import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Acompanamiento } from '../lib/acompanamientos'

/** ¿La fila va en la bandeja de este operador? Pendientes de todos + las propias (no descartadas). */
function esRelevante(a: Acompanamiento, operadorId: string) {
  if (a.estado === 'DESCARTADA') return false
  return a.estado === 'PENDIENTE' || a.operador_id === operadorId
}

/**
 * Lado operador: bandeja de acompañamientos en vivo.
 *  · Lista las solicitudes PENDIENTE (de todos) y las que este operador tomó.
 *  · Realtime sobre la tabla: las nuevas aparecen solas y desaparecen al
 *    cancelarse o cuando otro operador las acepta.
 *  · aceptar() asigna el operador solo si sigue PENDIENTE (gana el primero).
 */
export function useAcompanamientosOperador(operadorId: string | undefined) {
  const [lista, setLista] = useState<Acompanamiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listaRef = useRef(lista)
  useEffect(() => {
    listaRef.current = lista
  }, [lista])

  const cargar = useCallback(async () => {
    if (!operadorId) return
    const { data, error } = await supabase
      .from('acompanamientos')
      .select('*')
      .or(`estado.eq.PENDIENTE,and(estado.eq.EN_CURSO,operador_id.eq.${operadorId})`)
      .order('creado_en', { ascending: true })
    if (error) {
      console.error('[bandeja] no se pudo cargar:', error.code, error.message)
      setError('No pudimos cargar los acompañamientos.')
    } else {
      setError(null)
      setLista((data ?? []) as Acompanamiento[])
    }
    setCargando(false)
  }, [operadorId])

  useEffect(() => {
    if (!operadorId) return
    void cargar()

    const canal = supabase
      .channel('acompanamientos-bandeja')
      // La fila trae todo lo que muestra la bandeja (nombre y coords incluidos).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acompanamientos' }, (payload) => {
        const nueva = payload.new as Acompanamiento
        if (nueva.estado !== 'PENDIENTE') return
        setLista((prev) => (prev.some((a) => a.id === nueva.id) ? prev : [...prev, nueva]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'acompanamientos' }, (payload) => {
        const fila = payload.new as Acompanamiento
        if (!esRelevante(fila, operadorId)) {
          // Cancelada o tomada por otro operador: sale de la bandeja.
          setLista((prev) => prev.filter((a) => a.id !== fila.id))
          return
        }
        // La posición la maneja useSeguimientoAcompanamiento: aquí solo estado.
        if (listaRef.current.some((a) => a.id === fila.id)) {
          setLista((prev) =>
            prev.map((a) => (a.id === fila.id ? { ...a, ...fila, lat_actual: a.lat_actual, lng_actual: a.lng_actual } : a)),
          )
        } else {
          setLista((prev) => (prev.some((a) => a.id === fila.id) ? prev : [...prev, fila]))
        }
      })
      .subscribe((status) => {
        // Reconexión: lo que pasó mientras no había canal se recupera releyendo.
        if (status === 'SUBSCRIBED') void cargar()
      })

    return () => {
      supabase.removeChannel(canal)
    }
  }, [operadorId, cargar])

  /** Toma la solicitud. Devuelve un mensaje de error o null. */
  const aceptar = useCallback(
    async (id: string): Promise<string | null> => {
      if (!operadorId) return 'Sesión no válida.'
      const { data, error } = await supabase
        .from('acompanamientos')
        .update({ estado: 'EN_CURSO', operador_id: operadorId })
        .eq('id', id)
        .eq('estado', 'PENDIENTE')
        .select('*')
      if (error) {
        console.error('[bandeja] no se pudo aceptar:', error.code, error.message)
        return 'No se pudo aceptar el monitoreo.'
      }
      if (!data || data.length === 0) {
        setLista((prev) => prev.filter((a) => a.id !== id))
        return 'Esta solicitud ya no está disponible (fue cancelada o la tomó otro operador).'
      }
      const fila = data[0] as Acompanamiento
      setLista((prev) => prev.map((a) => (a.id === id ? fila : a)))
      return null
    },
    [operadorId],
  )

  /** Cierra un acompañamiento propio en curso. Devuelve un mensaje de error o null. */
  const finalizar = useCallback(async (id: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('acompanamientos')
      .update({ estado: 'FINALIZADO' })
      .eq('id', id)
      .eq('estado', 'EN_CURSO')
      .select('*')
    if (error || !data || data.length === 0) {
      if (error) console.error('[bandeja] no se pudo finalizar:', error.code, error.message)
      return 'No se pudo finalizar el acompañamiento.'
    }
    const fila = data[0] as Acompanamiento
    setLista((prev) => prev.map((a) => (a.id === id ? { ...a, ...fila } : a)))
    return null
  }, [])

  /**
   * Descarta una solicitud (pendiente, o propia en curso) con su motivo.
   * Sale de la bandeja al tiro; a los demás operadores se les va por Realtime.
   * Devuelve un mensaje de error o null.
   */
  const descartar = useCallback(
    async (id: string, motivo: string): Promise<string | null> => {
      if (!operadorId) return 'Sesión no válida.'
      const { data, error } = await supabase
        .from('acompanamientos')
        .update({ estado: 'DESCARTADA', operador_id: operadorId, motivo_cierre: motivo })
        .eq('id', id)
        .in('estado', ['PENDIENTE', 'EN_CURSO'])
        .select('id')
      if (error) {
        console.error('[bandeja] no se pudo descartar:', error.code, error.message)
        return 'No se pudo descartar la solicitud.'
      }
      setLista((prev) => prev.filter((a) => a.id !== id))
      if (!data || data.length === 0) return 'Esta solicitud ya no estaba disponible.'
      return null
    },
    [operadorId],
  )

  /** Actualiza la posición de una fila (desde el canal de seguimiento). */
  const moverUsuario = useCallback((id: string, lat: number, lng: number) => {
    setLista((prev) => prev.map((a) => (a.id === id ? { ...a, lat_actual: lat, lng_actual: lng } : a)))
  }, [])

  return { lista, cargando, error, aceptar, finalizar, descartar, moverUsuario }
}

/**
 * Seguimiento GPS de UNA fila: canal Realtime filtrado por id que llama a
 * onPos con cada nueva lat_actual/lng_actual. Pasar null para no seguir nada.
 */
export function useSeguimientoAcompanamiento(id: string | null, onPos: (lat: number, lng: number) => void) {
  const onPosRef = useRef(onPos)
  useEffect(() => {
    onPosRef.current = onPos
  })

  useEffect(() => {
    if (!id) return
    const canal = supabase
      .channel(`acompanamiento-seguimiento-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'acompanamientos', filter: `id=eq.${id}` },
        (payload) => {
          const { lat_actual, lng_actual } = payload.new as Acompanamiento
          if (lat_actual != null && lng_actual != null) onPosRef.current(lat_actual, lng_actual)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [id])
}
