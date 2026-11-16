import { useCallback, useEffect, useRef, useState } from 'react'

export type EstadoGrabadora = 'inactiva' | 'pidiendo' | 'grabando' | 'error'

/** Chrome/Android graban webm/opus; Safari/iPhone solo mp4. */
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function formatoSoportado(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f))
}

/**
 * Nota de voz corta. onLista recibe el audio al detener (o al llegar al
 * máximo). El micrófono se suelta apenas termina la grabación.
 */
export function useGrabadoraAudio(maxSegundos: number, onLista: (audio: Blob) => void) {
  const [estado, setEstado] = useState<EstadoGrabadora>('inactiva')
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const onListaRef = useRef(onLista)
  useEffect(() => {
    onListaRef.current = onLista
  })

  const detener = useCallback(() => {
    if (recRef.current?.state === 'recording') recRef.current.stop()
  }, [])

  const iniciar = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setEstado('error')
      setError(window.isSecureContext ? 'Tu navegador no permite grabar audio.' : 'Grabar audio requiere abrir la app con HTTPS.')
      return
    }
    setEstado('pidiendo')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setEstado('error')
      setError('Permite el micrófono en tu navegador para grabar una nota de voz.')
      return
    }
    const mimeType = formatoSoportado()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const partes: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) partes.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      recRef.current = null
      setEstado('inactiva')
      const audio = new Blob(partes, { type: rec.mimeType || mimeType || 'audio/webm' })
      if (audio.size > 0) onListaRef.current(audio)
    }
    recRef.current = rec
    rec.start()
    setSegundos(0)
    setEstado('grabando')
  }, [])

  // Contador y corte automático al máximo.
  useEffect(() => {
    if (estado !== 'grabando') return
    const t0 = Date.now()
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setSegundos(s)
      if (s >= maxSegundos) detener()
    }, 250)
    return () => clearInterval(t)
  }, [estado, maxSegundos, detener])

  // Al desmontar (cerrar el modal) no queda el micrófono abierto ni se guarda nada.
  useEffect(
    () => () => {
      const rec = recRef.current
      if (rec?.state === 'recording') {
        rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop())
        rec.stop()
      }
    },
    [],
  )

  return { estado, segundos, error, iniciar, detener }
}
