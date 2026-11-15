/**
 * Alertas SOS (botón de pánico): usuario → central vía Supabase Realtime.
 * Tabla public.alertas (tipo = 'sos') — ver supabase/migrations/20261114000000_alertas_sos.sql.
 */

export type EstadoAlerta = 'activa' | 'en_atencion' | 'resuelta' | 'cancelada' | 'falsa_alarma' | 'descartada'

export interface AlertaSOS {
  id: string
  usuario_id: string
  operador_id: string | null
  tipo: 'sos' | 'acompanamiento' | 'checkin'
  estado: EstadoAlerta
  /** Última posición conocida del usuario (se actualiza mientras está abierta). */
  lat: number | null
  lng: number | null
  /** Copiados desde perfil por un trigger al insertar (el operador no lee perfil). */
  usuario_nombre: string | null
  usuario_telefono: string | null
  /** Primer nombre del operador asignado (lo pone un trigger; el ciudadano no lee perfil ajeno). */
  operador_nombre: string | null
  creada_en: string
  atendida_en: string | null
  cerrada_en: string | null
  actualizado_en: string
  /** Solo 'descartada': por qué la descartó el operador (bitácora). */
  motivo_cierre: string | null
}

export const ESTADOS_SOS_ABIERTOS: EstadoAlerta[] = ['activa', 'en_atencion']

/** Mientras el SOS está abierto el GPS va más seguido que en un acompañamiento. */
export const INTERVALO_GPS_SOS_MS = 3000
