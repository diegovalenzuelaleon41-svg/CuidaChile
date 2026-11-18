import { useEffect, useRef } from 'react'

/**
 * "Agitar para SOS": detecta varias sacudidas fuertes seguidas con el acelerómetro. Solo funciona
 * con la app abierta y en primer plano (el navegador no entrega el sensor en segundo plano).
 * Va apagado por defecto y en iPhone pide permiso del sensor la primera vez.
 */

const CLAVE = 'cuidachile.agitarSOS'
/** Cambio de aceleración (m/s²) entre dos lecturas que cuenta como una sacudida. */
const UMBRAL = 25
/** Sacudidas necesarias dentro de VENTANA_MS: caminar o correr no llega. */
const SACUDIDAS = 4
const VENTANA_MS = 1200
/** Tras disparar, no vuelve a disparar por este rato. */
const PAUSA_MS = 4000

type ConPermiso = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export const agitarDisponible = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window

export function leerAgitarSOS(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

export function guardarAgitarSOS(activo: boolean) {
  try {
    localStorage.setItem(CLAVE, activo ? '1' : '0')
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
}

/** iPhone exige pedir el sensor dentro de un toque. En el resto devuelve true sin preguntar. */
export async function pedirPermisoMovimiento(): Promise<boolean> {
  if (!agitarDisponible()) return false
  const pedir = (window.DeviceMotionEvent as ConPermiso).requestPermission
  if (!pedir) return true
  try {
    return (await pedir()) === 'granted'
  } catch {
    return false
  }
}

export function useAgitar(activo: boolean, onAgitar: () => void) {
  const onAgitarRef = useRef(onAgitar)
  useEffect(() => {
    onAgitarRef.current = onAgitar
  })

  useEffect(() => {
    if (!activo || !agitarDisponible()) return
    let previa: { x: number; y: number; z: number } | null = null
    let golpes: number[] = []
    let pausaHasta = 0

    const alMover = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (a?.x == null || a.y == null || a.z == null) return
      const actual = { x: a.x, y: a.y, z: a.z }
      if (previa) {
        const cambio = Math.hypot(actual.x - previa.x, actual.y - previa.y, actual.z - previa.z)
        const ahora = Date.now()
        if (cambio > UMBRAL && ahora > pausaHasta) {
          golpes = golpes.filter((t) => ahora - t < VENTANA_MS)
          golpes.push(ahora)
          if (golpes.length >= SACUDIDAS) {
            golpes = []
            pausaHasta = ahora + PAUSA_MS
            onAgitarRef.current()
          }
        }
      }
      previa = actual
    }

    window.addEventListener('devicemotion', alMover)
    return () => window.removeEventListener('devicemotion', alMover)
  }, [activo])
}
