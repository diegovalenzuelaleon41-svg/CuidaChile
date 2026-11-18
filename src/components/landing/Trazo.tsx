import { useId, type CSSProperties } from 'react'
import { useEnVista } from '../../hooks/useEnVista'

/**
 * Subrayado a mano alzada que se dibuja una vez al entrar en pantalla (pathLength + stroke-dashoffset,
 * ver .trazo en index.css). Va dentro de un elemento `relative`: ocupa su ancho, justo bajo el texto.
 * Decorativo. Con movimiento reducido aparece ya dibujado.
 */
export default function Trazo({ retraso = 0 }: { retraso?: number }) {
  const [ref, visto] = useEnVista<SVGSVGElement>()
  const id = useId()

  return (
    <svg
      ref={ref}
      data-visto={visto || undefined}
      viewBox="0 0 300 14"
      preserveAspectRatio="none"
      aria-hidden
      className="trazo pointer-events-none absolute -bottom-[0.12em] left-0 h-[0.28em] w-full overflow-visible"
      style={{ '--retraso': `${retraso}ms` } as CSSProperties}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M4 9 C 52 4, 108 3, 160 6 S 252 11, 296 5"
        pathLength={100}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
