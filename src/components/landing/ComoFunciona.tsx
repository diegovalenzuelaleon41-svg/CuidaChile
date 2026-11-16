import { useEnVista } from '../../hooks/useEnVista'

const PASOS = [
  { t: 'Mantienes presionado SOS', d: 'Un segundo y medio basta. Así un toque accidental no envía nada.' },
  { t: 'Tu ubicación llega a la central', d: 'El operador ve dónde estás en el mapa y abre tu caso.' },
  { t: 'Una persona te contacta', d: 'Te escribe o te llama dentro de la app y escala el caso si hace falta.' },
]

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

/** "Qué pasa cuando pides ayuda": es una secuencia real, por eso va numerada. Siempre oscura. */
export default function ComoFunciona() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section id="como-funciona" className="scroll-mt-20 overflow-hidden" aria-labelledby="titulo-como-funciona">
      <Ola />
      <div className="bg-[#0F172A] px-5 py-16 md:px-8 md:py-20">
        <div ref={ref} data-visto={visto || undefined} className="mx-auto max-w-6xl">
          <h2
            id="titulo-como-funciona"
            className="revelar max-w-[18ch] text-balance font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-[52px]"
          >
            Qué pasa cuando pides ayuda
          </h2>

          <ol className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            <span className="linea-pasos absolute left-0 right-0 top-5 hidden h-0.5 bg-slate-700 md:block" aria-hidden />
            {PASOS.map((p, i) => (
              <li key={p.t} className="revelar relative" style={{ transitionDelay: `${200 + i * 300}ms` }}>
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#F3EDE6] text-[17px] font-bold text-[#0F172A]">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-display text-[22px] font-bold text-white">{p.t}</h3>
                <p className="mt-2 max-w-[32ch] text-[16px] leading-relaxed text-slate-300">{p.d}</p>
              </li>
            ))}
          </ol>

          <p className="revelar mt-12 text-[15px] text-slate-400" style={{ transitionDelay: '1100ms' }}>
            ¿Fue un error? Cancelas la alerta con tu PIN de 4&nbsp;dígitos.
          </p>
        </div>
      </div>
      {/* Debajo viene la sección de funciones (#0B1120): la ola cierra sobre ese color, no sobre el de la página */}
      <div className="bg-[#0B1120]">
        <Ola abajo />
      </div>
    </section>
  )
}
