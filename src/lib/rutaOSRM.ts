/**
 * Ruta real por calles (OSRM demo, gratis y sin API key).
 * Devuelve la polyline + distancia/duración. Si falla (rate limit, sin red),
 * el llamador usa línea recta como fallback.
 */

export interface InfoRutaOSRM {
  /** [lng, lat] listos para GeoJSON LineString */
  coords: [number, number][]
  distanciaM: number
  duracionS: number
}

interface OSRMResponse {
  code: string
  routes?: Array<{
    geometry: { coordinates: [number, number][] }
    distance: number
    duration: number
  }>
}

export async function obtenerRutaCalles(
  origen: [number, number],
  destino: [number, number],
  signal?: AbortSignal,
): Promise<InfoRutaOSRM | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origen[0]},${origen[1]};${destino[0]},${destino[1]}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as OSRMResponse
    const r = data.code === 'Ok' ? data.routes?.[0] : undefined
    if (!r || r.geometry.coordinates.length < 2) return null
    return { coords: r.geometry.coordinates, distanciaM: r.distance, duracionS: r.duration }
  } catch {
    return null
  }
}
