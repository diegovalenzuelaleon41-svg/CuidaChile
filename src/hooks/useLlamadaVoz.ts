import { useCallback, useEffect, useRef, useState } from 'react'
// Solo tipos: livekit-client se carga bajo demanda en conectar() para no
// engordar la página que se abre en una emergencia (a veces con mala señal).
import type { RemoteTrack, Room } from 'livekit-client'
import { supabase } from '../lib/supabase'
import { ErrorLlamada, pedirTokenLlamada, type CallSession } from '../lib/llamadas'

/**
 * inactiva      → sin conexión a LiveKit.
 * conectando    → pidiendo token / entrando a la sala.
 * esperando     → dentro de la sala, el otro aún no llega (o se fue).
 * conectada     → el otro participante está en la sala: hay audio en ambos sentidos.
 * reconectando  → se cayó la red; LiveKit está reintentando solo.
 * error         → no se pudo conectar o se cortó (ver `error`).
 */
export type FaseVoz = 'inactiva' | 'conectando' | 'esperando' | 'conectada' | 'reconectando' | 'error'

/**
 * Por qué falló, para mostrar la salida correcta (no todo es "mala red"):
 * sin_configurar → el servidor no tiene credenciales de LiveKit (no sirve reintentar).
 * sin_https      → el navegador bloquea el micrófono fuera de HTTPS/localhost.
 * servidor       → el token no se pudo emitir (permiso, llamada cerrada…).
 * red            → no se pudo entrar a la sala (o tardó demasiado).
 * corte          → estaba conectada y se cayó.
 */
export type MotivoFalloVoz = 'sin_configurar' | 'sin_https' | 'servidor' | 'red' | 'corte'

/** Pasado este tiempo en "conectando" se sugiere el plan B (sin abandonar el intento). */
const AVISO_LENTO_MS = 5000
/** Pasado este tiempo se da por fallida la conexión. */
const TIMEOUT_CONEXION_MS = 20000

type LiveKit = typeof import('livekit-client')

/** Logs de diagnóstico sin datos sensibles (nunca el token). */
function log(...datos: unknown[]) {
  console.info('[llamada]', ...datos)
}

/**
 * Logs internos de LiveKit (estados ICE, candidatos, TURN) solo si se pide:
 * en la consola del navegador, localStorage.setItem('cuidachile.debugLlamada', '1').
 */
function modoDepuracion() {
  try {
    return localStorage.getItem('cuidachile.debugLlamada') === '1'
  } catch {
    return false
  }
}

function mensajeMicrofono(lk: LiveKit, e: unknown, otro: string): string {
  switch (lk.MediaDeviceFailure.getFailure(e)) {
    case lk.MediaDeviceFailure.PermissionDenied:
      return `Habilita el micrófono en tu navegador para hablar con ${otro}.`
    case lk.MediaDeviceFailure.NotFound:
      return 'No encontramos un micrófono en este dispositivo.'
    case lk.MediaDeviceFailure.DeviceInUse:
      return 'Otra aplicación está usando el micrófono.'
    default:
      return 'No pudimos activar el micrófono.'
  }
}

/**
 * Conexión de audio a la sala LiveKit de una sesión de llamada. La usan el
 * usuario y el operador. `conectar()` debe llamarse desde un toque/clic: así
 * el navegador (sobre todo Safari iOS) permite reproducir audio y recién ahí
 * se pide el micrófono.
 *
 * La fase local solo dice "conectada" cuando el otro participante está
 * realmente en la sala; el estado oficial (call_sessions.status) lo mueven la
 * base de datos y el webhook de LiveKit.
 */
export function useLlamadaVoz(sesion: CallSession | null, otro = 'el operador') {
  const [fase, setFase] = useState<FaseVoz>('inactiva')
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<MotivoFalloVoz | null>(null)
  const [lento, setLento] = useState(false)
  const [avisoMicrofono, setAvisoMicrofono] = useState<string | null>(null)
  const [microfonoActivo, setMicrofonoActivo] = useState(false)
  const [audioBloqueado, setAudioBloqueado] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  const roomRef = useRef<Room | null>(null)
  const lkRef = useRef<LiveKit | null>(null)
  const callIdRef = useRef<string | null>(null)
  // true mientras cerramos a propósito: el evento Disconnected no es un error.
  const cerrandoRef = useRef(false)
  const audiosRef = useRef(new Set<HTMLMediaElement>())

  const limpiar = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null
    callIdRef.current = null
    if (room) {
      cerrandoRef.current = true
      room.removeAllListeners()
      void room.disconnect()
    }
    audiosRef.current.forEach((el) => el.remove())
    audiosRef.current.clear()
    setMicrofonoActivo(false)
    setAudioBloqueado(false)
  }, [])

  // Liberar micrófono y conexión al desmontar.
  useEffect(() => limpiar, [limpiar])

  const reportar = useCallback((callId: string, conectado: boolean) => {
    void supabase.rpc('reportar_conexion_llamada', { p_call_id: callId, p_conectado: conectado }).then(({ error }) => {
      if (error) console.error('[llamada] no se pudo reportar la conexión:', error.code)
    })
  }, [])

  const conectar = useCallback(async () => {
    if (!sesion || roomRef.current) return
    if (sesion.status !== 'connecting' && sesion.status !== 'active') return
    const callId = sesion.id
    cerrandoRef.current = false
    setError(null)
    setMotivo(null)
    setAvisoMicrofono(null)

    // El micrófono solo existe en contexto seguro (HTTPS o localhost).
    if (!window.isSecureContext || !navigator.mediaDevices) {
      log('contexto no seguro: el navegador bloquea el micrófono')
      setFase('error')
      setMotivo('sin_https')
      setError('El navegador bloquea el micrófono en conexiones no seguras. Abre CuidaChile desde su dirección https://.')
      return
    }
    setLento(false)
    setFase('conectando')

    let lk: LiveKit
    try {
      lk = lkRef.current ?? (await import('livekit-client'))
      lkRef.current = lk
    } catch {
      setFase('error')
      setMotivo('red')
      setError('No pudimos cargar el módulo de llamadas. Revisa tu conexión.')
      return
    }
    const { Room, RoomEvent, Track } = lk
    lk.setLogLevel(modoDepuracion() ? 'debug' : 'warn')
    if (roomRef.current) return // otro conectar() ganó mientras cargaba

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      disconnectOnPageLeave: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    roomRef.current = room
    callIdRef.current = callId

    const presencia = () => {
      if (roomRef.current !== room) return
      setFase(room.remoteParticipants.size > 0 ? 'conectada' : 'esperando')
    }

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return
        const el = track.attach()
        el.setAttribute('data-cuidachile-llamada', '')
        document.body.appendChild(el)
        audiosRef.current.add(el)
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => {
          el.remove()
          audiosRef.current.delete(el)
        })
      })
      .on(RoomEvent.ParticipantConnected, presencia)
      .on(RoomEvent.ParticipantDisconnected, presencia)
      .on(RoomEvent.Reconnecting, () => setFase('reconectando'))
      .on(RoomEvent.Reconnected, presencia)
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBloqueado(!room.canPlaybackAudio))
      // Diagnóstico: estado de la conexión (señalización + WebRTC) y del micrófono.
      .on(RoomEvent.ConnectionStateChanged, (estado) => log('conexión:', estado))
      .on(RoomEvent.SignalReconnecting, () => log('señalización reconectando'))
      .on(RoomEvent.MediaDevicesError, (e: Error) => log('error de dispositivo:', e.name, e.message))
      .on(RoomEvent.Disconnected, (razon) => {
        log('desconectado:', razon != null ? lk.DisconnectReason[razon] : 'sin razón')
        if (cerrandoRef.current || roomRef.current !== room) return
        // LiveKit agotó la reconexión: la llamada se cortó.
        reportar(callId, false)
        limpiar()
        setFase('error')
        setMotivo('corte')
        setError('Se cortó la llamada. Revisa tu conexión e intenta de nuevo.')
      })

    let token: string
    let url: string
    try {
      ;({ token, url } = await pedirTokenLlamada(callId))
    } catch (e) {
      if (roomRef.current !== room) return
      limpiar()
      setFase('error')
      const codigo = e instanceof ErrorLlamada ? e.codigo : undefined
      log('token rechazado:', codigo ?? (e as Error).message)
      setMotivo(codigo === 'sin_configurar' ? 'sin_configurar' : 'servidor')
      setError(e instanceof ErrorLlamada ? e.message : 'No pudimos preparar la llamada.')
      return
    }
    if (roomRef.current !== room) return // se colgó mientras pedíamos el token

    try {
      // LiveKit Cloud entrega sus propios servidores STUN/TURN (UDP, TCP y
      // TURN/TLS por el puerto 443) en la señalización: no se configuran aquí.
      let vencido: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        room.connect(url, token),
        new Promise<never>((_, rechazar) => {
          vencido = setTimeout(() => rechazar(new Error('tiempo de conexión agotado')), TIMEOUT_CONEXION_MS)
        }),
      ]).finally(() => clearTimeout(vencido))
      log('en la sala')
    } catch (e) {
      if (roomRef.current !== room) return
      log('no se pudo entrar a la sala:', (e as Error).message)
      limpiar()
      setFase('error')
      setMotivo('red')
      setError('No pudimos conectar la llamada. Revisa tu conexión a internet.')
      return
    }

    // Dentro de un gesto del usuario: desbloquea el audio en Safari iOS.
    try {
      await room.startAudio()
    } catch {
      /* se reintenta con el botón "Activar sonido" */
    }
    setAudioBloqueado(!room.canPlaybackAudio)

    // Recién ahora se pide el micrófono. Sin micrófono igual se escucha al otro.
    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      setMicrofonoActivo(true)
    } catch (e) {
      log('micrófono no disponible:', (e as Error).name)
      setMicrofonoActivo(false)
      setAvisoMicrofono(mensajeMicrofono(lk, e, otro))
    }

    presencia()
    reportar(callId, true)
  }, [sesion, otro, limpiar, reportar])

  /** Cuelga: cierra la sesión en la base de datos y sale de la sala. */
  const colgar = useCallback(async () => {
    const callId = callIdRef.current ?? sesion?.id
    limpiar()
    setFase('inactiva')
    setError(null)
    setMotivo(null)
    setAvisoMicrofono(null)
    if (!callId) return
    const { error } = await supabase.rpc('finalizar_llamada', { p_call_id: callId })
    if (error) console.error('[llamada] no se pudo finalizar:', error.code)
  }, [sesion?.id, limpiar])

  const alternarMicrofono = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const activar = !room.localParticipant.isMicrophoneEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(activar)
      setMicrofonoActivo(activar)
      setAvisoMicrofono(null)
    } catch (e) {
      setMicrofonoActivo(false)
      if (lkRef.current) setAvisoMicrofono(mensajeMicrofono(lkRef.current, e, otro))
    }
  }, [otro])

  /** Safari iOS puede bloquear el audio entrante hasta otro toque. */
  const activarAudio = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.startAudio()
    } catch {
      /* sigue bloqueado */
    }
    setAudioBloqueado(!room.canPlaybackAudio)
  }, [])

  // La sesión terminó en el servidor (el otro colgó, alerta cerrada, webhook)
  // o cambió a otra llamada: salir de la sala.
  const estado = sesion?.status
  const sesionId = sesion?.id
  useEffect(() => {
    if (!roomRef.current) return
    const otraLlamada = sesionId !== callIdRef.current
    if (otraLlamada || estado === 'ended' || estado === 'failed' || estado === 'cancelled') {
      limpiar()
      setFase('inactiva')
    }
  }, [estado, sesionId, limpiar])

  // Plan B a los 5 s si sigue "conectando" (típico de redes móviles inestables).
  useEffect(() => {
    if (fase !== 'conectando') return
    const t = setTimeout(() => setLento(true), AVISO_LENTO_MS)
    return () => clearTimeout(t)
  }, [fase])

  // Reloj de la duración (solo mientras la llamada está activa).
  useEffect(() => {
    if (estado !== 'active') return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [estado])

  const duracion =
    estado === 'active' && sesion?.started_at
      ? Math.max(0, Math.floor((ahora - Date.parse(sesion.started_at)) / 1000))
      : null

  return {
    fase,
    error,
    motivo,
    // Solo cuenta mientras sigue conectando.
    lento: lento && fase === 'conectando',
    avisoMicrofono,
    microfonoActivo,
    audioBloqueado,
    duracion,
    conectar,
    colgar,
    alternarMicrofono,
    activarAudio,
  }
}
