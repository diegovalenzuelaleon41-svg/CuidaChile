/**
 * Reportes barriales: el vecino reporta → un operador valida o descarta →
 * si se valida, la comunidad lo ve (tabla reportes_publicos, sin autor).
 * Ver supabase/migrations/20261115040000_reportes_barriales.sql.
 */
import { CarFront, CircleHelp, Footprints, Volume2, type LucideIcon } from 'lucide-react'
import { supabase } from './supabase'

export type CategoriaReporte = 'vehiculo' | 'personas' | 'ruidos' | 'otro'
export type GravedadReporte = 'rojo' | 'amarillo' | 'azul'
export type EstadoReporte = 'pendiente' | 'validado' | 'descartado'

export const CATEGORIAS_REPORTE: { id: CategoriaReporte; etiqueta: string; corta: string; Icono: LucideIcon }[] = [
  { id: 'vehiculo', etiqueta: 'Vehículo sospechoso', corta: 'Vehículo', Icono: CarFront },
  { id: 'personas', etiqueta: 'Personas merodeando', corta: 'Merodeo', Icono: Footprints },
  { id: 'ruidos', etiqueta: 'Ruidos / Violencia', corta: 'Ruidos', Icono: Volume2 },
  { id: 'otro', etiqueta: 'Otro', corta: 'Otro', Icono: CircleHelp },
]

export const ETIQUETA_CATEGORIA: Record<CategoriaReporte, string> = Object.fromEntries(
  CATEGORIAS_REPORTE.map((c) => [c.id, c.etiqueta]),
) as Record<CategoriaReporte, string>

/** Fila de reportes tal como la lee el operador. */
export interface ReporteOperador {
  id: string
  usuario_id: string
  usuario_nombre: string | null
  es_anonimo: boolean
  lat: number
  lng: number
  categoria: CategoriaReporte
  gravedad: GravedadReporte
  descripcion: string | null
  /** Rutas en el bucket 'evidencias' (no URLs públicas): foto y nota de voz. */
  evidencia_url: string | null
  audio_url: string | null
  estado: EstadoReporte
  creado_en: string
}

/** Formulario del modal de reporte (vive en Usuario: sobrevive a elegir ubicación en el mapa). */
export interface FormReporte {
  categoria: CategoriaReporte | ''
  descripcion: string
  /** Foto ya comprimida (JPEG, sin EXIF). */
  foto: Blob | null
  audio: Blob | null
  esAnonimo: boolean
}

export const FORM_REPORTE_VACIO: FormReporte = { categoria: '', descripcion: '', foto: null, audio: null, esAnonimo: false }

export const BUCKET_EVIDENCIAS = 'evidencias'
export const MAX_AUDIO_S = 60
export const MAX_DESCRIPCION = 280

/**
 * Reduce la foto a 1600 px en JPEG. Además de ahorrar datos móviles, al
 * redibujarla se pierden los metadatos EXIF (incluido el GPS del celular).
 */
export async function comprimirFoto(archivo: File): Promise<Blob> {
  const max = 1600
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
  if (!blob) throw new Error('No se pudo procesar la foto.')
  return blob
}

/** 'audio/webm;codecs=opus' → { tipo: 'audio/webm', ext: 'webm' } (el bucket filtra por tipo base). */
export function tipoAudio(blob: Blob): { tipo: string; ext: string } {
  const tipo = (blob.type.split(';')[0] || 'audio/webm').trim()
  const ext = tipo === 'audio/mp4' || tipo === 'audio/x-m4a' ? 'm4a' : tipo === 'audio/mpeg' ? 'mp3' : tipo.split('/')[1] || 'webm'
  return { tipo, ext }
}

/** Sube un archivo a {usuario}/{reporte}/{nombre}. Devuelve la ruta o lanza error. */
export async function subirEvidencia(usuarioId: string, reporteId: string, nombre: string, blob: Blob, tipo: string) {
  const ruta = `${usuarioId}/${reporteId}/${nombre}`
  const { error } = await supabase.storage.from(BUCKET_EVIDENCIAS).upload(ruta, blob, { contentType: tipo, upsert: false })
  if (error) throw new Error(`No se pudo subir la evidencia: ${error.message}`)
  return ruta
}

/* URLs firmadas: se cachean para no pedir una nueva en cada render. */
const cacheFirmadas = new Map<string, { url: string; vence: number }>()

export async function urlFirmada(ruta: string): Promise<string | null> {
  const c = cacheFirmadas.get(ruta)
  if (c && c.vence > Date.now()) return c.url
  const { data, error } = await supabase.storage.from(BUCKET_EVIDENCIAS).createSignedUrl(ruta, 3600)
  if (error || !data) {
    console.error('[evidencia] no se pudo firmar:', error?.message)
    return null
  }
  cacheFirmadas.set(ruta, { url: data.signedUrl, vence: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}

/** Distancia aproximada en metros (equirectangular; sobra para 200 m). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000
  const x = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const y = ((b.lat - a.lat) * Math.PI) / 180
  return Math.hypot(x, y) * R
}

/**
 * Agrupa reportes cercanos (≤ radioM del primero de cada grupo). Devuelve
 * grupos del más antiguo al más nuevo; dentro, en orden de llegada.
 */
export function agruparReportes<T extends { lat: number; lng: number; creado_en: string }>(lista: T[], radioM = 200): T[][] {
  const grupos: T[][] = []
  for (const r of [...lista].sort((a, b) => a.creado_en.localeCompare(b.creado_en))) {
    const g = grupos.find((gr) => distanciaM(gr[0], r) <= radioM)
    if (g) g.push(r)
    else grupos.push([r])
  }
  return grupos
}
