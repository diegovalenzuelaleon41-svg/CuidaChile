/**
 * Panel de Operador — Centro de Comando (Fase 2), estilo "Dark Control Room".
 *
 * Dashboard desktop-first, sin scroll general (h-screen).
 * Tres columnas + header superior. Datos 100% mock (sin Supabase Realtime).
 *
 * Ruta: /operador/dashboard
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import {
  Phone,
  Users,
  Pin,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  HardHat,
  ArrowLeft,
  Radar,
  ScrollText,
} from 'lucide-react'
import Logo from '../components/Logo'
import {
  MOCK_ALERTAS,
  filtrarPorTipo,
  ahoraHHMM,
  type Alerta,
  type AlertaTipo,
} from '../lib/mockAlerts'

/* ──────────────────── Colores de la paleta CuidaChile ──────────────────── */
const COLOR_SOS = '#EF4444'
const COLOR_BARRIAL = '#F59E0B'
const COLOR_ACOMPANAMIENTO = '#3B82F6'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

type TabId = AlertaTipo | 'TODAS'

/* ──────────────────── Helpers por tipo ──────────────────── */

function colorPorTipo(tipo: AlertaTipo) {
  switch (tipo) {
    case 'SOS':
      return COLOR_SOS
    case 'BARRIAL':
      return COLOR_BARRIAL
    case 'ACOMPANAMIENTO':
      return COLOR_ACOMPANAMIENTO
  }
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
    texto: 'Aceptar',
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
  return estado === 'PENDIENTE' ? 'Pendiente' : estado === 'EN_PROCESO' ? 'En proceso' : 'Resuelta'
}

function estadoClases(estado: Alerta['estado']) {
  return estado === 'RESUELTA'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : estado === 'EN_PROCESO'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
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

export default function OperadorDashboard() {
  const navigate = useNavigate()

  /* ── Estado ── */
  const [alertas, setAlertas] = useState<Alerta[]>(() =>
    MOCK_ALERTAS.map((a) => ({ ...a, timeline: [...a.timeline] }))
  )
  const [tabActivo, setTabActivo] = useState<TabId>('SOS')
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<Alerta | null>(null)
  const [mapListo, setMapListo] = useState(false)

  /* ── Refs del mapa ── */
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<MapLibreMap | null>(null)
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)

  /* ── Inicializar MapLibre (dynamic import, solo cliente) ── */
  useEffect(() => {
    let cancelado = false

    ;(async () => {
      try {
        const maplibre = await import('maplibre-gl')
        maplibreRef.current = maplibre

        if (!mapContainerRef.current || cancelado) return

        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: [-70.6693, -33.4489], // [lng, lat] Santiago
          zoom: 14,
          hash: false,
          interactive: true,
        })

        mapInstanceRef.current = map
        setMapListo(true)
      } catch (error) {
        console.error('Error cargando MapLibre:', error)
      }
    })()

    return () => {
      cancelado = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [])

  /* ── Actualizar / mover pin cuando cambia la alerta seleccionada ── */
  useEffect(() => {
    const map = mapInstanceRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre || !mapListo || !alertaSeleccionada) return

    // Quitar pin previo
    markerRef.current?.remove()
    markerRef.current = null

    const { lat, lng, tipo } = alertaSeleccionada
    const esSOS = tipo === 'SOS'
    const color = colorPorTipo(tipo)

    const el = document.createElement('div')
    el.style.width = '28px'
    el.style.height = '28px'
    el.style.background = color
    el.style.borderRadius = '50%'
    el.style.border = '2.5px solid #0F172A'
    el.style.boxShadow = `0 0 0 2px ${color}55, 0 0 18px ${color}`
    el.style.position = 'relative'
    el.style.zIndex = '10'

    if (esSOS) {
      // Pulso rojo para SOS
      el.className = 'pin-pulse'
      const centro = document.createElement('div')
      centro.style.width = '11px'
      centro.style.height = '11px'
      centro.style.background = '#ffffff'
      centro.style.borderRadius = '50%'
      centro.style.position = 'absolute'
      centro.style.top = '50%'
      centro.style.left = '50%'
      centro.style.transform = 'translate(-50%, -50%)'
      el.appendChild(centro)
    }

    markerRef.current = new maplibre.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)

    // Centrar el mapa en la alerta con animación suave
    map.easeTo({ center: [lng, lat], zoom: 15, duration: 800 })
  }, [alertaSeleccionada, mapListo])

  /* ── Acciones ── */

  const alertasFiltradas = filtrarPorTipo(alertas, tabActivo)

  const actualizarAlerta = (id: string, estado: Alerta['estado'], accionTexto: string) => {
    const accionCompleta = `${ahoraHHMM()} - ${accionTexto}`
    const aplicar = (a: Alerta): Alerta =>
      a.id !== id ? a : { ...a, estado, timeline: [...a.timeline, accionCompleta] }

    setAlertas((prev) => prev.map(aplicar))
    setAlertaSeleccionada((prev) => (prev ? aplicar(prev) : prev))
  }

  const manejarAccion = (id: string, accionTexto: string) =>
    actualizarAlerta(id, 'EN_PROCESO', accionTexto)

  const marcarResuelta = () => {
    if (!alertaSeleccionada) return
    actualizarAlerta(alertaSeleccionada.id, 'RESUELTA', 'Alerta marcada como resuelta')
  }

  const resolverDeshabilitado = !alertaSeleccionada || alertaSeleccionada.estado === 'RESUELTA'

  /* ──────────────────────────────── Render ──────────────────────────────── */

  return (
    <main className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
      {/* ── 1. Header Superior (64px) ── */}
      <header className="h-16 shrink-0 bg-slate-950/60 backdrop-blur border-b border-slate-800 flex items-center justify-between gap-4 md:gap-6 w-full px-4 md:px-6 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver al inicio"
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-[10px] text-slate-400 text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="hidden md:block">Inicio</span>
          </button>
          <div className="shrink-0">
            <Logo size={34} />
          </div>
          <span className="hidden lg:block truncate text-[18px] font-bold text-white tracking-tight">
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
            className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-[10px] border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cerrar Turno
          </button>
        </div>
      </header>

      {/* ── Cuerpo: 3 columnas ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 2. Columna Izquierda (25%) - Bandeja de Entrada ── */}
        <aside className="w-1/4 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden z-10">
          <div className="p-5 border-b border-slate-800 shrink-0">
            <h2 className="text-sm font-semibold text-white">Bandeja de Entrada</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Selecciona una alerta para ver su detalle
            </p>
          </div>

          {/* Pestañas (Tabs) */}
          <div className="flex flex-wrap gap-1 p-3 border-b border-slate-800 shrink-0">
            {(['TODAS', 'SOS', 'BARRIAL', 'ACOMPANAMIENTO'] as const).map((t) => {
              const activo = tabActivo === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTabActivo(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    activo
                      ? 'bg-slate-800 text-white border border-slate-600'
                      : 'text-slate-400 border border-transparent hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  {t !== 'TODAS' && iconoPorTipo(t)}
                  {t === 'TODAS' ? 'Todas' : labelPorTipo(t)}
                </button>
              )
            })}
          </div>

          {/* Lista de tarjetas de alertas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {alertasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                No hay alertas{tabActivo === 'TODAS' ? '' : ` del tipo ${labelPorTipo(tabActivo)}`}
              </div>
            ) : (
              alertasFiltradas.map((alerta) => (
                <AlertaCard
                  key={alerta.id}
                  alerta={alerta}
                  estaSeleccionada={alertaSeleccionada?.id === alerta.id}
                  onClick={() => setAlertaSeleccionada(alerta)}
                  onAccion={() => manejarAccion(alerta.id, btnAccionTexto(alerta.tipo))}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── 3. Columna Central (50%) - Mapa y Detalles ── */}
        <div className="w-2/4 flex flex-col overflow-hidden relative bg-slate-950">
          {/* Mapa (60% superior) */}
          <div className="h-3/5 bg-slate-950 relative border-b border-slate-800">
            <div ref={mapContainerRef} className="w-full h-full" />
            {!mapListo && (
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
            </div>
          </div>

          {/* Panel de Datos (40% inferior) */}
          <div className="h-2/5 bg-slate-900 p-6 flex flex-col overflow-y-auto relative">
            {alertaSeleccionada ? (
              <div className="w-full max-w-sm mx-auto rounded-2xl border border-slate-700/80 bg-slate-800 p-6 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: colorPorTipo(alertaSeleccionada.tipo),
                      boxShadow: `0 0 10px ${colorPorTipo(alertaSeleccionada.tipo)}`,
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {labelPorTipo(alertaSeleccionada.tipo)}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">{alertaSeleccionada.nombre}</h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-semibold">Teléfono</p>
                    <p className="text-slate-200">{alertaSeleccionada.telefono}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-semibold">Hora</p>
                    <p className="text-slate-200">{alertaSeleccionada.hora}</p>
                  </div>
                </div>

                {alertaSeleccionada.tipo === 'ACOMPANAMIENTO' && alertaSeleccionada.ruta && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <MessageCircle size={14} />
                    <span>Ruta: {alertaSeleccionada.ruta}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (alertaSeleccionada.telefono)
                      window.location.assign(`tel:${alertaSeleccionada.telefono}`)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] text-[15px] font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_18px_rgba(37,99,235,0.45)] transition-all"
                >
                  <Phone size={18} strokeWidth={2} /> Llamar al ciudadano
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  Estado:{' '}
                  <span
                    className={`font-semibold ${
                      alertaSeleccionada.estado === 'RESUELTA'
                        ? 'text-emerald-400'
                        : alertaSeleccionada.estado === 'EN_PROCESO'
                          ? 'text-amber-400'
                          : 'text-slate-300'
                    }`}
                  >
                    {estadoTexto(alertaSeleccionada.estado)}
                  </span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-slate-800/70 border border-slate-700 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                  <span className="absolute inset-0 rounded-full border border-blue-500/20 animate-ping [animation-duration:3s]" aria-hidden />
                  <Radar size={36} strokeWidth={1.5} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Sin alerta seleccionada</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecciona una alerta para ver los datos del ciudadano
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Columna Derecha (25%) - Acciones y Bitácora ── */}
        <aside className="w-1/4 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
          {/* Acciones Rápidas (Arriba) */}
          <div className="p-5 shrink-0 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Acciones rápidas
            </h3>
            <div className="space-y-3">
              {[
                { icono: <Phone size={16} strokeWidth={2} />, texto: 'Llamar contacto de confianza' },
                { icono: <HardHat size={16} strokeWidth={2} />, texto: 'Derivar a Carabineros' },
              ].map(({ icono, texto }) => (
                <button
                  key={texto}
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-slate-700 bg-slate-800 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-600 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {icono}
                    {texto}
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Timeline (Centro) */}
          <div className="flex-1 p-5 overflow-y-auto relative">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Bitácora del evento
            </h3>

            {alertaSeleccionada ? (
              <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-700" />
                {alertaSeleccionada.timeline.map((entrada, i, arr) => {
                  const ultima = i === arr.length - 1
                  return (
                    <div key={i} className="relative pl-7 pb-5 last:pb-0">
                      {/* Punto */}
                      <div
                        className={`absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2 border-slate-900 ${
                          ultima ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]' : 'bg-slate-600'
                        }`}
                      />
                      <div className={`text-sm ${ultima ? 'text-slate-100' : 'text-slate-400'}`}>
                        {entrada}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center text-slate-500 text-sm py-10">
                <ScrollText size={22} className="mb-2 opacity-60" />
                <p>Selecciona una alerta para ver su bitácora</p>
              </div>
            )}
          </div>

          {/* Botón de Cierre (Abajo) */}
          <div className="p-5 shrink-0 border-t border-slate-800 bg-slate-950/40">
            <button
              type="button"
              onClick={marcarResuelta}
              disabled={resolverDeshabilitado}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-[10px] text-base font-bold transition-all ${
                resolverDeshabilitado
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.55)] hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <CheckCircle2 size={20} strokeWidth={2} />
              {alertaSeleccionada?.estado === 'RESUELTA' ? 'Resuelta' : 'Marcar como Resuelta'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}

/* ──────────────────── Sub-componentes ──────────────────── */

/** Tarjeta individual de alerta en la bandeja de entrada (columna izquierda). */
function AlertaCard({
  alerta,
  estaSeleccionada,
  onClick,
  onAccion,
}: {
  alerta: Alerta
  estaSeleccionada: boolean
  onClick: () => void
  onAccion: () => void
}) {
  const accion = ACCION_POR_TIPO[alerta.tipo]
  const yaProcesado = alerta.estado !== 'PENDIENTE'

  return (
    // div (no button) porque contiene el botón de acción: no se anidan <button>.
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
      className={`relative overflow-hidden flex flex-col gap-3 p-3.5 pl-4 rounded-xl border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        estaSeleccionada
          ? 'bg-slate-800 border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.4),0_8px_24px_rgba(0,0,0,0.35)]'
          : 'bg-slate-800 border-slate-700/60 hover:border-slate-600 hover:bg-slate-700/60'
      }`}
    >
      {/* Borde izquierdo de color */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${BARRA_POR_TIPO[alerta.tipo]}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
            {alerta.hora} · {alerta.tipo === 'ACOMPANAMIENTO' ? `Ruta: ${alerta.ruta}` : alerta.descripcion || 'Alerta recibida'}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAccion()
          }}
          disabled={yaProcesado}
          className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            yaProcesado
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : accion.clases
          }`}
        >
          {accion.texto}
        </button>
      </div>
    </div>
  )
}
