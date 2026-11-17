import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Play, ShieldCheck, Users } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import FloatingPhoneMockup from '../components/FloatingPhoneMockup'
import HeroBackdrop from '../components/HeroBackdrop'
import ComoFunciona from '../components/landing/ComoFunciona'
import Funciones from '../components/landing/Funciones'
import CtaFinal from '../components/landing/CtaFinal'
import QuienResponde from '../components/landing/QuienResponde'

const CONFIANZA = [
  { Icono: ShieldCheck, texto: 'En tiempo real', color: 'text-blue-400' },
  { Icono: MapPin, texto: 'Ubicación segura', color: 'text-blue-400' },
  { Icono: Users, texto: 'Acompañamiento confiable', color: 'text-blue-400' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050B14]">
      <Header />
      <main className="pt-[68px]">
        {/* Hero */}
        <section id="inicio" className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14]">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10 lg:gap-12 items-center px-4 md:px-8 pt-10 pb-6 md:py-16">
            {/* isolate: el resplandor (-z-10) queda detrás del texto pero delante del fondo del hero */}
            <div className="relative isolate max-w-xl">
              {/* Resplandor detrás del bloque de texto: atenúa la malla del fondo y sube el contraste */}
              <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10">
                <div className="absolute inset-0 rounded-[48px] bg-[#050B14]/70 blur-2xl" />
                <div className="absolute inset-x-10 inset-y-6 rounded-full bg-blue-600/10 blur-3xl" />
              </div>

              {/* Móvil: el título llena el ancho de la pantalla (11,5vw), como en escritorio llena su columna */}
              <h1 className="text-[clamp(2.25rem,11.5vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-white md:text-5xl lg:text-7xl">
                Tu seguridad,
                <br />
                {/* inline-block + pb: el degradado recortado al texto no corta las letras con descendente (p, g) */}
                <span className="inline-block bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text pb-[0.08em] text-transparent">
                  siempre contigo.
                </span>
              </h1>

              <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-slate-300 sm:text-[18px] md:mt-5 md:text-[20px]">
                CuidaChile te ayuda a actuar rápidamente ante situaciones de riesgo, compartir tu ubicación y mantenerte conectado con personas de confianza.
              </p>

              {/* Móvil: botones a todo el ancho, uno bajo otro; desde sm en fila */}
              <div className="mt-7 flex flex-col gap-3 md:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
                <Link to="/registro" className="btn-cristal btn-cristal-principal group relative overflow-hidden px-8">
                  {/* Brillo que cruza el botón cada 3 s (.shimmer / .shimmer-3s en index.css) */}
                  <span className="shimmer shimmer-3s pointer-events-none absolute inset-0" aria-hidden />
                  <span className="relative">Comenzar ahora</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a href="#como-funciona" className="btn-cristal gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30">
                    <Play size={12} className="ml-0.5 fill-current" aria-hidden />
                  </span>
                  Ver cómo funciona
                </a>
              </div>

              {/* Señales de confianza: en móvil tres columnas (ícono sobre texto); desde sm en fila con separadores */}
              <ul className="mt-7 grid grid-cols-3 divide-x divide-white/10 text-[12px] leading-tight text-slate-300 sm:flex sm:flex-wrap sm:items-center sm:gap-y-3 sm:text-[13px] md:mt-10">
                {CONFIANZA.map(({ Icono, texto, color }) => (
                  <li key={texto} className="flex flex-col items-center gap-1.5 px-2 text-center sm:flex-row sm:gap-2 sm:whitespace-nowrap sm:px-3 sm:text-left sm:first:pl-0">
                    <Icono size={18} strokeWidth={1.75} className={`shrink-0 ${color}`} aria-hidden />
                    {texto}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pantalla real de la app (/usuario), entra una vez al cargar */}
            {/* overflow-x-clip: el teléfono y sus resplandores nunca empujan el ancho de la pantalla */}
            <div className="hero-render-entrada overflow-x-clip">
              <FloatingPhoneMockup />
            </div>
          </div>
        </section>

        <ComoFunciona />
        <Funciones />
        <QuienResponde />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  )
}
