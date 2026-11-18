/** Piezas compartidas de "Explora tu entorno" (tarjeta del mapa y vista en lista). */
import { Badge, Cross, Flame, Shield, type LucideIcon } from 'lucide-react'
import type { TipoAyuda } from './lugaresAyuda'

export const ICONO_AYUDA: Record<TipoAyuda, LucideIcon> = {
  carabineros: Shield,
  pdi: Badge,
  salud: Cross,
  bomberos: Flame,
}

export function distanciaTexto(m: number | null) {
  if (m == null) return null
  return m < 1000 ? `a ${Math.max(10, Math.round(m / 10) * 10)} m de ti` : `a ${(m / 1000).toFixed(1).replace('.', ',')} km de ti`
}
