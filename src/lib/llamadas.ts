/**
 * Llamadas de voz (VoIP) usuario ↔ operador sobre LiveKit.
 * Tabla public.call_sessions — ver supabase/migrations/20261115000000_llamadas_voip.sql.
 * El token lo firma la Edge Function livekit-token (el secreto nunca llega al navegador).
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type EstadoLlamada = 'pending' | 'connecting' | 'active' | 'ended' | 'failed' | 'cancelled'

export interface CallSession {
  id: string
  incident_id: string
  room_name: string
  user_id: string
  operator_id: string | null
  status: EstadoLlamada
  user_connected: boolean
  operator_connected: boolean
  end_reason: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  created_at: string
  updated_at: string
}

export const ESTADOS_LLAMADA_ABIERTOS: EstadoLlamada[] = ['pending', 'connecting', 'active']

export type RolLlamada = 'usuario' | 'operador'

/** Error con un mensaje listo para mostrar. */
export class ErrorLlamada extends Error {
  readonly codigo?: string
  constructor(message: string, codigo?: string) {
    super(message)
    this.codigo = codigo
  }
}

/** Pide un token de 10 min para la sala de esta llamada. Nunca se registra el token. */
export async function pedirTokenLlamada(callId: string): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('livekit-token', { body: { call_id: callId } })
  if (error) {
    let cuerpo: { error?: string; codigo?: string } = {}
    if (error instanceof FunctionsHttpError) {
      try {
        cuerpo = await error.context.json()
      } catch {
        /* sin cuerpo JSON */
      }
    }
    console.error('[llamada] no se obtuvo token:', cuerpo.codigo ?? error.name)
    throw new ErrorLlamada(
      cuerpo.codigo === 'sin_configurar'
        ? 'Las llamadas de voz aún no están habilitadas en la central.'
        : (cuerpo.error ?? 'No pudimos preparar la llamada. Revisa tu conexión.'),
      cuerpo.codigo,
    )
  }
  if (!data?.token || !data?.url) throw new ErrorLlamada('Respuesta inválida del servidor de llamadas.')
  return { token: data.token, url: data.url }
}

/** "01:07" */
export function formatoDuracion(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
