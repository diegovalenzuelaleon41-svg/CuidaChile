import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

/** Llamado final, oscuro como el resto de la página: el rojo del SOS como único acento cálido. */
export default function CtaFinal() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section className="relative isolate overflow-hidden bg-[#050B14] px-5 py-24 md:px-8 md:py-32" aria-labelledby="titulo-cta-final">
      {/* Resplandor rojo bajo el título, eco del botón SOS */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[360px] w-[720px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/15 blur-[110px]" />

      <div ref={ref} data-visto={visto || undefined} className="revelar mx-auto max-w-3xl text-center">
        <h2
          id="titulo-cta-final"
          className="mx-auto max-w-[16ch] text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[60px]"
        >
          Tu próxima vuelta a casa, acompañada
        </h2>
        <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-slate-300">
          Crea tu cuenta, agrega a tus contactos de confianza y deja listo tu PIN. Toma un par de minutos.
        </p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link to="/registro" className="btn-cristal btn-cristal-principal group px-8">
            Crear mi cuenta
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-[52px] items-center rounded-full px-6 text-[16px] font-semibold text-slate-300 transition-colors hover:text-white"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  )
}
