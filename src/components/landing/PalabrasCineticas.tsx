import { useEffect, useRef, useState } from 'react'

const PALABRAS = ['SEGURIDAD', 'TRANQUILIDAD', 'CONFIANZA']

/**
 * Fondo de una sección: una palabra gigante y tenue que cambia por fundido cruzado según cuánto se
 * avanzó por la sección (un tercio cada una). El scroll se escucha solo con la sección en pantalla y
 * se agrupa por frame (rAF). Decorativo. Con movimiento reducido queda fija la primera palabra.
 */
export default function PalabrasCineticas() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [activa, setActiva] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const medir = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const alto = window.innerHeight
      // 0 cuando la sección asoma por abajo, 1 cuando se va por arriba
      const progreso = Math.min(0.999, Math.max(0, (alto - r.top) / (alto + r.height)))
      setActiva(Math.floor(progreso * PALABRAS.length))
    }
    const alScroll = () => {
      if (!frame) frame = requestAnimationFrame(medir)
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        window.addEventListener('scroll', alScroll, { passive: true })
        alScroll()
      } else {
        window.removeEventListener('scroll', alScroll)
      }
    })
    io.observe(el)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', alScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {PALABRAS.map((p, i) => (
        <span
          key={p}
          className="palabra-cinetica absolute select-none whitespace-nowrap text-[17vw] font-black leading-none tracking-tighter text-slate-700/25 lg:text-9xl"
          data-activa={i === activa || undefined}
        >
          {p}
        </span>
      ))}
    </div>
  )
}
