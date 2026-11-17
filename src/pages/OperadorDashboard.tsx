/**
 * Panel de Operador — Centro de Comando (Fase 2), estilo "Dark Control Room".
 *
 * Dashboard desktop-first, sin scroll general (h-[100dvh]).
 * Escritorio (lg): tres columnas + header superior. Teléfono: una columna a la vez
 * (Bandeja, Mapa, Caso) con una barra de pestañas abajo, al alcance del pulgar. SOS (tabla alertas), acompañamientos
 * (tabla acompanamientos) y Barrial (tabla reportes, agrupados por zona)
 * son reales vía Supabase Realtime.
 *
 * Ruta: /operador/dashboard
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone,
  Users,
  Pin,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Loader2,
  HardHat,
  ArrowLeft,
  Radar,
  ScrollText,
  MessagesSquare,
  X,
  List,
  Clock3,
  UserRound,
  ShieldAlert,
  TriangleAlert,
  History,
  ContactRound,
  CircleCheck,
  EyeOff,
  Layers,
  Inbox,
  Map as MapIcon,
  ClipboardList,
} from 'lucide-react'
import Logo from '../components/Logo'
import MapaOperador from '../components/operador/MapaOperador'
import ChatCiudadano, { type MotivoSinChat } from '../components/operador/ChatCiudadano'
import { useChat } from '../hooks/useChatAcompanamiento'
import { useAuth } from '../auth/AuthContext'
import { useAcompanamientosOperador, useSeguimientoAcompanamiento } from '../hooks/useAcompanamientosOperador'
import { useAlertasSOSOperador } from '../hooks/useAlertasSOSOperador'
import { useSesionLlamada } from '../hooks/useSesionLlamada'
import {
  MOTIVOS_ESCALAMIENTO,
  textoMotivoEscalamiento,
  useContextoCiudadano,
  useEscalamientos,
  type MotivoEscalamiento,
} from '../hooks/useCasoOperador'
import { SENAL_PERDIDA_MS } from '../lib/acompanamientos'
import { useLlamadaVoz } from '../hooks/useLlamadaVoz'
import ControlesLlamada from '../components/llamada/ControlesLlamada'
import { supabase } from '../lib/supabase'
import type { Acompanamiento } from '../lib/acompanamientos'
import type { AlertaSOS } from '../lib/alertas'
import { COLOR_NEON, MOTIVOS_DESCARTE, filtrarPorTipo, type Alerta, type AlertaTipo } from '../lib/mockAlerts'
import { useReportesOperador } from '../hooks/useReportesOperador'
import { ETIQUETA_CATEGORIA, agruparReportes, type ReporteOperador } from '../lib/reportes'
import { BotonAudio, MiniaturaFoto } from '../components/operador/EvidenciaReporte'

type TabId = AlertaTipo | 'TODAS'

/* ──────────────────── Helpers por tipo ──────────────────── */

/** Mismos colores neón que los pines del mapa. */
function colorPorTipo(tipo: AlertaTipo) {
  return COLOR_NEON[tipo]
}

function labelPorTipo(tipo: AlertaTipo) {
  switch (tipo) {
    case 'SOS':
      return 'SOS'
    case 'BARRIAL':
      return 'Barrial'
    case 'ACOMPANAMIENTO':
      return 'Acompañamiento'
  }
}

function iconoPorTipo(tipo: AlertaTipo, size = 14) {
  switch (tipo) {
    case 'SOS':
      return <AlertCircle size={size} strokeWidth={2} />
    case 'BARRIAL':
      return <Users size={size} strokeWidth={2} />
    case 'ACOMPANAMIENTO':
      return <Pin size={size} strokeWidth={2} />
  }
}

/** Botón de acción de cada tarjeta. Clases estáticas para que Tailwind las genere. */
const ACCION_POR_TIPO: Record<AlertaTipo, { texto: string; clases: string }> = {
  SOS: {
    texto: 'Atender',
    clases:
      'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.65)] hover:bg-red-400 hover:shadow-[0_0_22px_rgba(239,68,68,0.85)]',
  },
  BARRIAL: {
    texto: 'Validar',
    clases:
      'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.45)] hover:bg-amber-400',
  },
  ACOMPANAMIENTO: {
    texto: 'Aceptar Monitoreo',
    clases:
      'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.45)] hover:bg-blue-400',
  },
}

const BARRA_POR_TIPO: Record<AlertaTipo, string> = {
  SOS: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]',
  BARRIAL: 'bg-amber-500',
  ACOMPANAMIENTO: 'bg-blue-500',
}

const TEXTO_POR_TIPO: Record<AlertaTipo, string> = {
  SOS: 'text-red-400',
  BARRIAL: 'text-amber-400',
  ACOMPANAMIENTO: 'text-blue-400',
}

function estadoTexto(estado: Alerta['estado']) {
  switch (estado) {
    case 'PENDIENTE':
      return 'Pendiente'
    case 'EN_PROCESO':
      return 'En proceso'
    case 'RESUELTA':
      return 'Resuelta'
    case 'DESCARTADA':
      return 'Descartada'
  }
}

function estadoClases(estado: Alerta['estado']) {
  return estado === 'RESUELTA'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : estado === 'EN_PROCESO'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-slate-700/60 text-slate-300 border-slate-600'
}

/* ──────────────────── Acompañamientos reales → tarjetas ──────────────────── */

const SANTIAGO_CENTRO = { lat: -33.4489, lng: -70.6693 }

function horaDe(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Alto aprox. de la tarjeta flotante: el mapa centra el pin por encima de ella. */
const MARGEN_TARJETA_FLOTANTE = 370

/** Hora con segundos (es-CL), p. ej. "12:46:16 p. m.". */
function horaLarga(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CL')
}

/**
 * Avance del ciudadano en su ruta (0–1): cuánto se acercó al destino respecto
 * de la distancia inicial. Aproximación plana, suficiente para la barra.
 */
function progresoRuta(a: Alerta): number | null {
  if (!a.rutaCoords || a.sinUbicacion) return null
  const [oLng, oLat] = a.rutaCoords.origen
  const [dLng, dLat] = a.rutaCoords.destino
  const k = Math.cos((dLat * Math.PI) / 180)
  const dist = (lng1: number, lat1: number, lng2: number, lat2: number) => Math.hypot((lng1 - lng2) * k, lat1 - lat2)
  const total = dist(oLng, oLat, dLng, dLat)
  if (total === 0) return 1
  return Math.min(1, Math.max(0, 1 - dist(a.lng, a.lat, dLng, dLat) / total))
}

/** "3 min en espera" / "12 min de monitoreo" para el panel de detalle. */
function tiempoAcompanamiento(a: Alerta, ahora: number): string | null {
  if (!a.creadoEn) return null
  const desde = a.estado === 'PENDIENTE' ? a.creadoEn : a.aceptadoEn
  if (!desde || a.estado === 'RESUELTA') return null
  const min = Math.max(0, Math.floor((ahora - Date.parse(desde)) / 60000))
  const txt = min < 1 ? 'menos de 1 min' : `${min} min`
  return a.estado === 'PENDIENTE' ? `${txt} en espera` : `${txt} de monitoreo`
}

function acompanamientoAAlerta(a: Acompanamiento): Alerta {
  const timeline = [`${horaDe(a.creado_en)} - Solicitud de acompañamiento recibida`]
  if (a.aceptado_en) timeline.push(`${horaDe(a.aceptado_en)} - Aceptaste el monitoreo`)
  if (a.finalizado_en) timeline.push(`${horaDe(a.finalizado_en)} - Acompañamiento finalizado`)
  // Sin GPS en vivo (p. ej. recién solicitado con ubicación aproximada): se dibuja en el
  // punto de partida de su ruta para que la solicitud aparezca en el mapa desde el primer momento.
  const sinGps = a.lat_actual == null || a.lng_actual == null
  const soloOrigen = sinGps && a.origen_lat != null && a.origen_lng != null
  const sinUbicacion = sinGps && !soloOrigen
  const rutaCoords =
    a.origen_lat != null && a.origen_lng != null && a.destino_lat != null && a.destino_lng != null
      ? {
          origen: [a.origen_lng, a.origen_lat] as [number, number],
          destino: [a.destino_lng, a.destino_lat] as [number, number],
        }
      : undefined
  return {
    id: a.id,
    tipo: 'ACOMPANAMIENTO',
    nombre: a.usuario_nombre ?? 'Usuario CuidaChile',
    telefono: a.usuario_telefono ?? '',
    hora: horaDe(a.creado_en),
    lat: a.lat_actual ?? a.origen_lat ?? SANTIAGO_CENTRO.lat,
    lng: a.lng_actual ?? a.origen_lng ?? SANTIAGO_CENTRO.lng,
    sinUbicacion,
    soloOrigen,
    rutaCoords,
    creadoEn: a.creado_en,
    aceptadoEn: a.aceptado_en ?? undefined,
    actualizadoEn: a.actualizado_en,
    ruta: `${a.origen} → ${a.destino}`,
    estado: a.estado === 'PENDIENTE' ? 'PENDIENTE' : a.estado === 'EN_CURSO' ? 'EN_PROCESO' : 'RESUELTA',
    usuarioId: a.usuario_id,
    timeline,
  }
}

/* ──────────────────── SOS reales → tarjetas ──────────────────── */

function sosAAlerta(a: AlertaSOS): Alerta {
  const timeline = [`${horaDe(a.creada_en)} - Alerta SOS recibida`]
  if (a.lat == null || a.lng == null) timeline.push(`${horaDe(a.creada_en)} - Sin ubicación GPS del ciudadano`)
  if (a.atendida_en) timeline.push(`${horaDe(a.atendida_en)} - Atendiste la alerta`)
  if (a.estado === 'resuelta' && a.cerrada_en) timeline.push(`${horaDe(a.cerrada_en)} - Alerta marcada como resuelta`)
  return {
    id: a.id,
    tipo: 'SOS',
    nombre: a.usuario_nombre ?? 'Usuario CuidaChile',
    telefono: a.usuario_telefono ?? '',
    hora: horaDe(a.creada_en),
    lat: a.lat ?? SANTIAGO_CENTRO.lat,
    lng: a.lng ?? SANTIAGO_CENTRO.lng,
    sinUbicacion: a.lat == null || a.lng == null,
    creadoEn: a.creada_en,
    aceptadoEn: a.atendida_en ?? undefined,
    actualizadoEn: a.actualizado_en,
    estado: a.estado === 'activa' ? 'PENDIENTE' : a.estado === 'en_atencion' ? 'EN_PROCESO' : 'RESUELTA',
    usuarioId: a.usuario_id,
    timeline,
  }
}

/* ──────────────────── Reportes barriales reales → tarjetas ──────────────────── */

/**
 * Un grupo de reportes cercanos = una tarjeta. El id es el del primer reporte
 * (estable aunque lleguen más a la zona); el contenido, el del más reciente.
 */
function grupoBarrialAAlerta(grupo: ReporteOperador[]): Alerta {
  const r = grupo[grupo.length - 1]
  const recientes = [...grupo].reverse()
  return {
    id: grupo[0].id,
    tipo: 'BARRIAL',
    // Anónimo: el nombre no llega (el servidor no lo copia) y no se muestra.
    nombre: r.es_anonimo ? 'Vecino anónimo' : (r.usuario_nombre ?? 'Vecino CuidaChile'),
    telefono: '',
    hora: horaDe(r.creado_en),
    lat: r.lat,
    lng: r.lng,
    descripcion: r.descripcion ?? undefined,
    creadoEn: r.creado_en,
    estado: 'PENDIENTE',
    timeline: grupo.map((g) => `${horaDe(g.creado_en)} - Reporte recibido: ${ETIQUETA_CATEGORIA[g.categoria]}`),
    barrial: {
      categoria: ETIQUETA_CATEGORIA[r.categoria],
      anonimo: r.es_anonimo,
      ids: grupo.map((g) => g.id),
      fotos: recientes.flatMap((g) => (g.evidencia_url ? [g.evidencia_url] : [])),
      audios: recientes.flatMap((g) => (g.audio_url ? [g.audio_url] : [])),
      otras: recientes.slice(1).map((g) => ({
        hora: horaDe(g.creado_en),
        descripcion: g.descripcion,
        categoria: ETIQUETA_CATEGORIA[g.categoria],
      })),
    },
  }
}

/* ──────────────────── Señal perdida ──────────────────── */

/**
 * Segundos sin noticias del teléfono del ciudadano, o null si no aplica.
 * Aplica a casos reales que deberían estar enviando GPS: un SOS abierto o un
 * acompañamiento en curso, con ubicación previa. El teléfono reenvía su
 * posición al menos cada 15 s aunque no se mueva, así que 45 s de silencio
 * significan señal perdida (no "persona quieta").
 */
function segundosSinSenal(a: Alerta, esReal: boolean, ahora: number): number | null {
  if (!esReal || a.sinUbicacion || a.soloOrigen || !a.actualizadoEn || a.estado === 'RESUELTA') return null
  if (a.tipo === 'ACOMPANAMIENTO' && a.estado !== 'EN_PROCESO') return null
  const ms = ahora - Date.parse(a.actualizadoEn)
  return ms > SENAL_PERDIDA_MS ? Math.floor(ms / 1000) : null
}

/** "52 s" / "3 min" */
function textoDuracionCorta(seg: number) {
  return seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min`
}

/** Alarma corta (dos tonos) al llegar un SOS. Sin archivos de audio. */
function sonarAlarmaSOS() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.28].forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.08, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.24)
    })
    setTimeout(() => void ctx.close(), 800)
  } catch {
    /* sin audio (permisos de autoplay): la tarjeta igual aparece */
  }
}

export default function OperadorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  /* ── Aviso flotante (también lo usan los hooks en vivo) ── */
  const [aviso, setAviso] = useState<string | null>(null)
  // Por id: la tarjeta seleccionada se recalcula con cada cambio en vivo.
  const [seleccionId, setSeleccionId] = useState<string | null>(null)

  /* ── SOS reales (Realtime) ── */
  const sos = useAlertasSOSOperador(user?.id, {
    onNueva: (a) => {
      sonarAlarmaSOS()
      setAviso(`Nueva alerta SOS de ${a.usuario_nombre ?? 'un ciudadano'}.`)
      // Sin caso abierto en pantalla: el mapa vuela al SOS. Si ya atiende otro, no se lo quitamos.
      setSeleccionId((actual) => actual ?? a.id)
    },
    onCancelada: (a) => setAviso(`${a.usuario_nombre ?? 'El ciudadano'} canceló su alerta SOS.`),
  })
  const idsSOS = new Set(sos.lista.map((a) => a.id))

  /* ── Llamada de voz (LiveKit) ──
     Ligada a una alerta (no a la selección): cambiar de tarjeta no corta la llamada. */
  const [llamadaAlertaId, setLlamadaAlertaId] = useState<string | null>(null)
  const { sesion: sesionLlamada, recargar: recargarLlamada } = useSesionLlamada(llamadaAlertaId)
  const voz = useLlamadaVoz(sesionLlamada, 'el ciudadano')
  const enLlamada = voz.fase !== 'inactiva' && voz.fase !== 'error'
  const alertaLlamada = sos.lista.find((a) => a.id === llamadaAlertaId) ?? null
  // Tras aceptar, entrar a la sala apenas llegue la sesión 'connecting'.
  const autoConectarRef = useRef<string | null>(null)
  const conectarVoz = voz.conectar
  useEffect(() => {
    if (!sesionLlamada || autoConectarRef.current !== sesionLlamada.incident_id) return
    if (sesionLlamada.status !== 'connecting' || voz.fase !== 'inactiva') return
    autoConectarRef.current = null
    void conectarVoz()
  }, [sesionLlamada, voz.fase, conectarVoz])
  // La alerta salió de la bandeja (descartada/cancelada): se suelta el panel.
  useEffect(() => {
    if (llamadaAlertaId && !sos.cargando && !sos.lista.some((a) => a.id === llamadaAlertaId) && !enLlamada) {
      setLlamadaAlertaId(null)
    }
  }, [llamadaAlertaId, sos.lista, sos.cargando, enLlamada])

  /**
   * Toma la alerta y su llamada en UNA operación atómica (aceptar_llamada):
   * si otro operador se adelantó, falla sin asignar nada. Devuelve error o null.
   */
  const aceptarSOSConLlamada = async (alertaId: string): Promise<string | null> => {
    const { data: pendiente } = await supabase
      .from('call_sessions')
      .select('id')
      .eq('incident_id', alertaId)
      .eq('status', 'pending')
      .maybeSingle()
    if (pendiente) {
      const { error } = await supabase.rpc('aceptar_llamada', { p_call_id: pendiente.id })
      if (error) {
        console.error('[llamada] no se pudo aceptar:', error.code, error.message)
        void sos.recargar()
        return error.hint === 'llamada_tomada'
          ? 'Otro operador ya tomó esta alerta.'
          : 'No se pudo aceptar la alerta.'
      }
    } else {
      // Alerta sin sesión pendiente (p. ej. anterior a las llamadas): se atiende y se abre una llamada.
      const error = await sos.atender(alertaId)
      if (error) return error
      const { error: errLlamada } = await supabase.rpc('nueva_llamada', { p_alerta_id: alertaId })
      if (errLlamada) console.error('[llamada] no se pudo abrir la llamada:', errLlamada.code)
    }
    void sos.recargar()
    return null
  }

  /** Abre (o reabre) la llamada de voz con el ciudadano de una alerta que ya atiendo. */
  const llamarPorVoz = async (alertaId: string) => {
    if (enLlamada && llamadaAlertaId !== alertaId) {
      setAviso('Termina la llamada en curso antes de iniciar otra.')
      return
    }
    const { error } = await supabase.rpc('nueva_llamada', { p_alerta_id: alertaId })
    if (error) {
      console.error('[llamada] no se pudo iniciar:', error.code, error.message)
      setAviso('No se pudo iniciar la llamada.')
      return
    }
    autoConectarRef.current = alertaId
    setLlamadaAlertaId(alertaId)
    void recargarLlamada()
  }

  /* ── Acompañamientos reales (Realtime) ── */
  const acomp = useAcompanamientosOperador(user?.id)
  const idsReales = new Set(acomp.lista.map((a) => a.id))

  /* ── Reportes barriales reales (Realtime), agrupados a ≤ 200 m ── */
  const reportes = useReportesOperador(user?.id)

  /* ── Escalamientos a supervisor (SOS y acompañamientos) ── */
  const escalamientos = useEscalamientos(
    sos.lista.map((a) => a.id),
    acomp.lista.map((a) => a.id),
  )
  const conEscalada = (a: Alerta): Alerta => {
    const real = escalamientos.porId[a.id]
    return real ? { ...a, escalada: { motivo: textoMotivoEscalamiento(real.motivo), en: real.creado_en } } : a
  }
  const [porEscalar, setPorEscalar] = useState<Alerta | null>(null)

  /* ── Estado ── */
  // Las descartadas y revisadas salen de la bandeja (ya no vienen de Supabase).
  const alertas = [
    ...sos.lista.map(sosAAlerta),
    ...acomp.lista.map(acompanamientoAAlerta),
    // Más recientes primero, como el resto de la bandeja.
    ...agruparReportes(reportes.lista).map(grupoBarrialAAlerta).reverse(),
  ].map(conEscalada)
  // Alerta a la espera de confirmar el rechazo (modal).
  const [porRechazar, setPorRechazar] = useState<Alerta | null>(null)
  const [tabActivo, setTabActivo] = useState<TabId>('SOS')
  const alertaSeleccionada = alertas.find((a) => a.id === seleccionId) ?? null
  // Reloj para el "Tiempo" del acompañamiento y el contador de "señal perdida".
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  /* ── Seguimiento en vivo del acompañamiento seleccionado ── */
  const idSeguido =
    alertaSeleccionada && idsReales.has(alertaSeleccionada.id) && alertaSeleccionada.estado === 'EN_PROCESO'
      ? alertaSeleccionada.id
      : null
  useSeguimientoAcompanamiento(idSeguido, (lat, lng) => {
    if (idSeguido) acomp.moverUsuario(idSeguido, lat, lng)
  })
  /** En vivo: el acompañamiento seguido o cualquier SOS en atención (su GPS llega en la misma fila). */
  const esEnVivo = (a: Alerta) => idSeguido === a.id || (idsSOS.has(a.id) && a.estado === 'EN_PROCESO')
  const sinSenal = (a: Alerta) => segundosSinSenal(a, idsSOS.has(a.id) || idsReales.has(a.id), ahora)

  /* ── Acciones ── */

  const alertasFiltradas = filtrarPorTipo(alertas, tabActivo)

  /** Barrial: validar difunde a los vecinos (y avisa al autor); actúa sobre todo el grupo. */
  const validarBarrial = async (alerta: Alerta) => {
    if (!alerta.barrial) return
    const error = await reportes.revisar(alerta.barrial.ids, 'validado')
    if (error) {
      setAviso(error)
      return
    }
    setSeleccionId((sel) => (sel === alerta.id ? null : sel))
    const n = alerta.barrial.ids.length
    setAviso(n > 1 ? `${n} reportes validados. Se alertó a los vecinos.` : 'Reporte validado. Se alertó a los vecinos.')
  }

  const manejarAccion = async (alerta: Alerta) => {
    if (alerta.barrial) {
      await validarBarrial(alerta)
      return
    }
    if (idsSOS.has(alerta.id)) {
      if (enLlamada && llamadaAlertaId !== alerta.id) {
        setAviso('Termina la llamada en curso antes de atender otra alerta.')
        return
      }
      const error = await aceptarSOSConLlamada(alerta.id)
      if (error) {
        setAviso(error)
        return
      }
      setSeleccionId(alerta.id)
      // Al atender se entra a la llamada de voz automáticamente.
      autoConectarRef.current = alerta.id
      setLlamadaAlertaId(alerta.id)
      setAviso(`Atendiendo SOS de ${alerta.nombre}. Conectando llamada…`)
      return
    }
    if (!idsReales.has(alerta.id)) return
    const error = await acomp.aceptar(alerta.id)
    if (error) {
      setAviso(error)
      return
    }
    // Al aceptar, el mapa pasa a seguir al usuario.
    setSeleccionId(alerta.id)
    setAviso(`Monitoreando a ${alerta.nombre}.`)
  }

  const confirmarRechazo = async (alerta: Alerta, motivo: string) => {
    setPorRechazar(null)
    if (idsSOS.has(alerta.id)) {
      const error = await sos.descartar(alerta.id, motivo)
      if (error) {
        setAviso(error)
        return
      }
    } else if (idsReales.has(alerta.id)) {
      const error = await acomp.descartar(alerta.id, motivo)
      if (error) {
        setAviso(error)
        return
      }
    } else if (alerta.barrial) {
      // El autor recibe "Tu reporte fue revisado y descartado".
      const error = await reportes.revisar(alerta.barrial.ids, 'descartado', motivo)
      if (error) {
        setAviso(error)
        return
      }
    }
    // Si estaba en el panel central, vuelve a "Sin alerta seleccionada".
    setSeleccionId((sel) => (sel === alerta.id ? null : sel))
    setAviso(alerta.barrial ? `Reporte descartado (${motivo}).` : `Alerta descartada (${motivo}).`)
  }

  const confirmarEscalamiento = async (alerta: Alerta, motivo: MotivoEscalamiento) => {
    setPorEscalar(null)
    // Solo SOS y acompañamientos se escalan (un reporte barrial se valida o descarta).
    if (!idsSOS.has(alerta.id) && !idsReales.has(alerta.id)) return
    const caso = idsSOS.has(alerta.id) ? { alertaId: alerta.id } : { acompanamientoId: alerta.id }
    const error = await escalamientos.escalar(caso, motivo)
    if (error) {
      setAviso(error)
      return
    }
    setAviso(`Caso escalado a supervisor (${textoMotivoEscalamiento(motivo)}).`)
  }

  const marcarResuelta = async () => {
    if (!alertaSeleccionada) return
    if (idsSOS.has(alertaSeleccionada.id)) {
      const error = await sos.resolver(alertaSeleccionada.id)
      if (error) setAviso(error)
      return
    }
    if (!idsReales.has(alertaSeleccionada.id)) return
    const error = await acomp.finalizar(alertaSeleccionada.id)
    if (error) setAviso(error)
  }

  const esAcompanamientoReal = !!alertaSeleccionada && idsReales.has(alertaSeleccionada.id)
  const esSOSReal = !!alertaSeleccionada && idsSOS.has(alertaSeleccionada.id)
  const resolverDeshabilitado =
    !alertaSeleccionada ||
    alertaSeleccionada.estado === 'RESUELTA' ||
    // Un reporte barrial no se "resuelve": se valida o se descarta.
    !!alertaSeleccionada.barrial ||
    // Un acompañamiento o SOS real se cierra solo después de tomarlo.
    ((esAcompanamientoReal || esSOSReal) && alertaSeleccionada.estado !== 'EN_PROCESO')

  /* ── Chat con el ciudadano (acompañamientos y SOS reales ya tomados) ──
     En un SOS es el plan B cuando la llamada de voz falla. */
  const [panelDerecho, setPanelDerecho] = useState<'bitacora' | 'chat'>('bitacora')
  const esReal = !!alertaSeleccionada && (idsReales.has(alertaSeleccionada.id) || esSOSReal)
  const chatId =
    esReal && (alertaSeleccionada.estado === 'EN_PROCESO' || alertaSeleccionada.estado === 'RESUELTA')
      ? alertaSeleccionada.id
      : null
  const chat = useChat(esSOSReal ? 'alerta_id' : 'acompanamiento_id', chatId, 'operador')
  const sinChat: MotivoSinChat | null = !alertaSeleccionada
    ? 'sin-seleccion'
    : !esReal
      ? 'no-disponible'
      : alertaSeleccionada.estado === 'PENDIENTE'
        ? 'pendiente'
        : null
  // Mensajes del ciudadano ya vistos: se marcan al entrar/salir de la pestaña de chat.
  const [vistosChat, setVistosChat] = useState<{ id: string | null; n: number }>({ id: null, n: 0 })
  const mensajesCiudadano = chat.mensajes.filter((m) => m.emisor_rol === 'usuario').length
  const chatNoLeidos =
    panelDerecho === 'chat' || !chatId ? 0 : mensajesCiudadano - (vistosChat.id === chatId ? vistosChat.n : 0)
  const cambiarPanel = (p: 'bitacora' | 'chat') => {
    setPanelDerecho(p)
    setVistosChat({ id: chatId, n: mensajesCiudadano })
  }

  const pendientesPorTab = (t: TabId) => filtrarPorTipo(alertas, t).filter((a) => a.estado === 'PENDIENTE').length

  /* ── Teléfono: una columna a la vez ──
     El mapa vuelve de display:none con tamaño 0; MapLibre se reajusta con el evento resize. */
  const [vistaMovil, setVistaMovil] = useState<'bandeja' | 'mapa' | 'caso'>('bandeja')
  const cambiarVistaMovil = (v: 'bandeja' | 'mapa' | 'caso') => {
    setVistaMovil(v)
    if (v === 'mapa') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }
  const esMovil = () => !window.matchMedia('(min-width: 1024px)').matches

  /* ──────────────────────────────── Render ──────────────────────────────── */

  const sel = alertaSeleccionada
  const tiempoSel = sel ? tiempoAcompanamiento(sel, ahora) : null

  return (
    <main className="h-[100dvh] bg-[#050A16] bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,0.10),transparent_50%)] text-slate-100 flex flex-col overflow-hidden">
      {/* ── 1. Header Superior (64px) ── */}
      <header className="h-14 lg:h-16 shrink-0 bg-slate-950/50 backdrop-blur-md border-b border-slate-800/70 flex items-center justify-between gap-2 md:gap-6 w-full px-3 md:px-6 z-20">
        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver al inicio"
            className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-2.5 md:px-3 py-2 rounded-[10px] text-slate-400 text-sm font-medium hover:bg-slate-800/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="hidden md:block">Inicio</span>
          </button>
          {/* En teléfonos angostos queda solo el isotipo: el texto deja sitio a "Cerrar turno" */}
          <div className="shrink-0 max-[419px]:[&>span>span:last-child]:hidden">
            <Logo size={32} textoClaro />
          </div>
          <span className="hidden lg:block truncate text-[18px] font-semibold text-slate-200 tracking-tight">
            Panel de Operador
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="flex items-center gap-1.5 whitespace-nowrap px-2.5 md:px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/30">
            <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
            En línea
          </span>
          <button
            type="button"
            onClick={() => navigate('/seleccionar-rol')}
            className="flex min-h-[40px] items-center gap-2 whitespace-nowrap px-3 md:px-4 py-2 rounded-[10px] bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-semibold shadow-[0_0_18px_rgba(59,130,246,0.45)] hover:from-blue-500 hover:to-sky-400 transition-colors"
          >
            Cerrar Turno
          </button>
        </div>
      </header>

      {/* ── Cuerpo: 3 columnas (lg); en teléfono, solo la de la pestaña activa ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── 2. Columna Izquierda (25%) - Bandeja de Entrada ── */}
        <aside
          className={`${vistaMovil === 'bandeja' ? 'flex' : 'hidden'} w-full lg:flex lg:w-1/4 lg:border-r border-slate-800/60 flex-col overflow-hidden z-10`}
        >
          <div className="p-3 shrink-0">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-md p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <h2 className="text-sm font-semibold text-white">Bandeja de Entrada</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Selecciona una alerta para ver su detalle</p>

              {/* Pestañas (Tabs) */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['TODAS', 'SOS', 'BARRIAL', 'ACOMPANAMIENTO'] as const).map((t) => {
                  const activo = tabActivo === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTabActivo(t)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                        activo
                          ? 'bg-slate-700/70 text-white border-slate-500/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'bg-slate-900/40 text-slate-400 border-slate-700/50 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      {t === 'TODAS' ? <List size={14} strokeWidth={2} /> : iconoPorTipo(t)}
                      <span className="truncate">{t === 'TODAS' ? 'Todas' : labelPorTipo(t)}</span>
                      {pendientesPorTab(t) > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-blue-500/90 text-white text-[10px] font-bold flex items-center justify-center">
                          {pendientesPorTab(t)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {(aviso || sos.error || acomp.error || reportes.error) && (
            <div role="status" className="mx-3 mb-1 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {aviso ?? sos.error ?? acomp.error ?? reportes.error}
            </div>
          )}

          {/* Lista de tarjetas de alertas */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1 space-y-3">
            {reportes.cargando && tabActivo === 'BARRIAL' ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando reportes barriales…
              </div>
            ) : acomp.cargando && tabActivo === 'ACOMPANAMIENTO' ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando acompañamientos…
              </div>
            ) : sos.cargando && tabActivo === 'SOS' ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando alertas SOS…
              </div>
            ) : alertasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                No hay alertas{tabActivo === 'TODAS' ? '' : ` del tipo ${labelPorTipo(tabActivo)}`}
              </div>
            ) : (
              alertasFiltradas.map((alerta) => (
                <AlertaCard
                  key={alerta.id}
                  alerta={alerta}
                  estaSeleccionada={sel?.id === alerta.id}
                  enVivo={esEnVivo(alerta)}
                  senalPerdidaSeg={sinSenal(alerta)}
                  onClick={() => {
                    setSeleccionId(alerta.id)
                    // En el teléfono, elegir una alerta lleva al mapa con su ficha
                    if (esMovil()) cambiarVistaMovil('mapa')
                  }}
                  onAccion={() => void manejarAccion(alerta)}
                  onRechazar={() => setPorRechazar(alerta)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── 3. Columna Central (50%) - Mapa con tarjeta flotante ── */}
        <div className={`${vistaMovil === 'mapa' ? 'block' : 'hidden'} w-full lg:block lg:w-2/4 relative overflow-hidden bg-slate-950`}>
          <MapaOperador
            seleccion={
              sel && {
                id: sel.id,
                tipo: sel.tipo,
                cantidad: sel.barrial?.ids.length,
                lat: sel.lat,
                lng: sel.lng,
                sinUbicacion: sel.sinUbicacion,
                enVivo: esEnVivo(sel),
                senalPerdidaSeg: sinSenal(sel),
              }
            }
            // Todos los casos abiertos, sin importar la pestaña: el mapa es la vista general.
            puntos={alertas
              .filter((a) => a.estado !== 'RESUELTA')
              .map((a) => ({
                id: a.id,
                tipo: a.tipo,
                lat: a.lat,
                lng: a.lng,
                sinUbicacion: a.sinUbicacion,
                senalPerdidaSeg: sinSenal(a),
                nombre: a.barrial ? `${a.barrial.categoria} · ${a.barrial.ids.length} reporte(s)` : a.nombre,
                cantidad: a.barrial?.ids.length,
              }))}
            onSeleccionar={setSeleccionId}
            ruta={sel?.rutaCoords ?? null}
            margenInferior={MARGEN_TARJETA_FLOTANTE}
          />

          {/* Fundido inferior: la tarjeta flota sobre el mapa sin cortar en seco */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050A16] via-[#050A16]/70 to-transparent" aria-hidden />

          {/* Tarjeta flotante central */}
          <div className="absolute inset-x-0 bottom-3 lg:bottom-6 z-20 flex justify-center px-3 lg:px-6">
            {sel ? (
              <div className="relative w-full max-w-sm max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur-lg px-4 pb-4 pt-8 lg:px-5 lg:pb-5 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(59,130,246,0.08)]">
                {/* Timer: hora de la solicitud */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                  <Clock3 size={15} strokeWidth={2.25} className="text-sky-400" />
                  <span className="text-sm font-bold tabular-nums text-white">{sel.hora}</span>
                </div>

                {sel.tipo === 'ACOMPANAMIENTO' ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tiempo</p>
                    <h3 className="mt-0.5 text-base font-semibold text-white">
                      {tiempoSel ?? estadoTexto(sel.estado)}
                    </h3>
                  </>
                ) : (
                  <>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: colorPorTipo(sel.tipo) }}
                    >
                      {labelPorTipo(sel.tipo)} · {estadoTexto(sel.estado)}
                      {sel.escalada && <span className="text-purple-300"> · Escalada</span>}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-white">{sel.barrial ? sel.barrial.categoria : sel.nombre}</h3>
                    {sel.barrial && <AutorReporte alerta={sel} />}
                    {sel.descripcion && <p className="mt-1 text-sm text-slate-400">{sel.descripcion}</p>}
                  </>
                )}

                {sel.barrial && <DetalleGrupoBarrial barrial={sel.barrial} />}

                {sel.ruta && (
                  <p className="mt-3 flex items-start gap-2.5 text-sm leading-snug text-slate-300">
                    <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full border-2 border-slate-400" aria-hidden />
                    <span>Ruta: {sel.ruta}</span>
                  </p>
                )}

                {(esAcompanamientoReal || esSOSReal) && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    {sinSenal(sel) != null ? (
                      <span className="flex items-center gap-1.5 font-semibold text-orange-400 animate-pulse">
                        <TriangleAlert size={13} /> Señal perdida hace {textoDuracionCorta(sinSenal(sel)!)} · última ubicación conocida
                      </span>
                    ) : esEnVivo(sel) && !sel.sinUbicacion && !sel.soloOrigen ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" aria-hidden />
                        Ubicación en vivo: {sel.actualizadoEn && horaLarga(sel.actualizadoEn)}
                      </>
                    ) : sel.sinUbicacion ? (
                      'Sin ubicación GPS todavía'
                    ) : sel.soloOrigen ? (
                      sel.estado === 'PENDIENTE'
                        ? 'En el mapa: punto de partida. Acepta el monitoreo para seguir su ubicación en vivo'
                        : 'En el mapa: punto de partida. Esperando su GPS en vivo'
                    ) : sel.estado === 'PENDIENTE' ? (
                      esSOSReal ? 'Atiende la alerta para seguir su ubicación en vivo' : 'Acepta el monitoreo para seguir su ubicación en vivo'
                    ) : null}
                  </p>
                )}

                {sel.usuarioId && <ContextoCiudadanoPanel usuarioId={sel.usuarioId} />}

                {sel.barrial ? (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPorRechazar(sel)}
                      className="flex-1 py-3 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => void validarBarrial(sel)}
                      className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.45)] transition-all"
                    >
                      <CircleCheck size={17} strokeWidth={2.25} />
                      {sel.barrial.ids.length > 1 ? `Validar ${sel.barrial.ids.length} reportes` : 'Validar y difundir'}
                    </button>
                  </div>
                ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (sel.telefono) window.location.assign(`tel:${sel.telefono}`)
                  }}
                  disabled={!sel.telefono}
                  title={sel.telefono ? sel.telefono : 'Sin teléfono registrado'}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-semibold text-white bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_24px_rgba(59,130,246,0.6)] shadow-[0_0_14px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-none transition-all"
                >
                  <Phone size={17} strokeWidth={2} /> Llamar al ciudadano
                </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur-lg px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                <div className="relative flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-slate-800/70 border border-slate-700">
                  <span className="absolute inset-0 rounded-full border border-blue-500/30 animate-ping [animation-duration:3s]" aria-hidden />
                  <Radar size={22} strokeWidth={1.5} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Sin alerta seleccionada</p>
                  <p className="text-xs text-slate-500 mt-0.5">Selecciona una alerta para ver los datos del ciudadano</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Columna Derecha (25%) - Acciones y Bitácora ── */}
        <aside
          className={`${vistaMovil === 'caso' ? 'flex' : 'hidden'} w-full lg:flex lg:w-1/4 lg:border-l border-slate-800/60 bg-slate-950/30 backdrop-blur-md flex-col overflow-y-auto lg:overflow-hidden`}
        >
          {/* Teléfono: de qué caso se trata, ya que el mapa con su ficha queda en otra pestaña */}
          {sel && (
            <div className="lg:hidden mx-4 mt-4 shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
              <p className="text-[11px] font-semibold" style={{ color: colorPorTipo(sel.tipo) }}>
                {labelPorTipo(sel.tipo)} · {estadoTexto(sel.estado)} · {sel.hora}
              </p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-white">
                {sel.barrial ? sel.barrial.categoria : sel.nombre}
              </p>
            </div>
          )}
          {/* Llamada de voz con el ciudadano (SOS) */}
          {llamadaAlertaId && (
            <div className="px-5 pt-5 shrink-0">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Llamada · {alertaLlamada?.usuario_nombre ?? 'Ciudadano'}
              </h3>
              <ControlesLlamada
                voz={voz}
                estadoSesion={sesionLlamada?.status}
                nombreOtro={alertaLlamada?.usuario_nombre ?? 'el ciudadano'}
                textoConectar="Conectar audio"
                tono="oscuro"
                onVolverALlamar={
                  alertaLlamada?.estado === 'en_atencion' ? () => void llamarPorVoz(alertaLlamada.id) : undefined
                }
              />
            </div>
          )}

          {/* Acciones Rápidas (Arriba) */}
          <div className="p-5 shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Acciones rápidas</h3>
            <div className="space-y-2.5">
              {/* SOS propio en atención sin llamada abierta en este panel: llamar por voz */}
              {sel && esSOSReal && sel.estado === 'EN_PROCESO' && llamadaAlertaId !== sel.id && (
                <button
                  type="button"
                  onClick={() => void llamarPorVoz(sel.id)}
                  disabled={enLlamada}
                  title={enLlamada ? 'Ya hay una llamada en curso' : undefined}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Phone size={16} strokeWidth={2} />
                    Llamada de voz con {sel.nombre}
                  </span>
                  <ChevronRight size={14} className="text-emerald-400/70" />
                </button>
              )}
              {sel?.escalada ? (
                <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-purple-500/60 bg-purple-500/15 text-sm font-semibold text-purple-200 shadow-[0_0_16px_rgba(168,85,247,0.25)]">
                  <ShieldAlert size={16} strokeWidth={2} />
                  <span className="min-w-0 truncate">Escalada a supervisor · {sel.escalada.motivo}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => sel && setPorEscalar(sel)}
                  disabled={!sel || sel.estado !== 'EN_PROCESO'}
                  title={!sel ? 'Selecciona una alerta' : sel.estado !== 'EN_PROCESO' ? 'Toma el caso antes de escalarlo' : undefined}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-purple-500 bg-purple-500/10 text-sm font-semibold text-purple-200 hover:bg-purple-500/20 hover:shadow-[0_0_16px_rgba(168,85,247,0.35)] disabled:opacity-40 disabled:hover:bg-purple-500/10 disabled:hover:shadow-none transition-all"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldAlert size={16} strokeWidth={2} />
                    Escalar a Supervisor
                  </span>
                  <ChevronRight size={14} className="text-purple-400/70" />
                </button>
              )}
              {[
                { icono: <Phone size={16} strokeWidth={2} />, texto: 'Llamar contacto de confianza' },
                { icono: <HardHat size={16} strokeWidth={2} />, texto: 'Derivar a Carabineros' },
              ].map(({ icono, texto }) => (
                <button
                  key={texto}
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-md text-sm font-medium text-slate-200 hover:bg-slate-700/50 hover:border-slate-600 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    {icono}
                    {texto}
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Bitácora / Chat con el ciudadano (Centro) */}
          <div className="flex-1 min-h-[320px] lg:min-h-0 px-5 pb-2 flex flex-col">
            <div role="tablist" aria-label="Panel del evento" className="mb-4 flex gap-1 rounded-xl border border-slate-700/60 bg-slate-900/50 p-1">
              {(
                [
                  { id: 'bitacora', texto: 'Bitácora', icono: <ScrollText size={14} strokeWidth={2} /> },
                  { id: 'chat', texto: 'Chat con el Ciudadano', icono: <MessagesSquare size={14} strokeWidth={2} /> },
                ] as const
              ).map((t) => {
                const activo = panelDerecho === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => cambiarPanel(t.id)}
                    className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                      t.id === 'chat' ? 'flex-1' : 'shrink-0'
                    } ${
                      activo
                        ? 'bg-slate-700/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    {t.icono}
                    <span className="truncate">{t.texto}</span>
                    {t.id === 'chat' && chatNoLeidos > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.7)]"
                        aria-label={`${chatNoLeidos} mensajes sin leer`}
                      >
                        {chatNoLeidos}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {panelDerecho === 'chat' ? (
              <ChatCiudadano
                sinChat={sinChat}
                puedeEscribir={sel?.estado === 'EN_PROCESO'}
                nombreCiudadano={sel?.nombre}
                mensajes={chat.mensajes}
                cargando={chat.cargando}
                error={chat.error}
                onEnviar={chat.enviar}
                otroEscribiendo={chat.otroEscribiendo}
                onEscribiendo={chat.avisarEscribiendo}
              />
            ) : sel ? (
              <ol className="ml-1.5 border-l border-slate-700 overflow-y-auto">
                {sel.timeline.map((entrada, i, arr) => {
                  const ultima = i === arr.length - 1
                  return (
                    <li key={i} className="relative pl-5 pb-5 last:pb-0">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full ${
                          ultima
                            ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.95)]'
                            : 'bg-blue-500/50 shadow-[0_0_6px_rgba(59,130,246,0.45)]'
                        }`}
                        aria-hidden
                      />
                      <p className={`text-sm ${ultima && !sel.escalada ? 'text-slate-100' : 'text-slate-400'}`}>{entrada}</p>
                    </li>
                  )
                })}
                {sel.escalada && (
                  <li className="relative pl-5 pt-1">
                    <span
                      className="absolute -left-[6px] top-2.5 w-[11px] h-[11px] rounded-full bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.95)]"
                      aria-hidden
                    />
                    <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                        <ShieldAlert size={12} /> Prioritario
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-purple-100">
                        {horaDe(sel.escalada.en)} - Escalada a supervisor: {sel.escalada.motivo}
                      </p>
                    </div>
                  </li>
                )}
              </ol>
            ) : (
              <div className="flex flex-col items-center text-center text-slate-500 text-sm py-10">
                <ScrollText size={22} className="mb-2 opacity-60" />
                <p>Selecciona una alerta para ver su bitácora</p>
              </div>
            )}
          </div>

          {/* Botón de Cierre (Abajo) */}
          <div className="p-5 shrink-0">
            <button
              type="button"
              onClick={marcarResuelta}
              disabled={resolverDeshabilitado}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-bold transition-all ${
                resolverDeshabilitado
                  ? 'bg-emerald-500/10 text-emerald-300/40 border border-emerald-500/15 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.45)] active:scale-[0.98]'
              }`}
            >
              <CheckCircle2 size={19} strokeWidth={2} />
              {sel?.estado === 'RESUELTA' ? 'Resuelta' : 'Marcar como Resuelta'}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Teléfono: pestañas abajo (zona del pulgar) ── */}
      <nav
        aria-label="Secciones del panel"
        className="lg:hidden shrink-0 grid grid-cols-3 border-t border-slate-800/70 bg-slate-950/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {(
          [
            { id: 'bandeja', texto: 'Bandeja', Icono: Inbox, badge: pendientesPorTab('TODAS') },
            { id: 'mapa', texto: 'Mapa', Icono: MapIcon, badge: 0 },
            { id: 'caso', texto: 'Caso', Icono: ClipboardList, badge: chatNoLeidos },
          ] as const
        ).map(({ id, texto, Icono, badge }) => {
          const activa = vistaMovil === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => cambiarVistaMovil(id)}
              aria-current={activa ? 'page' : undefined}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors ${
                activa ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="relative">
                <Icono size={20} strokeWidth={activa ? 2.25 : 1.75} className={activa ? 'text-blue-400' : ''} aria-hidden />
                {badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {badge}
                  </span>
                )}
              </span>
              {texto}
              {activa && (
                <span className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" aria-hidden />
              )}
            </button>
          )
        })}
      </nav>
      {porEscalar && (
        <ModalEscalar
          alerta={porEscalar}
          onCancelar={() => setPorEscalar(null)}
          onConfirmar={(motivo) => void confirmarEscalamiento(porEscalar, motivo)}
        />
      )}
      {porRechazar && (
        <ConfirmarRechazo
          alerta={porRechazar}
          onCancelar={() => setPorRechazar(null)}
          onConfirmar={(motivo) => void confirmarRechazo(porRechazar, motivo)}
        />
      )}
    </main>
  )
}

/** Diálogo pequeño para confirmar el rechazo y elegir el motivo (queda en la bitácora). */
function ConfirmarRechazo({
  alerta,
  onCancelar,
  onConfirmar,
}: {
  alerta: Alerta
  onCancelar: () => void
  onConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DESCARTE[0])
  const cancelarRef = useRef<HTMLButtonElement | null>(null)
  // El panel se re-renderiza con cada GPS/tick: el callback vive en una ref
  // para que el efecto corra una sola vez y no robe el foco.
  const onCancelarRef = useRef(onCancelar)
  useEffect(() => {
    onCancelarRef.current = onCancelar
  })

  useEffect(() => {
    // Foco en "Cancelar": un Enter accidental no rechaza nada.
    cancelarRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelarRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rechazo-titulo"
        aria-describedby="rechazo-detalle"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      >
        <h2 id="rechazo-titulo" className="text-base font-bold text-white">
          ¿Estás seguro de que deseas rechazar esta alerta?
        </h2>
        <p id="rechazo-detalle" className="mt-1 text-sm text-slate-400">
          {alerta.barrial
            ? `${alerta.barrial.categoria}. ${
                alerta.barrial.ids.length > 1 ? `Se descartarán los ${alerta.barrial.ids.length} reportes de la zona` : 'Saldrá de la bandeja'
              } y se avisará a quien reportó.`
            : `${labelPorTipo(alerta.tipo)} · ${alerta.nombre}. Saldrá de la bandeja.`}
        </p>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motivo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOTIVOS_DESCARTE.map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500/60 ${
                  motivo === m
                    ? 'border-red-500/60 bg-red-500/10 text-red-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="motivo-rechazo"
                  value={m}
                  checked={motivo === m}
                  onChange={() => setMotivo(m)}
                  className="sr-only"
                />
                {m}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            className="rounded-[10px] border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivo)}
            className="rounded-[10px] bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── Sub-componentes ──────────────────── */

/** Tarjeta individual de alerta en la bandeja de entrada (columna izquierda), efecto cristal. */
function AlertaCard({
  alerta,
  estaSeleccionada,
  enVivo,
  senalPerdidaSeg,
  onClick,
  onAccion,
  onRechazar,
}: {
  alerta: Alerta
  estaSeleccionada: boolean
  enVivo: boolean
  /** Segundos sin señal del teléfono (null = recibiendo bien o no aplica). */
  senalPerdidaSeg: number | null
  onClick: () => void
  onAccion: () => void
  onRechazar: () => void
}) {
  const accion = ACCION_POR_TIPO[alerta.tipo]
  const yaProcesado = alerta.estado !== 'PENDIENTE'
  // Una resuelta ya terminó: no hay nada que rechazar.
  const puedeRechazar = alerta.estado === 'PENDIENTE' || alerta.estado === 'EN_PROCESO'
  const esAcomp = alerta.tipo === 'ACOMPANAMIENTO'
  const progreso = esAcomp ? progresoRuta(alerta) : null

  return (
    // div (no button) porque contiene botones: no se anidan <button>.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`relative overflow-hidden flex flex-col gap-3 p-3.5 pl-4 rounded-2xl border backdrop-blur-md cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        estaSeleccionada
          ? 'bg-slate-800/70 border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_10px_30px_rgba(0,0,0,0.4),0_0_24px_rgba(59,130,246,0.12)]'
          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/75'
      }`}
    >
      {/* Borde izquierdo de color */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${BARRA_POR_TIPO[alerta.tipo]}`} />

      {/* Rechazar: discreto (gris, pequeño, en la esquina) para evitar clics accidentales */}
      {puedeRechazar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRechazar()
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Rechazar alerta de ${alerta.nombre}`}
          title="Rechazar alerta"
          className="absolute top-1 right-1 w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 transition-colors"
        >
          <X size={14} strokeWidth={2.25} />
        </button>
      )}

      <div className={`flex items-start gap-3 ${puedeRechazar ? 'pr-5' : ''}`}>
        {esAcomp && (
          <span className="mt-0.5 w-10 h-10 shrink-0 rounded-full bg-slate-700/70 border border-slate-600/60 text-slate-300 flex items-center justify-center" aria-hidden>
            <UserRound size={20} strokeWidth={1.75} />
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${TEXTO_POR_TIPO[alerta.tipo]}`}>
              {iconoPorTipo(alerta.tipo, 12)}
              {labelPorTipo(alerta.tipo)}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${estadoClases(alerta.estado)}`}>
              {estadoTexto(alerta.estado)}
            </span>
            {alerta.escalada && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-500/50 bg-purple-500/15 text-purple-300">
                <ShieldAlert size={11} /> Escalada
              </span>
            )}
          </div>
          {senalPerdidaSeg != null && (
            <span className="mb-1 inline-flex items-center gap-1 rounded-md border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300 animate-pulse">
              <TriangleAlert size={11} /> Señal perdida hace {textoDuracionCorta(senalPerdidaSeg)}
            </span>
          )}

          <h4 className="text-sm font-bold text-white truncate">{alerta.barrial ? alerta.barrial.categoria : alerta.nombre}</h4>
          {alerta.barrial && <AutorReporte alerta={alerta} />}
          <p className="text-[12px] text-slate-400 mt-0.5 truncate">
            {alerta.hora} · {esAcomp ? `Ruta: ${alerta.ruta}` : alerta.descripcion || (alerta.barrial ? 'Sin descripción' : 'Alerta recibida')}
          </p>
        </div>

        {!esAcomp && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAccion()
            }}
            disabled={yaProcesado}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              yaProcesado ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : accion.clases
            }`}
          >
            {alerta.barrial && alerta.barrial.ids.length > 1 ? `${accion.texto} (${alerta.barrial.ids.length})` : accion.texto}
          </button>
        )}
      </div>

      {alerta.barrial && (alerta.barrial.ids.length > 1 || alerta.barrial.fotos.length > 0 || alerta.barrial.audios.length > 0) && (
        <div className="flex items-center gap-2">
          {alerta.barrial.fotos[0] && <MiniaturaFoto ruta={alerta.barrial.fotos[0]} />}
          {alerta.barrial.audios[0] && <BotonAudio ruta={alerta.barrial.audios[0]} />}
          {alerta.barrial.ids.length > 1 && (
            <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold leading-tight text-amber-300">
              <Layers size={12} className="shrink-0" />
              {alerta.barrial.ids.length} reportes similares en esta zona
            </span>
          )}
        </div>
      )}

      {esAcomp && (
        <>
          {/* Progreso: origen → posición actual → destino */}
          <div className="relative mx-1 h-3 flex items-center" aria-label={progreso != null ? `Avance ${Math.round(progreso * 100)}%` : undefined}>
            <div className="h-[3px] w-full rounded-full bg-slate-700" />
            <div
              className="absolute left-0 h-[3px] rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
              style={{ width: `${(progreso ?? 0) * 100}%` }}
            />
            <span className="absolute left-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-slate-900" aria-hidden />
            {progreso != null && (
              <span
                className="absolute -translate-x-1/2 w-3 h-3 rounded-full bg-sky-300 ring-2 ring-slate-900 shadow-[0_0_10px_rgba(125,211,252,0.9)]"
                style={{ left: `${progreso * 100}%` }}
                aria-hidden
              />
            )}
            <span className="absolute right-0 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-600 ring-2 ring-slate-900" aria-hidden />
          </div>

          <p className="flex items-center gap-2 text-[11px] text-slate-400">
            {alerta.sinUbicacion ? (
              'Sin ubicación GPS todavía'
            ) : (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${enVivo ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse' : 'bg-slate-500'}`}
                  aria-hidden
                />
                {enVivo ? 'Ubicación en vivo' : 'Última ubicación'}
                {alerta.actualizadoEn && `: ${horaLarga(alerta.actualizadoEn)}`}
              </>
            )}
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              // Pendiente: tomarla. En proceso: llevar el mapa a la ruta.
              if (alerta.estado === 'PENDIENTE') onAccion()
              else onClick()
            }}
            disabled={alerta.estado === 'RESUELTA'}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_22px_rgba(59,130,246,0.7)] disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none transition-all"
          >
            {alerta.estado === 'PENDIENTE' ? accion.texto : alerta.estado === 'EN_PROCESO' ? 'Monitorear Ruta' : 'Finalizado'}
          </button>
        </>
      )}
    </div>
  )
}

/* ──────────────────── Reporte barrial: autor y detalle del grupo ──────────────────── */

/** Quién reportó; si es anónimo, solo el badge gris (el nombre nunca llega). */
function AutorReporte({ alerta }: { alerta: Alerta }) {
  if (alerta.barrial?.anonimo) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
        <EyeOff size={11} /> Anónimo
      </span>
    )
  }
  return <p className="mt-0.5 truncate text-[11px] text-slate-500">Reportado por {alerta.nombre}</p>
}

/** Tarjeta flotante: evidencia de todo el grupo y los otros reportes de la zona. */
function DetalleGrupoBarrial({ barrial }: { barrial: NonNullable<Alerta['barrial']> }) {
  return (
    <>
      {(barrial.fotos.length > 0 || barrial.audios.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {barrial.fotos.slice(0, 3).map((f) => (
            <MiniaturaFoto key={f} ruta={f} tam="grande" />
          ))}
          {barrial.audios.map((a, i) => (
            <BotonAudio key={a} ruta={a} conTexto={barrial.audios.length === 1 || i === 0} />
          ))}
        </div>
      )}
      {barrial.otras.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <Layers size={12} /> {barrial.ids.length} reportes similares en esta zona
          </p>
          <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
            {barrial.otras.map((o, i) => (
              <li key={i} className="truncate text-xs text-slate-300">
                <span className="tabular-nums text-slate-500">{o.hora}</span> · {o.descripcion || o.categoria}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/* ──────────────────── Contexto del ciudadano ──────────────────── */

const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' })

/** "hace 3 días", "hace 1 mes"… */
function haceCuanto(iso: string): string {
  const seg = (Date.parse(iso) - Date.now()) / 1000
  const escalas: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unidad, s] of escalas) {
    if (Math.abs(seg) >= s) return FORMATO_RELATIVO.format(Math.round(seg / s), unidad)
  }
  return 'recién'
}

/**
 * Historial de alertas y contactos de confianza del ciudadano (solo conteos,
 * vía RPC contexto_ciudadano). No hay datos de plan/suscripción en el sistema.
 */
function ContextoCiudadanoPanel({ usuarioId }: { usuarioId: string }) {
  const { datos, cargando, error } = useContextoCiudadano(usuarioId)

  if (cargando) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" /> Cargando contexto del ciudadano…
      </p>
    )
  }
  if (error || !datos) {
    return <p className="mt-3 text-xs text-slate-500">Contexto del ciudadano no disponible.</p>
  }

  const previas = datos.alertas_previas
  return (
    <dl className="mt-3 grid gap-1.5 rounded-xl border border-slate-700/70 bg-slate-800/50 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <History size={13} className="shrink-0 text-slate-400" aria-hidden />
        <dt className="text-slate-500">Historial:</dt>
        <dd className={previas > 0 ? 'text-amber-200' : 'text-slate-300'}>
          {previas === 0
            ? '0 alertas previas'
            : `${previas} alerta${previas === 1 ? '' : 's'} previa${previas === 1 ? '' : 's'}`}
          {datos.ultima_alerta_previa && (
            <span className="text-slate-500"> (última: {haceCuanto(datos.ultima_alerta_previa)})</span>
          )}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <ContactRound size={13} className="shrink-0 text-slate-400" aria-hidden />
        <dt className="text-slate-500">Contactos:</dt>
        <dd className="flex items-center gap-1.5 text-slate-300">
          {datos.contactos}/5 configurados
          {datos.contactos > 0 ? (
            <CircleCheck size={13} className="text-emerald-400" aria-label="Tiene contactos de confianza" />
          ) : (
            <TriangleAlert size={13} className="text-amber-400" aria-label="Sin contactos de confianza" />
          )}
        </dd>
      </div>
    </dl>
  )
}

/* ──────────────────── Escalar a supervisor ──────────────────── */

function ModalEscalar({
  alerta,
  onCancelar,
  onConfirmar,
}: {
  alerta: Alerta
  onCancelar: () => void
  onConfirmar: (motivo: MotivoEscalamiento) => void
}) {
  const [motivo, setMotivo] = useState<MotivoEscalamiento>('violencia')
  const cancelarRef = useRef<HTMLButtonElement | null>(null)
  const onCancelarRef = useRef(onCancelar)
  useEffect(() => {
    onCancelarRef.current = onCancelar
  })
  useEffect(() => {
    cancelarRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelarRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="escalar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-purple-500/40 bg-slate-900 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55),0_0_30px_rgba(168,85,247,0.15)]"
      >
        <h2 id="escalar-titulo" className="flex items-center gap-2 text-base font-bold text-white">
          <ShieldAlert size={18} className="text-purple-400" /> Escalar a supervisor
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {labelPorTipo(alerta.tipo)} · {alerta.nombre}. Queda registrado en la bitácora como prioritario.
        </p>

        <label htmlFor="motivo-escalado" className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          ¿Motivo del escalado?
        </label>
        <select
          id="motivo-escalado"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoEscalamiento)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/20"
        >
          {MOTIVOS_ESCALAMIENTO.map((m) => (
            <option key={m.id} value={m.id}>
              {m.texto}
            </option>
          ))}
        </select>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            className="rounded-[10px] border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivo)}
            className="rounded-[10px] bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.45)] transition-colors"
          >
            Escalar
          </button>
        </div>
      </div>
    </div>
  )
}
