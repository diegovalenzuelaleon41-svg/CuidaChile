import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useEnVista } from '../../hooks/useEnVista'

type Periodo = 'mensual' | 'anual'
type Estilo = 'basico' | 'premium' | 'institucional'

type Plan = {
  estilo: Estilo
  nombre: string
  subtitulo: string
  /** Monto en CLP por mes según el periodo, o un texto ("A tu medida"). */
  precio: Record<Periodo, number> | string
  sufijo?: string
  /** Línea chica bajo el precio. */
  nota: Record<Periodo, string>
  /** Primera línea de la lista, resaltada: lo que hereda del plan anterior. */
  incluye?: string
  funciones: string[]
  cta: { texto: string; destino: (periodo: Periodo) => string; externo?: boolean }
}

/** Anual = 10 meses pagados de 12 ("2 meses gratis"): $39.900 al año, $3.325 al mes. */
const PREMIUM_MES = 3990
const PREMIUM_ANUAL = PREMIUM_MES * 10
const AHORRO_ANUAL = PREMIUM_MES * 12 - PREMIUM_ANUAL

/** $3.990: punto de miles siempre, también con 4 cifras (toLocaleString no lo garantiza en todos los navegadores). */
const clp = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * Sin pasarela de pago todavía: Premium lleva al registro con el plan y el periodo marcados para
 * retomarlos cuando exista el cobro. Institucional abre un correo a la misma casilla del footer.
 */
const PLANES: Plan[] = [
  {
    estilo: 'basico',
    nombre: 'Básico',
    subtitulo: 'Para tu red de apoyo diaria',
    precio: { mensual: 0, anual: 0 },
    sufijo: 'CLP / siempre',
    nota: { mensual: 'Sin tarjeta de crédito.', anual: 'Sin tarjeta de crédito.' },
    funciones: ['Contactos ilimitados', 'Botón SOS con PIN', 'Alertas barriales'],
    cta: { texto: 'Empezar gratis', destino: () => '/registro' },
  },
  {
    estilo: 'premium',
    nombre: 'Premium',
    subtitulo: 'Tranquilidad total 24/7',
    precio: { mensual: PREMIUM_MES, anual: PREMIUM_ANUAL / 12 },
    sufijo: 'CLP / mes',
    nota: {
      mensual: 'Facturado mes a mes.',
      anual: `Facturado anualmente: ${clp(PREMIUM_ANUAL)} al año.`,
    },
    incluye: 'Todo lo del Básico',
    funciones: ['Acompañamiento en ruta (monitoreo en vivo)', 'Llamadas y chat ilimitados', 'Prioridad en la central'],
    cta: { texto: 'Obtener Premium', destino: (periodo) => `/registro?plan=premium&periodo=${periodo}` },
  },
  {
    estilo: 'institucional',
    nombre: 'Institucional',
    subtitulo: 'Colegios y municipalidades',
    precio: 'A tu medida',
    nota: {
      mensual: 'Cotizamos según el tamaño de tu institución.',
      anual: 'Cotizamos según el tamaño de tu institución.',
    },
    incluye: 'Todo lo del Premium',
    funciones: ['Panel de operador', 'Gestión masiva de usuarios', 'Integración con seguridad municipal'],
    cta: {
      texto: 'Hablar con ventas',
      destino: () => 'mailto:contacto@cuidachile.cl?subject=Plan%20Institucional',
      externo: true,
    },
  },
]

/**
 * Lo que trae cualquier plan. Solo lo que la app cumple hoy (ver Privacidad y PRODUCT.md): el cifrado es
 * TLS, no de extremo a extremo, y el horario de la central aún no está definido, así que nada de "24/7" aquí.
 */
const COMUNES = [
  'Tu SOS llega a la central de operadores',
  'Operadores verificados uno a uno',
  'Conexión cifrada con la central',
  'Ubicación compartida solo en una ruta o un SOS',
  // Espacio duro entre "Ley" y su número: el número nunca queda solo en la línea siguiente
  'Cumplimiento de la Ley 19.628 y la Ley 21.719',
  'Actualizaciones automáticas',
]

/** Foco común a los botones: anillo blanco, como .btn-neon y .btn-cristal. */
const FOCO =
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B14]'

const BOTON = `inline-flex min-h-[56px] w-full items-center justify-center rounded-full px-4 text-base font-semibold transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] md:text-sm lg:text-base ${FOCO}`

const ESTILOS: Record<Estilo, { tarjeta: string; check: string; boton: string }> = {
  basico: {
    tarjeta: 'border-slate-800 bg-slate-900/40 hover:border-slate-600 has-[:focus-visible]:border-slate-600',
    check: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    boton: `${BOTON} border border-cyan-400/60 bg-transparent text-cyan-100 hover:border-cyan-300 hover:bg-cyan-400/10 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]`,
  },
  premium: {
    tarjeta:
      'border-cyan-500/50 bg-slate-900/60 shadow-[0_0_30px_rgba(6,182,212,0.15)] hover:border-cyan-400/90 hover:shadow-[0_0_56px_rgba(6,182,212,0.28)] has-[:focus-visible]:border-cyan-400/90',
    check: 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]',
    // Cian sólido con texto oscuro: más contraste que el blanco sobre el degradado de .btn-neon
    boton: `${BOTON} bg-cyan-400 text-[#04121A] shadow-[0_0_24px_rgba(34,211,238,0.45)] hover:bg-cyan-300 hover:shadow-[0_0_40px_rgba(34,211,238,0.65)]`,
  },
  institucional: {
    tarjeta: 'border-slate-800 bg-slate-900/40 hover:border-purple-400/50 has-[:focus-visible]:border-purple-400/50',
    check: 'border-purple-400/30 bg-purple-500/10 text-purple-300',
    boton: `${BOTON} border border-purple-400/50 bg-transparent text-purple-100 hover:border-purple-300 hover:bg-purple-500/10 hover:shadow-[0_0_24px_rgba(168,85,247,0.3)]`,
  },
}

const DURACION_CONTEO = 700

/**
 * Monto que cuenta desde lo que muestra hasta `valor` (rAF, ease-out) cada vez que cambia el periodo.
 * Se escribe directo en el nodo: React solo pone el texto inicial. Con movimiento reducido salta al valor.
 */
function Monto({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [inicial] = useState(valor)
  const mostrado = useRef(valor)

  useEffect(() => {
    const el = ref.current
    const desde = mostrado.current
    if (!el || desde === valor) return
    const escribir = (n: number) => {
      mostrado.current = n
      el.textContent = clp(n)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      escribir(valor)
      return
    }
    let frame = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_CONTEO)
      escribir(t < 1 ? desde + (valor - desde) * (1 - Math.pow(1 - t, 3)) : valor)
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [valor])

  return (
    <>
      <span ref={ref} aria-hidden className="tabular-nums">
        {clp(inicial)}
      </span>
      <span className="sr-only">{clp(valor)}</span>
    </>
  )
}

/**
 * Selector Mensual / Anual: una pastilla se desliza bajo la opción activa. A su lado, "2 meses gratis"
 * con una flecha a mano alzada que se dibuja una vez (.trazo); en móvil va debajo y la flecha apunta arriba.
 */
function SelectorPeriodo({
  periodo,
  cambiar,
  visto,
}: {
  periodo: Periodo
  cambiar: (p: Periodo) => void
  visto: boolean
}) {
  return (
    <div className="mt-8 flex flex-col items-center md:mt-10">
      <div className="relative">
        <div
          role="group"
          aria-label="Periodo de pago"
          className="relative grid grid-cols-2 rounded-full border border-slate-700 bg-slate-900/50 p-1 backdrop-blur-md"
        >
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 w-28 rounded-full bg-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              periodo === 'anual' ? 'translate-x-full' : ''
            }`}
          />
          {(['mensual', 'anual'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => cambiar(p)}
              className={`relative min-h-[44px] w-28 rounded-full text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                periodo === p ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p === 'mensual' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </div>

        {/* Desde sm cuelga a la derecha del selector, que sigue centrado */}
        <p className="mt-3 flex translate-x-10 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-cyan-300 sm:absolute sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:translate-x-0 sm:-translate-y-1/2 sm:text-base">
          <svg
            data-visto={visto || undefined}
            viewBox="0 0 48 24"
            aria-hidden
            className="trazo h-5 w-10 shrink-0 rotate-[100deg] overflow-visible drop-shadow-[0_0_6px_rgba(34,211,238,0.6)] sm:h-6 sm:w-12 sm:rotate-0"
            style={{ '--retraso': '700ms' } as CSSProperties}
          >
            <path
              d="M45 15 C 35 21, 22 4, 6 11 M6 11 L 13 5 M6 11 L 13 17"
              pathLength={100}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          2 meses gratis
        </p>
      </div>
    </div>
  )
}

/** Una vuelta con pulso de mano a una caja de w × h px: lados apenas curvos y el final pasa de largo sobre el inicio. */
function vueltaAMano(w: number, h: number) {
  const r = 22 // esquinas: 16 px de la tarjeta más los 8 de aire, algo menos para que se vea a mano
  return [
    `M${r + 6} 4`,
    `C${w * 0.35} -1 ${w * 0.7} 6 ${w - r} 1`,
    `C${w - 3} 0 ${w + 1} 7 ${w - 1} ${r + 2}`,
    `C${w + 3} ${h * 0.35} ${w - 4} ${h * 0.7} ${w} ${h - r}`,
    `C${w + 0.5} ${h - 4} ${w - 7} ${h + 1} ${w - r - 2} ${h - 1}`,
    `C${w * 0.65} ${h + 3} ${w * 0.3} ${h - 3.5} ${r} ${h}`,
    `C4 ${h + 0.5} 0 ${h - 7} 1.5 ${h - r - 2}`,
    `C-2 ${h * 0.65} 4.5 ${h * 0.3} 1 ${r + 3}`,
    `C0.5 5 5 -0.5 ${r + 4} 1`,
    `C${r + 35} 2 ${r + 60} 7.5 ${r + 95} 6`,
  ].join(' ')
}

/**
 * Contorno a mano alzada alrededor de Premium, 8 px por fuera de la tarjeta; se dibuja una vez (.trazo).
 * Se traza en píxeles medidos (ResizeObserver) y no con un viewBox estirado: estirado, el patrón de
 * guiones de .trazo se descuadra y la línea sale cortada.
 */
function ContornoMano({ visto }: { visto: boolean }) {
  const id = useId()
  const ref = useRef<SVGSVGElement | null>(null)
  const [caja, setCaja] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const tarjeta = ref.current?.parentElement
    if (!tarjeta) return
    // offset*: el tamaño sin el translate del hover; +16 por el -inset-2
    const medir = () => setCaja({ w: tarjeta.offsetWidth + 16, h: tarjeta.offsetHeight + 16 })
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(tarjeta)
    return () => observador.disconnect()
  }, [])

  return (
    <svg
      ref={ref}
      data-visto={visto || undefined}
      viewBox={caja ? `0 0 ${caja.w} ${caja.h}` : undefined}
      aria-hidden
      className="trazo pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] overflow-visible drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]"
      style={{ '--retraso': '550ms' } as CSSProperties}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {caja && (
        <path
          d={vueltaAMano(caja.w, caja.h)}
          pathLength={100}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function FilaCheck({ texto, check, resaltada }: { texto: string; check: string; resaltada?: boolean }) {
  return (
    <li className={`flex items-start gap-3 text-pretty ${resaltada ? 'font-medium text-white' : ''}`}>
      {/* 20 px, igual que el interlineado de text-sm: el check queda centrado en la primera línea */}
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${check}`}>
        <Check size={12} strokeWidth={3} />
      </span>
      {texto}
    </li>
  )
}

function BotonPlan({ cta, periodo, clase }: { cta: Plan['cta']; periodo: Periodo; clase: string }) {
  const destino = cta.destino(periodo)
  return cta.externo ? (
    <a href={destino} className={clase}>
      {cta.texto}
    </a>
  ) : (
    <Link to={destino} className={clase}>
      {cta.texto}
    </Link>
  )
}

/**
 * "Elige cómo quieres cuidarte": selector Mensual / Anual, tres planes en columnas (apilados en móvil) y la
 * franja de lo que traen todos. Premium destaca con borde cian, resplandor y un contorno dibujado a mano.
 * Las tarjetas entran escalonadas al hacer scroll (.revelar en el li) y suben 5 px al pasar el cursor
 * (en el hijo, porque .revelar ya usa transform). Al cambiar a Anual el precio de Premium cuenta hasta el nuevo.
 */
export default function Precios() {
  const [ref, visto] = useEnVista<HTMLDivElement>()
  const [periodo, setPeriodo] = useState<Periodo>('mensual')

  return (
    <section
      id="precios"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#050B14] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-precios"
    >
      {/* Fondo: resplandor cian tenue detrás de la columna central */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_40%_at_50%_55%,rgba(6,182,212,0.10),transparent_70%)]"
      />

      <div ref={ref} data-visto={visto || undefined} className="mx-auto max-w-6xl">
        <div className="revelar text-center">
          <h2
            id="titulo-precios"
            className="mx-auto max-w-[18ch] text-balance bg-gradient-to-b from-white to-slate-300 bg-clip-text pb-[0.08em] text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-transparent sm:text-[38px] md:max-w-none md:text-[52px]"
          >
            Elige cómo quieres cuidarte
          </h2>
          <p className="mx-auto mt-5 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-slate-300">
            Sin letra chica. <br className="hidden sm:block" />
            Tus contactos de emergencia siempre serán ilimitados y gratis.
          </p>

          <SelectorPeriodo periodo={periodo} cambiar={setPeriodo} visto={visto} />
        </div>

        <ul className="mt-10 grid grid-cols-1 items-stretch gap-6 md:mt-12 md:grid-cols-3">
          {PLANES.map((plan, i) => {
            const estilo = ESTILOS[plan.estilo]
            const destacado = plan.estilo === 'premium'
            return (
              <li key={plan.nombre} className="revelar" style={{ transitionDelay: `${150 + i * 120}ms` }}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur-md transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[5px] has-[:focus-visible]:-translate-y-[5px] motion-reduce:hover:translate-y-0 motion-reduce:has-[:focus-visible]:translate-y-0 md:p-5 lg:p-8 ${estilo.tarjeta}`}
                >
                  {destacado && <ContornoMano visto={visto} />}

                  <h3 className="text-xl font-semibold text-white">{plan.nombre}</h3>
                  {/* Alto fijo en líneas (lh) en md, donde la columna es angosta: los precios quedan parejos */}
                  <p className={`mt-1 text-sm md:min-h-[2lh] lg:min-h-0 ${destacado ? 'text-slate-300' : 'text-slate-400'}`}>
                    {plan.subtitulo}
                  </p>

                  <p className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="whitespace-nowrap text-5xl font-extrabold tracking-[-0.03em] text-white md:text-3xl lg:text-5xl">
                      {typeof plan.precio === 'string' ? plan.precio : <Monto valor={plan.precio[periodo]} />}
                    </span>
                    {plan.sufijo && <span className="text-sm text-slate-400 md:text-xs lg:text-sm">{plan.sufijo}</span>}
                  </p>
                  {/* Dos líneas reservadas: al cambiar de periodo la tarjeta no salta */}
                  <p className="mt-2 min-h-[2lh] text-xs text-slate-400 md:min-h-[3lh] lg:min-h-[2lh]">
                    {plan.nota[periodo]}
                    {destacado && periodo === 'anual' && (
                      <span className="block font-semibold text-cyan-300"> Ahorras {clp(AHORRO_ANUAL)}.</span>
                    )}
                  </p>

                  <ul className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm text-slate-300">
                    {plan.incluye && <FilaCheck texto={plan.incluye} check={estilo.check} resaltada />}
                    {plan.funciones.map((f) => (
                      <FilaCheck key={f} texto={f} check={estilo.check} />
                    ))}
                  </ul>

                  {/* mt-auto: los tres botones quedan alineados al pie aunque las listas difieran */}
                  <div className="mt-auto pt-8">
                    <BotonPlan cta={plan.cta} periodo={periodo} clase={estilo.boton} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Lo que traen todos los planes */}
        <div
          className="revelar mt-8 rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8 lg:p-8"
          style={{ transitionDelay: '510ms' }}
        >
          <h3 className="text-base font-semibold text-white">En todos los planes</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 text-sm text-slate-300 sm:grid-cols-2 lg:mt-0">
            {COMUNES.map((c) => (
              <FilaCheck key={c} texto={c} check="border-cyan-400/40 bg-cyan-400/15 text-cyan-300" />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
