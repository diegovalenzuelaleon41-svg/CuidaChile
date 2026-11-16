/**
 * PIN de seguridad del usuario (4 dígitos). El hash nunca llega al cliente:
 * todo pasa por las RPC de supabase/migrations/20261115030000_pin_seguridad.sql.
 */
import { supabase } from './supabase'

export const LARGO_PIN = 4

export function esPinValido(pin: string) {
  return /^[0-9]{4}$/.test(pin)
}

/** Lo que devuelven las RPC que verifican el PIN. */
export interface VerificacionPin {
  resultado: 'ok' | 'incorrecto' | 'bloqueado' | 'sin_pin' | 'cancelada' | 'ya_cerrada'
  intentos_restantes?: number
  bloqueado_hasta?: string
}

/** Mensaje para un PIN rechazado (incorrecto o bloqueado), o null si no hubo rechazo. */
export function mensajeRechazoPin(v: VerificacionPin, contexto: 'sos' | 'perfil'): string | null {
  if (v.resultado === 'bloqueado') {
    const min = v.bloqueado_hasta
      ? Math.max(1, Math.ceil((new Date(v.bloqueado_hasta).getTime() - Date.now()) / 60000))
      : 15
    return contexto === 'sos'
      ? `Demasiados intentos. Podrás reintentar en ${min} min. La alerta sigue activa.`
      : `Demasiados intentos. Podrás reintentar en ${min} min.`
  }
  if (v.resultado === 'incorrecto') {
    const quedan =
      v.intentos_restantes != null && v.intentos_restantes <= 2
        ? ` Te ${v.intentos_restantes === 1 ? 'queda 1 intento' : `quedan ${v.intentos_restantes} intentos`}.`
        : ''
    return contexto === 'sos'
      ? `PIN incorrecto. Si es una emergencia real, la ayuda ya está en camino.${quedan}`
      : `El PIN actual es incorrecto.${quedan}`
  }
  return null
}

/** null = no se pudo consultar (se reintenta en la próxima carga). */
export async function consultarTienePin(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('tiene_pin')
  if (error) {
    console.error('[pin] no se pudo consultar:', error.code, error.message)
    return null
  }
  return data === true
}

/** Devuelve un mensaje de error o null. */
export async function crearPin(pin: string): Promise<string | null> {
  const { error } = await supabase.rpc('crear_pin', { p_pin: pin })
  if (!error) return null
  console.error('[pin] no se pudo crear:', error.code, error.message)
  return error.message || 'No se pudo guardar el PIN.'
}

export async function cambiarPin(actual: string, nuevo: string): Promise<VerificacionPin | string> {
  const { data, error } = await supabase.rpc('cambiar_pin', { p_actual: actual, p_nuevo: nuevo })
  if (error) {
    console.error('[pin] no se pudo cambiar:', error.code, error.message)
    return error.message || 'No se pudo actualizar el PIN.'
  }
  return data as VerificacionPin
}

/** Requiere haber iniciado sesión hace menos de 10 minutos (lo valida el servidor). */
export async function restablecerPin(nuevo: string): Promise<{ error: string | null; reautenticar: boolean }> {
  const { error } = await supabase.rpc('restablecer_pin', { p_nuevo: nuevo })
  if (!error) return { error: null, reautenticar: false }
  console.error('[pin] no se pudo restablecer:', error.code, error.message)
  return { error: error.message || 'No se pudo restablecer el PIN.', reautenticar: error.hint === 'reautenticar' }
}

/**
 * Tras volver de Google para restablecer el PIN, /auth/callback redirige
 * normal a /usuario; esta marca le dice que abra el formulario.
 */
const CLAVE_RESTABLECER = 'cuidachile.pin_restablecer'

export function marcarRestablecerPin() {
  try {
    sessionStorage.setItem(CLAVE_RESTABLECER, String(Date.now()))
  } catch {
    /* sin storage: el usuario vuelve a abrir el formulario a mano */
  }
}

/** Lee y borra la marca (vale 10 minutos, igual que el servidor). */
export function tomarMarcaRestablecerPin(): boolean {
  try {
    const v = sessionStorage.getItem(CLAVE_RESTABLECER)
    sessionStorage.removeItem(CLAVE_RESTABLECER)
    return !!v && Date.now() - Number(v) < 10 * 60 * 1000
  } catch {
    return false
  }
}
