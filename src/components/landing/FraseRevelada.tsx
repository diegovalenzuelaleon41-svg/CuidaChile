import { Fragment, useEffect, useRef, useState } from 'react'

/** Dos líneas: se corta donde se corta la idea. */
const LINEAS = ['Del paradero a la puerta de tu casa,', 'alguien sabe dónde estás.']
const PALABRAS = LINEAS.map((l) => l.split(' '))
const TOTAL = PALABRAS.flat().length

/**
 * La promesa de la página en grande. Las palabras parten apagadas (30 %) y se encienden una a una,
 * en orden de lectura, mientras el bloque sube de la parte baja de la pantalla hacia el centro.
 * El scroll se escucha solo con la sección en pantalla y se agrupa por frame (rAF).
 */
export default function FraseRevelada() {
  const ref = useRef<HTMLHeadingElement | null>(null)
  const [encendidas, setEncendidas] = useState(() =>
    'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : TOTAL,
  )

  const completa = encendidas === TOTAL

  useEffect(() => {
    const el = ref.current
    if (!el || completa) return

    let frame = 0
    const medir = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const alto = window.innerHeight
      // 0 cuando el bloque asoma por el 85 % de la pantalla, 1 cuando su base llega al 55 %.
      const progreso = (alto * 0.85 - r.top) / (alto * 0.3 + r.height)
      // No se apagan al volver a subir: la frase se revela una vez.
      setEncendidas((n) => Math.max(n, Math.round(Math.min(1, Math.max(0, progreso)) * TOTAL)))
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
  }, [completa])

  let indice = 0
  return (
    <section className="relative isolate overflow-hidden bg-[#050B14] px-4 py-24 md:px-8 md:py-40" aria-label="Nuestra promesa">
      {/* Resplandor cian/violeta muy tenue detrás de la frase */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[320px] w-[760px] max-w-[130vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.12),rgba(139,92,246,0.08)_50%,transparent_72%)] blur-2xl"
      />
      <h2
        ref={ref}
        className="mx-auto max-w-5xl text-balance text-center text-4xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white md:text-6xl md:leading-[1.05]"
      >
        {PALABRAS.map((linea, l) => (
          <Fragment key={l}>
            {l > 0 && <br />}
            {linea.map((p, i) => {
              const n = indice++
              return (
                <Fragment key={i}>
                  {i > 0 && ' '}
                  <span className="palabra-revelada" data-encendida={n < encendidas || undefined}>
                    {p}
                  </span>
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </h2>
    </section>
  )
}
