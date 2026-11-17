import { useEffect, useRef, useState, type ComponentType } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Headphones, MapPin, MessageCircle, Phone, SendHorizontal, ShieldCheck, Siren, type LucideIcon } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

// Vite empaqueta el worker como asset aparte: sin esto el mapa no dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl

const PASOS: { t: string; d: string; Icono: LucideIcon; color: string; brillo: string }[] = [
  {
    t: 'Mantienes presionado SOS',
    d: 'Un segundo y medio basta. Así un toque accidental no envía nada.',
    Icono: Siren,
    color: 'text-red-400',
    brillo: 'drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]',
  },
  {
    t: 'Tu ubicación llega a la central',
    d: 'El operador ve dónde estás en el mapa y abre tu caso.',
    Icono: MapPin,
    color: 'text-blue-400',
    brillo: 'drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]',
  },
  {
    t: 'Un operador se comunica contigo',
    d: 'Te escribe o te llama dentro de la app y escala el caso si hace falta.',
    Icono: Headphones,
    color: 'text-indigo-400',
    brillo: 'drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]',
  },
]

/** Pie del panel según el paso activo: punto de estado + texto. */
const ESTADOS = [
  { texto: 'Esperando activación…', punto: 'bg-red-500', parpadea: true },
  { texto: 'Ubicación recibida en la central', punto: 'bg-blue-400', parpadea: false },
  { texto: 'Operador conectado', punto: 'bg-emerald-400', parpadea: false },
]

/** Mismo estilo oscuro que el mapa del panel de operador. */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PIN_ALERTA: [number, number] = [-70.6505, -33.4372]

/** Debe coincidir con `lg:top-24` del panel fijo. */
const STICKY_TOP = 96

/**
 * Mapa MapLibre de solo lectura con el pin rojo de la alerta. Se crea recién cuando el panel
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
        // Panel angosto (móvil): la tarjeta va abajo, así que el pin sube para que no quede tapado.
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
        /* Sin mapa queda el fondo de cuadrícula: el panel sigue leyéndose */
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

/* ── Contenido del panel, uno por paso ────────────────────────────── */

/** Paso 01: el botón SOS con tres anillos de radar (.radar-sos) y resplandor rojo. */
function CuerpoSOS() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative flex items-center justify-center">
        {/* Halos fijos */}
        <span className="absolute h-[208px] w-[208px] rounded-full bg-red-500/[0.04] md:h-[300px] md:w-[300px]" />
        <span className="absolute h-[164px] w-[164px] rounded-full border border-red-500/20 bg-red-500/[0.06] md:h-[236px] md:w-[236px]" />
        {/* Anillos que se expanden, desfasados */}
        {[0, 0.8, 1.6].map((d) => (
          <span
            key={d}
            className="radar-sos absolute h-32 w-32 rounded-full border-2 border-red-500/60 md:h-48 md:w-48"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
        <span className="relative flex h-32 w-32 max-w-full flex-col md:h-48 md:w-48 items-center justify-center rounded-full border-4 border-red-300/30 bg-[radial-gradient(circle_at_50%_35%,#F87171,#DC2626_70%)] text-white shadow-[0_0_80px_rgba(239,68,68,0.4),inset_0_-10px_30px_rgba(127,29,29,0.5)]">
          <span className="text-[36px] font-extrabold leading-none tracking-wide md:text-[52px]">SOS</span>
          <span className="mt-1.5 text-[13px] font-medium opacity-90 md:mt-2 md:text-[14px]">Mantén 1,5&nbsp;s</span>
        </span>
      </div>
    </div>
  )
}

/** Paso 02: el mapa de la central con la alerta entrante. */
function CuerpoMapa() {
  return (
    <>
      <MapaAlerta />
      {/* Móvil: abajo y a todo el ancho; desde sm: arriba a la derecha */}
      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-slate-700/70 bg-slate-900/90 p-3.5 shadow-xl backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[230px]">
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
    </>
  )
}

/** Paso 03: la conversación con la operadora. */
function CuerpoChat() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[11px] font-bold text-white">CA</span>
        <span>
          <span className="block text-[13px] font-semibold text-white">Camila, operadora CuidaChile</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea
          </span>
        </span>
        <span className="halo-llamada ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Phone size={15} />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-5 py-3 text-[12px] leading-snug sm:text-[13px]">
        <p className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-slate-800/90 px-3 py-2 text-slate-100">
          Hola Diego, soy Camila. Ya te tengo en el mapa. ¿Estás bien?
        </p>
        <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-white">
          Sí, hay unos tipos siguiéndome.
        </p>
        <p className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-slate-800/90 px-3 py-2 text-slate-100">
          Tranquilo, ya avisé a la central. Mantén la calma.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 pb-4">
        <span className="flex h-9 flex-1 items-center rounded-full bg-slate-800/80 px-4 text-[13px] text-slate-400">
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

const CUERPOS: ComponentType[] = [CuerpoSOS, CuerpoMapa, CuerpoChat]

/**
 * Panel de cristal de la derecha. Las tres vistas están apiladas y solo la del paso activo es
 * visible (.visual-paso): quedan montadas para no recrear el mapa al volver al paso 02.
 */
function PanelSOS({ activo }: { activo: number }) {
  const estado = ESTADOS[activo]
  return (
    <div className="relative w-full max-w-[600px]" aria-hidden>
      {/* Resplandor azul/violeta detrás del panel */}
      <div className="pointer-events-none absolute -inset-8 rounded-[48px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.22),rgba(124,58,237,0.12)_45%,transparent_70%)] blur-2xl" />

      <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-slate-900/40 shadow-[0_0_60px_rgba(59,130,246,0.18)] backdrop-blur-xl">
        {/* Brillo de borde: azul arriba a la izquierda, violeta abajo a la derecha */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-violet-500/10" />

        <div className="relative flex items-center justify-between gap-3 border-b border-white/5 px-4 py-4 sm:px-6">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.4)]">
              <ShieldCheck size={20} strokeWidth={2.25} />
            </span>
            <span className="whitespace-nowrap text-[15px] font-bold text-white sm:text-[17px]">CuidaChile SOS</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            Sistema activo
          </span>
        </div>

        <div className="relative grid h-[340px] sm:h-[380px]">
          {CUERPOS.map((Cuerpo, i) => (
            <div key={i} className="visual-paso relative [grid-area:1/1]" data-activa={i === activo || undefined}>
              <Cuerpo />
            </div>
          ))}
        </div>

        <div className="relative flex items-center justify-center gap-2.5 border-t border-white/5 px-6 py-4 text-[15px] font-medium text-slate-200">
          <span className={`h-2.5 w-2.5 rounded-full ${estado.punto} ${estado.parpadea ? 'cursor-parpadeo' : ''}`} />
          {estado.texto}
        </div>
      </div>
    </div>
  )
}

/**
 * "Qué pasa cuando pides ayuda": línea de tiempo con 3 pasos a la izquierda y el panel SOS fijo
 * (sticky) a la derecha, que cambia de vista según el paso que cruza la altura del panel.
 * En móvil: título, panel y luego los pasos, en una columna.
 */
export default function ComoFunciona() {
  const [activo, setActivo] = useState(0)
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])
  const refPanel = useRef<HTMLDivElement | null>(null)
  const [refTitulo, tituloVisto] = useEnVista<HTMLDivElement>()

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    let io: IntersectionObserver | undefined

    // Franja fina a la altura del centro del panel fijo (desktop) o del centro de la pantalla
    // (móvil): el paso que la cruza es el activo. Se recalcula al cambiar el tamaño.
    function observar() {
      io?.disconnect()
      const alto = window.innerHeight
      const altoPanel = refPanel.current?.offsetHeight ?? 0
      const centro = window.matchMedia('(min-width: 1024px)').matches ? STICKY_TOP + altoPanel / 2 : alto / 2
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
    <section
      id="como-funciona"
      className="relative isolate scroll-mt-20 overflow-x-clip bg-[radial-gradient(ellipse_80%_60%_at_60%_40%,#0A1128,#050B14_70%)] py-12 md:py-24"
      aria-labelledby="titulo-como-funciona"
    >
      {/* overflow-x-clip y no overflow-hidden: corta los resplandores sin romper el sticky */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Funde con el fondo de la sección siguiente (#050B14) para que no se vea un corte */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#050B14]" />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 md:gap-10 md:px-8 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-10 lg:px-8">
        {/* Título (móvil: primero) */}
        <div ref={refTitulo} data-visto={tituloVisto || undefined} className="revelar lg:col-span-5">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-400">Cómo funciona</p>
          <h2
            id="titulo-como-funciona"
            className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[38px] md:text-[52px]"
          >
            Qué pasa cuando
            <br />
            pides ayuda
          </h2>
        </div>

        {/* Panel (móvil: al final, bajo los pasos, sin sticky). En escritorio ocupa las dos filas de la derecha para quedar fijo durante todos los pasos. */}
        <div className="order-last lg:order-none lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <div ref={refPanel} className="relative flex justify-center lg:sticky lg:top-24">
            <div className="revelar w-full max-w-[600px]" data-visto={tituloVisto || undefined} style={{ transitionDelay: '150ms' }}>
              <PanelSOS activo={activo} />
            </div>
          </div>
        </div>

        {/* Pasos con línea de tiempo (móvil: segundo). pb: el último paso alcanza la altura del panel. */}
        <div className="lg:col-span-5 lg:pb-40">
        <ol>
          {PASOS.map((p, i) => {
            const esActivo = i === activo
            const ultimo = i === PASOS.length - 1
            return (
              <li
                key={p.t}
                ref={(el) => {
                  refsPasos.current[i] = el
                }}
                data-paso={i}
                aria-current={esActivo ? 'step' : undefined}
                className={`relative flex gap-3 sm:gap-4 ${ultimo ? '' : 'pb-6 lg:pb-16'}`}
              >
                {/* Línea punteada hasta el número siguiente */}
                {!ultimo && (
                  <span aria-hidden className="absolute bottom-0 left-5 top-12 -translate-x-px sm:left-6 sm:top-14 border-l-2 border-dashed border-blue-500/40" />
                )}
                {/* Tramo ya recorrido: se ilumina en cian y guía el ojo al paso siguiente */}
                {!ultimo && (
                  <span
                    aria-hidden
                    className="linea-progreso absolute bottom-0 left-5 top-12 w-0.5 bg-gradient-to-b from-cyan-400 to-violet-500 shadow-[0_0_10px_rgba(34,211,238,0.7)] sm:left-6 sm:top-14"
                    style={{ transform: `translateX(-1px) scaleY(${i < activo ? 1 : 0})` }}
                  />
                )}
                <span
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] sm:h-12 sm:w-12 sm:text-[15px] font-bold tabular-nums transition-[background-color,color,box-shadow] duration-300 ${
                    esActivo
                      ? 'bg-cyan-500 text-white shadow-[0_0_18px_rgba(6,182,212,0.85)]'
                      : i < activo
                        ? 'border border-cyan-400/50 bg-slate-900 text-cyan-300'
                        : 'border border-white/10 bg-slate-800 text-slate-400'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* Tarjeta de cristal oscuro: reflejo de luz en el canto superior; el paso activo enciende su borde */}
                <div
                  className={`relative flex min-w-0 flex-1 items-start gap-4 overflow-hidden rounded-2xl border bg-slate-900/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 sm:p-5 ${
                    esActivo
                      ? 'border-cyan-400/50 bg-slate-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_30px_rgba(59,130,246,0.3)]'
                      : 'border-white/10'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent transition-opacity duration-300 ${
                      esActivo ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 sm:h-14 sm:w-14 bg-gradient-to-br from-blue-950 to-slate-900">
                    <p.Icono size={26} strokeWidth={1.75} className={`${p.color} ${esActivo ? p.brillo : ''}`} aria-hidden />
                  </span>
                  <div>
                    <h3
                      className={`text-[18px] font-bold transition-colors duration-300 ${esActivo ? 'text-white' : 'text-slate-400'}`}
                    >
                      {p.t}
                    </h3>
                    <p
                      className={`mt-1.5 text-[15px] leading-relaxed transition-colors duration-300 ${
                        esActivo ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {p.d}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-8 pl-[52px] text-[14px] text-slate-400 sm:pl-16">¿Fue un error? Cancelas la alerta con tu PIN de 4&nbsp;dígitos.</p>
        </div>
      </div>
    </section>
  )
}
