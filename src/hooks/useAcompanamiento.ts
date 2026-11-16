import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ESTADOS_ABIERTOS, INTERVALO_GPS_MS, LATIDO_GPS_MS, type Acompanamiento } from '../lib/acompanamientos'

interface Solicitud {
  origen: string
  destino: string
  rutaId: string | null
  /** Posición GPS actual al solicitar. */
  lat: number | null
  lng: number | null
  /** Extremos de la ruta: el operador dibuja la línea con ellos. */
  origenLat: number | null
  origenLng: number | null
  destinoLat: number | null
  destinoLng: number | null
}

/**
 * Lado usuario del acompañamiento en vivo:
 *  · solicitar() crea la fila PENDIENTE ("Buscando operador…").
 *  · Realtime sobre su propia fila: detecta cuando un operador la acepta
 *    (EN_CURSO) o la finaliza.
 *  · Mientras está EN_CURSO envía lat_actual/lng_actual cada 5 s.
 *
 * obtenerPos devuelve [lng, lat] del GPS real, o null si no hay fix
 * (nunca se envían coordenadas por defecto).
 */
export function useAcompanamiento(usuarioId: string | undefined, obtenerPos: () => [number, number] | null) {
  const [acomp, setAcomp] = useState<Acompanamiento | null>(null)
  const obtenerPosRef = useRef(obtenerPos)
  useEffect(() => {
    obtenerPosRef.current = obtenerPos
  })

  const id = acomp?.id
  const estado = acomp?.estado

  /** Aplica una fila recibida solo si sigue siendo el acompañamiento actual. */
  const aplicarFila = useCallback((fila: Acompanamiento) => {
    setAcomp((prev) => (prev && prev.id === fila.id ? fila : prev))
  }, [])

  // ── Al entrar: retomar un acompañamiento abierto (recarga de página) ──
  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false
    supabase
      .from('acompanamientos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .in('estado', ESTADOS_ABIERTOS)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[acompañamiento] no se pudo cargar:', error.code, error.message)
        if (!cancelado && data) setAcomp(data as Acompanamiento)
      })
    return () => {
      cancelado = true
    }
  }, [usuarioId])

  // ── Realtime sobre la propia fila ──
  useEffect(() => {
    if (!id) return
    const canal = supabase
      .channel(`acompanamiento-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'acompanamientos', filter: `id=eq.${id}` },
        (payload) => aplicarFila(payload.new as Acompanamiento),
      )
      .subscribe((status) => {
        // Un operador pudo aceptar entre el INSERT y la suscripción: releer una vez.
        if (status !== 'SUBSCRIBED') return
        supabase
          .from('acompanamientos')
          .select('*')
          .eq('id', id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) aplicarFila(data as Acompanamiento)
          })
      })
    return () => {
      supabase.removeChannel(canal)
    }
  }, [id, aplicarFila])

  // ── Tracking GPS cada 5 s mientras está EN_CURSO ──
  useEffect(() => {
    if (!id || estado !== 'EN_CURSO') return
    let ultimo: string | null = null
    let enviadoEn = 0
    async function enviar() {
      const p = obtenerPosRef.current()
      if (!p) return
      const [lng, lat] = p
      const clave = `${lat.toFixed(6)},${lng.toFixed(6)}`
      // Sin movimiento no se gasta una escritura… salvo el latido (ver LATIDO_GPS_MS).
      if (clave === ultimo && Date.now() - enviadoEn < LATIDO_GPS_MS) return
      const { error } = await supabase
        .from('acompanamientos')
        .update({ lat_actual: lat, lng_actual: lng })
        .eq('id', id)
      if (error) console.error('[acompañamiento] no se pudo enviar ubicación:', error.code, error.message)
      else {
        ultimo = clave
        enviadoEn = Date.now()
      }
    }
    void enviar()
    const t = setInterval(enviar, INTERVALO_GPS_MS)
    return () => clearInterval(t)
  }, [id, estado])

  /** Crea la solicitud PENDIENTE. Devuelve un mensaje de error o null. */
  const solicitar = useCallback(
    async (s: Solicitud): Promise<string | null> => {
      if (!usuarioId) return 'Debes iniciar sesión.'
      const { data, error } = await supabase
        .from('acompanamientos')
        .insert({
          usuario_id: usuarioId,
          ruta_id: s.rutaId,
          origen: s.origen,
          destino: s.destino,
          lat_actual: s.lat,
          lng_actual: s.lng,
          origen_lat: s.origenLat,
          origen_lng: s.origenLng,
          destino_lat: s.destinoLat,
          destino_lng: s.destinoLng,
        })
        .select('*')
        .single()
      if (error) {
        console.error('[acompañamiento] no se pudo solicitar:', error.code, error.message)
        return error.code === '23505'
          ? 'Ya tienes una ruta segura en curso.'
          : 'No pudimos contactar a la central. Revisa tu conexión e intenta de nuevo.'
      }
      setAcomp(data as Acompanamiento)
      return null
    },
    [usuarioId],
  )

  /**
   * Cancela mientras sigue PENDIENTE. Devuelve false si un operador la
   * aceptó justo antes (la fila se relee y la UI pasa a "conectado").
   */
  const cancelar = useCallback(async (): Promise<boolean> => {
    if (!id) return true
    const { data, error } = await supabase
      .from('acompanamientos')
      .update({ estado: 'CANCELADO' })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id')
    if (!error && data && data.length > 0) {
      setAcomp(null)
      return true
    }
    const { data: actual } = await supabase.from('acompanamientos').select('*').eq('id', id).maybeSingle()
    if (actual) aplicarFila(actual as Acompanamiento)
    return false
  }, [id, aplicarFila])

  /** El usuario termina la ruta. Se limpia antes del UPDATE para no reaccionar a su propio evento. */
  const finalizar = useCallback(async () => {
    if (!id || estado !== 'EN_CURSO') return
    setAcomp(null)
    const { error } = await supabase.from('acompanamientos').update({ estado: 'FINALIZADO' }).eq('id', id)
    if (error) console.error('[acompañamiento] no se pudo finalizar:', error.code, error.message)
  }, [id, estado])

  /** Olvida el acompañamiento local (p. ej. tras procesar un FINALIZADO del operador). */
  const limpiar = useCallback(() => setAcomp(null), [])

  return { acomp, solicitar, cancelar, finalizar, limpiar }
}
