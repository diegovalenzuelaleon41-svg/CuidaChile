import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ──────────────── Contexto del ciudadano ──────────────── */

/** Solo conteos: el operador no ve nombres ni teléfonos de los contactos. */
export interface ContextoCiudadano {
  alertas_previas: number
  ultima_alerta_previa: string | null
  contactos: number
}

/**
 * Historial y contactos del ciudadano que se está atendiendo (RPC
 * contexto_ciudadano). Se pide una vez por ciudadano y se guarda en memoria.
 */
export function useContextoCiudadano(usuarioId: string | null) {
  // Una consulta por ciudadano: los datos quedan guardados por id.
  const [porId, setPorId] = useState<Record<string, ContextoCiudadano | 'error'>>({})
  const pedidoRef = useRef(new Set<string>())

  useEffect(() => {
    if (!usuarioId || pedidoRef.current.has(usuarioId)) return
    pedidoRef.current.add(usuarioId)
    supabase.rpc('contexto_ciudadano', { p_usuario_id: usuarioId }).then(({ data, error }) => {
      if (error) {
        console.error('[contexto] no se pudo cargar:', error.code, error.message)
        pedidoRef.current.delete(usuarioId) // se reintenta la próxima vez que se seleccione
      }
      setPorId((prev) => ({ ...prev, [usuarioId]: error ? 'error' : (data as ContextoCiudadano) }))
    })
  }, [usuarioId])

  const valor = usuarioId ? porId[usuarioId] : undefined
  return {
    datos: valor && valor !== 'error' ? valor : null,
    cargando: !!usuarioId && valor === undefined,
    error: valor === 'error',
  }
}

/* ──────────────── Escalamiento a supervisor ──────────────── */

export type MotivoEscalamiento = 'violencia' | 'rehen' | 'falla_tecnica' | 'otro'

export const MOTIVOS_ESCALAMIENTO: { id: MotivoEscalamiento; texto: string }[] = [
  { id: 'violencia', texto: 'Violencia' },
  { id: 'rehen', texto: 'Rehén' },
  { id: 'falla_tecnica', texto: 'Falla técnica' },
  { id: 'otro', texto: 'Otro' },
]

export function textoMotivoEscalamiento(m: MotivoEscalamiento) {
  return MOTIVOS_ESCALAMIENTO.find((x) => x.id === m)?.texto ?? m
}

export interface Escalamiento {
  motivo: MotivoEscalamiento
  creado_en: string
}

/** Caso a escalar: una alerta SOS o un acompañamiento (Ruta Segura). */
export type CasoEscalable = { alertaId: string } | { acompanamientoId: string }

/**
 * Escalamientos (tabla alerta_escalamientos) de los casos en la bandeja,
 * indexados por id de alerta o acompañamiento. escalar() solo funciona si el
 * operador tiene el caso asignado (lo valida RLS).
 */
export function useEscalamientos(idsAlertas: string[], idsAcompanamientos: string[]) {
  const [porId, setPorId] = useState<Record<string, Escalamiento>>({})
  const claveAlertas = [...idsAlertas].sort().join(',')
  const claveAcomp = [...idsAcompanamientos].sort().join(',')

  useEffect(() => {
    const alertas = claveAlertas ? claveAlertas.split(',') : []
    const acomps = claveAcomp ? claveAcomp.split(',') : []
    if (alertas.length === 0 && acomps.length === 0) return
    let vivo = true
    const filtros = [
      alertas.length ? `alerta_id.in.(${alertas.join(',')})` : null,
      acomps.length ? `acompanamiento_id.in.(${acomps.join(',')})` : null,
    ].filter(Boolean)
    supabase
      .from('alerta_escalamientos')
      .select('alerta_id, acompanamiento_id, motivo, creado_en')
      .or(filtros.join(','))
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          console.error('[escalamiento] no se pudo cargar:', error.code, error.message)
          return
        }
        const nuevos: Record<string, Escalamiento> = {}
        for (const f of data ?? []) {
          const id = (f.alerta_id ?? f.acompanamiento_id) as string
          nuevos[id] = { motivo: f.motivo as MotivoEscalamiento, creado_en: f.creado_en as string }
        }
        setPorId((prev) => ({ ...prev, ...nuevos }))
      })
    return () => {
      vivo = false
    }
  }, [claveAlertas, claveAcomp])

  /** Registra el escalamiento. Devuelve un mensaje de error o null. */
  const escalar = useCallback(async (caso: CasoEscalable, motivo: MotivoEscalamiento): Promise<string | null> => {
    const fila = 'alertaId' in caso ? { alerta_id: caso.alertaId } : { acompanamiento_id: caso.acompanamientoId }
    const { data, error } = await supabase
      .from('alerta_escalamientos')
      .insert({ ...fila, motivo })
      .select('motivo, creado_en')
      .single()
    if (error) {
      console.error('[escalamiento] no se pudo registrar:', error.code, error.message)
      return error.code === '23505'
        ? 'Este caso ya fue escalado.'
        : 'No se pudo escalar: el caso debe estar tomado por ti y abierto.'
    }
    const id = 'alertaId' in caso ? caso.alertaId : caso.acompanamientoId
    setPorId((prev) => ({ ...prev, [id]: { motivo: data.motivo as MotivoEscalamiento, creado_en: data.creado_en as string } }))
    return null
  }, [])

  return { porId, escalar }
}
