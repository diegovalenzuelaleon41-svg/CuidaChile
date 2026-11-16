import { Link } from 'react-router-dom'
import { useEnVista } from '../../hooks/useEnVista'

/** Llamado final: bloque crema sobre el fondo marino para que contraste fuerte. */
export default function CtaFinal() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section className="bg-[#0B1120] px-5 pb-20 md:px-8" aria-labelledby="titulo-cta-final">
      <div
        ref={ref}
        data-visto={visto || undefined}
        className="revelar mx-auto max-w-5xl rounded-[2rem] bg-[#FDFBF7] px-6 py-16 text-center md:py-24"
      >
        <h2
          id="titulo-cta-final"
          className="mx-auto max-w-[16ch] text-balance font-display text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-slate-900 md:text-[60px]"
        >
          Tu próxima vuelta a casa, acompañada
        </h2>
        <Link
          to="/registro"
          className="btn-pildora mt-9 inline-flex min-h-[52px] items-center rounded-full bg-[#0F172A] px-9 text-[17px] font-semibold text-white hover:bg-[#1E293B]"
        >
          Crear mi cuenta
        </Link>
      </div>
    </section>
  )
}
