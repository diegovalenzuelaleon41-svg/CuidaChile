import { useEffect, useRef } from 'react'
import { useEnVista } from '../../hooks/useEnVista'

/**
 * Solo afirmaciones verificables en el código y la base:
 * · La ubicación se envía cada 5 s (INTERVALO_GPS_MS) solo con una ruta EN_CURSO o un SOS activo
 *   (useAcompanamiento, useSOS); fuera de eso, ninguna.
 * · Cifrado en tránsito (HTTPS/TLS). No es de extremo a extremo: el operador ve la ubicación del caso,
 *   así que no prometer "E2E" ni que "nadie del equipo puede acceder".
 * · PIN guardado como hash bcrypt en un esquema privado (20261115030000_pin_seguridad.sql).
 * · Leyes de datos que ya cita el registro.
 */
const DETALLES = [
  'Conexión cifrada (TLS) entre tu teléfono y la central.',
  'PIN guardado con un hash irreversible: nadie puede leerlo.',
  'Tratamiento de datos según la Ley 19.628 y la Ley 21.719.',
]

/* ── Ruta de ejemplo (viewBox 400 × 320): dos curvas Bézier enlazadas ──────── */

type Punto = [number, number]
const CURVAS: [Punto, Punto, Punto, Punto][] = [
  [[44, 268], [130, 268], [112, 168], [196, 166]],
  [[196, 166], [280, 164], [266, 70], [356, 58]],
]
const RUTA = 'M44 268 C130 268 112 168 196 166 C280 164 266 70 356 58'
const INICIO = CURVAS[0][0]
const FINAL = CURVAS[1][3]

/** Ubicaciones enviadas en el trayecto de ejemplo: una cada 5 s. */
const PUNTOS = 28
/** Lo que tarda la línea en dibujarse; los puntos y el contador la siguen. Coincide con .ruta-trazo. */
const DIBUJO_MS = 2200
const RETRASO_MS = 300

function bezier([a, b, c, d]: [Punto, Punto, Punto, Punto], t: number): Punto {
  const u = 1 - t
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ]
}

/** Reparte `n` puntos a la misma distancia a lo largo de la ruta (muestreo fino + largo acumulado). */
function puntosEnRuta(n: number): Punto[] {
  const muestras = CURVAS.flatMap((c) => Array.from({ length: 201 }, (_, k) => bezier(c, k / 200)))
  const acumulado = [0]
  for (let i = 1; i < muestras.length; i++) {
    const [x0, y0] = muestras[i - 1]
    const [x1, y1] = muestras[i]
    acumulado.push(acumulado[i - 1] + Math.hypot(x1 - x0, y1 - y0))
  }
  const total = acumulado[acumulado.length - 1]
  return Array.from({ length: n }, (_, i) => {
    const meta = (total * i) / (n - 1)
    const j = acumulado.findIndex((l) => l >= meta - 0.001)
    return muestras[j === -1 ? muestras.length - 1 : j]
  })
}

const PUNTOS_RUTA = puntosEnRuta(PUNTOS)
/** Momento en que la línea pasa por el punto i (los puntos están a igual distancia). */
const retrasoPunto = (i: number) => RETRASO_MS + (DIBUJO_MS * i) / (PUNTOS - 1)

/** Cuenta 0 → PUNTOS al mismo ritmo en que la línea alcanza cada punto (rAF, escribe directo en el nodo). */
function ContadorEnvios({ activo }: { activo: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(PUNTOS)
      return
    }
    let frame = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const avance = (ahora - inicio - RETRASO_MS) / DIBUJO_MS
      const n = avance < 0 ? 0 : Math.min(PUNTOS, Math.floor(avance * (PUNTOS - 1)) + 1)
      el.textContent = String(n)
      if (n < PUNTOS) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [activo])

  return (
    <span ref={ref} className="tabular-nums">
      0
    </span>
  )
}

/**
 * "Tus datos, bajo llave": a la izquierda el dato (0 ubicaciones fuera de una ruta o un SOS) en tipografía
 * editorial; a la derecha, una tarjeta de cristal donde una ruta de ejemplo se dibuja sola y cada
 * ubicación enviada aparece cuando la línea pasa por ella.
 */
export default function Privacidad() {
  const [ref, visto] = useEnVista<HTMLDivElement>()

  return (
    <section
      id="privacidad"
      className="scroll-mt-20 overflow-hidden bg-[#020408] px-4 py-12 md:px-8 md:py-24"
      aria-labelledby="titulo-privacidad"
    >
      <div
        ref={ref}
        data-visto={visto || undefined}
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2"
      >
        <div>
          <h2 id="titulo-privacidad">
            <span className="relative block w-fit">
              {/* Resplandor cian muy tenue detrás del cero */}
              <span aria-hidden className="absolute inset-[15%] rounded-full bg-cyan-500/20 blur-3xl" />
              <span className="cero-entrada relative block bg-gradient-to-b from-white via-slate-200 to-slate-600 bg-clip-text pb-2 text-8xl font-black leading-[0.9] tracking-tighter text-transparent md:text-9xl">
                0
              </span>
            </span>
            <span className="mt-6 block max-w-[16ch] text-balance text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Ubicaciones enviadas cuando no pides ayuda
            </span>
          </h2>
          <p className="mb-10 mt-5 max-w-[44ch] text-pretty text-base text-slate-400">
            Tu ubicación viaja a la central solo mientras tienes una ruta acompañada o una alerta SOS activa. Cuando
            termina, el envío se detiene.
          </p>
          <ul className="space-y-3">
            {DETALLES.map((d) => (
              <li key={d} className="flex items-start gap-3 text-sm text-slate-500">
                {/* mt: el punto queda a la altura de la primera línea aunque el texto se parta */}
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative">
          {/* Profundidad: resplandor radial muy sutil detrás de la tarjeta */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-16 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.10),rgba(37,99,235,0.04)_45%,transparent_70%)]"
          />

          <div className="relative rounded-3xl border border-slate-700/50 bg-slate-900/40 p-6 backdrop-blur-md">
            <p className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400 backdrop-blur-md">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
              <span>
                <span className="font-medium text-white">
                  <ContadorEnvios activo={visto} />
                </span>{' '}
                ubicaciones enviadas
              </span>
            </p>

            <svg viewBox="0 0 400 320" className="block h-auto w-full" aria-hidden>
              <defs>
                {/* La línea nace casi transparente y llega en cian pleno */}
                <linearGradient
                  id="ruta-privacidad"
                  gradientUnits="userSpaceOnUse"
                  x1={INICIO[0]}
                  y1={INICIO[1]}
                  x2={FINAL[0]}
                  y2={FINAL[1]}
                >
                  <stop offset="0" stopColor="#22d3ee" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#22d3ee" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              <path
                d={RUTA}
                pathLength={100}
                fill="none"
                stroke="url(#ruta-privacidad)"
                strokeWidth="2"
                strokeLinecap="round"
                className="ruta-trazo"
              />
              {/* Pulso de luz que recorre la ruta una vez dibujada: la sensación de que fluye */}
              <path
                d={RUTA}
                pathLength={100}
                fill="none"
                stroke="#a5f3fc"
                strokeWidth="2"
                strokeLinecap="round"
                className="ruta-pulso"
              />

              {PUNTOS_RUTA.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="2.5"
                  className="punto-ruta fill-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                  style={{ transitionDelay: `${retrasoPunto(i)}ms` }}
                />
              ))}

              <circle cx={INICIO[0]} cy={INICIO[1]} r="6" fill="#0B1220" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              <circle
                cx={FINAL[0]}
                cy={FINAL[1]}
                r="5"
                className="punto-ruta fill-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.9)]"
                style={{ transitionDelay: `${RETRASO_MS + DIBUJO_MS}ms` }}
              />
              <text x={INICIO[0]} y={INICIO[1] + 26} textAnchor="middle" className="fill-slate-500 text-[11px]">
                Inicio
              </text>
              <text
                x={FINAL[0]}
                y={FINAL[1] + 24}
                textAnchor="middle"
                className="punto-ruta fill-emerald-300 text-[11px]"
                style={{ transitionDelay: `${RETRASO_MS + DIBUJO_MS}ms` }}
              >
                Llegaste
              </text>
            </svg>
          </div>

          <figcaption className="relative mt-4 text-xs font-normal text-slate-500">
            Ruta de ejemplo. Un punto cada 5 s mientras la ruta está activa; antes y después, ninguno.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
