import { useEffect, useRef, useState, type ComponentType } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MapPin, Pause, Phone, Play, SendHorizontal, ShieldCheck } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

// Vite empaqueta el worker como asset aparte: sin esto el mapa no dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl

const PASOS = [
  {
    t: 'Mantienes presionado SOS',
    d: 'Un segundo y medio basta. Así un toque accidental no envía nada.',
  },
  {
    t: 'Tu ubicación llega a la central',
    d: 'El operador ve dónde estás en el mapa y abre tu caso.',
  },
  {
    t: 'Un operador se comunica contigo',
    d: 'Te escribe o te llama dentro de la app y escala el caso si hace falta.',
  },
]

/** Cada cuánto avanza el recorrido solo: es la duración de la barra del paso activo (.progreso-paso). */
const AVANCE_MS = 5000

/** Mismo estilo oscuro que el mapa del panel de operador. */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PIN_ALERTA: [number, number] = [-70.6505, -33.4372]

/**
 * Mapa MapLibre de solo lectura con el pin rojo de la alerta. Se crea recién cuando el teléfono
 * se acerca a la pantalla: así el estilo y los tiles no se piden al abrir la landing.
 */
function MapaAlerta() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let mapa: maplibregl.Map | undefined
    let cancelado = false

    function iniciar() {
      if (cancelado || !el) return
      try {
        mapa = new maplibregl.Map({
          container: el,
          style: MAP_STYLE,
          center: PIN_ALERTA,
          zoom: 14.6,
          interactive: false,
          attributionControl: false,
        })
        // La tarjeta de la alerta tapa la parte baja de la pantalla: el pin sube para que se vea.
        mapa.setPadding({ top: 0, right: 0, left: 0, bottom: 170 })
        // El pulso va en un hijo: MapLibre posiciona el marcador con transform.
        const pin = document.createElement('div')
        pin.innerHTML =
          '<span class="relative flex h-5 w-5 items-center justify-center">' +
          '<span class="pin-neon-pulso absolute inset-0 rounded-full bg-red-500/60"></span>' +
          '<span class="relative h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]"></span>' +
          '</span>'
        new maplibregl.Marker({ element: pin }).setLngLat(PIN_ALERTA).addTo(mapa)
        mapa.once('load', () => {
          if (!cancelado) setListo(true)
        })
      } catch {
        /* Sin mapa queda el fondo de puntos: la pantalla sigue leyéndose */
      }
    }

    if (!('IntersectionObserver' in window)) {
      iniciar()
    } else {
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            io.disconnect()
            iniciar()
          }
        },
        { rootMargin: '400px 0px' },
      )
      io.observe(el)
      return () => {
        cancelado = true
        io.disconnect()
        mapa?.remove()
      }
    }
    return () => {
      cancelado = true
      mapa?.remove()
    }
  }, [])

  return (
    <div className="absolute inset-0 bg-[#0B1120] bg-[radial-gradient(rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:18px_18px]">
      <div ref={ref} className={`absolute inset-0 transition-opacity duration-500 ${listo ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}

/* ── Pantallas del teléfono, una por paso ─────────────────────────── */

/** Paso 01: el botón SOS con tres anillos de radar (.radar-sos). */
function PantallaSOS() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative flex items-center justify-center">
        {[0, 0.8, 1.6].map((d) => (
          <span
            key={d}
            className="radar-sos absolute h-36 w-36 rounded-full border-2 border-red-500/60"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
        <span className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-red-300/30 bg-[radial-gradient(circle_at_50%_35%,#F87171,#DC2626_70%)] text-white shadow-[0_0_60px_rgba(239,68,68,0.45),inset_0_-10px_30px_rgba(127,29,29,0.5)]">
          <span className="text-4xl font-extrabold leading-none tracking-wide">SOS</span>
          <span className="mt-1.5 text-xs font-medium opacity-90">Mantén 1,5&nbsp;s</span>
        </span>
      </div>
      <p className="mt-16 text-sm font-semibold text-white">¿Necesitas ayuda?</p>
      <p className="mt-1 text-xs text-slate-400">Mantén presionado para alertar a la central</p>
    </div>
  )
}

/** Paso 02: el mapa con tu ubicación y la confirmación de que la central la recibió. */
function PantallaMapa() {
  return (
    <>
      <MapaAlerta />
      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Alerta enviada
        </span>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white">
          <MapPin size={14} className="text-cyan-300" aria-hidden />
          La central ya ve dónde estás
        </p>
        <p className="mt-1 text-xs text-slate-400">Un operador está abriendo tu caso.</p>
      </div>
      {/* Créditos del mapa como texto: un enlace focusable no corresponde dentro de una imagen decorativa */}
      <span className="absolute left-3 top-2 text-[9px] text-slate-500">© CARTO © OpenStreetMap</span>
    </>
  )
}

/** Paso 03: la conversación con la operadora, con la llamada a un toque. */
function PantallaChat() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[11px] font-bold text-white">
          CA
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-white">Camila, operadora</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea
          </span>
        </span>
        <span className="halo-llamada ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Phone size={15} />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-4 py-3 text-[12px] leading-snug">
        <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-slate-800/90 px-3 py-2 text-slate-100">
          Hola Diego, soy Camila. Ya te tengo en el mapa. ¿Estás bien?
        </p>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-white">
          Sí, hay unos tipos siguiéndome.
        </p>
        <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-slate-800/90 px-3 py-2 text-slate-100">
          Tranquilo, ya avisé a la central. Mantén la calma.
        </p>
      </div>
      <div className="flex items-center gap-2 px-3 pb-4">
        <span className="flex h-9 flex-1 items-center rounded-full bg-slate-800/80 px-4 text-[12px] text-slate-400">
          <span className="cursor-parpadeo mr-1 h-4 w-px bg-slate-200" />
          Escribe un mensaje
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
          <SendHorizontal size={15} />
        </span>
      </div>
    </div>
  )
}

const PANTALLAS: ComponentType[] = [PantallaSOS, PantallaMapa, PantallaChat]

/**
 * Teléfono con marco metálico (el mismo del hero). Las tres pantallas están apiladas y solo la del
 * paso activo es visible (.visual-paso): quedan montadas para no recrear el mapa al volver al paso 02.
 */
function Telefono({ activo }: { activo: number }) {
  return (
    <div aria-hidden className="relative mx-auto w-[280px] sm:w-[300px]">
      {/* Resplandor tenue detrás del teléfono */}
      <div className="pointer-events-none absolute -inset-16 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.16),transparent_65%)] blur-2xl" />

      <div
        className="relative h-[580px] rounded-[46px] bg-[linear-gradient(145deg,#E2E8F0_0%,#64748B_20%,#1E293B_48%,#94A3B8_72%,#334155_100%)] p-[3px] sm:h-[620px]"
        style={{ boxShadow: '0 50px 90px -24px rgba(0, 0, 0, 0.85), 0 0 40px rgba(6, 182, 212, 0.12)' }}
      >
        <div className="h-full w-full rounded-[43px] bg-[#05070C] p-[6px]">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[37px] bg-[#050B14] text-white">
            {/* Barra de estado + Dynamic Island */}
            <div className="relative flex h-9 shrink-0 items-center justify-between px-6 text-[11px] font-semibold">
              <span>23:41</span>
              <span className="absolute left-1/2 top-2 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-black" />
              <span className="h-2 w-3.5 rounded-[2px] border border-white/80" />
            </div>
            {/* Header de la app */}
            <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 pb-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <ShieldCheck size={16} strokeWidth={2.25} />
              </span>
              <span className="text-[14px] font-bold">CuidaChile</span>
            </div>

            <div className="relative grid min-h-0 flex-1">
              {PANTALLAS.map((Pantalla, i) => (
                <div key={i} className="visual-paso relative [grid-area:1/1]" data-activa={i === activo || undefined}>
                  <Pantalla />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * "Qué pasa cuando pides ayuda" como recorrido de la app: tres pasos que se pueden tocar a la izquierda
 * y un teléfono a la derecha que muestra la pantalla del paso activo. Avanza solo cada 5 s; el avance lo
 * marca la barra del paso activo (al terminar su animación pasa al siguiente). Se detiene con el cursor
 * encima, con el foco dentro, fuera de pantalla o con el botón de pausa; con movimiento reducido no avanza solo.
 */
export default function ComoFunciona() {
  const [activo, setActivo] = useState(0)
  const [encima, setEncima] = useState(false)
  const [foco, setFoco] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [enPantalla, setEnPantalla] = useState(false)
  const refSeccion = useRef<HTMLElement | null>(null)
  const [refTitulo, tituloVisto] = useEnVista<HTMLDivElement>()

  useEffect(() => {
    const el = refSeccion.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const corriendo = enPantalla && !encima && !foco && !pausado

  return (
    <section
      ref={refSeccion}
      id="como-funciona"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-como-funciona"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div
          onMouseEnter={() => setEncima(true)}
          onMouseLeave={() => setEncima(false)}
          onFocus={() => setFoco(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false)
          }}
        >
          <div ref={refTitulo} data-visto={tituloVisto || undefined} className="revelar">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Cómo funciona</p>
            <h2
              id="titulo-como-funciona"
              className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white md:text-5xl"
            >
              Qué pasa cuando pides ayuda
            </h2>
          </div>

          <ol className="mt-10 space-y-2">
            {PASOS.map((p, i) => {
              const esActivo = i === activo
              return (
                <li key={p.t}>
                  <button
                    type="button"
                    onClick={() => setActivo(i)}
                    aria-current={esActivo ? 'step' : undefined}
                    className={`group/paso flex w-full gap-5 rounded-2xl py-4 text-left transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      esActivo ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span
                      className={`w-12 shrink-0 text-4xl font-bold leading-none tabular-nums tracking-tight text-cyan-400 transition-[text-shadow] duration-300 ${
                        esActivo ? '[text-shadow:0_0_24px_rgba(34,211,238,0.6)]' : ''
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-2xl font-bold leading-tight text-white">{p.t}</span>
                      <span className="mt-2 block text-base text-slate-400">{p.d}</span>
                      {/* Barra del paso activo: se llena en AVANCE_MS y su fin pasa al paso siguiente */}
                      <span className="mt-4 block h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
                        {esActivo && (
                          <span
                            key={activo}
                            className="progreso-paso block h-full origin-left bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                            style={{ animationDuration: `${AVANCE_MS}ms`, animationPlayState: corriendo ? 'running' : 'paused' }}
                            onAnimationEnd={() => setActivo((activo + 1) % PASOS.length)}
                          />
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="mt-6 flex items-center justify-between gap-4 pl-[68px]">
            <p className="text-sm text-slate-500">¿Fue un error? Cancelas la alerta con tu PIN de 4&nbsp;dígitos.</p>
            <button
              type="button"
              onClick={() => setPausado((v) => !v)}
              aria-label={pausado ? 'Reanudar el recorrido' : 'Pausar el recorrido'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {pausado ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
            </button>
          </div>
        </div>

        <Telefono activo={activo} />
      </div>
    </section>
  )
}
