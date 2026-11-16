import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReporteOperador } from '../lib/reportes'

/**
 * Bandeja Barrial del operador: reportes 'pendiente' vigentes, en vivo.
 * Validar o descartar pasa por revisar_reportes() (atómico: si otro
 * operador se adelantó, no cambia nada y la fila sale de la bandeja igual).
 */
export function useReportesOperador(operadorId: string | undefined) {
  const [lista, setLista] = useState<ReporteOperador[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('reportes')
      .select('id,usuario_id,usuario_nombre,es_anonimo,lat,lng,categoria,gravedad,descripcion,evidencia_url,audio_url,estado,creado_en')
      .eq('estado', 'pendiente')
      .gt('expira_en', new Date().toISOString())
      .order('creado_en', { ascending: false })
      .limit(200)
    setCargando(false)
    if (err) {
      console.error('[reportes] no se pudieron cargar:', err.code, err.message)
      setError('No se pudieron cargar los reportes barriales.')
      return
    }
    setError(null)
    setLista((data ?? []) as ReporteOperador[])
  }, [])

  useEffect(() => {
    if (!operadorId) return
    void recargar()
    const canal = supabase
      .channel('reportes-operador')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => void recargar())
      .subscribe()
    // Los pendientes vencen a las 6 h sin evento: se refresca cada minuto.
    const t = setInterval(() => void recargar(), 60_000)
    return () => {
      clearInterval(t)
      supabase.removeChannel(canal)
    }
  }, [operadorId, recargar])

  /** Valida o descarta varios reportes. Devuelve un mensaje de error o null. */
  const revisar = useCallback(
    async (ids: string[], estado: 'validado' | 'descartado', motivo?: string): Promise<string | null> => {
      const { data, error: err } = await supabase.rpc('revisar_reportes', {
        p_ids: ids,
        p_estado: estado,
        p_motivo: motivo ?? null,
      })
      // Sale de la bandeja de inmediato (Realtime lo confirma después).
      setLista((prev) => prev.filter((r) => !ids.includes(r.id)))
      if (err) {
        console.error('[reportes] no se pudo revisar:', err.code, err.message)
        void recargar()
        return 'No se pudo actualizar el reporte.'
      }
      if (data === 0) return 'Otro operador ya revisó este reporte.'
      return null
    },
    [recargar],
  )

  return { lista, cargando, error, revisar }
}
