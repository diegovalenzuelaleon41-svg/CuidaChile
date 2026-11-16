import FondoConstelacion from './FondoConstelacion'

/** Silueta aproximada de Chile (lon/lat proyectados a 200×790). Decorativa, no cartográfica. */
const CHILE_PATH =
  'M130 10 L140 40 L150 70 L156 100 L180 116 L174 140 L152 170 L148 200 L140 230 L124 260 L116 300 L120 330 L112 360 L104 390 L96 420 L92 460 L84 500 L86 540 L88 580 L74 620 L60 660 L74 690 L100 700 L148 712 L148 758 L180 764 L140 770 L90 750 L40 720 L20 680 L12 640 L10 600 L30 560 L40 520 L44 490 L54 460 L50 430 L56 404 L68 380 L80 350 L86 320 L88 290 L90 250 L100 210 L108 170 L110 130 L118 90 L114 60 L112 26 Z'

/** Ciudades de referencia sobre la silueta (Arica, Antofagasta, Santiago, Concepción, Puerto Montt, Punta Arenas). */
const CIUDADES: [number, number][] = [
  [130, 26],
  [112, 252],
  [128, 322],
  [92, 390],
  [92, 488],
  [120, 724],
]

/** Une las ciudades de norte a sur: la "red" que recorre el país. */
const RED_CIUDADES = CIUDADES.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')

/**
 * Fondo del hero, estética "cyber-tech": base casi negra con degradados radiales, constelación
 * neón animada (canvas), una órbita de luz detrás del teléfono, un horizonte luminoso abajo y el
 * mapa de Chile con nodos brillantes a la derecha. Todo decorativo (aria-hidden) y siempre oscuro.
 */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050B14]" aria-hidden>
      {/* Degradados radiales: azul marino detrás del teléfono, violeta abajo a la izquierda */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_68%_42%,rgba(37,99,235,0.22),transparent_70%),radial-gradient(ellipse_45%_40%_at_12%_95%,rgba(124,58,237,0.16),transparent_70%)]" />

      {/* Malla neuronal animada */}
      <FondoConstelacion
        variante="neon"
        className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
      />

      {/* Órbita de luz detrás del teléfono */}
      <div className="absolute left-[64%] top-[50%] hidden h-[260px] w-[820px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-blue-400/30 shadow-[0_0_32px_rgba(59,130,246,0.35),inset_0_0_32px_rgba(59,130,246,0.18)] lg:block" />

      {/* Horizonte luminoso al pie del hero */}
      <div className="absolute -bottom-[180px] left-1/2 h-[260px] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-blue-400/40 shadow-[0_-12px_60px_rgba(59,130,246,0.35)]" />

      {/* Mapa de Chile con nodos brillantes (desde 1440px: con menos ancho queda bajo las tarjetas del teléfono) */}
      <svg
        viewBox="0 0 200 790"
        preserveAspectRatio="xMidYMin meet"
        className="absolute right-[1%] top-[3%] hidden h-[100%] drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] min-[1440px]:block"
      >
        <defs>
          <pattern id="hero-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1" fill="#3B82F6" />
          </pattern>
          <linearGradient id="chile-borde" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="55%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <path d={CHILE_PATH} fill="url(#hero-dots)" opacity="0.45" />
        <path d={CHILE_PATH} fill="none" stroke="url(#chile-borde)" strokeWidth="1.6" strokeLinejoin="round" opacity="0.85" />
        <path d={RED_CIUDADES} fill="none" stroke="#60A5FA" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.6" />
        {CIUDADES.map(([x, y], i) => {
          const color = i % 2 ? '#A78BFA' : '#60A5FA'
          return (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="11" fill={color} opacity="0.18" />
              <circle cx={x} cy={y} r="5" fill={color} opacity="0.45" />
              <circle cx={x} cy={y} r="2.6" fill="#FFFFFF" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
