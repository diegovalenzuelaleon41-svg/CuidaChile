import { useEffect, useRef } from 'react'

/**
 * Escribe en el elemento la variable --scroll (px recorridos desde que su borde superior pasó la
 * parte alta de la pantalla). Los hijos con .parallax y --velocidad se desplazan a distinto ritmo.
 * El scroll se escucha solo mientras el elemento está en pantalla y se agrupa por frame (rAF).
 * Sin efecto con prefers-reduced-motion.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const actualizar = () => {
      frame = 0
      const recorrido = Math.max(0, -el.getBoundingClientRect().top)
      el.style.setProperty('--scroll', recorrido.toFixed(1))
    }
    const alScroll = () => {
      if (!frame) frame = requestAnimationFrame(actualizar)
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

  return ref
}
