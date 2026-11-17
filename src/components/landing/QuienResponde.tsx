import { KeyRound, MapPin, MapPinned, Scale, UserCheck, type LucideIcon } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

/**
 * Garantías verificables en el código: operadores aprobados uno a uno (aprobar_operador), ubicación
 * enviada solo con una alerta o una ruta activa (useSOS / useAcompanamiento), alerta que solo se
 * cancela con el PIN y cumplimiento de las leyes de datos que ya cita el registro. La cobertura
 * (todo Santiago) la confirmó el equipo; el horario de la central aún no está definido aquí.
 */
const GARANTIAS: { Icono: LucideIcon; t: string; d: string }[] = [
  {
    Icono: UserCheck,
    t: 'Operadores verificados',
    d: 'Cada operador es revisado y aprobado por el equipo de CuidaChile antes de ver un solo caso.',
  },
  {
    Icono: MapPin,
    t: 'Tu ubicación, solo cuando la pides',
    d: 'Viaja a la central únicamente mientras tienes una alerta SOS o una ruta acompañada activa.',
  },
  {
    Icono: KeyRound,
    t: 'Solo tú cancelas la alerta',
    d: 'Una alerta enviada se detiene con tu PIN de 4 dígitos, no con un toque cualquiera.',
  },
  {
    Icono: Scale,
    t: 'Tus datos bajo la ley chilena',
    d: 'Tratamos tu información según la Ley 19.628 y la Ley 21.719 de protección de datos personales.',
  },
]

/** "Quién está del otro lado": lo que respalda a la persona que pide ayuda. Siempre oscura. */
export default function QuienResponde() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section
      id="confianza"
      className="scroll-mt-20 border-t border-white/5 bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-confianza"
    >
      <div ref={ref} data-visto={visto || undefined} className="mx-auto max-w-6xl">
        <div className="revelar grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2
              id="titulo-confianza"
              className="text-[32px] sm:text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[52px]"
            >
              Quién está del otro lado
            </h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-slate-300">
              Cuando pides ayuda le confías a alguien tu ubicación y tu situación. Esto es lo que respalda esa confianza.
            </p>
          </div>

          {/* Cobertura de la central: el dato duro de la sección */}
          <div className="flex items-center gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/5 px-6 py-5 lg:col-span-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
              <MapPinned size={24} strokeWidth={1.75} className="text-blue-300" aria-hidden />
            </span>
            <div>
              <p className="text-[24px] font-extrabold leading-tight text-white md:text-[28px]">Todo Santiago</p>
              <p className="mt-0.5 text-[14px] text-slate-400">La central responde en cualquier comuna de la ciudad.</p>
            </div>
          </div>
        </div>

        {/* Lista con divisores, no tarjetas: cada garantía es una afirmación, no un producto */}
        <ul className="mt-14 grid grid-cols-1 gap-x-14 sm:grid-cols-2">
          {GARANTIAS.map(({ Icono, t, d }, i) => (
            <li
              key={t}
              className="revelar flex gap-5 border-t border-white/10 py-8"
              style={{ transitionDelay: `${120 + i * 90}ms` }}
            >
              <Icono size={24} strokeWidth={1.75} className="mt-0.5 shrink-0 text-blue-400" aria-hidden />
              <div>
                <h3 className="text-[19px] font-bold text-white">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
