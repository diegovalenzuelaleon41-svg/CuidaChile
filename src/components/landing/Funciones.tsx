import { CheckCircle2, Headphones, Lock, Megaphone, Route, Users, Zap, type LucideIcon } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'
import PalabrasCineticas from './PalabrasCineticas'

const FUNCIONES: { t: string; d: string; Icono: LucideIcon | null }[] = [
  {
    t: 'Acompañamiento en ruta',
    d: 'Marcas a dónde vas y un operador sigue tu trayecto en vivo hasta que llegas.',
    Icono: Route,
  },
  {
    t: 'SOS con PIN',
    d: 'La alerta se envía al mantener el botón presionado y solo tú puedes cancelarla, con tu PIN de 4 dígitos.',
    Icono: null, // cuatro puntos de PIN, dibujados abajo
  },
  {
    t: 'Chat y llamada con un operador',
    d: 'Hablas con una persona sin salir de la app, por escrito si no puedes hablar o por voz si lo necesitas.',
    Icono: Headphones,
  },
  {
    t: 'Reportes de tu barrio',
    d: 'Avisa lo que ves en tu cuadra, con foto si quieres y sin dar tu nombre. Un operador lo valida y tus vecinos lo ven en el mapa.',
    Icono: Megaphone,
  },
]

/**
 * Indicadores de confianza. Solo datos que la app cumple hoy: el SOS se activa a los 1,5 s, todo
 * viaja por HTTPS/TLS y quien responde es un operador humano. Si se miden tiempos de respuesta o
 * se cubre 24/7, cambiar aquí.
 */
const INDICADORES: { Icono: LucideIcon; texto: string }[] = [
  { Icono: Zap, texto: 'Alerta en 1,5 s' },
  { Icono: Lock, texto: 'Conexión cifrada' },
  { Icono: Users, texto: 'Operadores humanos' },
]

/** "Para el camino de todos los días": las 4 funciones de uso diario. Siempre oscura. */
export default function Funciones() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section
      id="funciones"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-funciones"
    >
      {/* Fondo: resplandor azul arriba a la izquierda */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_20%_25%,rgba(37,99,235,0.14),transparent_70%)]" />
        <PalabrasCineticas />
      </div>

      <div
        ref={ref}
        data-visto={visto || undefined}
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 md:gap-12 lg:grid-cols-12 lg:gap-14"
      >
        {/* Izquierda (móvil: arriba): escudo, título e indicadores */}
        <div className="revelar text-center lg:col-span-5 lg:text-left">
          <h2
            id="titulo-funciones"
            className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[38px] md:text-[52px]"
          >
            Para el camino
            <br />
            de todos los días
          </h2>

          <p className="mx-auto mt-5 max-w-[38ch] text-[17px] leading-relaxed text-slate-300 lg:mx-0">
            No solo sirve en una emergencia. CuidaChile te acompaña antes de que algo pase.
          </p>

          <ul className="mt-9 flex justify-center lg:justify-start">
            {INDICADORES.map(({ Icono, texto }) => (
              <li
                key={texto}
                className="flex flex-col items-center gap-2 border-r border-slate-700 px-4 text-center last:border-r-0 sm:px-6 lg:first:pl-0"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_14px_rgba(59,130,246,0.3)]">
                  <Icono size={18} strokeWidth={2} className="text-blue-300" aria-hidden />
                </span>
                <span className="text-xs font-medium text-slate-200">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Derecha (móvil: abajo): tarjetas de funciones */}
        <ul className="flex flex-col gap-4 lg:col-span-7">
          {FUNCIONES.map(({ t, d, Icono }, i) => {
            const destacada = i === 0
            return (
              <li key={t} className="revelar" style={{ transitionDelay: `${120 + i * 90}ms` }}>
                {/* El hover va en el hijo: .revelar ya usa transform en el li */}
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-md md:p-6 transition-[transform,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-blue-400/70 hover:shadow-[0_0_28px_rgba(59,130,246,0.25)] sm:gap-4 md:gap-5 ${
                    destacada
                      ? 'border-blue-500/50 bg-slate-900/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800 md:h-12 md:w-12"
                    aria-hidden
                  >
                    {Icono ? (
                      <Icono size={22} strokeWidth={1.75} className="text-blue-300" />
                    ) : (
                      <span className="flex gap-1">
                        {[0, 1, 2, 3].map((n) => (
                          <span key={n} className="h-1.5 w-1.5 rounded-full bg-blue-200" />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[17px] font-bold text-white md:text-[18px]">{t}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-slate-400 md:text-[15px]">{d}</p>
                  </div>
                  {/* Función disponible hoy en la app */}
                  <span className="flex h-7 w-7 shrink-0 items-center md:h-8 md:w-8 justify-center rounded-full border border-teal-400/20 bg-teal-500/10">
                    <CheckCircle2 size={18} strokeWidth={2} className="text-teal-400" aria-label="Disponible" />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
