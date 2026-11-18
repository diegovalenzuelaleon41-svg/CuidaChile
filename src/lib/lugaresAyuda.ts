/**
 * Lugares de ayuda del mapa ("Ayuda cercana"): comisarías, PDI, urgencias y bomberos de Santiago.
 * Vienen de OpenStreetMap (scripts/lugares-ayuda.mjs → tabla lugares_ayuda). No los verifica
 * CuidaChile: la tarjeta dice la fuente y cuándo se revisaron, nunca "verificado".
 */
import { supabase } from './supabase'

export type TipoAyuda = 'carabineros' | 'pdi' | 'salud' | 'bomberos'

export interface LugarAyuda {
  id: string
  tipo: TipoAyuda
  nombre: string
  direccion: string | null
  telefono: string | null
  lat: number
  lng: number
  revisado_en: string
}

export const ETIQUETA_AYUDA: Record<TipoAyuda, string> = {
  carabineros: 'Carabineros',
  pdi: 'PDI',
  salud: 'Centro de salud',
  bomberos: 'Bomberos',
}

export async function cargarLugaresAyuda(): Promise<LugarAyuda[]> {
  const { data, error } = await supabase
    .from('lugares_ayuda')
    .select('id,tipo,nombre,direccion,telefono,lat,lng,revisado_en')
    .limit(2000)
  if (error) {
    console.error('[lugares_ayuda] no se pudieron cargar:', error.code, error.message)
    return []
  }
  return (data ?? []) as LugarAyuda[]
}
