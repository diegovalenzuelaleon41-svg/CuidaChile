import { useEffect, useState } from 'react'
import { useEnVista } from '../../hooks/useEnVista'

type Guardian = {
  nombre: string
  /** Foto que la persona autorizó usar. */
  foto: string
  turno: string
  /** Horario del turno en hora de Chile (0 a 23). Si `hasta` < `desde`, el turno cruza la medianoche. */
  desde: number
  hasta: number
}

/**
 * Operadores reales de la central, con permiso para mostrar su nombre y su foto.
 * Mientras esté vacío la sección no se muestra en producción.
 */
const REALES: Guardian[] = []

/**
 * Muestras para diseñar en desarrollo: personas, fotos (randomuser.me) y turnos inventados.
 * Solo existen en `npm run dev`: en el build de producción esta rama se elimina.
 */
const MUESTRAS: Guardian[] = import.meta.env.DEV
  ? [
      { nombre: 'Camila Soto', foto: 'https://randomuser.me/api/portraits/women/68.jpg', turno: 'Turno noche', desde: 20, hasta: 8 },
      { nombre: 'Matías Rojas', foto: 'https://randomuser.me/api/portraits/men/46.jpg', turno: 'Turno tarde', desde: 14, hasta: 22 },
      { nombre: 'Fernanda Díaz', foto: 'https://randomuser.me/api/portraits/women/32.jpg', turno: 'Turno mañana', desde: 6, hasta: 14 },
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

/**
 * "No estás solo": las personas de la central. El badge sale del horario del turno ("En turno ahora"),
 * no de una presencia en vivo que la landing no conoce. Sin operadores reales no se muestra.
 */
export default function Guardianes() {
  const [ref, visto] = useEnVista<HTMLDivElement>()
  const [hora, setHora] = useState(horaChile)

  // El badge se corrige solo si la página queda abierta al cambiar de turno.
  useEffect(() => {
    const t = window.setInterval(() => setHora(horaChile()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  if (GUARDIANES.length === 0) return null

  return (
    <section
      id="guardianes"
      className="scroll-mt-20 bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-guardianes"
    >
      <div ref={ref} data-visto={visto || undefined} className="mx-auto max-w-6xl">
        <div className="revelar">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Tus guardianes</p>
          <h2
            id="titulo-guardianes"
            className="mt-4 max-w-[20ch] text-balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white md:text-5xl"
          >
            No estás solo. Hay un equipo mirando por ti.
          </h2>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GUARDIANES.map((g, i) => {
            const activo = enTurno(g, hora)
            return (
              <li key={g.nombre} className="revelar" style={{ transitionDelay: `${120 + i * 90}ms` }}>
                {/* El hover va en el hijo: .revelar ya usa transform en el li */}
                <article className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[5px] hover:border-slate-700 motion-reduce:hover:translate-y-0">
                  <img
                    src={g.foto}
                    alt={`Foto de ${g.nombre}`}
                    width={64}
                    height={64}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{g.nombre}</h3>
                    <p className="text-sm text-slate-400">
                      {g.turno} · {dosDigitos(g.desde)} a {dosDigitos(g.hasta)}
                    </p>
                    {activo ? (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                        En turno ahora
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                        Fuera de turno
                      </span>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
