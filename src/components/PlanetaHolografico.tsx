/**
 * Curvatura de un planeta visto desde el espacio, con atmósfera cian y una red de datos sobre la
 * superficie. Todo en un solo SVG (sin librerías 3D) para que nodos y arcos queden exactamente
 * sobre la curva a cualquier ancho: el viewBox se recorta por los lados ("slice") y en un celular
 * se ve solo el centro del horizonte. Decorativo.
 */

/** Geometría en el viewBox 0 0 1600 500: un círculo enorme cuya cima asoma en y = 250. */
const ANCHO = 1600
const ALTO = 500
const CX = 800
const R = 2600
const CY = 250 + R

/** Altura de la superficie en x, más `fondo` px hacia dentro del planeta. */
function sobre(x: number, fondo = 0) {
  return CY - Math.sqrt(R * R - (x - CX) ** 2) + fondo
}

/** Ciudades (nodos con anillos), como [x, profundidad bajo el horizonte]. Casi todas a los lados: el centro queda bajo la tarjeta. */
const NODOS: [number, number][] = [
  [150, 40],
  [330, 70],
  [520, 34],
  [610, 120],
  [990, 118],
  [1090, 30],
  [1270, 64],
  [1460, 44],
]
const PUNTOS = NODOS.map(([x, f]) => ({ x, y: sobre(x, f) }))

/** Rutas de datos: arcos que despegan de un nodo y aterrizan en otro. */
const RUTAS: [number, number, number][] = [
  // [desde, hasta, altura del arco]
  [0, 2, 150],
  [1, 3, 60],
  [2, 3, 70],
  [4, 5, 70],
  [5, 7, 150],
  [5, 6, 60],
]

function arco(a: number, b: number, alto: number) {
  const p = PUNTOS[a]
  const q = PUNTOS[b]
  return `M${p.x} ${p.y} Q${(p.x + q.x) / 2} ${Math.min(p.y, q.y) - alto} ${q.x} ${q.y}`
}

/** Luces de ciudad: puntos tenues con un pseudoazar fijo (igual en cada render). */
const LUCES = (() => {
  let semilla = 7
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 170 }, () => {
    const x = azar() * ANCHO
    return { x, y: sobre(x, 12 + azar() ** 1.6 * 230), r: 0.5 + azar() * 1.1, o: 0.15 + azar() * 0.5 }
  })
})()

export default function PlanetaHolografico({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`} aria-hidden>
      {/* Atmósfera: la luz del planeta tiñe el espacio de abajo hacia arriba */}
      <div className="absolute inset-x-0 bottom-0 h-[160%] bg-gradient-to-t from-cyan-900/20 via-blue-950/10 to-transparent" />

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="planeta-superficie" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R}>
            <stop offset="0.9" stopColor="#020617" />
            <stop offset="0.975" stopColor="#06132e" />
            <stop offset="1" stopColor="#0c2a5c" />
          </radialGradient>
          <filter id="planeta-difuso" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="planeta-brillo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="d" />
            <feMerge>
              <feMergeNode in="d" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Resplandor de la atmósfera sobre el horizonte */}
        <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#06b6d4" strokeWidth="60" opacity="0.5" filter="url(#planeta-difuso)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#planeta-superficie)" />

        {/* Luces de ciudad */}
        <g fill="#7dd3fc">
          {LUCES.map((l, i) => (
            <circle key={i} cx={l.x} cy={l.y} r={l.r} opacity={l.o} />
          ))}
        </g>

        {/* Horizonte: línea fina e intensa, con un halo corto */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#22d3ee" strokeWidth="8" opacity="0.6" filter="url(#planeta-difuso)" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#cffafe" strokeWidth="2" />

        {/* Red de datos: rutas finas y un pulso que las recorre */}
        <g fill="none" strokeLinecap="round">
          {RUTAS.map(([a, b, alto], i) => (
            <path key={`r${i}`} d={arco(a, b, alto)} stroke="rgba(6,182,212,0.3)" strokeWidth="1.2" />
          ))}
          {RUTAS.map(([a, b, alto], i) => (
            <path
              key={`p${i}`}
              d={arco(a, b, alto)}
              pathLength={100}
              stroke="#67e8f9"
              strokeWidth="1.6"
              className="planeta-flujo"
              style={{ animationDelay: `${i * -1.1}s` }}
            />
          ))}
        </g>

        {/* Nodos: punto brillante con anillos aplanados por la perspectiva */}
        {PUNTOS.map((p, i) => (
          <g key={`n${i}`}>
            <ellipse cx={p.x} cy={p.y} rx="34" ry="9" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.35" />
            <ellipse cx={p.x} cy={p.y} rx="20" ry="5.5" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.6" />
            <circle cx={p.x} cy={p.y} r="3.2" fill="#06b6d4" filter="url(#planeta-brillo)" />
            <circle cx={p.x} cy={p.y} r="1.4" fill="#ecfeff" />
          </g>
        ))}
      </svg>
    </div>
  )
}
