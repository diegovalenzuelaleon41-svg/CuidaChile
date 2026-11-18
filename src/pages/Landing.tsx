import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Headphones, MapPinned, Play, Route, UserCheck, Zap } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import FloatingPhoneMockup from '../components/FloatingPhoneMockup'
import HeroBackdrop from '../components/HeroBackdrop'
import ComoFunciona from '../components/landing/ComoFunciona'
import Funciones from '../components/landing/Funciones'
import CtaFinal from '../components/landing/CtaFinal'
import QuienResponde from '../components/landing/QuienResponde'
import FraseRevelada from '../components/landing/FraseRevelada'
import Cifras from '../components/landing/Cifras'
import Testimonios from '../components/landing/Testimonios'
import Privacidad from '../components/landing/Privacidad'
import ContadorEnVivo from '../components/landing/ContadorEnVivo'
import Guardianes from '../components/landing/Guardianes'
import Trazo from '../components/landing/Trazo'
import { useParallax } from '../hooks/useParallax'

/** Solo datos que la app cumple hoy (ver Funciones y QuienResponde). */
const CONFIANZA = [
  { Icono: Zap, texto: 'Alerta en 1,5 s' },
  { Icono: UserCheck, texto: 'Operadores verificados' },
  { Icono: MapPinned, texto: 'Todo Santiago' },
]

export default function Landing() {
  const refHero = useParallax<HTMLElement>()

  return (
    <div className="min-h-screen bg-[#050B14]">
      <Header />
      <main className="pt-[68px]">
        {/* Hero */}
        <section ref={refHero} id="inicio" className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14]">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10 lg:gap-12 items-center px-4 md:px-8 pt-10 pb-6 md:py-16">
            {/* isolate: el resplandor (-z-10) queda detrás del texto pero delante del fondo del hero */}
            <div className="relative isolate max-w-xl">
              {/* Resplandor detrás del bloque de texto: atenúa la malla del fondo y sube el contraste */}
              <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10">
                <div className="absolute inset-0 rounded-[48px] bg-[#050B14]/70 blur-2xl" />
                <div className="absolute inset-x-10 inset-y-6 rounded-full bg-blue-600/10 blur-3xl" />
              </div>

              {/* El dolor concreto antes del título: volver de noche sin que nadie sepa dónde estás */}
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/[0.08] px-3 py-1 text-xs font-medium text-cyan-200 backdrop-blur-md md:mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" aria-hidden />
                Para cuando caminas de noche
              </p>

              {/* Móvil: el título llena el ancho de la pantalla (11,5vw), como en escritorio llena su columna */}
              <h1 className="text-[clamp(2.25rem,11.5vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
                Tu vuelta a casa,
                <br />
                {/* inline-block + pb: el degradado recortado al texto no corta las letras con descendente (p, g) */}
                <span className="relative inline-block">
                  <span className="inline-block bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text pb-[0.08em] text-transparent">
                    siempre acompañada.
                  </span>
                  <Trazo retraso={600} />
                </span>
              </h1>

              <p className="mt-4 max-w-[540px] text-pretty text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
                Si algo no se ve bien en el camino, mantienes presionado SOS y un operador ve dónde estás y te contacta. O
                pide que siga tu ruta en vivo hasta que llegues.
              </p>

              {/* Móvil: botones a todo el ancho, uno bajo otro; desde sm en fila. El principal es el único sólido de la página. */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:mt-10">
                <Link to="/registro" className="btn-neon group overflow-hidden">
                  {/* Brillo que cruza el botón cada 3 s (.shimmer / .shimmer-3s en index.css) */}
                  <span className="shimmer shimmer-3s pointer-events-none absolute inset-0" aria-hidden />
                  <span className="relative">Crear mi cuenta</span>
                  <ArrowRight size={18} className="relative transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a href="#como-funciona" className="btn-cristal gap-3 border-white/10 bg-white/[0.04]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30">
                    <Play size={12} className="ml-0.5 fill-current" aria-hidden />
                  </span>
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-3 text-xs text-slate-400">Dejarla lista toma un par de minutos.</p>
              {/* Cifra real de la base; no se muestra mientras sea menor que el mínimo */}
              <ContadorEnVivo />

              {/* Señales de confianza: en móvil tres columnas (ícono sobre texto); desde sm en fila con separadores */}
              <ul className="mt-8 grid grid-cols-3 divide-x divide-white/10 text-xs text-slate-300 sm:flex sm:flex-wrap sm:items-center sm:gap-y-3 sm:text-sm md:mt-10">
                {CONFIANZA.map(({ Icono, texto }) => (
                  <li key={texto} className="flex flex-col items-center gap-2 px-2 text-center sm:flex-row sm:whitespace-nowrap sm:px-3 sm:text-left sm:first:pl-0">
                    <Icono size={18} strokeWidth={1.75} className="shrink-0 text-cyan-400" aria-hidden />
                    {texto}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pantalla real de la app (/usuario), entra una vez al cargar */}
            {/* overflow-x-clip: el teléfono y sus resplandores nunca empujan el ancho de la pantalla */}
            <div className="hero-render-entrada relative overflow-x-clip">
              {/* Parallax: el teléfono se queda atrás y las tarjetas avanzan a distinto ritmo (.parallax, useParallax) */}
              <div className="parallax" style={{ '--velocidad': 0.12 } as CSSProperties}>
                <FloatingPhoneMockup />
              </div>

              {/* Tarjetas de cristal: lo que pasa al otro lado de la pantalla. Solo desde sm: en móvil taparían el teléfono. */}
              <div
                aria-hidden
                className="parallax pointer-events-none absolute left-0 top-[18%] hidden sm:block"
                style={{ '--velocidad': -0.1 } as CSSProperties}
              >
                <div className="flotar-tarjeta flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-slate-900/60 py-3 pl-3 pr-4 shadow-[0_0_30px_rgba(6,182,212,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                    <Route size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">Ruta acompañada</span>
                    <span className="block text-xs text-slate-400">Siguiendo tu trayecto</span>
                  </span>
                </div>
              </div>
              <div
                aria-hidden
                className="parallax pointer-events-none absolute bottom-[22%] right-0 hidden sm:block"
                style={{ '--velocidad': -0.22 } as CSSProperties}
              >
                <div className="flotar-tarjeta flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-slate-900/60 py-3 pl-3 pr-4 shadow-[0_0_30px_rgba(139,92,246,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl [animation-delay:-2.5s]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                    <Headphones size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">Camila, operadora</span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ComoFunciona />
        <Cifras />
        <Funciones />
        <FraseRevelada />
        <QuienResponde />
        <Privacidad />
        {/* Sin testimonios reales no se muestra en producción (ver REALES en Testimonios.tsx) */}
        <Testimonios />
        {/* Sin operadores reales no se muestra en producción (ver REALES en Guardianes.tsx) */}
        <Guardianes />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  )
}
