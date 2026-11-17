import { useId } from 'react'

/** Contorno del escudo (viewBox 0 0 200 200) y su bisel interior, un poco más chico. */
const ESCUDO = 'M100 30 L152 49 V96 C152 131 130 153 100 168 C70 153 48 131 48 96 V49 Z'
const BISEL = 'M100 42 L141 57 V97 C141 125 124 143 100 155 C76 143 59 125 59 97 V57 Z'
/** Mitad izquierda del escudo: la cara que recibe la luz y le da volumen. */
const CARA = 'M100 30 L48 49 V96 C48 131 70 153 100 168 Z'

/**
 * Escudo holográfico con candado y un anillo orbital: cristal cian que emite luz. Decorativo.
 * El anillo se dibuja en dos mitades para que la de atrás quede detrás del escudo y la de
 * adelante lo cruce por delante.
 */
export default function EscudoHolografico({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const ref = (n: string) => `url(#${n}-${id})`

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#2563eb" stopOpacity="0.18" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cristal-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`borde-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="0.5" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id={`candado-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f9ff" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id={`anillo-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
        </linearGradient>
        <filter id={`brillo-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="difuso" />
          <feMerge>
            <feMergeNode in="difuso" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="100" cy="100" r="96" fill={ref('halo')} />

      {/* Mitad trasera del anillo: pasa por detrás del escudo */}
      <g transform="rotate(-14 100 128)">
        <path d="M14 128 A86 22 0 0 1 186 128" fill="none" stroke={ref('anillo')} strokeWidth="2" opacity="0.45" />
      </g>

      <g filter={ref('brillo')}>
        <path d={ESCUDO} fill={ref('cristal')} stroke={ref('borde')} strokeWidth="3" strokeLinejoin="round" />
        <path d={CARA} fill="#ffffff" opacity="0.1" />
        <path d={BISEL} fill="none" stroke="#a5f3fc" strokeWidth="1.2" strokeLinejoin="round" opacity="0.55" />

        {/* Candado */}
        <path d="M88 96 V86 a12 12 0 0 1 24 0 V96" fill="none" stroke={ref('candado')} strokeWidth="5" strokeLinecap="round" />
        <rect x="80" y="94" width="40" height="32" rx="6" fill={ref('candado')} />
        <circle cx="100" cy="107" r="4.5" fill="#1e40af" />
        <rect x="98" y="108" width="4" height="10" rx="2" fill="#1e40af" />
      </g>

      {/* Mitad delantera del anillo: cruza el escudo por delante */}
      <g transform="rotate(-14 100 128)" filter={ref('brillo')}>
        <path d="M14 128 A86 22 0 0 0 186 128" fill="none" stroke={ref('anillo')} strokeWidth="2.5" />
      </g>

      {/* Destellos */}
      <g fill="#cffafe">
        <circle cx="38" cy="58" r="1.6" opacity="0.8" />
        <circle cx="166" cy="40" r="1.2" opacity="0.7" />
        <circle cx="172" cy="92" r="1.8" opacity="0.6" />
        <circle cx="30" cy="104" r="1.1" opacity="0.6" />
        <circle cx="128" cy="22" r="1.3" opacity="0.7" />
      </g>
    </svg>
  )
}
