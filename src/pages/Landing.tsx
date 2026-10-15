import { Link } from 'react-router-dom'
import { ArrowRight, Route, Siren, Users, ShieldCheck } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import FloatingPhoneMockup from '../components/FloatingPhoneMockup'

const FEATURES = [
  {
    icon: Route,
    title: 'Rutas Vigiladas',
    desc: 'Define tu trayecto y compártelo con tus contactos. Si te desvías, ellos lo sabrán.',
  },
  {
    icon: Siren,
    title: 'Botón de Pánico',
    desc: 'Activa una alerta silenciosa con un solo toque. Un operador te contactará en segundos.',
  },
  {
    icon: Users,
    title: 'Círculo de Confianza',
    desc: 'Hasta 5 contactos reciben tu ubicación y estado en tiempo real durante una emergencia.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header />
      <main className="pt-[68px]">
        {/* Hero */}
        <section id="inicio" className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_55%,#F8FAFC_100%)] dark:bg-none dark:bg-slate-950">
          <div className="mx-auto max-w-7xl grid md:grid-cols-2 gap-12 items-center px-5 md:px-8 py-12 md:py-16">
            <div>
              <span className="inline-block rounded-full bg-[#EFF6FF] dark:bg-slate-800 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-[#93C5FD]">
                Seguridad que te acompaña
              </span>
              <h1 className="mt-5 text-[44px] md:text-[60px] font-bold leading-[1.1] tracking-tight text-[#0F172A] dark:text-white">
                Tu seguridad,
                <br />
                siempre contigo.
              </h1>
              <p className="mt-5 text-[18px] leading-relaxed text-[#64748B] dark:text-slate-400 max-w-[520px]">
                CuidaChile te ayuda a actuar rápidamente ante situaciones de riesgo, compartir tu ubicación y mantenerte conectado con personas de confianza.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/registro" className="btn-primary px-7 py-3.5 text-[15px]">
                  Comenzar ahora <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="btn-secondary px-7 py-3.5 text-[15px]">
                  Ya tengo una cuenta
                </Link>
              </div>
              <p className="mt-5 text-[13px] text-[#94A3B8] dark:text-slate-500">
                Prevención, tecnología y comunidad en un solo lugar.
              </p>
            </div>

            {/* Floating phone */}
            <div className="flex justify-center md:justify-end">
              <FloatingPhoneMockup />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="funciones" className="mx-auto max-w-7xl px-5 md:px-8 py-16">
          <h2 className="text-center text-[36px] md:text-[40px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            Todo lo que necesitas para sentirte más seguro
          </h2>
          <p className="mx-auto mt-4 max-w-[700px] text-center text-[16px] text-[#64748B] dark:text-slate-400">
            CuidaChile es una plataforma digital de seguridad y prevención ciudadana que te ayuda a sentirte más seguro durante tus desplazamientos.
          </p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-8 hover:scale-[1.02] transition-transform duration-200">
                <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-brand">
                  <f.icon size={24} strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 text-[18px] font-bold text-[#0F172A] dark:text-white">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#64748B] dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="bg-[#F8FAFC] dark:bg-slate-950 border-y border-[#E2E8F0] dark:border-slate-700">
          <div className="mx-auto max-w-6xl px-5 md:px-8 py-16">
            <h2 className="text-center text-[32px] font-bold text-[#0F172A] dark:text-white">¿Cómo funciona?</h2>
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {[
                { n: '01', t: 'Crea tu cuenta', d: 'Regístrate y agrega hasta 5 contactos de confianza.' },
                { n: '02', t: 'Activa tu ruta', d: 'Comparte tu trayecto y tu ubicación en tiempo real.' },
                { n: '03', t: 'Pide ayuda si la necesitas', d: 'Un toque al SOS y un operador te contacta en segundos.' },
              ].map((s) => (
                <div key={s.n} className="card p-8 text-center">
                  <span className="mx-auto w-12 h-12 rounded-full bg-[#2563EB] text-white font-bold flex items-center justify-center">{s.n}</span>
                  <h3 className="mt-4 font-bold text-[#0F172A] dark:text-white">{s.t}</h3>
                  <p className="mt-2 text-[14px] text-[#64748B] dark:text-slate-400">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#2563EB]">
          <div className="mx-auto max-w-7xl px-5 md:px-8 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
            <h2 className="text-[28px] md:text-[32px] font-bold text-white tracking-tight text-center md:text-left">
              Únete a la comunidad que se cuida
            </h2>
            <Link to="/registro" className="rounded-[10px] bg-white px-8 py-3.5 font-semibold text-[#2563EB] hover:scale-[1.02] transition-transform">
              Comenzar gratis
            </Link>
          </div>
        </section>

        {/* Seguridad */}
        <section className="mx-auto max-w-7xl px-5 md:px-8 py-10 flex items-center justify-center gap-2 text-[13px] text-[#64748B] dark:text-slate-400">
          <ShieldCheck size={18} className="text-[#10B981]" />
          Tus datos están protegidos según la Ley 19.628 y Ley 21.719.
        </section>
      </main>
      <Footer />
    </div>
  )
}
