/**
 * Panel de Operador — Centro de Comando (Fase 2).
 *
 * Dashboard desktop-first, sin scroll general (h-screen).
 * Tres columnas + header superior. Datos 100% mock (sin Supabase Realtime).
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
  MessageCircle,
  HardHat,
  WifiOff,
  ArrowLeft,
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
const COLOR_SOS = '#DC2626'
const COLOR_BARRIAL = '#F59E0B'
const COLOR_ACOMPANAMIENTO = '#2563EB'
const COLOR_BG_CANVAS = '#F8FAFC'

type TabId = AlertaTipo | 'TODAS'

/* ────────────────────────────── Mapa (MapLibre) ───────────────────────────── */

interface MapMarkerRef {
  current: any | null
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
  const mapInstanceRef = useRef<any>(null)
  const maplibreRef = useRef<any>(null)
  const markerRef = useRef<MapMarkerRef>({ current: null })

  /* ── Inicializar MapLibre (dynamic import, solo cliente) ── */
  useEffect(() => {
    let cancelado = false

    ;(async () => {
      try {
        const maplibre = await import('maplibre-gl')
        maplibreRef.current = maplibre
        const { Map } = maplibre

        if (!mapContainerRef.current || cancelado) return

        const map = new Map({
          container: mapContainerRef.current,
          style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [-70.6693, -33.4489], // [lng, lat] Santiago
          zoom: 14,
          hash: false,
          interactive: true,
        })

        mapInstanceRef.current = map

        if (cancelado) {
          map.remove()
          return
        }

        setMapListo(true)
      } catch (error) {
        console.error('Error cargando MapLibre:', error)
      }
    })()

    return () => {
      cancelado = true
      const map = mapInstanceRef.current
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  /* ── Actualizar / mover pin cuando cambia la alerta seleccionada ── */
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapListo || !alertaSeleccionada) return

    // Quitar pin previo
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    const { lat, lng, tipo } = alertaSeleccionada
    const esSOS = tipo === 'SOS'

    const el = document.createElement('div')
    el.style.width = '28px'
    el.style.height = '28px'
    el.style.background = esSOS ? COLOR_SOS : COLOR_BARRIAL
    el.style.borderRadius = '50%'
    el.style.border = '2.5px solid #ffffff'
    el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)'
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

    markerRef.current = maplibreMarker(el, lng, lat)

    // Centrar el mapa en la alerta con animación suave
    map.easeTo({ center: [lng, lat], zoom: 15, duration: 800 })
  }, [alertaSeleccionada, mapListo])

  /* ── Helpers ── */

  const alertasFiltradas = filtrarPorTipo(alertas, tabActivo)

  const colorPorTipo = (tipo: AlertaTipo) => {
    switch (tipo) {
      case 'SOS':
        return COLOR_SOS
      case 'BARRIAL':
        return COLOR_BARRIAL
      case 'ACOMPANAMIENTO':
        return COLOR_ACOMPANAMIENTO
    }
  }

  const labelPorTipo = (tipo: AlertaTipo) => {
    switch (tipo) {
      case 'SOS':
        return 'SOS'
      case 'BARRIAL':
        return 'Barrial'
      case 'ACOMPANAMIENTO':
        return 'Acompañamiento'
    }
  }

  const iconoPorTipo = (tipo: AlertaTipo) => {
    switch (tipo) {
      case 'SOS':
        return <AlertCircle size={18} strokeWidth={2} />
      case 'BARRIAL':
        return <Users size={18} strokeWidth={2} />
      case 'ACOMPANAMIENTO':
        return <Pin size={18} strokeWidth={2} />
    }
  }

  const btnAccionPorTipo = (tipo: AlertaTipo) => {
    switch (tipo) {
      case 'SOS':
        return 'Atender'
      case 'BARRIAL':
        return 'Validar'
      case 'ACOMPANAMIENTO':
        return 'Aceptar'
    }
  }

  const seleccionarAlerta = (alerta: Alerta) => {
    setAlertaSeleccionada(alerta)
  }

  const manejarAccion = (id: string, accionTexto: string) => {
    const ahora = ahoraHHMM()
    const accionCompleta = `${ahora} - ${accionTexto}`

    setAlertas((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const siguiente: Alerta = { ...a, estado: 'EN_PROCESO' }
        siguiente.timeline = [...a.timeline, accionCompleta]
        return siguiente
      })
    )

    setAlertaSeleccionada((prev) => {
      if (!prev || prev.id !== id) return prev
      const siguiente: Alerta = { ...prev, estado: 'EN_PROCESO' }
      siguiente.timeline = [...prev.timeline, accionCompleta]
      return siguiente
    })
  }

  const marcarResuelta = () => {
    if (!alertaSeleccionada) return
    const id = alertaSeleccionada.id
    const ahora = ahoraHHMM()
    const accionCompleta = `${ahora} - Alerta marcada como resuelta`

    setAlertas((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const siguiente: Alerta = { ...a, estado: 'RESUELTA' }
        siguiente.timeline = [...a.timeline, accionCompleta]
        return siguiente
      })
    )

    setAlertaSeleccionada((prev) => {
      if (!prev || prev.id !== id) return prev
      const siguiente: Alerta = { ...prev, estado: 'RESUELTA' }
      siguiente.timeline = [...prev.timeline, accionCompleta]
      return siguiente
    })
  }

  /* ──────────────────────────────── Render ──────────────────────────────── */

  return (
    <main className="h-screen bg-white flex flex-col overflow-hidden">
      {/* ── 1. Header Superior (64px) ── */}
      <header className="h-16 shrink-0 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-4 md:gap-6 w-full px-4 md:px-6 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver al inicio"
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-[10px] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] hover:text-heading transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="hidden md:block">Inicio</span>
          </button>
          <div className="shrink-0">
            <Logo size={34} />
          </div>
          <span className="hidden lg:block truncate text-[18px] font-bold text-heading tracking-tight">
            Panel de Operador
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-medium border border-[#86EFAC]">
            <span className="w-2 h-2 shrink-0 rounded-full bg-[#22C55E]" aria-hidden />
            En línea
          </span>
          <button
            type="button"
            onClick={() => navigate('/seleccionar-rol')}
            className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-[10px] border border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] transition-colors"
          >
            Cerrar Turno
          </button>
        </div>
      </header>

      {/* ── Cuerpo: 3 columnas ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 2. Columna Izquierda (25%) - Bandeja de Entrada ── */}
        <aside className={`w-1/4 bg-[${COLOR_BG_CANVAS}] border-r border-[#E2E8F0] flex flex-col overflow-hidden z-10`}>
          <div className="p-5 border-b border-[#E2E8F0] bg-white/50 backdrop-blur-md z-10 shrink-0">
            <h2 className="text-sm font-semibold text-heading">Bandeja de Entrada</h2>
            <p className="text-[11px] text-muted mt-0.5">
              Selecciona una alerta para ver su detalle
            </p>
          </div>

          {/* Pestañas (Tabs) */}
          <div className="flex gap-1 p-3 border-b border-[#E2E8F0] bg-white/40 shrink-0">
            {([ 'TODAS', 'SOS', 'BARRIAL', 'ACOMPANAMIENTO' ] as const).map((t) => {
              const activo = tabActivo === t
              const esTipo = t !== 'TODAS'
              return (
                <button
                  key={t}
                  onClick={() => setTabActivo(activo ? 'TODAS' : (esTipo ? t : 'SOS'))}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    activo
                      ? 'bg-white shadow-soft text-heading border border-[#E2E8F0]'
                      : 'text-muted hover:bg-[#E2E8F0] hover:text-heading'
                  }`}
                >
                  {esTipo && iconoPorTipo(t as AlertaTipo)}
                  {esTipo ? ` ${labelPorTipo(t as AlertaTipo)}` : 'Todas'}
                </button>
              )
            })}
          </div>

          {/* Lista de tarjetas de alertas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {alertasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted text-sm">
                No hay alertas{punto(tabActivo)}
              </div>
            ) : (
              alertasFiltradas.map((alerta) => (
                <AlertaCard
                  key={alerta.id}
                  alerta={alerta}
                  estaSeleccionada={alertaSeleccionada?.id === alerta.id}
                  color={colorPorTipo(alerta.tipo)}
                  onClick={() => seleccionarAlerta(alerta)}
                  onAccion={() => manejarAccion(alerta.id, btnAccionTexto(alerta.tipo))}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── 3. Columna Central (50%) - Mapa y Detalles ── */}
        <div className="w-2/4 flex flex-col overflow-hidden relative">
          {/* Mapa (60% superior) */}
          <div className="h-3/5 bg-[#EFF6FF] relative border-b border-[#E2E8F0]">
            <div ref={mapContainerRef} className="w-full h-full" />
            {!mapListo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
                <Loader2 size={24} className="mb-2 animate-spin" />
                <span>Cargando mapa…</span>
              </div>
            )}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-xs font-semibold text-heading border border-[#E2E8F0] shadow-soft">
                <Pin size={14} strokeWidth={2} />
                Santiago Centro
              </div>
            </div>
          </div>

          {/* Panel de Datos (40% inferior) */}
          <div className="h-2/5 bg-white border-t border-[#E2E8F0] p-6 flex flex-col overflow-y-auto relative">
            {alertaSeleccionada ? (
              <div className="card max-w-sm mx-auto mt-[-24px] relative z-10 shadow-lift p-6 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${colorPorTipo(alertaSeleccionada.tipo)}`}
                  />
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    {labelPorTipo(alertaSeleccionada.tipo)}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-heading">{alertaSeleccionada.nombre}</h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[11px] text-muted uppercase font-semibold">Teléfono</p>
                    <p className="text-ink">{alertaSeleccionada.telefono}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted uppercase font-semibold">Hora</p>
                    <p className="text-ink">{alertaSeleccionada.hora}</p>
                  </div>
                </div>

                {alertaSeleccionada.tipo === 'ACOMPANAMIENTO' && alertaSeleccionada.ruta && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <MessageCircle size={14} />
                    <span>Ruta: {alertaSeleccionada.ruta}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    alertaSeleccionada.telefono &&
                      window.location.assign(`tel:${alertaSeleccionada.telefono}`)
                  }}
                  className="btn-primary w-full py-3.5 text-[15px]"
                >
                  <Phone size={18} strokeWidth={2} /> 𝗟𝗹𝗮𝗺𝗮𝗿 al ciudadano
                </button>

                <p className="text-[11px] text-muted text-center">
                  Estado:{' '}
                  <span
                    className={`font-semibold text-${alertaSeleccionada.estado === 'RESUELTA' ? 'ok' : alertaSeleccionada.estado === 'EN_PROCESO' ? 'warn' : 'muted'}`}
                  >
                    {alertaSeleccionada.estado === 'PENDIENTE' ? 'Pendiente' : alertaSeleccionada.estado === 'EN_PROCESO' ? 'En proceso' : 'Resuelta'}
                  </span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted space-y-2">
                <Pin size={32} className="text-faint" />
                <span className="text-sm">Selecciona una alerta para ver los datos del ciudadano</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Columna Derecha (25%) - Acciones y Bitácora ── */}
        <aside className="w-1/4 border-l border-[#E2E8F0] bg-white flex flex-col overflow-hidden">
          {/* Acciones Rápidas (Arriba) */}
          <div className="p-5 shrink-0 border-b border-[#E2E8F0]">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-4">
              Acciones rápidas
            </h3>
            <div className="space-y-3">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-[#E2E8F0] bg-white text-sm font-medium text-ink hover:bg-[#F8FAFC] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Phone size={16} strokeWidth={2} />
                  Llamar contacto de confianza
                </span>
                <ChevronRight size={14} className="text-faint" />
              </button>
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border border-[#E2E8F0] bg-white text-sm font-medium text-ink hover:bg-[#F8FAFC] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HardHat size={16} strokeWidth={2} />
                  Derivar a Carabineros
                </span>
                <ChevronRight size={14} className="text-faint" />
              </button>
            </div>
          </div>

          {/* Timeline (Centro) */}
          <div className="flex-1 p-5 overflow-y-auto relative">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-4">
              Bitácora del evento
            </h3>

            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#E2E8F0]" />

              {alertaSeleccionada ? (
                alertaSeleccionada.timeline.map((entrada, i) => (
                  <div key={i} className="relative pl-8 pb-6 last:pb-0">
                    {/* Punto */}
                    <div
                      className={`absolute left-[calc(50%-4px)] top-0 w-2 h-2 rounded-full border-2 ${
                        i === 0
                          ? 'bg-[#2563EB] border-white'
                          : 'bg-[#E2E8F0] border-[#E2E8F0]'
                      }`}
                    />
                    <div className="text-sm text-ink">
                      {entrada}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted text-sm py-10">
                  <WifiOff size={20} className="mb-2 opacity-50" />
                  <p>Selecciona una alerta para ver su bitácora</p>
                </div>
              )}
            </div>
          </div>

          {/* Botón de Cierre (Abajo) */}
          <div className="p-5 shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <button
              type="button"
              onClick={marcarResuelta}
              disabled={!alertaSeleccionada || alertaSeleccionada.estado === 'RESUELTA'}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-[10px] text-base font-bold text-white shadow-[0_8px_24px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] ${
                !alertaSeleccionada || alertaSeleccionada.estado === 'RESUELTA'
                  ? 'bg-[#94A3B8] cursor-not-allowed'
                  : 'bg-[#10B981] hover:bg-[#059669]'
              }`}
            >
              <CheckCircle2 size={20} strokeWidth={2} />
              {alertaSeleccionada?.estado === 'RESUELTA' ? 'Resuelta' : '✅ Marcar como Resuelta'}
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
  color,
  onClick,
  onAccion,
}: {
  alerta: Alerta
  estaSeleccionada: boolean
  color: string
  onClick: () => void
  onAccion: () => void
}) {
  const estadoTexto =
    alerta.estado === 'PENDIENTE' ? 'Pendiente' : alerta.estado === 'EN_PROCESO' ? 'En proceso' : 'Resuelta'
  const btnTexto =
    alerta.tipo === 'SOS' ? 'Atender' : alerta.tipo === 'BARRIAL' ? 'Validar' : 'Aceptar'
  const btnColor =
    alerta.tipo === 'SOS' ? '#DC2626' : alerta.tipo === 'BARRIAL' ? '#F59E0B' : '#2563EB'
  const yaProcesado = alerta.estado !== 'PENDIENTE'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 p-3.5 rounded-xl border cursor-pointer transition-all hover:bg-[#F1F5F9] ${
        estaSeleccionada
          ? 'ring-2 ring-offset-1 ring-[#2563EB] bg-[#EFF6FF]'
          : 'bg-white border-[#E2E8F0]'
      }`}
    >
      {/* Borde izquierdo de color */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${color === '#DC2626' ? 'bg-sos' : color === '#F59E0B' ? 'bg-warn' : 'bg-brand-600'} `}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase ${color}`}>
              {alerta.tipo === 'SOS' ? '🔴 SOS' : alerta.tipo === 'BARRIAL' ? '🟡 Barrial' : '🔵 Acompañamiento'}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                alerta.estado === 'RESUELTA'
                  ? 'bg-[#D1FAE5] text-[#065F46]'
                  : alerta.estado === 'EN_PROCESO'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-[#E2E8F0] text-[#475569]'
              }`}
            >
              {estadoTexto}
            </span>
          </div>

          <h4 className="text-sm font-bold text-heading truncate">{alerta.nombre}</h4>
          <p className="text-[12px] text-muted mt-0.5 truncate">
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
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            yaProcesado
              ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
              : `bg-${color === '#DC2626' ? 'sos' : color === '#F59E0B' ? 'warn' : 'brand-600'} text-white hover:opacity-90 disabled:opacity-50`
          }`}
        >
          {btnTexto}
        </button>
      </div>
    </button>
  )
}

/** Punto decorativo si el tab tiene filtro específico. */
function punto(tab: TabId): string {
  return tab === 'TODAS' ? '' : ` del tipo ${labelPorTipo(tab as AlertaTipo)}`
}

/** Helper para crear un marcador MapLibre manteniendo la referencia tipada. */
function maplibreMarker(el: HTMLElement, lng: number, lat: number) {
  const map = mapInstanceRef.current
  const maplibre = maplibreRef.current
  if (!map || !maplibre) return null
  const { Marker } = maplibre
  return new Marker(el).setLngLat([lng, lat]).addTo(map)
}

/** Texto del botón de acción según tipo. */
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
