import { useEffect, useRef, type RefObject } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { cargarIconosMapa, idIcono } from '../lib/iconosMapa'

/** Aviso de vecinos (o reporte propio en revisión) tal como se dibuja. */
export interface PuntoAviso {
  id: string
  lng: number
  lat: number
  color: string
  /** Opacidad por antigüedad (0.1 a 0.8). */
  op: number
  /** 3 rojo, 2 amarillo, 1 azul: los graves se dibujan más grandes y encima. */
  rango: number
  /** Clave del ícono (iconosMapaDatos). */
  icono: string
}

export interface PuntoAyuda {
  id: string
  lng: number
  lat: number
  icono: string
}

export type SeleccionMapa = { tipo: 'aviso' | 'ayuda'; id: string } | null

const CYAN = '#22D3EE'
const AMBAR = '#F59E0B'
const FONDO_AYUDA = '#0B1A2B'

const CAPAS_CLICK = ['cc-avisos-pin', 'cc-ayuda-pin', 'cc-avisos-cluster', 'cc-ayuda-cluster']

/** Polígono circular (radio en metros) para sombrear la zona de un aviso. */
function circulo(lng: number, lat: number, radioM = 150, puntos = 28): [number, number][] {
  const anillo: [number, number][] = []
  const dLat = radioM / 111_320
  const dLng = radioM / (111_320 * Math.max(0.3, Math.cos((lat * Math.PI) / 180)))
  for (let i = 0; i <= puntos; i++) {
    const a = (i / puntos) * Math.PI * 2
    anillo.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat])
  }
  return anillo
}

function coleccion(features: unknown[]) {
  return { type: 'FeatureCollection', features } as never
}

function datosAvisos(avisos: PuntoAviso[]) {
  return coleccion(
    avisos.map((a) => ({
      type: 'Feature',
      properties: { id: a.id, color: a.color, op: Math.min(1, a.op + 0.2), rango: a.rango, icono: idIcono(a.icono) },
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
    })),
  )
}

function datosZonas(avisos: PuntoAviso[]) {
  return coleccion(
    avisos.map((a) => ({
      type: 'Feature',
      properties: { color: a.color, op: a.op },
      geometry: { type: 'Polygon', coordinates: [circulo(a.lng, a.lat)] },
    })),
  )
}

function datosAyuda(ayuda: PuntoAyuda[]) {
  return coleccion(
    ayuda.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, icono: idIcono(p.icono) },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  )
}

/** Vuelca los datos y la selección en las fuentes, si ya existen. */
function aplicarDatos(map: maplibregl.Map | null, d: { avisos: PuntoAviso[]; ayuda: PuntoAyuda[]; seleccion: SeleccionMapa }) {
  if (!map) return
  try {
    const fuente = (id: string) => map.getSource(id) as maplibregl.GeoJSONSource | undefined
    fuente('cc-avisos')?.setData(datosAvisos(d.avisos))
    fuente('cc-avisos-zona')?.setData(datosZonas(d.avisos))
    fuente('cc-ayuda')?.setData(datosAyuda(d.ayuda))
    const idAviso = d.seleccion?.tipo === 'aviso' ? d.seleccion.id : ''
    const idAyuda = d.seleccion?.tipo === 'ayuda' ? d.seleccion.id : ''
    if (map.getLayer('cc-avisos-sel')) map.setFilter('cc-avisos-sel', ['==', ['get', 'id'], idAviso])
    if (map.getLayer('cc-ayuda-sel')) map.setFilter('cc-ayuda-sel', ['==', ['get', 'id'], idAyuda])
  } catch {
    /* estilo cambiando: se reaplica al terminar */
  }
}

/** La fuente de texto que ya usa el estilo (para el número de los grupos). null si no hay. */
function fuenteDelEstilo(map: maplibregl.Map): string[] | null {
  try {
    for (const capa of map.getStyle().layers ?? []) {
      const f = capa.type === 'symbol' ? (capa.layout as Record<string, unknown> | undefined)?.['text-font'] : null
      if (Array.isArray(f) && f.every((x) => typeof x === 'string')) return f as string[]
    }
  } catch {
    /* estilo no listo */
  }
  return null
}

/**
 * Capas de "Explora tu entorno" dibujadas por el propio mapa (no elementos HTML): avisos de vecinos
 * con su zona, y lugares de ayuda, cada uno con su agrupación al alejar. Las capas se crean una vez
 * por estilo y después solo cambian los datos, así mover el mapa no reconstruye nada.
 */
export function useCapasExplora({
  mapaRef,
  listo,
  estiloKey,
  avisos,
  ayuda,
  seleccion,
  onSeleccion,
}: {
  mapaRef: RefObject<maplibregl.Map | null>
  listo: boolean
  estiloKey: number
  avisos: PuntoAviso[]
  ayuda: PuntoAyuda[]
  seleccion: SeleccionMapa
  onSeleccion: (s: SeleccionMapa) => void
}) {
  const datosRef = useRef({ avisos, ayuda, seleccion })
  const onSeleccionRef = useRef(onSeleccion)
  useEffect(() => {
    datosRef.current = { avisos, ayuda, seleccion }
    onSeleccionRef.current = onSeleccion
  })

  // Crear fuentes, capas e interacciones (una vez por estilo).
  useEffect(() => {
    const map = mapaRef.current
    if (!map || !listo) return

    const preparar = () => {
      try {
        if (!map.getSource('cc-avisos')) {
          const fuenteTexto = fuenteDelEstilo(map)
          map.addSource('cc-avisos-zona', { type: 'geojson', data: datosZonas([]) })
          map.addSource('cc-avisos', { type: 'geojson', data: datosAvisos([]), cluster: true, clusterRadius: 48, clusterMaxZoom: 14 })
          map.addSource('cc-ayuda', { type: 'geojson', data: datosAyuda([]), cluster: true, clusterRadius: 48, clusterMaxZoom: 13 })

          // Zonas: se desvanecen con la edad del aviso.
          map.addLayer({
            id: 'cc-avisos-zona-fill',
            type: 'fill',
            source: 'cc-avisos-zona',
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', ['get', 'op'], 0.35] },
          })
          map.addLayer({
            id: 'cc-avisos-zona-linea',
            type: 'line',
            source: 'cc-avisos-zona',
            paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': ['min', ['+', ['get', 'op'], 0.15], 0.8] },
          })

          // Grupos al alejar: un círculo por categoría, nunca mezclados.
          const grupo = (id: string, source: string, color: string, fondo: string) => {
            map.addLayer({
              id,
              type: 'circle',
              source,
              filter: ['has', 'point_count'],
              paint: {
                'circle-color': fondo,
                'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 24],
                'circle-stroke-color': color,
                'circle-stroke-width': 2,
              },
            })
            if (fuenteTexto) {
              map.addLayer({
                id: `${id}-n`,
                type: 'symbol',
                source,
                filter: ['has', 'point_count'],
                layout: {
                  'text-field': ['get', 'point_count_abbreviated'],
                  'text-font': fuenteTexto,
                  'text-size': 13,
                  'text-allow-overlap': true,
                },
                paint: { 'text-color': '#ffffff' },
              })
            }
          }
          grupo('cc-ayuda-cluster', 'cc-ayuda', CYAN, FONDO_AYUDA)
          grupo('cc-avisos-cluster', 'cc-avisos', AMBAR, 'rgba(245,158,11,0.85)')

          // Ayuda: disco oscuro con borde cian e ícono blanco.
          map.addLayer({
            id: 'cc-ayuda-sel',
            type: 'circle',
            source: 'cc-ayuda',
            filter: ['==', ['get', 'id'], ''],
            paint: { 'circle-radius': 20, 'circle-color': 'rgba(34,211,238,0.18)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
          })
          map.addLayer({
            id: 'cc-ayuda-pin',
            type: 'circle',
            source: 'cc-ayuda',
            filter: ['!', ['has', 'point_count']],
            paint: { 'circle-radius': 13, 'circle-color': FONDO_AYUDA, 'circle-stroke-color': CYAN, 'circle-stroke-width': 2 },
          })
          map.addLayer({
            id: 'cc-ayuda-icono',
            type: 'symbol',
            source: 'cc-ayuda',
            filter: ['!', ['has', 'point_count']],
            layout: { 'icon-image': ['get', 'icono'], 'icon-size': 0.6, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
          })

          // Avisos: disco del color de su gravedad, más grande si es grave.
          map.addLayer({
            id: 'cc-avisos-sel',
            type: 'circle',
            source: 'cc-avisos',
            filter: ['==', ['get', 'id'], ''],
            paint: { 'circle-radius': 22, 'circle-color': 'rgba(255,255,255,0.12)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
          })
          map.addLayer({
            id: 'cc-avisos-pin',
            type: 'circle',
            source: 'cc-avisos',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': ['match', ['get', 'rango'], 3, 15, 13],
              'circle-color': ['get', 'color'],
              'circle-opacity': ['get', 'op'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-stroke-opacity': ['get', 'op'],
            },
          })
          map.addLayer({
            id: 'cc-avisos-icono',
            type: 'symbol',
            source: 'cc-avisos',
            filter: ['!', ['has', 'point_count']],
            layout: {
              'icon-image': ['get', 'icono'],
              'icon-size': ['match', ['get', 'rango'], 3, 0.68, 0.6],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'symbol-sort-key': ['get', 'rango'],
            },
            paint: { 'icon-opacity': ['get', 'op'] },
          })
        }
        void cargarIconosMapa(map)
        aplicarDatos(map, datosRef.current)
      } catch {
        /* estilo aún no listo: se reintenta en 'load' */
      }
    }

    const alTocar = (e: maplibregl.MapMouseEvent) => {
      let f: maplibregl.MapGeoJSONFeature | undefined
      try {
        f = map.queryRenderedFeatures(e.point, { layers: CAPAS_CLICK.filter((id) => map.getLayer(id)) })[0]
      } catch {
        f = undefined
      }
      if (!f) {
        if (datosRef.current.seleccion) onSeleccionRef.current(null)
        return
      }
      const capa = f.layer.id
      if (capa.endsWith('-cluster')) {
        const fuente = map.getSource(capa === 'cc-avisos-cluster' ? 'cc-avisos' : 'cc-ayuda') as maplibregl.GeoJSONSource
        const centro = (f.geometry as unknown as { coordinates: [number, number] }).coordinates
        void fuente
          .getClusterExpansionZoom(f.properties?.cluster_id as number)
          .then((z) => map.easeTo({ center: centro, zoom: Math.min(z + 0.5, 17), duration: 500 }))
          .catch(() => {})
        return
      }
      const id = f.properties?.id as string | undefined
      if (!id) return
      onSeleccionRef.current({ tipo: capa === 'cc-avisos-pin' ? 'aviso' : 'ayuda', id })
    }
    const puntero = () => (map.getCanvas().style.cursor = 'pointer')
    const sinPuntero = () => (map.getCanvas().style.cursor = '')

    if (map.isStyleLoaded()) preparar()
    else map.once('load', preparar)
    map.on('click', alTocar)
    for (const id of CAPAS_CLICK) {
      map.on('mouseenter', id, puntero)
      map.on('mouseleave', id, sinPuntero)
    }
    return () => {
      try {
        map.off('load', preparar)
        map.off('click', alTocar)
        for (const id of CAPAS_CLICK) {
          map.off('mouseenter', id, puntero)
          map.off('mouseleave', id, sinPuntero)
        }
      } catch {
        /* mapa destruido */
      }
    }
  }, [mapaRef, listo, estiloKey])

  // Datos o selección nuevos: solo se cambian las fuentes.
  useEffect(() => {
    aplicarDatos(mapaRef.current, { avisos, ayuda, seleccion })
  }, [mapaRef, avisos, ayuda, seleccion])
}
