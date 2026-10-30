/**
 * Mock de alertas para el Dashboard del Operador (Fase 2).
 * Datos locales, sin backend ni Supabase Realtime.
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
  /** Última actualización (ISO) — acompañamientos reales. */
  actualizadoEn?: string
  /** Acompañamientos reales: cuándo se solicitó y cuándo se aceptó (ISO). */
  creadoEn?: string
  aceptadoEn?: string
  /** Acompañamientos reales: extremos de la ruta, [lng, lat]. */
  rutaCoords?: { origen: [number, number]; destino: [number, number] }
  estado: AlertaEstado
  /** Entradas de la bitácora (timeline) asociadas a esta alerta. */
  timeline: string[]
}

export const MOCK_ALERTAS: Alerta[] = [
  {
    id: 'a1',
    tipo: 'SOS',
    nombre: 'María González',
    telefono: '+56 9 1234 5678',
    hora: '10:14',
    lat: -33.4489,
    lng: -70.6693,
    estado: 'PENDIENTE',
    timeline: [
      '10:14 - Alerta SOS recibida',
      '10:14 - Notificación enviada al operador',
    ],
  },
  {
    id: 'a2',
    tipo: 'SOS',
    nombre: 'Carlos Ramírez',
    telefono: '+56 9 8765 4321',
    hora: '09:52',
    lat: -33.4505,
    lng: -70.6612,
    estado: 'PENDIENTE',
    timeline: [
      '09:52 - Alerta SOS recibida',
    ],
  },
  {
    id: 'a3',
    tipo: 'BARRIAL',
    nombre: 'Vecino Barrio Italia',
    telefono: '+56 9 2222 3333',
    hora: '10:05',
    lat: -33.4450,
    lng: -70.6650,
    descripcion: '3 personas merodeando cerca de la plaza',
    estado: 'PENDIENTE',
    timeline: [
      '10:05 - Alerta barrial recibida',
    ],
  },
  {
    id: 'a4',
    tipo: 'ACOMPANAMIENTO',
    nombre: 'Ana Torres',
    telefono: '+56 9 4444 5555',
    hora: '09:30',
    lat: -33.4420,
    lng: -70.6720,
    ruta: 'Casa -> Universidad',
    estado: 'PENDIENTE',
    timeline: [
      '09:30 - Ruta de acompañamiento iniciada',
    ],
  },
]

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
