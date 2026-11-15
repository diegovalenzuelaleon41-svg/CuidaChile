import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CallSession } from '../lib/llamadas'

/**
 * La sesión de llamada más reciente de una alerta SOS, en vivo (Realtime).
 * Sirve a los dos lados: RLS ya limita qué filas ve cada uno. Realtime solo
 * avisa; cualquier acción se vuelve a validar en la base de datos.
 */
export function useSesionLlamada(alertaId: string | null) {
  const [sesion, setSesion] = useState<CallSession | null>(null)

  const cargar = useCallback(async () => {
    if (!alertaId) return
    const { data, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('incident_id', alertaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) console.error('[llamada] no se pudo cargar la sesión:', error.code, error.message)
    else setSesion((data as CallSession | null) ?? null)
  }, [alertaId])

  useEffect(() => {
    if (!alertaId) {
      setSesion(null)
      return
    }
    void cargar()
    const canal = supabase
      .channel(`call-sessions-${alertaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_sessions', filter: `incident_id=eq.${alertaId}` },
        (payload) => {
          const fila = payload.new as CallSession
          if (!fila?.id) return
          // Solo avanza: una fila más antigua (evento atrasado) no pisa a la actual.
          setSesion((prev) =>
            !prev || prev.id === fila.id || fila.created_at >= prev.created_at ? fila : prev,
          )
        },
      )
      .subscribe((status) => {
        // Reconexión: lo que pasó mientras no había canal se recupera releyendo.
        if (status === 'SUBSCRIBED') void cargar()
      })
    return () => {
      supabase.removeChannel(canal)
    }
  }, [alertaId, cargar])

  return { sesion, recargar: cargar }
}
