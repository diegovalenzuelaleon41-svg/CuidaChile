import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

type Testimonio = {
  cita: string
  nombre: string
  /** Comuna, o el rol si es del equipo ("Operadora de la central"). */
  lugar: string
  /** Foto de perfil que la persona autorizó usar. */
  foto: string
  /** Sello bajo el nombre ("Usuario verificado"). Solo si su cuenta se verificó de verdad. */
  sello?: string
  /** Fecha del testimonio (AAAA-MM-DD): la tarjeta muestra "Hace 2 días" a partir de ella. */
  fecha: string
  /** Nota de voz original, si la persona la envió. Sin `audio` la onda es solo decorativa. */
  audio?: { src: string; duracion: string }
}

/**
 * Testimonios reales, con permiso de cada persona para usar su nombre, foto, voz y cita.
 * Mientras esté vacío la sección no se muestra en producción.
 */
const REALES: Testimonio[] = []

/**
 * Muestras para diseñar en desarrollo: personas, fotos (randomuser.me), fechas y sellos inventados.
 * Solo existen en `npm run dev`: en el build de producción esta rama se elimina y no llegan al bundle.
 */
const MUESTRAS: Testimonio[] = import.meta.env.DEV
  ? [
      {
        cita: 'Mi hija sale tarde de la pega y yo no me dormía hasta que llegaba. Ahora sé que si pasa algo, aprieta el botón y alguien la llama al tiro.',
        nombre: 'María',
        lugar: 'Providencia',
        foto: 'https://randomuser.me/api/portraits/women/44.jpg',
        sello: 'Usuario verificado',
        fecha: '2026-11-15',
        audio: { src: '', duracion: '0:14' },
      },
      {
        cita: 'Vuelvo de la U como a las once y el último tramo hasta mi casa es bien oscuro. Con la ruta activa voy más tranquilo, la verdad.',
        nombre: 'Diego',
        lugar: 'Puente Alto',
        foto: 'https://randomuser.me/api/portraits/men/32.jpg',
        sello: 'Usuario verificado',
        fecha: '2026-11-10',
        audio: { src: '', duracion: '0:09' },
      },
      {
        cita: 'Cuando entra una alerta veo altiro en el mapa dónde está la persona. Eso cambia todo, porque la puedo ir guiando mientras hablamos.',
        nombre: 'Camila',
        lugar: 'Operadora de la central',
        foto: 'https://randomuser.me/api/portraits/women/68.jpg',
        sello: 'Operadora verificada',
        fecha: '2026-11-03',
        audio: { src: '', duracion: '0:21' },
      },
    ]
  : []

const TESTIMONIOS = REALES.length > 0 ? REALES : MUESTRAS
const TOTAL = TESTIMONIOS.length
/** Cada cuánto avanza el carrusel: es la duración de la barra de progreso (.progreso-testimonio). */
const AVANCE_MS = 5000

/** Alturas fijas de la onda (no aleatorias: así no cambian en cada render). */
const ONDA = [6, 10, 16, 12, 20, 14, 8, 18, 24, 16, 10, 14, 22, 18, 12, 8, 14, 20, 12, 6, 10, 16, 12, 8, 6, 10, 14, 8]

const relativo = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' })
/** "Hace 2 días", "La semana pasada"... según cuánto pasó desde `fecha`. */
function haceCuanto(fecha: string) {
  const dias = Math.round((new Date(`${fecha}T12:00:00`).getTime() - Date.now()) / 86_400_000)
  const texto = Math.abs(dias) < 7 ? relativo.format(dias, 'day') : relativo.format(Math.round(dias / 7), 'week')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Distancia circular de la tarjeta `i` a la activa: -1 izquierda, 0 centro, 1 derecha (bucle infinito). */
function distancia(i: number, activo: number) {
  const mitad = Math.floor(TOTAL / 2)
  return ((i - activo + TOTAL + mitad) % TOTAL) - mitad
}

/** Posición en el abanico de escritorio. Las laterales giran hacia el centro. */
function estiloAbanico(d: number): CSSProperties {
  const lejos = Math.abs(d)
  return {
    transform: `translate3d(calc(-50% + ${d * 82}%), 0, 0) rotateY(${d * -15}deg) scale(${lejos === 0 ? 1 : 0.85})`,
    opacity: lejos === 0 ? 1 : 0.4,
    filter: lejos === 0 ? 'none' : 'blur(3px)',
    zIndex: 10 - lejos,
  }
}

/**
 * Nota de voz al estilo de un chat. Con un audio real, el botón lo reproduce; sin audio, es solo la
 * imagen de la nota (sin botón, para no ofrecer un control que no hace nada).
 */
function NotaDeVoz({ audio, nombre }: { audio: NonNullable<Testimonio['audio']>; nombre: string }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [sonando, setSonando] = useState(false)
  const reproducible = audio.src !== ''

  function alternar() {
    const el = ref.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  const icono = sonando ? <Pause size={14} className="fill-current" aria-hidden /> : <Play size={14} className="ml-0.5 fill-current" aria-hidden />

  return (
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-800/60 py-1.5 pl-1.5 pr-4">
      {reproducible ? (
        <>
          <button
            type="button"
            onClick={alternar}
            aria-label={`${sonando ? 'Pausar' : 'Escuchar'} la nota de voz de ${nombre}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {icono}
          </button>
          <audio ref={ref} src={audio.src} preload="none" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => setSonando(false)} />
        </>
      ) : (
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
          {icono}
        </span>
      )}
      <span aria-hidden className="flex h-6 flex-1 items-center gap-[3px]">
        {ONDA.map((h, i) => (
          <span key={i} className={`w-[3px] rounded-full ${i < 9 ? 'bg-cyan-300' : 'bg-slate-500'}`} style={{ height: h }} />
        ))}
      </span>
      <span className="text-xs tabular-nums text-slate-400">{audio.duracion}</span>
    </div>
  )
}

/** Tarjeta con aspecto de captura de la app: foto, nombre, sello, cita entre comillas, nota de voz y fecha. */
function Tarjeta({ t, activa }: { t: Testimonio; activa: boolean }) {
  return (
    <figure
      className={`flex h-full flex-col rounded-2xl border bg-slate-900/60 p-5 backdrop-blur-md transition-[box-shadow,border-color] duration-500 md:p-6 ${
        activa
          ? 'border-cyan-400/25 shadow-[0_0_24px_rgba(6,182,212,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
      }`}
    >
      <figcaption className="flex items-center gap-3">
        {/* Foto de perfil: aro claro y un brillo cian tenue, como un avatar de chat */}
        <img
          src={t.foto}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/15 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
        />
        <span className="min-w-0">
          <span className="block text-base font-semibold text-white">{t.nombre}</span>
          <span className="block text-sm text-slate-400">{t.lugar}</span>
          {t.sello && (
            <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
              <Check size={12} strokeWidth={3} className="text-emerald-400" aria-hidden />
              {t.sello}
            </span>
          )}
        </span>
      </figcaption>

      <blockquote className="mt-6 flex-1">
        <p className="text-pretty text-lg leading-relaxed text-slate-200">“{t.cita}”</p>
      </blockquote>

      {t.audio && (
        <div className="mt-5">
          <NotaDeVoz audio={t.audio} nombre={t.nombre} />
        </div>
      )}

      <p className="mt-5 text-right text-xs text-slate-500">
        <time dateTime={t.fecha}>{haceCuanto(t.fecha)}</time>
      </p>
    </figure>
  )
}

/**
 * "En la vida real": carrusel automático en abanico 3D (escritorio) y deslizable con el dedo (móvil).
 * Avanza cada 5 s en bucle. El avance lo marca la barra de progreso: al terminar su animación pasa a la
 * siguiente, así barra y carrusel nunca se desfasan. Se pausa con el cursor encima, con el foco dentro,
 * fuera de pantalla o con el botón de pausa. Con movimiento reducido no avanza solo.
 * Sin testimonios reales, en producción no se muestra (ver REALES y MUESTRAS).
 */
export default function Testimonios() {
  const [activo, setActivo] = useState(0)
  const [encima, setEncima] = useState(false)
  const [foco, setFoco] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [enPantalla, setEnPantalla] = useState(false)
  const refEscenario = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = refEscenario.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (TOTAL === 0) return null

  const corriendo = enPantalla && !encima && !foco && !pausado
  const ir = (i: number) => setActivo(((i % TOTAL) + TOTAL) % TOTAL)

  return (
    <section
      id="testimonios"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14] py-12 md:py-24"
      aria-labelledby="titulo-testimonios"
      aria-roledescription="carrusel"
    >
      {/* Resplandor radial cian detrás del carrusel */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[62%] -z-10 h-[560px] w-[1000px] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.11),rgba(37,99,235,0.05)_45%,transparent_70%)]"
      />

      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">En la vida real</p>
        <h2
          id="titulo-testimonios"
          className="mt-4 max-w-[18ch] text-balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white md:text-5xl"
        >
          Así se vive CuidaChile, <span className="text-cyan-300">de vuelta a casa.</span>
        </h2>
        <p className="mt-4 max-w-[52ch] text-pretty text-lg text-slate-400">
          Quienes la usan para volver de noche y quienes responden desde la central.
        </p>
      </div>

      {/* Escritorio: abanico 3D con flechas que aparecen al pasar el cursor */}
      <div
        ref={refEscenario}
        className="group/escenario relative mx-auto mt-16 hidden h-[440px] max-w-6xl [perspective:1400px] md:block"
        onMouseEnter={() => setEncima(true)}
        onMouseLeave={() => setEncima(false)}
        onFocus={() => setFoco(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false)
        }}
      >
        {TESTIMONIOS.map((t, i) => {
          const d = distancia(i, activo)
          return (
            <div
              key={t.nombre}
              role="group"
              aria-roledescription="testimonio"
              aria-label={`${i + 1} de ${TOTAL}`}
              aria-hidden={d !== 0 || undefined}
              inert={d !== 0 || undefined}
              onClick={() => d !== 0 && ir(i)}
              className={`tarjeta-carrusel absolute left-1/2 top-0 h-full w-[340px] ${d !== 0 ? 'cursor-pointer' : ''}`}
              style={estiloAbanico(d)}
            >
              {/* La elevación va en un hijo: el padre ya usa transform para su lugar en el abanico */}
              <div
                className={`h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  d === 0 ? 'hover:-translate-y-[5px] motion-reduce:hover:translate-y-0' : ''
                }`}
              >
                <Tarjeta t={t} activa={d === 0} />
              </div>
            </div>
          )
        })}

        {(['anterior', 'siguiente'] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => ir(activo + (dir === 'anterior' ? -1 : 1))}
            aria-label={dir === 'anterior' ? 'Testimonio anterior' : 'Testimonio siguiente'}
            className={`absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-slate-200 opacity-0 backdrop-blur-md transition-[opacity,transform,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-slate-800 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 group-hover/escenario:opacity-100 ${
              dir === 'anterior' ? 'left-8' : 'right-8'
            }`}
          >
            {dir === 'anterior' ? <ChevronLeft size={22} aria-hidden /> : <ChevronRight size={22} aria-hidden />}
          </button>
        ))}
      </div>

      {/* Escritorio: progreso por testimonio. El tramo activo se llena en 5 s y al terminar avanza. */}
      <div className="mx-auto mt-10 hidden max-w-md items-center gap-3 px-4 md:flex">
        <div className="flex flex-1 gap-2">
          {TESTIMONIOS.map((t, i) => (
            <button
              key={t.nombre}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ver testimonio de ${t.nombre}`}
              aria-current={i === activo || undefined}
              className="group/tramo flex h-11 flex-1 items-center focus-visible:outline-none"
            >
              <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-slate-700/70 group-focus-visible/tramo:ring-2 group-focus-visible/tramo:ring-cyan-400">
                {i === activo ? (
                  <span
                    // key: al cambiar de testimonio la animación vuelve a empezar
                    key={activo}
                    className="progreso-testimonio absolute inset-0 origin-left bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]"
                    style={{ animationDuration: `${AVANCE_MS}ms`, animationPlayState: corriendo ? 'running' : 'paused' }}
                    onAnimationEnd={() => ir(activo + 1)}
                  />
                ) : (
                  <span className={`absolute inset-0 bg-cyan-400/50 ${i < activo ? '' : 'hidden'}`} />
                )}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPausado((p) => !p)}
          aria-label={pausado ? 'Reanudar el carrusel' : 'Pausar el carrusel'}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {pausado ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        </button>
      </div>

      {/* Móvil: sin abanico, una tarjeta al 90 % del ancho, deslizable con el dedo y con imán al centro */}
      <ul className="scrollbar-hide mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[5%] md:hidden">
        {TESTIMONIOS.map((t) => (
          <li key={t.nombre} className="w-[90%] shrink-0 snap-center">
            <Tarjeta t={t} activa />
          </li>
        ))}
      </ul>
    </section>
  )
}
