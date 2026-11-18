import type * as maplibregl from 'maplibre-gl'
import { NODOS_ICONO } from './iconosMapaDatos'

/** Nombre de la imagen del ícono dentro del estilo del mapa. */
export const idIcono = (clave: string) => `cc-${clave}`

/** SVG blanco (trazo lucide) de 48 px; se dibuja a media escala para que se vea nítido. */
function svgIcono(clave: string): string | null {
  const nodos = NODOS_ICONO[clave]
  if (!nodos) return null
  const hijos = nodos
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" ' +
    `stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${hijos}</svg>`
  )
}

/** Agrega al estilo los íconos que faltan. Hay que llamarla de nuevo si cambia el estilo del mapa. */
export async function cargarIconosMapa(map: maplibregl.Map) {
  await Promise.all(
    Object.keys(NODOS_ICONO).map(async (clave) => {
      const id = idIcono(clave)
      if (map.hasImage(id)) return
      const svg = svgIcono(clave)
      if (!svg) return
      const img = new Image(48, 48)
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      try {
        await img.decode()
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 })
      } catch {
        /* sin ícono: el punto de color se ve igual */
      }
    }),
  )
}
