/**
 * Ruta real por calles (OSRM demo, gratis y sin API key).
 * Devuelve la polyline + distancia/duración, eligiendo entre las alternativas
 * la que pasa cerca de menos reportes de la comunidad. Si falla (rate limit, sin red),
 * el llamador usa línea recta como fallback.
 */

export interface InfoRutaOSRM {
  /** [lng, lat] listos para GeoJSON LineString */
  coords: [number, number][]
  distanciaM: number
  duracionS: number
  /** Reportes vigentes a menos de RADIO_REPORTE_M de esta ruta. */
  reportesCerca: number
  /** Reportes que se evitan frente a la ruta más rápida (0 si es la misma). */
  reportesEvitados: number
}

interface OSRMResponse {
  code: string
  routes?: Array<{
    geometry: { coordinates: [number, number][] }
    distance: number
    duration: number
  }>
}

/** Un reporte "toca" la ruta si queda a menos de esto de algún tramo. */
const RADIO_REPORTE_M = 150
/** No se elige una alternativa que alargue el viaje más de un 25 %. */
const DESVIO_MAXIMO = 1.25

/** Distancia aproximada en metros de un punto a un tramo (proyección equirectangular, basta a escala de ciudad). */
function distanciaATramo(p: [number, number], a: [number, number], b: [number, number]) {
  const k = Math.cos((p[1] * Math.PI) / 180) * 111_320
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * 110_540
  const bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * 110_540
  const dx = bx - ax, dy = by - ay
  const largo = dx * dx + dy * dy
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

function contarReportes(coords: [number, number][], reportes: [number, number][]) {
  return reportes.filter((r) =>
    coords.some((c, i) => i > 0 && distanciaATramo(r, coords[i - 1], c) < RADIO_REPORTE_M),
  ).length
}

/**
 * Pide a OSRM la ruta y sus alternativas y elige la que pasa cerca de menos
 * reportes vigentes ([lng, lat]), siempre que no alargue demasiado el viaje.
 * Sin reportes devuelve la más rápida.
 */
export async function obtenerRutaCalles(
  origen: [number, number],
  destino: [number, number],
  signal?: AbortSignal,
  reportes: [number, number][] = [],
): Promise<InfoRutaOSRM | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origen[0]},${origen[1]};${destino[0]},${destino[1]}?overview=full&geometries=geojson&alternatives=true`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as OSRMResponse
    const rutas = (data.code === 'Ok' ? data.routes ?? [] : []).filter((r) => r.geometry.coordinates.length >= 2)
    if (rutas.length === 0) return null

    const evaluadas = rutas.map((r) => ({ r, cerca: contarReportes(r.geometry.coordinates, reportes) }))
    const rapida = evaluadas[0]
    const elegida = evaluadas
      .filter((e) => e.r.duration <= rapida.r.duration * DESVIO_MAXIMO)
      .reduce((mejor, e) => (e.cerca < mejor.cerca ? e : mejor), rapida)

    return {
      coords: elegida.r.geometry.coordinates,
      distanciaM: elegida.r.distance,
      duracionS: elegida.r.duration,
      reportesCerca: elegida.cerca,
      reportesEvitados: rapida.cerca - elegida.cerca,
    }
  } catch {
    return null
  }
}
