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
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] dark:border-slate-700 dark:bg-slate-800 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-[#93C5FD]">
                <ShieldCheck size={14} strokeWidth={2.25} />
                Seguridad que te acompaña
              </span>
              <h1 className="mt-5 text-[44px] md:text-[60px] font-extrabold leading-[1.05] tracking-tight text-[#0B1E4A] dark:text-white">
                Tu seguridad,
                <br />
                <span className="text-[#2563EB] dark:text-[#60A5FA]">siempre contigo.</span>
              </h1>
              <p className="mt-5 text-[18px] leading-relaxed text-[#64748B] dark:text-slate-400 max-w-[520px]">
                CuidaChile te ayuda a actuar rápidamente ante situaciones de riesgo, compartir tu ubicación y mantenerte conectado con personas de confianza.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/registro"
                  className="group inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#0B1E4A] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(11,30,74,0.30)] transition-all duration-200 hover:bg-[#132B66] hover:scale-[1.02] active:scale-[0.98] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
                >
                  Comenzar ahora <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
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
