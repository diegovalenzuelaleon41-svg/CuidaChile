import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Loader2, Pin, TriangleAlert } from 'lucide-react'
import type { GeoJSONSource } from 'maplibre-gl'
import { COLOR_NEON as NEON, type AlertaTipo } from '../../lib/mockAlerts'
import { obtenerRutaCalles } from '../../lib/rutaOSRM'

// Vite empaqueta el worker como asset aparte: sin esto el mapa no dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const SANTIAGO: [number, number] = [-70.6693, -33.4489]
const ZOOM_ALERTA = 15
/** Px que tapa abajo la tarjeta "Sin alerta seleccionada". */
const MARGEN_SIN_SELECCION = 130

const FUENTE_RUTA = 'ruta-acompanamiento'
const FUENTE_EXTREMOS = 'ruta-acompanamiento-extremos'
const VACIO: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export interface PuntoMapa {
  id: string
  tipo: AlertaTipo
  lat: number
  lng: number
  /** Sin GPS todavía: no se dibuja pin. */
  sinUbicacion?: boolean
  /** Acompañamiento en curso: la posición llega por Realtime (pin con pulso). */
  enVivo?: boolean
  /** Segundos sin señal del teléfono: el pin queda "fantasma" (no es posición en vivo). */
  senalPerdidaSeg?: number | null
  /** Para el tooltip y el lector de pantalla de los pines de la bandeja. */
  nombre?: string
}

export interface RutaMapa {
  /** [lng, lat] */
  origen: [number, number]
  destino: [number, number]
}

interface Props {
  seleccion: PuntoMapa | null
  /** Todas las alertas de la bandeja: pines chicos clicables (la seleccionada va aparte). */
  puntos?: PuntoMapa[]
  onSeleccionar?: (id: string) => void
  ruta: RutaMapa | null
  /** Px tapados abajo por una tarjeta flotante: los centrados quedan por encima. */
  margenInferior?: number
}

/**
 * Pin neón. MapLibre posiciona el elemento EXTERNO con transform/position
 * absolute: todo el estilo y las animaciones van en hijos, si no el pin
 * se sale de su coordenada (o queda fuera del canvas).
 */
function crearPin(tipo: AlertaTipo, enVivo: boolean) {
  const color = NEON[tipo]
  const el = document.createElement('div')
  el.style.width = '26px'
  el.style.height = '26px'
  el.setAttribute('aria-hidden', 'true')

  // Halo exterior fijo: separa el pin del fondo oscuro aunque no pulse.
  const halo = document.createElement('div')
  halo.style.cssText = `position:absolute;inset:-10px;border-radius:9999px;background:${color}33;box-shadow:0 0 24px ${color}66;`
  el.appendChild(halo)

  if (tipo === 'SOS' || enVivo) {
    const pulso = document.createElement('div')
    pulso.className = 'pin-neon-pulso'
    pulso.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${color};`
    el.appendChild(pulso)
  }

  const punto = document.createElement('div')
  punto.style.cssText =
    `position:absolute;inset:0;border-radius:9999px;background:${color};` +
    `border:3px solid #FFFFFF;box-shadow:0 0 15px ${color},0 0 32px ${color}99;`
  el.appendChild(punto)

  if (tipo === 'SOS') {
    const centro = document.createElement('div')
    centro.style.cssText =
      'position:absolute;top:50%;left:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:9999px;background:#FFFFFF;'
    el.appendChild(centro)
  }
  return el
}

/** Pin chico de una alerta de la bandeja (no seleccionada). Clic → seleccionarla. */
function crearPinBandeja(p: PuntoMapa, onClick: () => void) {
  const color = NEON[p.tipo]
  const el = document.createElement('div')
  el.style.cssText = 'width:16px;height:16px;cursor:pointer;'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', `Ver alerta de ${p.nombre ?? 'ciudadano'}`)
  el.title = p.nombre ?? ''
  el.addEventListener('click', onClick)
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  })

  // Hijo interno para el hover: el transform del elemento externo es de MapLibre.
  const cuerpo = document.createElement('div')
  cuerpo.style.cssText = 'position:absolute;inset:0;transition:transform 150ms;'
  el.addEventListener('mouseenter', () => (cuerpo.style.transform = 'scale(1.35)'))
  el.addEventListener('mouseleave', () => (cuerpo.style.transform = ''))
  el.appendChild(cuerpo)

  if (p.tipo === 'SOS') {
    const pulso = document.createElement('div')
    pulso.className = 'pin-neon-pulso'
    pulso.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${color};`
    cuerpo.appendChild(pulso)
  }
  const punto = document.createElement('div')
  punto.style.cssText =
    `position:absolute;inset:0;border-radius:9999px;background:${color};` +
    `border:2px solid #FFFFFF;box-shadow:0 0 10px ${color},0 0 20px ${color}88;`
  cuerpo.appendChild(punto)
  return el
}

/* ── Movimiento suave de los pines (el GPS llega a saltos de 3–5 s) ── */

const animaciones = new WeakMap<maplibregl.Marker, number>()

function moverSuave(marker: maplibregl.Marker, destino: [number, number], ms = 900) {
  cancelAnimationFrame(animaciones.get(marker) ?? 0)
  const desde = marker.getLngLat()
  const sinAnimar = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (sinAnimar || (desde.lng === destino[0] && desde.lat === destino[1])) {
    marker.setLngLat(destino)
    return
  }
  const t0 = performance.now()
  const paso = (t: number) => {
    const k = Math.min(1, (t - t0) / ms)
    const e = 1 - (1 - k) ** 3 // ease-out
    marker.setLngLat([desde.lng + (destino[0] - desde.lng) * e, desde.lat + (destino[1] - desde.lat) * e])
    if (k < 1) animaciones.set(marker, requestAnimationFrame(paso))
    else animaciones.delete(marker)
  }
  animaciones.set(marker, requestAnimationFrame(paso))
}

function quitarMarker(marker: maplibregl.Marker) {
  cancelAnimationFrame(animaciones.get(marker) ?? 0)
  marker.remove()
}

/** Pin fantasma (señal perdida) o normal. MapLibre pisa style.opacity: hay que usar su API. */
function aplicarFantasma(marker: maplibregl.Marker, fantasma: boolean) {
  marker.setOpacity(fantasma ? '0.5' : '1', fantasma ? '0.5' : '0.2')
  marker.getElement().querySelectorAll<HTMLElement>('div').forEach((capa) => {
    capa.style.filter = fantasma ? 'grayscale(0.6)' : ''
  })
  marker.getElement().querySelectorAll<HTMLElement>('.pin-neon-pulso').forEach((p) => (p.style.display = fantasma ? 'none' : ''))
}

/**
 * Mapa "Dark Control Room" del operador: todas las alertas de la bandeja como
 * pines chicos, la seleccionada grande (flyTo + seguimiento en vivo) y la ruta
 * del acompañamiento.
 */
export default function MapaOperador({ seleccion, puntos = [], onSeleccionar, ruta, margenInferior = 0 }: Props) {
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const bandejaRef = useRef(new Map<string, maplibregl.Marker>())
  const [listo, setListo] = useState(false)

  // ── 1. Mapa + capas de la ruta (glow + línea + extremos) ──
  useEffect(() => {
    if (!contenedorRef.current) return
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: MAP_STYLE,
      center: SANTIAGO,
      zoom: 14,
      // Compacta ("i"): la tarjeta flotante tapa la esquina inferior; los créditos siguen disponibles.
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('load', () => {
      // La atribución compacta parte abierta en mapas anchos: se pliega al "i".
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      map.addSource(FUENTE_RUTA, { type: 'geojson', data: VACIO })
      map.addSource(FUENTE_EXTREMOS, { type: 'geojson', data: VACIO })
      // Resplandor: línea ancha, semitransparente y difuminada debajo.
      map.addLayer({
        id: 'ruta-acomp-glow',
        type: 'line',
        source: FUENTE_RUTA,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NEON.ACOMPANAMIENTO, 'line-width': 16, 'line-opacity': 0.35, 'line-blur': 8 },
      })
      map.addLayer({
        id: 'ruta-acomp-linea',
        type: 'line',
        source: FUENTE_RUTA,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NEON.ACOMPANAMIENTO, 'line-width': 5 },
      })
      // Halo del destino (como el del pin del ciudadano).
      map.addLayer({
        id: 'ruta-acomp-destino-halo',
        type: 'circle',
        source: FUENTE_EXTREMOS,
        filter: ['==', ['get', 'tipo'], 'destino'],
        paint: { 'circle-radius': 20, 'circle-color': NEON.ACOMPANAMIENTO, 'circle-opacity': 0.25, 'circle-blur': 0.6 },
      })
      // Origen (blanco) y destino (azul) con borde para que se lean sobre la línea.
      map.addLayer({
        id: 'ruta-acomp-extremos',
        type: 'circle',
        source: FUENTE_EXTREMOS,
        paint: {
          'circle-radius': 7,
          'circle-color': ['match', ['get', 'tipo'], 'origen', '#FFFFFF', NEON.ACOMPANAMIENTO],
          'circle-stroke-width': 3,
          'circle-stroke-color': ['match', ['get', 'tipo'], 'origen', NEON.ACOMPANAMIENTO, '#FFFFFF'],
        },
      })
      setListo(true)
    })

    const bandeja = bandejaRef.current
    return () => {
      if (markerRef.current) quitarMarker(markerRef.current)
      markerRef.current = null
      bandeja.forEach(quitarMarker)
      bandeja.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── 2. Pin de la alerta seleccionada + centrar (zoom 15) ──
  const selId = seleccion?.id
  const selTipo = seleccion?.tipo
  const selVivo = !!seleccion?.enVivo
  const conUbicacion = !!seleccion && !seleccion.sinUbicacion
  const seleccionRef = useRef(seleccion)
  const margenRef = useRef(margenInferior)
  const rutaKey = ruta ? `${ruta.origen.join(',')};${ruta.destino.join(',')}` : ''
  const rutaRef = useRef(ruta)
  useEffect(() => {
    seleccionRef.current = seleccion
    rutaRef.current = ruta
    margenRef.current = margenInferior
  })
  useEffect(() => {
    if (markerRef.current) quitarMarker(markerRef.current)
    markerRef.current = null
    const map = mapRef.current
    const sel = seleccionRef.current
    if (!map || !listo || !sel || !selTipo) return
    if (!conUbicacion) {
      // Sin GPS del ciudadano todavía: centrar en el punto medio de su ruta.
      const r = rutaRef.current
      if (r) {
        const medio: [number, number] = [(r.origen[0] + r.destino[0]) / 2, (r.origen[1] + r.destino[1]) / 2]
        map.flyTo({ center: medio, zoom: 14, duration: 900, padding: { top: 0, right: 0, left: 0, bottom: margenRef.current } })
      }
      return
    }
    const el = crearPin(selTipo, selVivo)
    el.style.zIndex = '2' // sobre los pines de la bandeja
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([sel.lng, sel.lat])
      .addTo(map)
    map.flyTo({ center: [sel.lng, sel.lat], zoom: ZOOM_ALERTA, duration: 900, padding: { top: 0, right: 0, left: 0, bottom: margenRef.current } })
  }, [selId, selTipo, selVivo, conUbicacion, listo])

  // ── 2b. Señal perdida: pin al 50 % ("fantasma"), sin pulso de "en vivo" ──
  const fantasma = seleccion?.senalPerdidaSeg != null
  useEffect(() => {
    if (markerRef.current) aplicarFantasma(markerRef.current, fantasma)
  }, [fantasma, selId, selVivo, conUbicacion, listo])

  // ── 3. Tracking: mover el pin (sin recrearlo) cuando cambian las coordenadas ──
  const lat = seleccion?.lat
  const lng = seleccion?.lng
  // Solo movimientos de la MISMA alerta: al cambiar de selección manda el
  // flyTo del efecto 2 (un easeTo aquí lo cortaría a medio camino).
  const ultimaSelRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const cambioDeSeleccion = ultimaSelRef.current !== selId
    ultimaSelRef.current = selId
    if (cambioDeSeleccion) return
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || lat == null || lng == null) return
    moverSuave(marker, [lng, lat])
    // Si el ciudadano sale de la vista, la cámara lo sigue.
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat], duration: 600, padding: { top: 0, right: 0, left: 0, bottom: margenRef.current } })
  }, [selId, lat, lng])

  // ── 3b. Pines de la bandeja: se crean, mueven (suave) y quitan según la lista ──
  const puntosRef = useRef(puntos)
  const onSeleccionarRef = useRef(onSeleccionar)
  useEffect(() => {
    puntosRef.current = puntos
    onSeleccionarRef.current = onSeleccionar
  })
  const conGps = puntos.filter((p) => !p.sinUbicacion)
  const bandejaKey = conGps.map((p) => `${p.id}|${p.lat}|${p.lng}|${p.senalPerdidaSeg != null}`).join(';')
  useEffect(() => {
    const map = mapRef.current
    if (!map || !listo) return
    const bandeja = bandejaRef.current
    // La seleccionada no va aquí: tiene su pin grande (efecto 2).
    const visibles = puntosRef.current.filter((p) => !p.sinUbicacion && p.id !== selId)
    const ids = new Set(visibles.map((p) => p.id))
    bandeja.forEach((m, id) => {
      if (!ids.has(id)) {
        quitarMarker(m)
        bandeja.delete(id)
      }
    })
    for (const p of visibles) {
      let m = bandeja.get(p.id)
      if (!m) {
        m = new maplibregl.Marker({ element: crearPinBandeja(p, () => onSeleccionarRef.current?.(p.id)) })
          .setLngLat([p.lng, p.lat])
          .addTo(map)
        bandeja.set(p.id, m)
      } else {
        moverSuave(m, [p.lng, p.lat])
      }
      aplicarFantasma(m, p.senalPerdidaSeg != null)
    }
  }, [bandejaKey, selId, listo])

  // ── 3c. Sin selección: la cámara abarca todas las alertas (y se reajusta si llega una nueva) ──
  const idsConGps = conGps
    .map((p) => p.id)
    .sort()
    .join(',')
  useEffect(() => {
    const map = mapRef.current
    if (!map || !listo || selId) return
    const ps = puntosRef.current.filter((p) => !p.sinUbicacion)
    if (ps.length === 0) return
    const padding = { top: 70, right: 60, left: 60, bottom: MARGEN_SIN_SELECCION }
    if (ps.length === 1) {
      map.easeTo({ center: [ps[0].lng, ps[0].lat], zoom: 14, duration: 900, padding })
      return
    }
    const limites = new maplibregl.LngLatBounds()
    ps.forEach((p) => limites.extend([p.lng, p.lat]))
    map.fitBounds(limites, { padding, maxZoom: 15, duration: 900 })
  }, [idsConGps, selId, listo])

  // ── 4. Línea de ruta origen → destino (por calles; recta si OSRM falla) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !listo) return
    const fuenteRuta = map.getSource<GeoJSONSource>(FUENTE_RUTA)
    const fuenteExtremos = map.getSource<GeoJSONSource>(FUENTE_EXTREMOS)
    const r = rutaRef.current
    if (!r) {
      fuenteRuta?.setData(VACIO)
      fuenteExtremos?.setData(VACIO)
      return
    }
    const dibujar = (coords: [number, number][]) =>
      fuenteRuta?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })

    fuenteExtremos?.setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { tipo: 'origen' }, geometry: { type: 'Point', coordinates: r.origen } },
        { type: 'Feature', properties: { tipo: 'destino' }, geometry: { type: 'Point', coordinates: r.destino } },
      ],
    })
    dibujar([r.origen, r.destino]) // línea recta inmediata; se reemplaza por la de calles
    const ctrl = new AbortController()
    obtenerRutaCalles(r.origen, r.destino, ctrl.signal).then((info) => {
      if (info && !ctrl.signal.aborted) dibujar(info.coords)
    })
    return () => ctrl.abort()
  }, [rutaKey, listo])

  return (
    <div className="relative w-full h-full">
      <div ref={contenedorRef} className="w-full h-full" />
      {!listo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={24} className="mb-2 animate-spin" />
          <span>Cargando mapa…</span>
        </div>
      )}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur text-xs font-semibold text-slate-100 border border-slate-700">
          <Pin size={14} strokeWidth={2} />
          Santiago Centro
        </div>
        {fantasma && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur text-xs font-semibold text-orange-300 border border-orange-500/50 animate-pulse">
            <TriangleAlert size={13} />
            Señal perdida hace {seleccion!.senalPerdidaSeg! < 60 ? `${seleccion!.senalPerdidaSeg} s` : `${Math.floor(seleccion!.senalPerdidaSeg! / 60)} min`}
          </div>
        )}
        {seleccion?.sinUbicacion && (
          <div className="px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur text-xs text-amber-300 border border-amber-500/30">
            Sin ubicación GPS del ciudadano
          </div>
        )}
      </div>
    </div>
  )
}
