/**
 * Panel de Operador — Centro de Comando (Fase 2), estilo "Dark Control Room".
 *
 * Dashboard desktop-first, sin scroll general (h-screen).
 * Tres columnas + header superior. SOS (tabla alertas) y acompañamientos
 * (tabla acompanamientos) son reales vía Supabase Realtime; Barrial sigue
 * siendo mock.
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
} from 'lucide-react'
import Logo from '../components/Logo'
import MapaOperador from '../components/operador/MapaOperador'
import ChatCiudadano, { type MotivoSinChat } from '../components/operador/ChatCiudadano'
import { useChatAcompanamiento } from '../hooks/useChatAcompanamiento'
import { useAuth } from '../auth/AuthContext'
import { useAcompanamientosOperador, useSeguimientoAcompanamiento } from '../hooks/useAcompanamientosOperador'
import { useAlertasSOSOperador } from '../hooks/useAlertasSOSOperador'
import type { Acompanamiento } from '../lib/acompanamientos'
import type { AlertaSOS } from '../lib/alertas'
import {
  MOCK_ALERTAS,
  COLOR_NEON,
  MOTIVOS_DESCARTE,
  filtrarPorTipo,
  ahoraHHMM,
  type Alerta,
  type AlertaTipo,
} from '../lib/mockAlerts'

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

/** Texto que queda en la bitácora al presionar el botón de acción. */
function btnAccionTexto(tipo: AlertaTipo): string {
  switch (tipo) {
    case 'SOS':
      return 'atendió la alerta SOS'
    case 'BARRIAL':
      return 'validó la alerta barrial'
    case 'ACOMPANAMIENTO':
      return 'aceptó el acompañamiento'
  }
}

/* ──────────────────── Acompañamientos reales → tarjetas ──────────────────── */

const SANTIAGO_CENTRO = { lat: -33.4489, lng: -70.6693 }

function horaDe(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Alto aprox. de la tarjeta flotante: el mapa centra el pin por encima de ella. */
const MARGEN_TARJETA_FLOTANTE = 300

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
  const sinUbicacion = a.lat_actual == null || a.lng_actual == null
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
    lat: a.lat_actual ?? SANTIAGO_CENTRO.lat,
    lng: a.lng_actual ?? SANTIAGO_CENTRO.lng,
    sinUbicacion,
    rutaCoords,
    creadoEn: a.creado_en,
    aceptadoEn: a.aceptado_en ?? undefined,
    actualizadoEn: a.actualizado_en,
    ruta: `${a.origen} → ${a.destino}`,
    estado: a.estado === 'PENDIENTE' ? 'PENDIENTE' : a.estado === 'EN_CURSO' ? 'EN_PROCESO' : 'RESUELTA',
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
    timeline,
  }
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

  /* ── SOS reales (Realtime) ── */
  const sos = useAlertasSOSOperador(user?.id, {
    onNueva: (a) => {
      sonarAlarmaSOS()
      setAviso(`Nueva alerta SOS de ${a.usuario_nombre ?? 'un ciudadano'}.`)
    },
    onCancelada: (a) => setAviso(`${a.usuario_nombre ?? 'El ciudadano'} canceló su alerta SOS.`),
  })
  const idsSOS = new Set(sos.lista.map((a) => a.id))

  /* ── Acompañamientos reales (Realtime) ── */
  const acomp = useAcompanamientosOperador(user?.id)
  const idsReales = new Set(acomp.lista.map((a) => a.id))

  /* ── Estado ── */
  // Mock solo para Barrial: SOS y acompañamientos vienen de Supabase.
  const [alertasMock, setAlertasMock] = useState<Alerta[]>(() =>
    MOCK_ALERTAS.map((a) => ({ ...a, timeline: [...a.timeline] }))
  )
  // Las descartadas salen de la bandeja (las reales ya no vienen de Supabase).
  const alertas = [
    ...sos.lista.map(sosAAlerta),
    ...acomp.lista.map(acompanamientoAAlerta),
    ...alertasMock.filter((a) => a.estado !== 'DESCARTADA'),
  ]
  // Alerta a la espera de confirmar el rechazo (modal).
  const [porRechazar, setPorRechazar] = useState<Alerta | null>(null)
  const [tabActivo, setTabActivo] = useState<TabId>('SOS')
  // Por id: la tarjeta seleccionada se recalcula con cada cambio en vivo.
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const alertaSeleccionada = alertas.find((a) => a.id === seleccionId) ?? null
  // Reloj para el "Tiempo" del acompañamiento seleccionado.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
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

  /* ── Acciones ── */

  const alertasFiltradas = filtrarPorTipo(alertas, tabActivo)

  /** Solo alertas mock (Barrial): SOS y acompañamientos se actualizan en Supabase. */
  const actualizarAlertaMock = (id: string, estado: Alerta['estado'], accionTexto: string) => {
    const accionCompleta = `${ahoraHHMM()} - ${accionTexto}`
    setAlertasMock((prev) =>
      prev.map((a) => (a.id !== id ? a : { ...a, estado, timeline: [...a.timeline, accionCompleta] })),
    )
  }

  const manejarAccion = async (alerta: Alerta) => {
    if (idsSOS.has(alerta.id)) {
      const error = await sos.atender(alerta.id)
      if (error) {
        setAviso(error)
        return
      }
      setSeleccionId(alerta.id)
      setAviso(`Atendiendo SOS de ${alerta.nombre}.`)
      return
    }
    if (!idsReales.has(alerta.id)) {
      actualizarAlertaMock(alerta.id, 'EN_PROCESO', btnAccionTexto(alerta.tipo))
      return
    }
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
    } else {
      actualizarAlertaMock(alerta.id, 'DESCARTADA', `Alerta descartada: ${motivo}`)
    }
    // Si estaba en el panel central, vuelve a "Sin alerta seleccionada".
    setSeleccionId((sel) => (sel === alerta.id ? null : sel))
    setAviso(`Alerta descartada (${motivo}).`)
  }

  const marcarResuelta = async () => {
    if (!alertaSeleccionada) return
    if (idsSOS.has(alertaSeleccionada.id)) {
      const error = await sos.resolver(alertaSeleccionada.id)
      if (error) setAviso(error)
      return
    }
    if (!idsReales.has(alertaSeleccionada.id)) {
      actualizarAlertaMock(alertaSeleccionada.id, 'RESUELTA', 'Alerta marcada como resuelta')
      return
    }
    const error = await acomp.finalizar(alertaSeleccionada.id)
    if (error) setAviso(error)
  }

  const esAcompanamientoReal = !!alertaSeleccionada && idsReales.has(alertaSeleccionada.id)
  const esSOSReal = !!alertaSeleccionada && idsSOS.has(alertaSeleccionada.id)
  const resolverDeshabilitado =
    !alertaSeleccionada ||
    alertaSeleccionada.estado === 'RESUELTA' ||
    // Un acompañamiento o SOS real se cierra solo después de tomarlo.
    ((esAcompanamientoReal || esSOSReal) && alertaSeleccionada.estado !== 'EN_PROCESO')

  /* ── Chat con el ciudadano (solo acompañamientos reales ya aceptados) ── */
  const [panelDerecho, setPanelDerecho] = useState<'bitacora' | 'chat'>('bitacora')
  const esReal = !!alertaSeleccionada && idsReales.has(alertaSeleccionada.id)
  const chatId =
    esReal && (alertaSeleccionada.estado === 'EN_PROCESO' || alertaSeleccionada.estado === 'RESUELTA')
      ? alertaSeleccionada.id
      : null
  const chat = useChatAcompanamiento(chatId, 'operador')
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

  /* ──────────────────────────────── Render ──────────────────────────────── */

  const sel = alertaSeleccionada
  const tiempoSel = sel ? tiempoAcompanamiento(sel, ahora) : null

  return (
    <main className="h-screen bg-[#050A16] bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,0.10),transparent_50%)] text-slate-100 flex flex-col overflow-hidden">
      {/* ── 1. Header Superior (64px) ── */}
      <header className="h-16 shrink-0 bg-slate-950/50 backdrop-blur-md border-b border-slate-800/70 flex items-center justify-between gap-4 md:gap-6 w-full px-4 md:px-6 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver al inicio"
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-[10px] text-slate-400 text-sm font-medium hover:bg-slate-800/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="hidden md:block">Inicio</span>
          </button>
          <div className="shrink-0">
            <Logo size={34} textoClaro />
          </div>
          <span className="hidden lg:block truncate text-[18px] font-semibold text-slate-200 tracking-tight">
            Panel de Operador
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/30">
            <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
            En línea
          </span>
          <button
            type="button"
            onClick={() => navigate('/seleccionar-rol')}
            className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-[10px] bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-semibold shadow-[0_0_18px_rgba(59,130,246,0.45)] hover:from-blue-500 hover:to-sky-400 transition-colors"
          >
            Cerrar Turno
          </button>
        </div>
      </header>

      {/* ── Cuerpo: 3 columnas ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 2. Columna Izquierda (25%) - Bandeja de Entrada ── */}
        <aside className="w-1/4 border-r border-slate-800/60 flex flex-col overflow-hidden z-10">
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

          {(aviso || sos.error || acomp.error) && (
            <div role="status" className="mx-3 mb-1 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {aviso ?? sos.error ?? acomp.error}
            </div>
          )}

          {/* Lista de tarjetas de alertas */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1 space-y-3">
            {acomp.cargando && tabActivo === 'ACOMPANAMIENTO' ? (
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
                  onClick={() => setSeleccionId(alerta.id)}
                  onAccion={() => void manejarAccion(alerta)}
                  onRechazar={() => setPorRechazar(alerta)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── 3. Columna Central (50%) - Mapa con tarjeta flotante ── */}
        <div className="w-2/4 relative overflow-hidden bg-slate-950">
          <MapaOperador
            seleccion={
              sel && {
                id: sel.id,
                tipo: sel.tipo,
                lat: sel.lat,
                lng: sel.lng,
                sinUbicacion: sel.sinUbicacion,
                enVivo: esEnVivo(sel),
              }
            }
            ruta={sel?.rutaCoords ?? null}
            margenInferior={MARGEN_TARJETA_FLOTANTE}
          />

          {/* Fundido inferior: la tarjeta flota sobre el mapa sin cortar en seco */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050A16] via-[#050A16]/70 to-transparent" aria-hidden />

          {/* Tarjeta flotante central */}
          <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
            {sel ? (
              <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur-lg px-5 pb-5 pt-8 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(59,130,246,0.08)]">
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
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-white">{sel.nombre}</h3>
                    {sel.descripcion && <p className="mt-1 text-sm text-slate-400">{sel.descripcion}</p>}
                  </>
                )}

                {sel.ruta && (
                  <p className="mt-3 flex items-start gap-2.5 text-sm leading-snug text-slate-300">
                    <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full border-2 border-slate-400" aria-hidden />
                    <span>Ruta: {sel.ruta}</span>
                  </p>
                )}

                {(esAcompanamientoReal || esSOSReal) && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    {esEnVivo(sel) && !sel.sinUbicacion ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" aria-hidden />
                        Ubicación en vivo: {sel.actualizadoEn && horaLarga(sel.actualizadoEn)}
                      </>
                    ) : sel.sinUbicacion ? (
                      'Sin ubicación GPS todavía'
                    ) : sel.estado === 'PENDIENTE' ? (
                      esSOSReal ? 'Atiende la alerta para seguir su ubicación en vivo' : 'Acepta el monitoreo para seguir su ubicación en vivo'
                    ) : null}
                  </p>
                )}

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
        <aside className="w-1/4 border-l border-slate-800/60 bg-slate-950/30 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Acciones Rápidas (Arriba) */}
          <div className="p-5 shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Acciones rápidas</h3>
            <div className="space-y-2.5">
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
          <div className="flex-1 min-h-0 px-5 pb-2 flex flex-col">
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
                      <p className={`text-sm ${ultima ? 'text-slate-100' : 'text-slate-400'}`}>{entrada}</p>
                    </li>
                  )
                })}
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
          {labelPorTipo(alerta.tipo)} · {alerta.nombre}. Saldrá de la bandeja.
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
  onClick,
  onAccion,
  onRechazar,
}: {
  alerta: Alerta
  estaSeleccionada: boolean
  enVivo: boolean
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
          </div>

          <h4 className="text-sm font-bold text-white truncate">{alerta.nombre}</h4>
          <p className="text-[12px] text-slate-400 mt-0.5 truncate">
            {alerta.hora} · {esAcomp ? `Ruta: ${alerta.ruta}` : alerta.descripcion || 'Alerta recibida'}
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
            {accion.texto}
          </button>
        )}
      </div>

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
