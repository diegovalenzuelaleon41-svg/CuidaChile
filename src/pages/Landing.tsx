import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import HeroRender3D from '../components/landing/HeroRender3D'
import HeroBackdrop from '../components/HeroBackdrop'
import ComoFunciona from '../components/landing/ComoFunciona'
import Funciones from '../components/landing/Funciones'
import CtaFinal from '../components/landing/CtaFinal'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B1120]">
      <Header />
      <main className="pt-[68px]">
        {/* Hero */}
        <section id="inicio" className="relative isolate overflow-hidden bg-white dark:bg-[#0B1120]">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4 lg:px-8 py-12 md:py-16">
            {/* isolate: el resplandor (-z-10) queda detrás del texto pero delante del fondo del hero */}
            <div className="relative isolate max-w-xl">
              {/* Resplandor detrás del bloque de texto: tapa el patrón del fondo y sube el contraste */}
              <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10">
                <div className="absolute inset-0 rounded-[48px] bg-white/70 blur-2xl dark:bg-[#0B1120]/75" />
                <div className="absolute inset-x-10 inset-y-6 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/15" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] dark:border-slate-700 dark:bg-slate-800 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-[#93C5FD]">
                <ShieldCheck size={14} strokeWidth={2.25} />
                Seguridad que te acompaña
              </span>
              <h1 className="mt-5 text-[44px] md:text-[60px] font-extrabold leading-[1.05] tracking-tight text-[#0B1E4A] dark:text-white">
                Tu{' '}
                {/* En claro el degradado arranca más oscuro: blue-400 sobre blanco no llega al contraste mínimo */}
                <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-600">
                  seguridad
                </span>
                ,
                <br />
                <span className="text-[#2563EB] dark:text-[#60A5FA]">siempre contigo.</span>
              </h1>
              <p className="mt-5 text-[18px] leading-relaxed text-[#64748B] dark:text-slate-400 max-w-[520px]">
                CuidaChile te ayuda a actuar rápidamente ante situaciones de riesgo, compartir tu ubicación y mantenerte conectado con personas de confianza.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/registro"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#0B1E4A] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(11,30,74,0.30)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:scale-[1.02] hover:bg-[#132B66] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-[0.98] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
                >
                  {/* Brillo que cruza el botón cada 3 s (.shimmer / .shimmer-3s en index.css) */}
                  <span className="shimmer shimmer-3s pointer-events-none absolute inset-0" aria-hidden />
                  <span className="relative">Comenzar ahora</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border-2 border-[#0B1E4A]/15 bg-white/70 backdrop-blur px-7 py-3.5 text-[15px] font-semibold text-[#0B1E4A] transition-all duration-200 hover:border-[#2563EB] hover:text-[#2563EB] hover:scale-[1.02] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  Ya tengo una cuenta
                </Link>
              </div>
              <p className="mt-5 text-[13px] text-[#94A3B8] dark:text-slate-500">
                Prevención, tecnología y comunidad en un solo lugar.
              </p>
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
