/**
 * Tipos de las tarjetas del Dashboard del Operador. SOS (alertas),
 * acompañamientos y reportes barriales son reales: se convierten a Alerta en el panel.
 */

export type AlertaTipo = 'SOS' | 'BARRIAL' | 'ACOMPANAMIENTO'

/** Colores neón por tipo: contrastan con el fondo casi negro del mapa dark-matter. */
export const COLOR_NEON: Record<AlertaTipo, string> = {
  SOS: '#EF4444',
  BARRIAL: '#F59E0B',
  ACOMPANAMIENTO: '#3B82F6',
}

export type AlertaEstado = 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTA' | 'DESCARTADA'

/** Motivos para descartar una alerta (quedan en la bitácora). */
export const MOTIVOS_DESCARTE = ['Falsa alarma', 'Duplicada', 'Fuera de zona', 'Otro'] as const

export interface Alerta {
  id: string
  tipo: AlertaTipo
  nombre: string
  telefono: string
  hora: string
  lat: number
  lng: number
  /** Solo BARRIAL: descripción corta del hecho. */
  descripcion?: string
  /** Solo ACOMPANAMIENTO: ruta del ciudadano. */
  ruta?: string
  /** Acompañamiento real aún sin GPS: lat/lng son un valor por defecto y no se dibuja pin. */
  sinUbicacion?: boolean
  /** Acompañamiento sin GPS en vivo todavía: lat/lng son el punto de partida de su ruta. */
  soloOrigen?: boolean
  /** Última actualización (ISO) — acompañamientos reales. */
  actualizadoEn?: string
  /** Acompañamientos reales: cuándo se solicitó y cuándo se aceptó (ISO). */
  creadoEn?: string
  aceptadoEn?: string
  /** Acompañamientos reales: extremos de la ruta, [lng, lat]. */
  rutaCoords?: { origen: [number, number]; destino: [number, number] }
  estado: AlertaEstado
  /** Casos reales: el ciudadano (para su contexto: historial y contactos). */
  usuarioId?: string
  /** Escalada a supervisor: motivo legible y cuándo (ISO). */
  escalada?: { motivo: string; en: string }
  /**
   * Solo BARRIAL: la tarjeta representa a todos los reportes pendientes a
   * ≤ 200 m (el más reciente es la tarjeta). Validar/descartar actúa sobre el grupo.
   */
  barrial?: {
    categoria: string
    anonimo: boolean
    /** Ids de todos los reportes del grupo (incluido este). */
    ids: string[]
    /** Rutas en el bucket de evidencias, de todo el grupo. */
    fotos: string[]
    audios: string[]
    /** Descripciones de los otros reportes del grupo. */
    otras: { hora: string; descripcion: string | null; categoria: string }[]
  }
  /** Entradas de la bitácora (timeline) asociadas a esta alerta. */
  timeline: string[]
}

/** Filtra las alertas por tipo de pestaña. */
export function filtrarPorTipo(alertas: Alerta[], tipo: AlertaTipo | 'TODAS') {
  if (tipo === 'TODAS') return alertas
  return alertas.filter((a) => a.tipo === tipo)
}

/** Genera la hora actual en formato HH:MM. */
export function ahoraHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
