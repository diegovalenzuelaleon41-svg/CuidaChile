import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

/** Mantener presionado este tiempo muestra la ayuda en vez de abrir el reporte. */
const LARGO_MS = 450

interface Props {
  onClick: () => void
  /** Reportes visibles en el mapa (badge). */
  cantidad: number
}

/**
 * Acción secundaria: botón de cristal oscuro de 48 px con el ícono y el borde en ámbar.
 * Vive abajo a la izquierda, frente a los controles del mapa. Al tocarlo el ícono gira y
 * destella; mantenerlo presionado muestra "Reportar algo sospechoso".
 */
export default function BotonReportar({ onClick, cantidad }: Props) {
  const [ayuda, setAyuda] = useState(false)
  const [destello, setDestello] = useState(0)
  const timerRef = useRef<number | null>(null)
  const fueLargoRef = useRef(false)

  useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!ayuda) return
    const t = setTimeout(() => setAyuda(false), 1600)
    return () => clearTimeout(t)
  }, [ayuda])

  function cancelarTimer() {
    if (timerRef.current != null) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onPointerDown={() => {
          fueLargoRef.current = false
          cancelarTimer()
          timerRef.current = window.setTimeout(() => {
            fueLargoRef.current = true
            setAyuda(true)
          }, LARGO_MS)
        }}
        onPointerUp={cancelarTimer}
        onPointerLeave={cancelarTimer}
        onPointerCancel={cancelarTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          // Mantener presionado solo muestra la ayuda.
          if (fueLargoRef.current) return
          setDestello((n) => n + 1)
          onClick()
        }}
        aria-label={`Reportar algo sospechoso. Hay ${cantidad} reportes visibles.`}
        title="Reportar algo sospechoso"
        className="relative w-12 h-12 rounded-full bg-slate-800/80 backdrop-blur-md text-amber-400 border border-amber-400/50 flex items-center justify-center select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] shadow-[0_0_14px_rgba(245,158,11,0.35),0_6px_24px_rgba(0,0,0,0.4)] hover:bg-slate-700/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.6),0_6px_24px_rgba(0,0,0,0.4)] active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/70"
      >
        {/* Destello: se reinicia en cada toque (key) */}
        {destello > 0 && (
          <span key={destello} className="destello absolute inset-0 rounded-full bg-amber-400/60" aria-hidden />
        )}
        <TriangleAlert size={22} strokeWidth={2.5} className="relative icono-alerta" />
        {cantidad > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-slate-900">
            {cantidad}
          </span>
        )}
      </button>

      {/* Tooltip: al mantener presionado (táctil) o con hover (escritorio) */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-[calc(100%+10px)] whitespace-nowrap rounded-lg bg-slate-900/90 backdrop-blur-sm px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg transition-all duration-150 ${
          ayuda ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:translate-x-0'
        }`}
      >
        Reportar algo sospechoso
      </span>
    </div>
  )
}
