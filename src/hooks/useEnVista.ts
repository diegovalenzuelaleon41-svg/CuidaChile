import { useEffect, useRef, useState } from 'react'

/** true la primera vez que el elemento entra en pantalla; no vuelve a false. */
export function useEnVista<T extends Element>() {
  const ref = useRef<T | null>(null)
  // Sin IntersectionObserver se muestra todo de entrada.
  const [visto, setVisto] = useState(() => !('IntersectionObserver' in window))

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisto(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return [ref, visto] as const
}
