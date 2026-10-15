/**
 * Geocoding exacto sin API key (OpenStreetMap Nominatim).
 * - buscarDirecciones: autocompletado sesgado a Chile (acepta "Av. Providencia 1200").
 * - direccionDesdeCoords: geocodificación inversa para mostrar la dirección del origen.
 *
 * Límites de uso (política Nominatim): 1 req/s. El llamador debe aplicar debounce.
 */

export interface ResultadoGeo {
  etiqueta: string
  lat: number
  lng: number
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'
// Viewbox Región Metropolitana (izq, arriba, der, abajo): solo sesga, no restringe.
const VIEWBOX_RM = '-71.6,-32.7,-69.7,-34.2'

interface NominatimItem {
  display_name: string
  lat: string
  lon: string
}

function etiquetaCorta(displayName: string): string {
  return displayName.split(',').slice(0, 3).join(',').trim()
}

export async function buscarDirecciones(query: string, signal?: AbortSignal): Promise<ResultadoGeo[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    countrycodes: 'cl',
    limit: '6',
    addressdetails: '0',
    'accept-language': 'es',
    viewbox: VIEWBOX_RM,
    bounded: '0',
  })
  const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Geocoding falló (${res.status})`)
  const data = (await res.json()) as NominatimItem[]
  return data
    .filter((d) => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lon)))
    .map((d) => ({ etiqueta: etiquetaCorta(d.display_name), lat: Number(d.lat), lng: Number(d.lon) }))
}

export async function direccionDesdeCoords(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '17',
    'accept-language': 'es',
  })
  try {
    const res = await fetch(`${NOMINATIM}/reverse?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    return data.display_name ? etiquetaCorta(data.display_name) : null
  } catch {
    return null
  }
}
