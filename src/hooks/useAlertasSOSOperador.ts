import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AlertaSOS } from '../lib/alertas'

/** ¿La fila va en la bandeja de este operador? Activas de todos + las que atiende (o resolvió) él. */
function esRelevante(a: AlertaSOS, operadorId: string) {
  if (a.tipo !== 'sos') return false
  if (a.estado === 'activa') return true
  return a.operador_id === operadorId && (a.estado === 'en_atencion' || a.estado === 'resuelta')
}

interface Avisos {
  /** Llegó un SOS nuevo (para el sonido). */
  onNueva?: (a: AlertaSOS) => void
  /** El ciudadano canceló una alerta que estaba en la bandeja. */
  onCancelada?: (a: AlertaSOS) => void
}

/**
 * Lado operador: bandeja de SOS en vivo.
 *  · Lista las alertas activas (de todos) y las que este operador atiende.
 *  · Realtime sobre la tabla: las nuevas aparecen solas (onNueva avisa para
 *    el sonido) y desaparecen al cancelarse o cuando otro operador las toma.
 *    Las resueltas por este operador quedan hasta recargar (bitácora).
 *  · La posición viene en la misma fila: cada UPDATE trae lat/lng nuevos.
 *  · atender() asigna el operador solo si sigue activa (gana el primero).
 */
export function useAlertasSOSOperador(operadorId: string | undefined, avisos: Avisos = {}) {
  const [lista, setLista] = useState<AlertaSOS[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listaRef = useRef(lista)
  useEffect(() => {
    listaRef.current = lista
  }, [lista])
  const avisosRef = useRef(avisos)
  useEffect(() => {
    avisosRef.current = avisos
  })

  const cargar = useCallback(async () => {
    if (!operadorId) return
    const { data, error } = await supabase
      .from('alertas')
      .select('*')
      .eq('tipo', 'sos')
      .or(`estado.eq.activa,and(estado.eq.en_atencion,operador_id.eq.${operadorId})`)
      .order('creada_en', { ascending: true })
    if (error) {
      console.error('[sos] no se pudo cargar:', error.code, error.message)
      setError('No pudimos cargar las alertas SOS.')
    } else {
      setError(null)
      setLista((data ?? []) as AlertaSOS[])
    }
    setCargando(false)
  }, [operadorId])

  useEffect(() => {
    if (!operadorId) return
    void cargar()

    const canal = supabase
      .channel('alertas-sos-bandeja')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, (payload) => {
        const nueva = payload.new as AlertaSOS
        if (!esRelevante(nueva, operadorId)) return
        setLista((prev) => (prev.some((a) => a.id === nueva.id) ? prev : [...prev, nueva]))
        avisosRef.current.onNueva?.(nueva)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas' }, (payload) => {
        const fila = payload.new as AlertaSOS
        if (!esRelevante(fila, operadorId)) {
          // Cancelada, cerrada o tomada por otro operador: sale de la bandeja.
          if (fila.estado === 'cancelada' && listaRef.current.some((a) => a.id === fila.id)) {
            avisosRef.current.onCancelada?.(fila)
          }
          setLista((prev) => prev.filter((a) => a.id !== fila.id))
          return
        }
        setLista((prev) =>
          prev.some((a) => a.id === fila.id) ? prev.map((a) => (a.id === fila.id ? fila : a)) : [...prev, fila],
        )
      })
      .subscribe((status) => {
        // Reconexión: lo que pasó mientras no había canal se recupera releyendo.
        if (status === 'SUBSCRIBED') void cargar()
      })

    return () => {
      supabase.removeChannel(canal)
    }
  }, [operadorId, cargar])

  /** Toma la alerta. Devuelve un mensaje de error o null. */
  const atender = useCallback(
    async (id: string): Promise<string | null> => {
      if (!operadorId) return 'Sesión no válida.'
      const { data, error } = await supabase
        .from('alertas')
        .update({ estado: 'en_atencion', operador_id: operadorId })
        .eq('id', id)
        .eq('estado', 'activa')
        .select('*')
      if (error) {
        console.error('[sos] no se pudo atender:', error.code, error.message)
        return 'No se pudo atender la alerta.'
      }
      if (!data || data.length === 0) {
        setLista((prev) => prev.filter((a) => a.id !== id))
        return 'Esta alerta ya no está disponible (fue cancelada o la tomó otro operador).'
      }
      const fila = data[0] as AlertaSOS
      setLista((prev) => prev.map((a) => (a.id === id ? fila : a)))
      return null
    },
    [operadorId],
  )

  /** Cierra una alerta propia en atención. Devuelve un mensaje de error o null. */
  const resolver = useCallback(async (id: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('alertas')
      .update({ estado: 'resuelta' })
      .eq('id', id)
      .eq('estado', 'en_atencion')
      .select('*')
    if (error || !data || data.length === 0) {
      if (error) console.error('[sos] no se pudo resolver:', error.code, error.message)
      return 'No se pudo cerrar la alerta.'
    }
    const fila = data[0] as AlertaSOS
    setLista((prev) => prev.map((a) => (a.id === id ? fila : a)))
    return null
  }, [])

  /** Descarta una alerta (activa, o propia en atención) con su motivo. Devuelve un mensaje de error o null. */
  const descartar = useCallback(
    async (id: string, motivo: string): Promise<string | null> => {
      if (!operadorId) return 'Sesión no válida.'
      const { data, error } = await supabase
        .from('alertas')
        .update({ estado: 'descartada', operador_id: operadorId, motivo_cierre: motivo })
        .eq('id', id)
        .in('estado', ['activa', 'en_atencion'])
        .select('id')
      if (error) {
        console.error('[sos] no se pudo descartar:', error.code, error.message)
        return 'No se pudo descartar la alerta.'
      }
      setLista((prev) => prev.filter((a) => a.id !== id))
      if (!data || data.length === 0) return 'Esta alerta ya no estaba disponible.'
      return null
    },
    [operadorId],
  )

  return { lista, cargando, error, atender, resolver, descartar, recargar: cargar }
}
