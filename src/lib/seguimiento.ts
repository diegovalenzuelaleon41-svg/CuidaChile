/**
 * Links de seguimiento: el usuario manda a sus contactos un link para ver en vivo su SOS o su ruta
 * acompañada, sin cuenta. Ver supabase/migrations/20261118000000_coaccion_seguimiento_calificacion.sql.
 *
 * Los mensajes salen desde el propio teléfono (WhatsApp o SMS con el texto listo): CuidaChile no
 * envía nada por su cuenta, así que no hay que prometer que "tus contactos ya fueron avisados".
 */
import { supabase } from './supabase'

export type ObjetivoSeguimiento = { alertaId: string } | { acompanamientoId: string }

/** URL pública del seguimiento, o null si no se pudo crear. */
export async function crearLinkSeguimiento(objetivo: ObjetivoSeguimiento): Promise<string | null> {
  const { data, error } = await supabase.rpc('crear_seguimiento', {
    p_alerta_id: 'alertaId' in objetivo ? objetivo.alertaId : null,
    p_acompanamiento_id: 'acompanamientoId' in objetivo ? objetivo.acompanamientoId : null,
  })
  if (error || typeof data !== 'string') {
    console.error('[seguimiento] no se pudo crear:', error?.code, error?.message)
    return null
  }
  return `${window.location.origin}/seguir/${data}`
}

/** Lo que devuelve ver_seguimiento() para la página pública. */
export interface VistaSeguimiento {
  estado: 'no_encontrado' | 'terminado' | 'activa' | 'en_atencion' | 'PENDIENTE' | 'EN_CURSO'
  tipo?: 'sos' | 'ruta'
  nombre?: string
  lat?: number | null
  lng?: number | null
  destino?: string | null
  destino_lat?: number | null
  destino_lng?: number | null
  actualizado_en?: string
  atendida?: boolean
}

export async function verSeguimiento(token: string): Promise<VistaSeguimiento | null> {
  const { data, error } = await supabase.rpc('ver_seguimiento', { p_token: token })
  if (error) return null
  return data as VistaSeguimiento
}

/**
 * Teléfono en formato internacional sin "+" para wa.me (Chile por defecto):
 * "9 1234 5678" → "56912345678". null si no parece un número.
 */
export function telefonoInternacional(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length < 8) return null
  if (digitos.startsWith('56')) return digitos
  if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`
  if (digitos.length === 8) return `569${digitos}`
  return digitos
}

export function mensajeSeguimiento(tipo: 'sos' | 'ruta', link: string) {
  return tipo === 'sos'
    ? `Activé una alerta SOS en CuidaChile. Puedes ver dónde estoy en vivo aquí: ${link}`
    : `Voy camino a casa con CuidaChile. Puedes seguir mi trayecto en vivo aquí: ${link}`
}

export function linkWhatsApp(telefono: string, texto: string) {
  const numero = telefonoInternacional(telefono)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
}

export function linkSMS(telefono: string, texto: string) {
  const numero = telefonoInternacional(telefono)
  // "?&body=" funciona en iOS y Android
  return numero ? `sms:+${numero}?&body=${encodeURIComponent(texto)}` : null
}
