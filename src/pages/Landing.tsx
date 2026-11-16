import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Play, ShieldCheck, Users } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import HeroRender3D from '../components/landing/HeroRender3D'
import HeroBackdrop from '../components/HeroBackdrop'
import ComoFunciona from '../components/landing/ComoFunciona'
import Funciones from '../components/landing/Funciones'
import CtaFinal from '../components/landing/CtaFinal'

const CONFIANZA = [
  { Icono: ShieldCheck, texto: 'En tiempo real', color: 'text-blue-400' },
  { Icono: MapPin, texto: 'Ubicación segura', color: 'text-sky-400' },
  { Icono: Users, texto: 'Acompañamiento confiable', color: 'text-violet-400' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050B14]">
      <Header />
      <main className="pt-[68px]">
        {/* Hero */}
        <section id="inicio" className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14]">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4 lg:px-8 py-12 md:py-16">
            {/* isolate: el resplandor (-z-10) queda detrás del texto pero delante del fondo del hero */}
            <div className="relative isolate max-w-xl">
              {/* Resplandor detrás del bloque de texto: atenúa la malla del fondo y sube el contraste */}
              <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10">
                <div className="absolute inset-0 rounded-[48px] bg-[#050B14]/70 blur-2xl" />
                <div className="absolute inset-x-10 inset-y-6 rounded-full bg-blue-600/10 blur-3xl" />
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-white/5 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_0_20px_rgba(59,130,246,0.25)] backdrop-blur-md">
                <ShieldCheck size={15} strokeWidth={2.25} className="text-blue-400" aria-hidden />
                Seguridad que te acompaña
              </span>

              <h1 className="mt-6 text-[44px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white sm:text-[56px] lg:text-[64px]">
                Tu seguridad,
                <br />
                {/* inline-block + pb: el degradado recortado al texto no corta las letras con descendente (p, g) */}
                <span className="inline-block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text pb-[0.08em] text-transparent">
                  siempre contigo.
                </span>
              </h1>

              <p className="mt-5 max-w-[540px] text-[18px] leading-relaxed text-slate-300 md:text-[20px]">
                CuidaChile te ayuda a actuar rápidamente ante situaciones de riesgo, compartir tu ubicación y mantenerte conectado con personas de confianza.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
                <Link
                  to="/registro"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-8 py-4 text-[16px] font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.55)] transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_0_44px_rgba(99,102,241,0.75)] active:scale-[0.98]"
                >
                  {/* Brillo que cruza el botón cada 3 s (.shimmer / .shimmer-3s en index.css) */}
                  <span className="shimmer shimmer-3s pointer-events-none absolute inset-0" aria-hidden />
                  <span className="relative">Comenzar ahora</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-blue-400/60 bg-transparent px-7 py-4 text-[16px] font-semibold text-white transition-[border-color,box-shadow,background-color] duration-200 hover:border-blue-300 hover:bg-blue-500/10 hover:shadow-[0_0_24px_rgba(59,130,246,0.45)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-300/70">
                    <Play size={12} className="ml-0.5 fill-current" aria-hidden />
                  </span>
                  Ver cómo funciona
                </a>
              </div>

              {/* Señales de confianza: en móvil apiladas, desde sm en fila con separadores */}
              <ul className="mt-10 flex flex-col gap-3 text-[13px] text-slate-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-0 sm:gap-y-3 sm:divide-x sm:divide-white/10">
                {CONFIANZA.map(({ Icono, texto, color }) => (
                  <li key={texto} className="flex items-center gap-2 whitespace-nowrap sm:px-3 sm:first:pl-0">
                    <Icono size={20} strokeWidth={1.75} className={`shrink-0 ${color}`} aria-hidden />
                    {texto}
                  </li>
                ))}
              </ul>
            </div>

            <HeroRender3D />
          </div>
        </section>

        <ComoFunciona />
        <Funciones />
        <CtaFinal />

        {/* Seguridad: oscura fija, igual que el CTA de arriba y el footer de abajo */}
        <section className="bg-[#0B1120]">
          <div className="mx-auto max-w-7xl px-5 md:px-8 py-10 flex items-center justify-center gap-2 text-[13px] text-slate-400">
            <ShieldCheck size={18} className="text-[#10B981]" aria-hidden />
            Tus datos están protegidos según la Ley 19.628 y Ley 21.719.
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
