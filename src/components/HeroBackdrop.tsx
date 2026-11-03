/** Silueta aproximada de Chile (lon/lat proyectados a 200×790). Decorativa, no cartográfica. */
const CHILE_PATH =
  'M130 10 L140 40 L150 70 L156 100 L180 116 L174 140 L152 170 L148 200 L140 230 L124 260 L116 300 L120 330 L112 360 L104 390 L96 420 L92 460 L84 500 L86 540 L88 580 L74 620 L60 660 L74 690 L100 700 L148 712 L148 758 L180 764 L140 770 L90 750 L40 720 L20 680 L12 640 L10 600 L30 560 L40 520 L44 490 L54 460 L50 430 L56 404 L68 380 L80 350 L86 320 L88 290 L90 250 L100 210 L108 170 L110 130 L118 90 L114 60 L112 26 Z'

/** Ciudades de referencia sobre la silueta (Arica, Antofagasta, Santiago, Concepción, Puerto Montt, Punta Arenas). */
const CIUDADES = [
  [130, 26],
  [112, 252],
  [128, 322],
  [92, 390],
  [92, 488],
  [120, 724],
]

/**
 * Fondo del hero: patrón geométrico de líneas a la izquierda y mapa de Chile
 * desvanecido a la derecha. Todo decorativo (aria-hidden), colores vía currentColor
 * para que funcione en claro/oscuro.
 */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Patrón geométrico (izquierda) */}
      <svg
        className="absolute left-0 top-0 h-full w-[55%] text-[#2563EB]/[0.07] dark:text-[#3B82F6]/[0.08] [mask-image:linear-gradient(to_right,black_30%,transparent)]"
      >
        <defs>
          <pattern id="hero-geo" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M0 32 L32 0 L64 32 L32 64 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M32 0 V64 M0 32 H64" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-geo)" />
      </svg>

      {/* Mapa de Chile desvanecido (derecha) */}
      <svg
        viewBox="0 0 200 790"
        preserveAspectRatio="xMidYMin meet"
        className="absolute right-[1%] top-[2%] hidden h-[105%] md:block text-[#2563EB] [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]"
      >
        <defs>
          <pattern id="hero-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <path d={CHILE_PATH} fill="url(#hero-dots)" opacity="0.22" />
        <path d={CHILE_PATH} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.3" />
        {CIUDADES.map(([x, y]) => (
          <g key={`${x}-${y}`} opacity="0.3">
            <circle cx={x} cy={y} r="7" fill="currentColor" opacity="0.25" />
            <circle cx={x} cy={y} r="2.5" fill="currentColor" />
          </g>
        ))}
      </svg>

      {/* Halo azul detrás del teléfono: da algo que difuminar a las tarjetas glass */}
      <div className="absolute right-[12%] top-[18%] hidden h-[420px] w-[420px] rounded-full bg-[#3B82F6]/20 blur-[100px] md:block dark:bg-[#3B82F6]/15" />
    </div>
  )
}
