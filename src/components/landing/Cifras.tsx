import { Fragment, useEffect, useRef, useState } from 'react'
import { useEnVista } from '../../hooks/useEnVista'

const FUENTE_ENUSC =
  'https://subprevenciondeldelito.gob.cl/noticia/enusc-2025-bajan-la-victimizacion-de-hogares-por-delitos-violentos-y-la-percepcion-de-inseguridad-en-el-pais/'

/**
 * Cifras del problema: ENUSC 2025 (INE y Subsecretaría de Prevención del Delito, 10 de julio de 2026).
 * Cifras de la respuesta: lo que la app cumple hoy. No agregar tiempos de respuesta de la central
 * ni "24/7" mientras no se midan o no estén definidos (ver Funciones y QuienResponde).
 */
const TEMOR = 65.5
const RESPUESTA = [
  { valor: 1.5, decimales: 1, unidad: 's', texto: 'Mantienes presionado SOS y tu ubicación llega a la central.' },
  { valor: 4, decimales: 0, unidad: 'dígitos', texto: 'Tu PIN es lo único que cancela una alerta enviada.' },
]

const DURACION = 1400
const formatear = (n: number, decimales: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

/** Número que sube de 0 a `valor` (rAF, ease-out) la primera vez que `activo` pasa a true. */
function Contador({ valor, decimales, activo }: { valor: number; decimales: number; activo: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [sinMovimiento] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const el = ref.current
    if (!el || !activo || sinMovimiento) return
    let frame = 0
    const inicio = performance.now()
    // Se escribe directo en el nodo: sin un render de React por frame.
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION)
      el.textContent = formatear(valor * (1 - Math.pow(1 - t, 3)), decimales)
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [activo, valor, decimales, sinMovimiento])

  return (
    <span ref={ref} aria-hidden className="tabular-nums">
      {formatear(sinMovimiento ? valor : 0, decimales)}
    </span>
  )
}

/**
 * 100 puntos, uno por persona: 65 encendidos, el 66 a medias (el 0,5). Se encienden en orden de
 * lectura la primera vez que la sección entra en pantalla (.punto-cifra, data-visto en el padre).
 */
function CienPersonas() {
  return (
    <div aria-hidden className="grid w-full max-w-[260px] grid-cols-10 gap-2 sm:max-w-[320px] sm:gap-3">
      {Array.from({ length: 100 }, (_, i) => {
        const tono = i < 65 ? 'bg-red-500' : i === 65 ? 'bg-red-500/50' : 'bg-slate-700/60'
        return (
          <span
            key={i}
            className={`punto-cifra aspect-square rounded-full ${tono}`}
            data-encendido={i <= 65 || undefined}
            style={i <= 65 ? { transitionDelay: `${300 + i * 12}ms` } : undefined}
          />
        )
      })}
    </div>
  )
}

/**
 * "La realidad que nos une", maquetada como una página de reporte: una cifra principal enorme con
 * su matriz de 100 personas, una cifra secundaria y, en un panel sólido aparte, lo que responde la app.
 */
export default function Cifras() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section
      id="cifras"
      className="relative scroll-mt-20 bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-cifras"
    >
      <div ref={ref} data-visto={visto || undefined} className="mx-auto max-w-6xl">
        {/* Encabezado editorial: título a la izquierda, bajada alineada a su base a la derecha */}
        <div className="grid grid-cols-1 gap-6 border-b border-white/10 pb-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chile en cifras</p>
            <h2
              id="titulo-cifras"
              className="mt-4 text-balance text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-white md:text-6xl"
            >
              La realidad que nos une
            </h2>
          </div>
          <p className="max-w-[44ch] text-pretty text-base text-slate-400 lg:col-span-5 lg:justify-self-end">
            La encuesta nacional de seguridad del INE midió cuánto pesa la calle de noche. Estas son sus cifras y lo
            que hacemos con ellas.
          </p>
        </div>

        {/* Cifra principal: el número manda, la matriz lo vuelve personas */}
        <div className="grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="lg:col-span-7">
            <p className="text-[clamp(5.5rem,22vw,11rem)] font-semibold leading-[0.85] tracking-[-0.06em] text-red-400">
              <span className="sr-only">{formatear(TEMOR, 1)} %</span>
              <Contador valor={TEMOR} decimales={1} activo={visto} />
              <span aria-hidden className="ml-1 align-top text-[0.4em] tracking-normal text-red-400/70">
                %
              </span>
            </p>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-white md:mt-12">
              Siente temor al caminar de noche
            </p>
            <p className="mt-2 max-w-[40ch] text-base text-slate-400">
              Casi dos de cada tres personas en Chile. Es la razón de ser de CuidaChile.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end">
            <CienPersonas />
            <p className="text-xs text-slate-500 lg:w-full lg:max-w-[320px]">Cada punto, una persona de cada 100.</p>
          </div>
        </div>

        {/* Fila inferior, con pesos distintos: una cifra más del problema y el panel de la respuesta */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="border-t border-white/10 pt-8 lg:col-span-4 lg:pr-6">
            <p className="text-6xl font-semibold leading-none tracking-[-0.04em] text-red-400">
              <span className="sr-only">10,2 %</span>
              <Contador valor={10.2} decimales={1} activo={visto} />
              <span aria-hidden className="text-3xl text-red-400/70">%</span>
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white">Región Metropolitana</p>
            <p className="mt-2 text-sm text-slate-400">
              De los hogares sufrió un delito violento en el último año. Es la tasa más alta del país.
            </p>
          </div>

          {/* Panel de la respuesta: borde de 1 px en degradado (el relleno va en el hijo), sube y brilla más al pasar el cursor */}
          <div className="group rounded-3xl bg-gradient-to-br from-slate-600/50 via-slate-800/40 to-cyan-900/40 p-px shadow-[0_0_40px_rgba(6,182,212,0.1)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_0_56px_rgba(6,182,212,0.2)] motion-reduce:hover:translate-y-0 lg:col-span-8">
            <div className="barrido-luz relative h-full overflow-hidden rounded-[23px] bg-gradient-to-br from-slate-800/50 to-slate-900/50 px-6 py-6 md:px-10 md:py-8">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">Lo que responde CuidaChile</p>
              <dl className="mt-5 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_auto_1fr] sm:gap-10">
                {RESPUESTA.map((r, i) => (
                  <Fragment key={r.unidad}>
                    {/* Divisor: una línea tenue por la que baja un pulso de luz, de una columna a la otra */}
                    {i > 0 && (
                      <span aria-hidden className="relative hidden w-px overflow-hidden bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent sm:block">
                        <span className="pulso-divisor absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-cyan-300 to-transparent" />
                      </span>
                    )}
                    <div>
                      <dt className="flex items-baseline gap-2 leading-none">
                        <span className="sr-only">
                          {formatear(r.valor, r.decimales)} {r.unidad}
                        </span>
                        <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text pb-1 text-6xl font-black tracking-tighter text-transparent lg:text-7xl">
                          <Contador valor={r.valor} decimales={r.decimales} activo={visto} />
                        </span>
                        <span aria-hidden className="text-xl font-semibold text-cyan-300">
                          {r.unidad}
                        </span>
                      </dt>
                      <dd className="mt-3 max-w-[30ch] text-sm text-slate-400">{r.texto}</dd>
                    </div>
                  </Fragment>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Fuente de las cifras de Chile:{' '}
          <a
            href={FUENTE_ENUSC}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-white"
          >
            ENUSC 2025, INE y Subsecretaría de Prevención del Delito
          </a>
          .
        </p>
      </div>
    </section>
  )
}
