import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

/**
 * Llamado final: el bloque más luminoso de la página. Panel de cristal con borde cian → violeta,
 * el horizonte del planeta holográfico al pie y el botón neón, el único sólido, como única salida.
 */
export default function CtaFinal() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section className="relative isolate overflow-hidden bg-[#050B14] px-4 py-12 md:px-8 md:py-24" aria-labelledby="titulo-cta-final">
      <div ref={ref} data-visto={visto || undefined} className="revelar relative mx-auto max-w-5xl">
        {/* Halo exterior: cian a la izquierda, violeta a la derecha */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 rounded-[64px] bg-[radial-gradient(ellipse_at_20%_50%,rgba(6,182,212,0.28),transparent_60%),radial-gradient(ellipse_at_80%_50%,rgba(139,92,246,0.28),transparent_60%)] blur-3xl"
        />

        {/* Borde de 1 px con degradado: el relleno va en el hijo */}
        <div className="rounded-[32px] bg-gradient-to-br from-cyan-400/70 via-white/10 to-violet-500/70 p-px shadow-[0_0_80px_rgba(6,182,212,0.18)]">
          <div className="relative overflow-hidden rounded-[31px] bg-[#070F1E]/90 px-6 py-16 text-center backdrop-blur-xl md:px-16 md:py-24">
            {/* Horizonte del planeta holográfico, eco del hero */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-[250px] left-1/2 h-[300px] md:-bottom-[220px] w-[140%] -translate-x-1/2 rounded-[50%] border-t border-cyan-300/50 shadow-[0_-16px_70px_rgba(6,182,212,0.4),inset_0_20px_60px_rgba(139,92,246,0.25)]"
            />
            {/* Reflejo en el canto superior */}
            <div aria-hidden className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />

            <h2
              id="titulo-cta-final"
              className="relative mx-auto max-w-[16ch] text-balance md:max-w-none text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-6xl"
            >
              Tu próxima vuelta a casa,{' '}
              <br className="hidden md:block" />
              <span className="inline-block bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text pb-[0.08em] text-transparent">
                acompañada
              </span>
            </h2>
            <p className="relative mx-auto mt-6 max-w-[46ch] text-pretty text-lg text-slate-300">
              Crea tu cuenta, agrega a tus contactos de confianza y deja listo tu PIN. Toma un par de minutos.
            </p>
            <div className="relative mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link to="/registro" className="btn-neon group min-h-[60px] px-10 text-lg">
                Crear mi cuenta
                <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full px-6 text-base font-semibold text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
