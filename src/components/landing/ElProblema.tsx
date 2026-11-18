import type { CSSProperties } from 'react'
import { ArrowDown } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'
import { useParallax } from '../../hooks/useParallax'

/**
 * El problema → la compañía. Justo después del hero: una calle de noche (la foto manda, sin
 * tarjetas ni bordes) y, al seguir bajando, la luz cian que entra con "No tienes que recorrerlo sin
 * compañía". Animaciones solo al entrar en pantalla (.problema / .solucion en index.css) y un
 * parallax leve en la foto (solo escritorio); nada de eso corre con prefers-reduced-motion.
 *
 * Nitidez: la foto original mide 1672×941; los archivos (noche-v3) salen de una ampliación 2× con
 * Upscayl (modelo remacri, mezclado 70/30 con el original para no alisar la piel), hasta 3344×1882. La caja donde se dibuja tiene casi su misma proporción
 * en cada tamaño (4:5 en teléfono con un recorte propio, 16:9 en tablet, ~16:9 en escritorio), así
 * el navegador no la amplía para llenar alto. Si cambia el alto de la sección o el sobrante del
 * parallax, revisar que no vuelva a estirarse.
 */
const FOTO = '/img/problema/noche-v3'
/** En escritorio la caja mide 108 % del alto (sobrante del parallax): a lo más ~108vw de ancho útil. */
const TAMANOS = '(min-width: 1024px) 108vw, 100vw'
export default function ElProblema() {
  const refSeccion = useParallax<HTMLElement>()
  const [refProblema, problemaVisto] = useEnVista<HTMLDivElement>()
  const [refSolucion, solucionVista] = useEnVista<HTMLDivElement>()

  return (
    <section
      ref={refSeccion}
      id="el-problema"
      aria-labelledby="titulo-problema"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14]"
    >
      {/* ── 1. El problema: la foto a todo el ancho y el texto sobre su lado más oscuro ── */}
      <div
        ref={refProblema}
        data-visto={problemaVisto || undefined}
        className="problema relative lg:flex lg:h-[clamp(560px,min(100svh,56.25vw),940px)] lg:items-center"
      >
        {/* Teléfono: caja 4:5 (su recorte). Tablet: 16:9 (la toma). Escritorio: detrás del texto, a todo el alto. */}
        <div className="relative -z-10 aspect-[4/5] overflow-hidden sm:aspect-video lg:absolute lg:inset-0 lg:aspect-auto">
          {/* El parallax mueve el envoltorio (solo escritorio, con 4 % de sobrante arriba y abajo) */}
          <div className="problema-parallax absolute inset-0 lg:-top-[4%] lg:bottom-auto lg:h-[108%]">
            <picture>
              {/* AVIF de 10 bits: sin bandas en los degradados oscuros; WebP de respaldo */}
              <source
                media="(max-width: 639px)"
                type="image/avif"
                srcSet={`${FOTO}-movil-800.avif 800w, ${FOTO}-movil-1200.avif 1200w`}
                sizes="100vw"
              />
              <source
                media="(max-width: 639px)"
                type="image/webp"
                srcSet={`${FOTO}-movil-800.webp 800w, ${FOTO}-movil-1200.webp 1200w`}
                sizes="100vw"
              />
              <source
                type="image/avif"
                srcSet={`${FOTO}-1200.avif 1200w, ${FOTO}-1920.avif 1920w, ${FOTO}-2560.avif 2560w, ${FOTO}-3344.avif 3344w`}
                sizes={TAMANOS}
              />
              <source
                type="image/webp"
                srcSet={`${FOTO}-1200.webp 1200w, ${FOTO}-1920.webp 1920w, ${FOTO}-2560.webp 2560w, ${FOTO}-3344.webp 3344w`}
                sizes={TAMANOS}
              />
              <img
                src={`${FOTO}-1200.webp`}
                alt="Una mujer vuelve sola de noche por una calle mojada y mira hacia atrás."
                width={3344}
                height={1882}
                loading="lazy"
                decoding="async"
                className="problema-foto h-full w-full object-cover lg:object-[68%_center]"
              />
            </picture>
          </div>

          {/* Integración con el fondo: arriba se funde con el hero, abajo con la transición */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#050B14] via-[#050B14]/50 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#050B14] via-[#050B14]/75 to-transparent lg:h-[40%] lg:via-[#050B14]/50" />
          {/* Escritorio: el texto vive a la izquierda, donde la calle ya es oscura */}
          <div aria-hidden className="absolute inset-y-0 left-0 hidden w-[68%] bg-gradient-to-r from-[#050B14]/95 via-[#050B14]/65 to-transparent lg:block" />
        </div>

        {/* Teléfono y tablet: el texto sube sobre el final de la foto; escritorio: encima, a la izquierda */}
        <div className="relative mx-auto -mt-24 w-full max-w-6xl px-4 pb-14 sm:-mt-28 md:px-8 lg:mt-0 lg:py-24">
          <div className="max-w-2xl">
            <p className="problema-entra text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80" style={{ '--retraso': '150ms' } as CSSProperties}>
              El problema
            </p>
            <h2
              id="titulo-problema"
              className="problema-entra mt-4 text-balance text-[clamp(2.15rem,9vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl"
              style={{ '--retraso': '250ms' } as CSSProperties}
            >
              Hay caminos que{' '}
              {/* Desde sm: tres líneas fijas, con la frase destacada entera en la del medio */}
              <br className="hidden sm:block" />
              {/* En línea (no inline-block) para que corte como el resto del título; clone + pb: el degradado
                  sigue en cada línea y no corta los descendentes */}
              <span className="bg-gradient-to-r from-cyan-200 to-sky-400 bg-clip-text pb-[0.06em] text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                se sienten más largos
              </span>{' '}
              <br className="hidden sm:block" />
              cuando vas solo.
            </h2>
            <p
              className="problema-entra mt-5 max-w-md text-pretty text-base leading-relaxed text-slate-300 md:mt-6 md:text-lg"
              style={{ '--retraso': '450ms' } as CSSProperties}
            >
              Regresar tarde a casa, caminar por una calle desconocida o sentir que no tienes a quién acudir. A veces, lo que más
              necesitamos es saber que alguien está ahí.
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. La compañía: la noche se aclara con luz cian y aparece la conexión ── */}
      <div
        ref={refSolucion}
        data-visto={solucionVista || undefined}
        className="solucion relative px-4 pb-20 pt-6 text-center md:px-8 md:pb-28 md:pt-10"
      >
        {/* Luz que entra desde arriba: el cambio de ánimo de la sección. Sube sobre el final de la foto
            (-top) y se apaga hacia los bordes, así no deja una línea donde empieza. */}
        <div aria-hidden className="solucion-luz pointer-events-none absolute inset-x-0 -top-48 bottom-0 -z-10" />

        <Conexion />

        <h2 className="solucion-entra mx-auto mt-8 max-w-3xl text-balance text-[clamp(1.9rem,7.5vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-5xl" style={{ '--retraso': '700ms' } as CSSProperties}>
          No tienes que recorrerlo sin compañía.
        </h2>
        <p
          className="solucion-entra mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg"
          style={{ '--retraso': '850ms' } as CSSProperties}
        >
          Con CuidaChile puedes compartir tu trayecto, mantenerte conectado con personas de confianza y contar con herramientas
          para solicitar ayuda.
        </p>
        <a
          href="#como-funciona"
          className="solucion-entra group mt-8 inline-flex h-11 items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-5 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/60 hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          style={{ '--retraso': '1000ms' } as CSSProperties}
        >
          Mira cómo funciona
          <ArrowDown size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden />
        </a>
      </div>
    </section>
  )
}

/**
 * Dos puntos unidos por un trazo que se dibuja: tú y alguien de confianza. Al terminar, el punto de
 * llegada se enciende una vez. Es una imagen de la idea, no un dato: va oculta a lectores de pantalla.
 */
function Conexion() {
  return (
    <svg aria-hidden viewBox="0 0 320 64" className="conexion mx-auto h-auto w-[min(320px,80vw)] overflow-visible">
      <defs>
        <linearGradient id="conexion-trazo" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        className="conexion-trazo"
        d="M16 44 C 90 6, 150 60, 210 28 S 290 18, 304 22"
        fill="none"
        stroke="url(#conexion-trazo)"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={100}
      />
      <circle cx="16" cy="44" r="6" fill="#3B82F6" />
      <circle className="conexion-anillo" cx="304" cy="22" r="14" fill="none" stroke="#22D3EE" strokeWidth="1.5" />
      <circle className="conexion-llegada" cx="304" cy="22" r="6" fill="#22D3EE" />
    </svg>
  )
}
