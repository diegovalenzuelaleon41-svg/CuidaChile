import { useEffect, useState } from 'react'
import { useEnVista } from '../../hooks/useEnVista'
import Trazo from './Trazo'

type Guardian = {
  nombre: string
  /** Foto que la persona autorizó usar. */
  foto: string
  turno: string
  /** Horario del turno en hora de Chile (0 a 23). Si `hasta` < `desde`, el turno cruza la medianoche. */
  desde: number
  hasta: number
  /** Una frase suya, con su permiso. Opcional. */
  frase?: string
}

/**
 * Operadores reales de la central, con permiso para mostrar su nombre y su foto.
 * Mientras esté vacío la sección no se muestra en producción.
 */
const REALES: Guardian[] = []

/**
 * Muestras para diseñar en desarrollo: personas, fotos (randomuser.me), turnos y frases inventados.
 * Solo existen en `npm run dev`: en el build de producción esta rama se elimina.
 */
const MUESTRAS: Guardian[] = import.meta.env.DEV
  ? [
      {
        nombre: 'Camila Soto',
        foto: 'https://randomuser.me/api/portraits/women/68.jpg',
        turno: 'Turno noche',
        desde: 20,
        hasta: 8,
        frase: 'Mientras vas en ruta te sigo en el mapa, hasta que me avisas que llegaste.',
      },
      {
        nombre: 'Matías Rojas',
        foto: 'https://randomuser.me/api/portraits/men/46.jpg',
        turno: 'Turno tarde',
        desde: 14,
        hasta: 22,
        frase: 'Lo primero que hago es escribirte. Que sepas que hay alguien.',
      },
      {
        nombre: 'Fernanda Díaz',
        foto: 'https://randomuser.me/api/portraits/women/32.jpg',
        turno: 'Turno mañana',
        desde: 6,
        hasta: 14,
        frase: 'Conozco Santiago de memoria. Eso ayuda cuando cada minuto cuenta.',
      },
    ]
  : []

const GUARDIANES = REALES.length > 0 ? REALES : MUESTRAS

/** Hora actual en Chile, sin importar la zona del navegador. */
function horaChile() {
  return Number(new Intl.DateTimeFormat('es-CL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Santiago' }).format(new Date()))
}

function enTurno({ desde, hasta }: Guardian, hora: number) {
  return desde < hasta ? hora >= desde && hora < hasta : hora >= desde || hora < hasta
}

const dosDigitos = (h: number) => `${String(h).padStart(2, '0')}:00`

/** Posición de cada guardián en la órbita (en % del cuadro), repartidos desde arriba. */
function posicion(i: number, total: number): [number, number] {
  const angulo = -Math.PI / 2 + (2 * Math.PI * i) / total
  return [50 + 38 * Math.cos(angulo), 50 + 38 * Math.sin(angulo)]
}

/** Tarjeta de cristal con la persona elegida en la órbita. */
function Ficha({ g, activo }: { g: Guardian; activo: boolean }) {
  return (
    <article
      className="cambio-guardian relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <img
          src={g.foto}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-cyan-400/40"
        />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{g.nombre}</h3>
          <p className="text-sm text-slate-400">
            {g.turno} · {dosDigitos(g.desde)} a {dosDigitos(g.hasta)}
          </p>
        </div>
        {activo ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            En turno
          </span>
        ) : (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs text-slate-500">
            Fuera de turno
          </span>
        )}
      </div>
      {g.frase && (
        <blockquote className="relative mt-5 text-pretty text-base leading-relaxed text-slate-300">
          “{g.frase}”
        </blockquote>
      )}
    </article>
  )
}

/**
 * "Hay personas detrás": una órbita con quienes atienden la central alrededor de ti. Cada guardián en
 * turno (según su horario, no una presencia en vivo que la landing no conoce) manda un pulso de luz por
 * su línea hacia el centro. Al pasar o enfocar a alguien, su ficha aparece al lado.
 * Sin operadores reales no se muestra.
 */
export default function Guardianes() {
  const [ref, visto] = useEnVista<HTMLDivElement>()
  const [hora, setHora] = useState(horaChile)
  const [elegido, setElegido] = useState(() => Math.max(0, GUARDIANES.findIndex((g) => enTurno(g, horaChile()))))

  // Los estados se corrigen solos si la página queda abierta al cambiar de turno.
  useEffect(() => {
    const t = window.setInterval(() => setHora(horaChile()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  if (GUARDIANES.length === 0) return null

  const enTurnoAhora = GUARDIANES.filter((g) => enTurno(g, hora)).length
  const actual = GUARDIANES[elegido]

  return (
    <section
      id="guardianes"
      className="relative scroll-mt-20 overflow-hidden bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-guardianes"
    >
      <div
        ref={ref}
        data-visto={visto || undefined}
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16"
      >
        <div className="revelar">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Tus guardianes</p>
          <h2
            id="titulo-guardianes"
            className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white md:text-5xl"
          >
            Tu seguridad no depende solo de la tecnología.{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
              Hay{' '}
              <span className="relative inline-block">
                personas
                <Trazo retraso={500} />
              </span>{' '}
              detrás de ella.
            </span>
          </h2>
          <p className="mt-5 max-w-[46ch] text-pretty text-base text-slate-400">
            Cuando pides ayuda, tu alerta no cae en un buzón. La recibe alguien de la central, que ve dónde estás y te
            escribe por el chat.
          </p>

          <p className="mt-8 inline-flex items-center gap-2 text-sm text-slate-400">
            <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            {enTurnoAhora === 1 ? '1 guardián en turno a esta hora' : `${enTurnoAhora} guardianes en turno a esta hora`}
          </p>

          <div className="mt-6 hidden lg:block" aria-live="polite">
            <Ficha key={actual.nombre} g={actual} activo={enTurno(actual, hora)} />
          </div>
        </div>

        <div className="revelar" style={{ transitionDelay: '150ms' }}>
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            {/* Resplandor de fondo y órbita */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.14),rgba(37,99,235,0.05)_45%,transparent_70%)]"
            />
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.3" strokeDasharray="1 1.5" />
              <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.3" />
              {GUARDIANES.map((g, i) => {
                const [x, y] = posicion(i, GUARDIANES.length)
                const d = `M${x} ${y} L50 50`
                return (
                  <g key={g.nombre}>
                    <path
                      d={d}
                      stroke={i === elegido ? 'rgba(34,211,238,0.55)' : 'rgba(34,211,238,0.18)'}
                      strokeWidth="0.4"
                      className="transition-[stroke] duration-300"
                    />
                    {enTurno(g, hora) && (
                      <path
                        d={d}
                        pathLength={100}
                        stroke="#a5f3fc"
                        strokeWidth="0.8"
                        strokeLinecap="round"
                        className="pulso-guardian"
                        style={{ animationDelay: `${i * 0.9}s` }}
                      />
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Tú, al centro */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span aria-hidden className="anillo-guardian absolute inset-0 rounded-full border border-cyan-400/40" />
              <span
                aria-hidden
                className="anillo-guardian absolute inset-0 rounded-full border border-cyan-400/40"
                style={{ animationDelay: '1.5s' }}
              />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/50 bg-[#07121F] text-sm font-semibold text-white shadow-[0_0_30px_rgba(6,182,212,0.45)]">
                Tú
              </span>
            </div>

            {/* Los guardianes en la órbita */}
            {GUARDIANES.map((g, i) => {
              const [x, y] = posicion(i, GUARDIANES.length)
              const activo = enTurno(g, hora)
              const esElegido = i === elegido
              return (
                <button
                  key={g.nombre}
                  type="button"
                  onMouseEnter={() => setElegido(i)}
                  onFocus={() => setElegido(i)}
                  onClick={() => setElegido(i)}
                  aria-pressed={esElegido}
                  aria-label={`${g.nombre}, ${g.turno.toLowerCase()}, ${activo ? 'en turno' : 'fuera de turno'}`}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-full outline-none"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span
                    className={`relative block rounded-full p-1 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-cyan-300 motion-reduce:group-hover:scale-100 ${
                      esElegido
                        ? 'bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_28px_rgba(6,182,212,0.55)]'
                        : 'bg-white/10'
                    }`}
                  >
                    <img
                      src={g.foto}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      className={`h-16 w-16 rounded-full object-cover transition-[filter] duration-300 sm:h-20 sm:w-20 ${
                        activo ? '' : 'grayscale'
                      }`}
                    />
                    {activo && (
                      <span
                        aria-hidden
                        className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#050B14] bg-emerald-400"
                      />
                    )}
                  </span>
                  <span
                    className={`whitespace-nowrap text-xs font-medium transition-colors duration-300 ${
                      esElegido ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {g.nombre.split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-8 lg:hidden" aria-live="polite">
            <Ficha key={actual.nombre} g={actual} activo={enTurno(actual, hora)} />
          </div>
        </div>
      </div>
    </section>
  )
}
