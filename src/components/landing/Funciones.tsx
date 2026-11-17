import { CheckCircle2, Headphones, Lock, Megaphone, Route, ShieldCheck, Users, Zap, type LucideIcon } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

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

/** Escudo con check, brillo azul y anillos orbitales planos debajo. Decorativo. */
function EscudoConfianza() {
  return (
    <div className="relative mx-auto flex h-40 w-56 items-center justify-center lg:mx-0" aria-hidden>
      {/* Anillos orbitales: elipses planas concéntricas bajo el escudo */}
      <div className="absolute bottom-3 left-1/2 h-12 w-56 -translate-x-1/2 rounded-[50%] border border-blue-400/20" />
      <div className="absolute bottom-6 left-1/2 h-8 w-40 -translate-x-1/2 rounded-[50%] border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.25)]" />
      <div className="absolute bottom-4 left-1/2 h-10 w-36 -translate-x-1/2 rounded-full bg-blue-500/25 blur-2xl" />
      <ShieldCheck
        size={112}
        strokeWidth={1.25}
        className="float-card relative fill-blue-500/20 text-sky-300 drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]"
      />
    </div>
  )
}

/** "Para el camino de todos los días": las 4 funciones de uso diario. Siempre oscura. */
export default function Funciones() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section
      id="funciones"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14] px-5 py-20 md:px-8 md:pb-40 md:pt-28"
      aria-labelledby="titulo-funciones"
    >
      {/* Fondo: resplandor azul arriba a la izquierda y ondas de horizonte abajo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_20%_25%,rgba(37,99,235,0.14),transparent_70%)]" />
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 hidden h-[220px] w-full md:block">
          <defs>
            <linearGradient id="onda-funciones" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="bruma-funciones" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path d="M0 110 C 260 60, 520 200, 820 150 S 1260 60, 1440 120 L1440 220 L0 220 Z" fill="url(#bruma-funciones)" />
          <path d="M0 110 C 260 60, 520 200, 820 150 S 1260 60, 1440 120" fill="none" stroke="url(#onda-funciones)" strokeWidth="1.5" />
          <path d="M0 150 C 300 110, 560 220, 860 180 S 1240 100, 1440 160" fill="none" stroke="url(#onda-funciones)" strokeWidth="1" opacity="0.5" />
        </svg>
        {/* Funde con el CTA (#0B1120) */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#0B1120]" />
      </div>

      <div
        ref={ref}
        data-visto={visto || undefined}
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14"
      >
        {/* Izquierda (móvil: arriba): escudo, título e indicadores */}
        <div className="revelar text-center lg:col-span-5 lg:text-left">
          <EscudoConfianza />

          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-slate-900/60 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-blue-200">
            <ShieldCheck size={15} strokeWidth={2.25} className="text-blue-400" aria-hidden />
            Seguridad y confianza
          </span>

          <h2
            id="titulo-funciones"
            className="mt-5 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[52px]"
          >
            Para el camino
            <br />
            de todos los{' '}
            {/* inline-block + pb: el degradado recortado al texto no corta la í */}
            <span className="inline-block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text pb-[0.08em] text-transparent">
              días
            </span>
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
                  className={`flex items-center gap-4 rounded-2xl border p-4 backdrop-blur-md sm:p-5 transition-[transform,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-blue-400/70 hover:shadow-[0_0_28px_rgba(59,130,246,0.25)] sm:gap-5 ${
                    destacada
                      ? 'border-blue-500/50 bg-slate-900/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800"
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-400/20 bg-teal-500/10">
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
