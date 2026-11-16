/**
 * Acompañamientos en vivo (Ruta Segura): usuario ↔ operador vía Supabase Realtime.
 * Tabla public.acompanamientos — ver supabase/migrations/20261030000000_acompanamientos.sql
 * y 20261030010000_acompanamientos_datos_ruta.sql.
 */

export type EstadoAcompanamiento = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO' | 'DESCARTADA'

export interface Acompanamiento {
  id: string
  usuario_id: string
  operador_id: string | null
  ruta_id: string | null
  estado: EstadoAcompanamiento
  origen: string
  destino: string
  /** Copiados desde perfil por un trigger al insertar (el operador no lee perfil). */
  usuario_nombre: string | null
  usuario_telefono: string | null
  origen_lat: number | null
  origen_lng: number | null
  destino_lat: number | null
  destino_lng: number | null
  lat_actual: number | null
  lng_actual: number | null
  aceptado_en: string | null
  finalizado_en: string | null
  /** Solo DESCARTADA: por qué la descartó el operador (bitácora). */
  motivo_cierre: string | null
  creado_en: string
  actualizado_en: string
}

/** Mensaje del chat usuario ↔ operador (tabla public.mensajes): de una ruta o de un SOS. */
export interface MensajeChat {
  id: string
  acompanamiento_id: string | null
  alerta_id: string | null
  emisor_id: string | null
  emisor_rol: 'usuario' | 'operador' | 'sistema'
  contenido: string
  creado_en: string
}

/** Largo máximo de un mensaje (CHECK mensajes_contenido). */
export const MAX_MENSAJE = 2000

/** Cada cuánto el usuario envía su posición mientras el acompañamiento está EN_CURSO. */
export const INTERVALO_GPS_MS = 5000

/**
 * Aunque la persona no se mueva, se reenvía su posición cada 15 s: así el
 * operador distingue "está quieta" de "perdimos la señal" (SENAL_PERDIDA_MS).
 */
export const LATIDO_GPS_MS = 15_000

/** Sin noticias del teléfono por más de esto → el panel del operador marca "Señal perdida". */
export const SENAL_PERDIDA_MS = 45_000

export const ESTADOS_ABIERTOS: EstadoAcompanamiento[] = ['PENDIENTE', 'EN_CURSO']
