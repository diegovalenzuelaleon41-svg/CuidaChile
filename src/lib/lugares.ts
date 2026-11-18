/**
 * Lugares guardados (Casa y Trabajo): un toque y la ruta queda lista. Solo los ve su dueño.
 * Ver supabase/migrations/20261119000000_lugares_y_acompanantes.sql.
 */
import { supabase } from './supabase'

export type TipoLugar = 'casa' | 'trabajo'

export interface Lugar {
  tipo: TipoLugar
  direccion: string
  lat: number
  lng: number
}

export const NOMBRE_LUGAR: Record<TipoLugar, string> = { casa: 'Casa', trabajo: 'Trabajo' }

export async function cargarLugares(): Promise<Lugar[]> {
  const { data, error } = await supabase.from('lugares').select('tipo,direccion,lat,lng')
  if (error) {
    console.error('[lugares] no se pudieron cargar:', error.code, error.message)
    return []
  }
  return (data ?? []) as Lugar[]
}

/** Crea o reemplaza el lugar de ese tipo. Devuelve un mensaje de error o null. */
export async function guardarLugar(lugar: Lugar, usuarioId: string): Promise<string | null> {
  const { error } = await supabase.from('lugares').upsert(
    {
      usuario_id: usuarioId,
      tipo: lugar.tipo,
      direccion: lugar.direccion.slice(0, 200),
      lat: lugar.lat,
      lng: lugar.lng,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,tipo' },
  )
  if (error) {
    console.error('[lugares] no se pudo guardar:', error.code, error.message)
    return 'No pudimos guardar el lugar. Revisa tu conexión.'
  }
  return null
}

export async function borrarLugar(tipo: TipoLugar): Promise<boolean> {
  const { error } = await supabase.from('lugares').delete().eq('tipo', tipo)
  return !error
}
