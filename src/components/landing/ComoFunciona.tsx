import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MessageCircle, Phone, SendHorizontal } from 'lucide-react'

// Vite empaqueta el worker como asset aparte: sin esto el mapa no dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl

const PASOS = [
  { t: 'Mantienes presionado SOS', d: 'Un segundo y medio basta. Así un toque accidental no envía nada.' },
  { t: 'Tu ubicación llega a la central', d: 'El operador ve dónde estás en el mapa y abre tu caso.' },
  { t: 'Una persona te contacta', d: 'Te escribe o te llama dentro de la app y escala el caso si hace falta.' },
]

/** Mismo estilo oscuro que el mapa del panel de operador. */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PIN_ALERTA: [number, number] = [-70.6505, -33.4372]

/** Deben coincidir con `lg:top-40` del sticky y con la altura de la ventana (barra 36 + mapa 360 + bordes). */
const STICKY_TOP = 160
const ALTO_VENTANA = 398

/** Corte curvo del color de la banda. `abajo` lo voltea para cerrarla. */
function Ola({ abajo = false }: { abajo?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      className={`block h-10 w-full text-[#0F172A] md:h-16 ${abajo ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="M0 40 C 240 0, 480 0, 720 28 S 1200 64, 1440 24 L1440 64 L0 64 Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Mapa MapLibre de solo lectura con el pin rojo de la alerta. Se crea recién cuando la ventana
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
        // Ventana angosta (móvil): la tarjeta va abajo, así que el pin sube para que no quede tapado.
        if (el.clientWidth < 420) mapa.setPadding({ top: 0, right: 0, left: 0, bottom: 150 })
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
        /* Sin mapa queda el fondo de cuadrícula: la ventana sigue leyéndose */
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

/** Marco común de las tres vistas: mismo ancho y alto, así el cambio de paso no mueve el layout. */
function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
      <div className="flex h-9 items-center gap-2 border-b border-slate-800 px-4">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 truncate text-[11px] font-medium text-slate-400">{titulo}</span>
      </div>
      <div className="relative h-[340px] sm:h-[360px]">{children}</div>
    </div>
  )
}

/** Paso 01: la pantalla del usuario mientras mantiene presionado el SOS. */
function SOSVisual() {
  return (
    <Marco titulo="CuidaChile - Tu teléfono">
      <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_42%,rgba(239,68,68,0.14),transparent_60%)]">
        <div className="relative flex h-40 w-40 items-center justify-center">
          {/* Anillo de progreso: se completa en 1,5 s cada vez que el paso se activa (.anillo-sos) */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#334155" strokeWidth="4" />
            <circle
              className="anillo-sos"
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#EF4444"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
            />
          </svg>
          <span className="sos-ring absolute h-28 w-28 rounded-full bg-red-500/25" />
          <span className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#F87171] to-[#DC2626] text-white shadow-[0_0_40px_rgba(239,68,68,0.55)]">
            <span className="text-[28px] font-extrabold leading-none tracking-widest">SOS</span>
            <span className="mt-1 text-[10px] opacity-90">Mantén 1,5&nbsp;s</span>
          </span>
        </div>
        <p className="mt-6 flex items-center gap-2 text-[14px] font-medium text-slate-200">
          <span className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse" />
          Enviando ubicación…
        </p>
      </div>
    </Marco>
  )
}

/** Paso 02: el panel de la central con el mapa y la alerta entrante. */
function OperatorDashboardVisual() {
  return (
    <Marco titulo="Central CuidaChile - Operador">
      <MapaAlerta />
      {/* Móvil: abajo y a todo el ancho; desde sm: arriba a la derecha */}
      <div className="absolute inset-x-3 bottom-3 rounded-lg border border-slate-700/70 bg-slate-900/90 p-3.5 shadow-xl backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-[220px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Alerta activa
        </span>
        <p className="mt-2 text-[14px] font-bold leading-snug text-white">SOS: Diego Valenzuela - Hace 12&nbsp;s</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-[12px] font-semibold text-white">
            <Phone size={13} /> Llamar
          </span>
          <span className="flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 py-2 text-[12px] font-semibold text-slate-200">
            <MessageCircle size={13} /> Chat
          </span>
        </div>
      </div>
      {/* Créditos del mapa como texto: un enlace focusable no corresponde dentro de una imagen decorativa */}
      <span className="absolute left-2 top-1.5 text-[9px] text-slate-500 sm:bottom-1.5 sm:top-auto">© CARTO © OpenStreetMap</span>
    </Marco>
  )
}

/** Paso 03: la conversación con la operadora. */
function ChatVisual() {
  return (
    <Marco titulo="Chat con la central">
      <div className="flex h-full flex-col bg-[#0B1120]">
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-white">CA</span>
          <span>
            <span className="block text-[13px] font-semibold text-white">Camila, operadora CuidaChile</span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea
            </span>
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-4 py-3 text-[12px] leading-snug sm:text-[13px]">
          <p className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2 text-slate-100">
            Hola Diego, soy Camila. Ya te tengo en el mapa. ¿Estás bien?
          </p>
          <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-[#2563EB] px-3 py-2 text-white">
            Sí, hay unos tipos siguiéndome.
          </p>
          <p className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2 text-slate-100">
            Tranquilo, ya avisé a la central. Mantén la calma.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-800 p-3">
          <span className="flex h-9 flex-1 items-center rounded-full bg-slate-800 px-4 text-[13px] text-slate-400">
            <span className="cursor-parpadeo mr-1 h-4 w-px bg-slate-200" />
            Escribe un mensaje
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-white">
            <SendHorizontal size={15} />
          </span>
        </div>
      </div>
    </Marco>
  )
}

const VISUALES = [SOSVisual, OperatorDashboardVisual, ChatVisual]

/** Móvil: la vista del paso dentro de su tarjeta. data-activa reinicia el anillo del SOS al llegar al paso. */
function MovilVisual({ paso, activo }: { paso: number; activo: boolean }) {
  const Visual = VISUALES[paso]
  return (
    <div className="mt-6 lg:hidden" data-activa={activo || undefined} aria-hidden>
      <Visual />
    </div>
  )
}

/**
 * Columna derecha (desktop): las tres vistas apiladas en la misma celda y solo la del paso
 * activo visible (.visual-paso). Quedan montadas para no recrear el mapa al volver al paso 02.
 */
function VisualPaso({ activo }: { activo: number }) {
  return (
    <div className="relative w-full max-w-[560px]" aria-hidden>
      {/* Glow azul de fondo */}
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-blue-600/25 blur-[90px]" />
      <div className="relative grid">
        {VISUALES.map((Visual, i) => (
          <div key={i} className="visual-paso [grid-area:1/1]" data-activa={i === activo || undefined}>
            <Visual />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * "Qué pasa cuando pides ayuda": en desktop los pasos se iluminan al llegar a la altura de la
 * ventana de la central (sticky). En móvil la ventana va debajo de los pasos, sin sticky.
 */
export default function ComoFunciona() {
  const [activo, setActivo] = useState(0)
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    let io: IntersectionObserver | undefined

    // Franja fina a la altura del centro de la ventana fija (desktop) o del centro de la
    // pantalla (móvil): el paso que la cruza es el activo. Se recalcula al cambiar el alto.
    function observar() {
      io?.disconnect()
      const alto = window.innerHeight
      const centro = window.matchMedia('(min-width: 1024px)').matches ? STICKY_TOP + ALTO_VENTANA / 2 : alto / 2
      const arriba = Math.max(0, centro - 40)
      const abajo = Math.max(0, alto - centro - 40)
      io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (e.isIntersecting) setActivo(Number((e.target as HTMLElement).dataset.paso))
          }
        },
        { rootMargin: `-${arriba}px 0px -${abajo}px 0px` },
      )
      refsPasos.current.forEach((el) => el && io?.observe(el))
    }

    observar()
    window.addEventListener('resize', observar)
    return () => {
      window.removeEventListener('resize', observar)
      io?.disconnect()
    }
  }, [])

  return (
    <section id="como-funciona" className="scroll-mt-20 overflow-x-clip" aria-labelledby="titulo-como-funciona">
      {/* overflow-x-clip y no overflow-hidden: corta el glow sin romper el sticky */}
      <Ola />
      <div className="bg-[#0F172A] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* El título va en la columna de texto: así el dashboard arranca a su lado y no queda aire debajo.
                pb: deja que el último paso llegue a la altura de la ventana fija. */}
            <div className="lg:col-span-5 lg:pb-8">
              <h2
                id="titulo-como-funciona"
                className="max-w-[18ch] text-balance font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-[52px] lg:text-[44px]"
              >
                Qué pasa cuando pides ayuda
              </h2>
              <ol className="mt-8 space-y-6 lg:space-y-16">
                {PASOS.map((p, i) => {
                  const esActivo = i === activo
                  return (
                    <li
                      key={p.t}
                      ref={(el) => {
                        refsPasos.current[i] = el
                      }}
                      data-paso={i}
                      aria-current={esActivo ? 'step' : undefined}
                      className={`rounded-2xl border p-6 transition-[background-color,border-color] duration-300 ${
                        esActivo ? 'border-slate-700/50 bg-slate-800/50 backdrop-blur-md' : 'border-transparent bg-transparent'
                      }`}
                    >
                      <span
                        className={`block font-display text-[15px] font-bold tabular-nums transition-colors duration-300 ${
                          esActivo ? 'text-blue-500' : 'text-slate-500'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3
                        className={`mt-2 font-display text-[24px] font-bold transition-colors duration-300 md:text-[28px] ${
                          esActivo ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        {p.t}
                      </h3>
                      <p
                        className={`mt-2 max-w-[40ch] text-[16px] leading-relaxed transition-colors duration-300 ${
                          esActivo ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {p.d}
                      </p>
                      {/* Móvil: sin sticky, cada paso lleva su vista debajo del texto */}
                      <MovilVisual paso={i} activo={esActivo} />
                    </li>
                  )
                })}
              </ol>
              <p className="mt-8 text-[15px] text-slate-400">
                ¿Fue un error? Cancelas la alerta con tu PIN de 4&nbsp;dígitos.
              </p>
            </div>

            {/* Solo desktop: fija mientras se recorren los pasos (self-stretch para que el sticky dure todo el recorrido).
                En móvil cada paso muestra su vista con MovilVisual. */}
            {/* pt: en la posición inicial, baja la ventana hasta la altura del paso 01 */}
            <div className="hidden self-stretch lg:col-span-7 lg:block lg:pt-[38px]">
              <div className="sticky top-40 flex justify-center">
                <VisualPaso activo={activo} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Debajo viene la sección de funciones (#0B1120): la ola cierra sobre ese color */}
      <div className="bg-[#0B1120]">
        <Ola abajo />
      </div>
    </section>
  )
}
