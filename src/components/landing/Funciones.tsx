import type { ReactNode } from 'react'
import { EyeOff, MapPin, Phone } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

const FUNCIONES: { t: string; d: string; icono: ReactNode }[] = [
  {
    t: 'Acompañamiento en ruta',
    d: 'Marcas a dónde vas y un operador sigue tu trayecto en vivo hasta que llegas.',
    icono: (
      <svg viewBox="0 0 120 60" className="h-10 w-16 text-[#7EA6FF]">
        <path d="M8 50 C 34 44, 46 18, 70 22 S 104 12, 112 8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <circle cx="70" cy="22" r="7" fill="currentColor" />
      </svg>
    ),
  },
  {
    t: 'SOS con PIN',
    d: 'La alerta se envía al mantener el botón presionado y solo tú puedes cancelarla, con tu PIN de 4 dígitos.',
    icono: (
      <span className="flex gap-1.5">
        {[true, true, false, false].map((lleno, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border-2 border-[#F3EDE6] ${lleno ? 'bg-[#F3EDE6]' : ''}`} />
        ))}
      </span>
    ),
  },
  {
    t: 'Chat y llamada con un operador',
    d: 'Hablas con una persona sin salir de la app, por escrito si no puedes hablar o por voz si lo necesitas.',
    icono: (
      <span className="flex flex-col gap-1 px-1.5">
        <span className="self-start rounded-lg rounded-bl-sm bg-slate-700 px-1.5 py-0.5 text-[9px] text-white">¿Estás bien?</span>
        <span className="flex items-center gap-1 self-end rounded-lg rounded-br-sm bg-[#F3EDE6] px-1.5 py-0.5 text-[9px] text-[#0F172A]">
          <Phone size={8} /> Llamando
        </span>
      </span>
    ),
  },
  {
    t: 'Reportes de tu barrio',
    d: 'Avisa lo que ves en tu cuadra, con foto si quieres y sin dar tu nombre. Un operador lo valida y tus vecinos lo ven en el mapa.',
    icono: (
      <span className="flex flex-col items-center gap-1 px-1">
        <span className="flex items-center gap-1 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white">
          <MapPin size={8} className="shrink-0 text-[#F87171]" /> Vehículo sospechoso
        </span>
        <span className="flex items-center gap-1 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-medium text-white">
          <EyeOff size={8} /> Anónimo
        </span>
      </span>
    ),
  },
]

/** "Para el camino de todos los días": las 4 funciones de uso diario. Siempre oscura. */
export default function Funciones() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section id="funciones" className="scroll-mt-20 bg-[#0B1120] px-5 py-20 md:px-8 md:py-28" aria-labelledby="titulo-funciones">
      <div ref={ref} data-visto={visto || undefined} className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="revelar lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
          <h2
            id="titulo-funciones"
            className="text-balance font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-[48px]"
          >
            Para el camino de todos los días
          </h2>
          <p className="mt-5 max-w-[38ch] text-[17px] leading-relaxed text-slate-300">
            No solo sirve en una emergencia. CuidaChile te acompaña antes de que algo pase.
          </p>
        </div>

        <ul className="lg:col-span-8">
          {FUNCIONES.map((f, i) => (
            <li
              key={f.t}
              className="revelar mb-6 flex items-start gap-6 border-b border-slate-800/50 pb-6 last:mb-0"
              style={{ transitionDelay: `${120 + i * 90}ms` }}
            >
              {/* Tamaño fijo: el ícono nunca se estira con la fila */}
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 md:h-24 md:w-24"
                aria-hidden
              >
                {f.icono}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-[20px] font-bold text-white md:text-[22px]">{f.t}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-slate-300">{f.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
