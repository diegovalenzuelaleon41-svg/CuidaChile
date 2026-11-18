import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ESTADOS_SOS_ABIERTOS, INTERVALO_GPS_SOS_MS, type AlertaSOS } from '../lib/alertas'
import { LATIDO_GPS_MS } from '../lib/acompanamientos'
import { mensajeRechazoPin, type VerificacionPin } from '../lib/pin'

/**
 * Lado usuario del botón SOS:
 *  · activar() crea la alerta 'activa' (un toque, sin confirmación). Si ya
 *    hay una abierta, la reutiliza (índice único en la tabla).
 *  · Realtime sobre su propia fila: detecta cuando un operador la atiende,
 *    la resuelve o la descarta.
 *  · Mientras está abierta envía lat/lng cada 3 s.
 *  · Cancelada con el PIN de coacción, la pantalla vuelve a la normalidad
 *    pero el teléfono sigue enviando su ubicación en silencio
 *    (ubicacion_silenciosa) hasta que la central cierra la alerta.
 *
 * obtenerPos devuelve [lng, lat] del GPS real, o null si no hay fix
 * (nunca se envían coordenadas por defecto).
 */
/** Alerta de coacción en curso: sobrevive a una recarga. Nombre neutro a propósito. */
const CLAVE_SILENCIOSA = 'cuidachile.sync'

function leerSilenciosa(): string | null {
  try {
    return localStorage.getItem(CLAVE_SILENCIOSA)
  } catch {
    return null
  }
}

function guardarSilenciosa(id: string | null) {
  try {
    if (id) localStorage.setItem(CLAVE_SILENCIOSA, id)
    else localStorage.removeItem(CLAVE_SILENCIOSA)
  } catch {
    /* sin almacenamiento: sigue mientras la página esté abierta */
  }
}

export function useSOS(usuarioId: string | undefined, obtenerPos: () => [number, number] | null) {
  const [alerta, setAlerta] = useState<AlertaSOS | null>(null)
  const [enviando, setEnviando] = useState(false)
  const obtenerPosRef = useRef(obtenerPos)
  useEffect(() => {
    obtenerPosRef.current = obtenerPos
  })

  const [silenciosa, setSilenciosa] = useState<string | null>(leerSilenciosa)
  const id = alerta?.id
  const abierta = !!alerta && ESTADOS_SOS_ABIERTOS.includes(alerta.estado)

  /** Aplica una fila recibida solo si sigue siendo la alerta actual. */
  const aplicarFila = useCallback((fila: AlertaSOS) => {
    setAlerta((prev) => (prev && prev.id === fila.id ? fila : prev))
  }, [])

  const buscarAbierta = useCallback(async () => {
    if (!usuarioId) return null
    const { data, error } = await supabase
      .from('alertas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'sos')
      .in('estado', ESTADOS_SOS_ABIERTOS)
      .order('creada_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) console.error('[sos] no se pudo cargar:', error.code, error.message)
    return (data as AlertaSOS | null) ?? null
  }, [usuarioId])

  // ── Al entrar: retomar un SOS abierto (recarga de página) ──
  useEffect(() => {
    let cancelado = false
    void buscarAbierta().then((fila) => {
      if (!cancelado && fila) setAlerta(fila)
    })
    return () => {
      cancelado = true
    }
  }, [buscarAbierta])

  // ── Realtime sobre la propia fila ──
  useEffect(() => {
    if (!id) return
    const canal = supabase
      .channel(`sos-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alertas', filter: `id=eq.${id}` },
        (payload) => aplicarFila(payload.new as AlertaSOS),
      )
      .subscribe((status) => {
        // Un operador pudo atender entre el INSERT y la suscripción: releer una vez.
        if (status !== 'SUBSCRIBED') return
        supabase
          .from('alertas')
          .select('*')
          .eq('id', id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) aplicarFila(data as AlertaSOS)
          })
      })
    return () => {
      supabase.removeChannel(canal)
    }
  }, [id, aplicarFila])

  // ── Tracking GPS mientras la alerta está abierta ──
  useEffect(() => {
    if (!id || !abierta) return
    let ultimo: string | null = null
    let enviadoEn = 0
    async function enviar() {
      const p = obtenerPosRef.current()
      if (!p) return
      const [lng, lat] = p
      const clave = `${lat.toFixed(6)},${lng.toFixed(6)}`
      // Sin movimiento no se gasta una escritura… salvo el latido: si no, el
      // operador no distinguiría a alguien quieto de una señal perdida.
      if (clave === ultimo && Date.now() - enviadoEn < LATIDO_GPS_MS) return
      const { error } = await supabase.from('alertas').update({ lat, lng }).eq('id', id)
      if (error) console.error('[sos] no se pudo enviar ubicación:', error.code, error.message)
      else {
        ultimo = clave
        enviadoEn = Date.now()
      }
    }
    void enviar()
    const t = setInterval(enviar, INTERVALO_GPS_SOS_MS)
    return () => clearInterval(t)
  }, [id, abierta])

  // ── Coacción: ubicación en silencio hasta que la central cierre la alerta ──
  useEffect(() => {
    if (!silenciosa) return
    let detenido = false
    async function enviar() {
      const p = obtenerPosRef.current()
      if (!p || detenido) return
      const { data, error } = await supabase.rpc('ubicacion_silenciosa', {
        p_alerta_id: silenciosa,
        p_lat: p[1],
        p_lng: p[0],
      })
      // false = la central ya la cerró (o no existe): se deja de enviar.
      if (!error && data === false && !detenido) {
        detenido = true
        guardarSilenciosa(null)
        setSilenciosa(null)
      }
    }
    void enviar()
    const t = setInterval(enviar, INTERVALO_GPS_SOS_MS)
    return () => {
      detenido = true
      clearInterval(t)
    }
  }, [silenciosa])

  /** Envía el SOS. Devuelve un mensaje de error o null. */
  const activar = useCallback(async (): Promise<string | null> => {
    if (!usuarioId) return 'Debes iniciar sesión.'
    setEnviando(true)
    const p = obtenerPosRef.current()
    const { data, error } = await supabase
      .from('alertas')
      .insert({ usuario_id: usuarioId, tipo: 'sos', lat: p?.[1] ?? null, lng: p?.[0] ?? null })
      .select('*')
      .single()
    if (!error) {
      setAlerta(data as AlertaSOS)
      setEnviando(false)
      return null
    }
    // Ya había una abierta (doble toque, otra pestaña): seguir con esa.
    if (error.code === '23505') {
      const fila = await buscarAbierta()
      setEnviando(false)
      if (fila) {
        setAlerta(fila)
        return null
      }
    }
    setEnviando(false)
    console.error('[sos] no se pudo enviar:', error.code, error.message)
    return 'No pudimos enviar tu alerta a la central.'
  }, [usuarioId, buscarAbierta])

  /**
   * El usuario cancela su alerta (activa o en atención) con su PIN: el
   * servidor lo verifica y solo cancelar_sos() puede pasarla a 'cancelada'.
   * Devuelve un mensaje de error (PIN incorrecto, bloqueo, red) o null.
   */
  const cancelar = useCallback(async (pin: string): Promise<string | null> => {
    if (!id) return null
    const { data, error } = await supabase.rpc('cancelar_sos', { p_alerta_id: id, p_pin: pin })
    if (error) {
      console.error('[sos] no se pudo cancelar:', error.code, error.message)
      return 'No se pudo cancelar la alerta. Revisa tu conexión.'
    }
    const res = data as VerificacionPin
    const rechazo = mensajeRechazoPin(res, 'sos')
    if (rechazo) return rechazo
    if (res.resultado === 'cancelada') {
      if (res.seguir) {
        guardarSilenciosa(id)
        setSilenciosa(id)
      }
      setAlerta(null)
    }
    else {
      // Ya la cerró un operador: mostrar el estado real.
      const { data: actual } = await supabase.from('alertas').select('*').eq('id', id).maybeSingle()
      if (actual) aplicarFila(actual as AlertaSOS)
    }
    return null
  }, [id, aplicarFila])

  /** Olvida la alerta local (p. ej. tras mostrar que el operador la cerró). */
  const limpiar = useCallback(() => setAlerta(null), [])

  return { alerta, abierta, enviando, activar, cancelar, limpiar }
}
