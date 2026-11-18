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
  /** llego: la persona terminó su ruta con "Llegué" (ya no hay ubicación, solo la hora). */
  estado: 'no_encontrado' | 'terminado' | 'llego' | 'activa' | 'en_atencion' | 'PENDIENTE' | 'EN_CURSO'
  tipo?: 'sos' | 'ruta'
  nombre?: string
  lat?: number | null
  lng?: number | null
  destino?: string | null
  destino_lat?: number | null
  destino_lng?: number | null
  actualizado_en?: string
  atendida?: boolean
  llego_en?: string
}

export async function verSeguimiento(token: string): Promise<VistaSeguimiento | null> {
  const { data, error } = await supabase.rpc('ver_seguimiento', { p_token: token })
  if (error) return null
  return data as VistaSeguimiento
}

/* ── Contactos que acompañan desde el link ── */

/** Quien acompaña desde el link: activo si su página siguió abierta en los últimos 90 s. */
export interface Acompanante {
  visitante: string
  nombre: string
  activo: boolean
  ultimo_toque_en: string | null
}

/** Acompañantes del SOS o la ruta abierta del usuario. null si falló la consulta. */
export async function misAcompanantes(objetivo: ObjetivoSeguimiento): Promise<Acompanante[] | null> {
  const { data, error } = await supabase.rpc('mis_acompanantes', {
    p_alerta_id: 'alertaId' in objetivo ? objetivo.alertaId : null,
    p_acompanamiento_id: 'acompanamientoId' in objetivo ? objetivo.acompanamientoId : null,
  })
  if (error || !Array.isArray(data)) return null
  return data as Acompanante[]
}

/**
 * Unirse, latido o "Aquí estoy" (toque) desde la página del link. true: quedó registrado;
 * false: el seguimiento ya terminó o está lleno; null: sin conexión.
 */
export async function acompanar(token: string, visitante: string, nombre: string, toque = false): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('acompanar_seguimiento', {
    p_token: token,
    p_visitante: visitante,
    p_nombre: nombre,
    p_toque: toque,
  })
  if (error) return null
  return data === true
}

const CLAVE_VISITANTE = 'cuidachile.visitante'
const CLAVE_NOMBRE = 'cuidachile.acompanante'

/** Identificador anónimo de este navegador para acompañar (no es una cuenta). */
export function idVisitante(): string {
  try {
    const guardado = localStorage.getItem(CLAVE_VISITANTE)
    if (guardado && /^[0-9a-f-]{36}$/i.test(guardado)) return guardado
    const nuevo = crypto.randomUUID()
    localStorage.setItem(CLAVE_VISITANTE, nuevo)
    return nuevo
  } catch {
    return crypto.randomUUID()
  }
}

export function leerNombreAcompanante(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? ''
  } catch {
    return ''
  }
}

export function guardarNombreAcompanante(nombre: string) {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre)
  } catch {
    /* sin almacenamiento: se vuelve a pedir */
  }
}

export const MENSAJE_LLEGADA = 'Llegué bien. Gracias por acompañarme. (CuidaChile)'

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
