import { useCallback, useEffect, useRef, useState } from 'react'

/** Quieta más de esto (sin moverse RADIO_QUIETO_M) durante una ruta → "¿Todo bien?". */
const QUIETO_MS = 5 * 60_000
const RADIO_QUIETO_M = 40
/** Llegada estimada × 1,5 + 10 min sin terminar la ruta → "¿Todo bien?". */
const HOLGURA_MS = 10 * 60_000
/** Tiempo para responder antes de enviar el SOS solo. */
export const SEGUNDOS_RESPUESTA = 30

export type MotivoControl = 'quieta' | 'demora'

function metros(a: [number, number], b: [number, number]) {
  const k = Math.cos((a[1] * Math.PI) / 180) * 111_320
  return Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * 110_540)
}

/**
 * Durante una ruta acompañada pregunta "¿Todo bien?" si la persona lleva mucho rato quieta o se
 * pasó bastante de la hora estimada de llegada. Si no responde en SEGUNDOS_RESPUESTA, llama a
 * onSinRespuesta (enviar el SOS). Responder "Estoy bien" reinicia la cuenta.
 */
export function useControlBienestar({
  activo,
  obtenerPos,
  inicioEpoch,
  duracionS,
  onSinRespuesta,
}: {
  activo: boolean
  obtenerPos: () => [number, number] | null
  inicioEpoch: number | null
  /** Duración estimada de la ruta, si se conoce. */
  duracionS: number | null
  onSinRespuesta: () => void
}) {
  const [motivo, setMotivo] = useState<MotivoControl | null>(null)
  const [segundos, setSegundos] = useState(SEGUNDOS_RESPUESTA)
  const ancla = useRef<{ pos: [number, number]; desde: number } | null>(null)
  const demoraPreguntada = useRef(false)
  const obtenerPosRef = useRef(obtenerPos)
  const onSinRespuestaRef = useRef(onSinRespuesta)
  useEffect(() => {
    obtenerPosRef.current = obtenerPos
    onSinRespuestaRef.current = onSinRespuesta
  })

  // Vigilancia cada 15 s mientras la ruta está activa y no hay pregunta abierta.
  useEffect(() => {
    if (!activo) {
      ancla.current = null
      demoraPreguntada.current = false
      return
    }
    if (motivo) return
    const revisar = () => {
      const ahora = Date.now()
      const p = obtenerPosRef.current()
      if (p) {
        if (!ancla.current || metros(ancla.current.pos, p) > RADIO_QUIETO_M) ancla.current = { pos: p, desde: ahora }
        else if (ahora - ancla.current.desde > QUIETO_MS) {
          setSegundos(SEGUNDOS_RESPUESTA)
          setMotivo('quieta')
          return
        }
      }
      if (!demoraPreguntada.current && inicioEpoch && duracionS) {
        if (ahora > inicioEpoch + duracionS * 1500 + HOLGURA_MS) {
          demoraPreguntada.current = true
          setSegundos(SEGUNDOS_RESPUESTA)
          setMotivo('demora')
        }
      }
    }
    const t = window.setInterval(revisar, 15_000)
    return () => window.clearInterval(t)
  }, [activo, motivo, inicioEpoch, duracionS])

  // Cuenta regresiva de la pregunta.
  useEffect(() => {
    if (!motivo || !activo) return
    const t = window.setTimeout(() => {
      if (segundos > 1) {
        setSegundos(segundos - 1)
        return
      }
      setMotivo(null)
      ancla.current = null
      onSinRespuestaRef.current()
    }, 1000)
    return () => window.clearTimeout(t)
  }, [motivo, segundos, activo])

  const estoyBien = useCallback(() => {
    ancla.current = null
    setMotivo(null)
  }, [])

  // Si la ruta termina con la pregunta abierta, la pregunta desaparece.
  return { motivo: activo ? motivo : null, segundos, estoyBien }
}
