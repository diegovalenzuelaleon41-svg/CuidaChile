import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Sirena de disuasión: tono "wail" (sube y baja) generado con Web Audio, sin
 * archivos. Va al volumen máximo que permite el navegador; el volumen del
 * sistema no se puede forzar desde la web (y en iOS el modo silencio la apaga).
 * Debe encenderse desde un toque: así el navegador permite el audio.
 */
export function useSirena() {
  const [activa, setActiva] = useState(false)
  const detenerRef = useRef<(() => void) | null>(null)

  const detener = useCallback(() => {
    detenerRef.current?.()
    detenerRef.current = null
    setActiva(false)
  }, [])

  const iniciar = useCallback(() => {
    if (detenerRef.current) return
    try {
      const ctx = new AudioContext()
      const tono = ctx.createOscillator()
      tono.type = 'sawtooth'
      tono.frequency.value = 1050
      // LFO lento: barre ±450 Hz (≈1,1 s por ciclo), como una sirena real.
      const lfo = ctx.createOscillator()
      lfo.type = 'triangle'
      lfo.frequency.value = 0.9
      const barrido = ctx.createGain()
      barrido.gain.value = 450
      lfo.connect(barrido).connect(tono.frequency)
      const compresor = ctx.createDynamicsCompressor()
      tono.connect(compresor).connect(ctx.destination)
      tono.start()
      lfo.start()
      void ctx.resume()
      detenerRef.current = () => {
        try {
          tono.stop()
          lfo.stop()
        } catch {
          /* ya detenidos */
        }
        void ctx.close()
      }
      setActiva(true)
    } catch {
      setActiva(false)
    }
  }, [])

  // Nunca dejar la sirena sonando al desmontar.
  useEffect(() => () => detenerRef.current?.(), [])

  const alternar = useCallback(() => (detenerRef.current ? detener() : iniciar()), [detener, iniciar])
  return { activa, alternar, detener }
}

/**
 * linterna → flash de la cámara trasera encendido (Chrome Android).
 * pantalla → el navegador no permite el flash (Safari iOS, escritorio) o no
 *            dio permiso de cámara: se usa la pantalla en blanco como luz.
 */
export type ModoLinterna = 'apagada' | 'encendiendo' | 'linterna' | 'pantalla'

export function useLinterna() {
  const [modo, setModo] = useState<ModoLinterna>('apagada')
  const trackRef = useRef<MediaStreamTrack | null>(null)

  const apagar = useCallback(() => {
    const track = trackRef.current
    trackRef.current = null
    if (track) {
      track.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }).catch(() => {})
      track.stop()
    }
    setModo('apagada')
  }, [])

  const encender = useCallback(async () => {
    if (trackRef.current) return
    setModo('encendiendo')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin cámara')
      // Recién aquí se pide la cámara: solo para controlar el flash, no se graba nada.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      const track = stream.getVideoTracks()[0]
      const capacidades = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
      if (!track || !capacidades?.torch) {
        track?.stop()
        setModo('pantalla')
        return
      }
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] })
      trackRef.current = track
      setModo('linterna')
    } catch {
      setModo('pantalla')
    }
  }, [])

  // Liberar la cámara al desmontar.
  useEffect(() => () => trackRef.current?.stop(), [])

  const alternar = useCallback(() => {
    if (modo === 'apagada') void encender()
    else apagar()
  }, [modo, encender, apagar])

  return { modo, alternar, apagar }
}
