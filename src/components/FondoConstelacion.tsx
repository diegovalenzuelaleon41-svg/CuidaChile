import { useEffect, useRef } from 'react'

/** Un punto cada tantos px² de superficie, con tope: densidad pareja en cualquier pantalla. */
const AREA_POR_PUNTO = 16000
const MAX_PUNTOS = 80
/** Distancia (px) bajo la cual dos puntos se unen; la línea se intensifica al acercarse. */
const DISTANCIA_LINEA = 130
/** Velocidad máxima por eje, en px por frame (~60 fps): deriva lenta. */
const VELOCIDAD = 0.18

interface Punto {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

/** Colores en RGB sin alfa: la opacidad de cada punto y línea se calcula al dibujar. */
const COLOR = {
  claro: { punto: '37, 99, 235', alfaPunto: 0.28, alfaLinea: 0.14 },
  oscuro: { punto: '96, 165, 250', alfaPunto: 0.4, alfaLinea: 0.16 },
}

function crearPuntos(ancho: number, alto: number): Punto[] {
  const n = Math.min(MAX_PUNTOS, Math.round((ancho * alto) / AREA_POR_PUNTO))
  return Array.from({ length: n }, () => ({
    x: Math.random() * ancho,
    y: Math.random() * alto,
    vx: (Math.random() * 2 - 1) * VELOCIDAD,
    vy: (Math.random() * 2 - 1) * VELOCIDAD,
    r: 1 + Math.random() * 0.9,
  }))
}

/**
 * Fondo de constelación del hero: puntos azules tenues que derivan y se unen con líneas finas
 * cuando quedan cerca. Decorativo. Se pausa fuera de pantalla o con la pestaña oculta, y con
 * movimiento reducido se dibuja una sola vez, quieto.
 */
export default function FondoConstelacion({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ancho = 0
    let alto = 0
    let puntos: Punto[] = []
    let raf: number | undefined
    let visible = true

    function ajustarTamano() {
      if (!canvas || !ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ancho = canvas.clientWidth
      alto = canvas.clientHeight
      canvas.width = Math.round(ancho * dpr)
      canvas.height = Math.round(alto * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      puntos = crearPuntos(ancho, alto)
    }

    function dibujar() {
      if (!ctx) return
      const c = document.documentElement.classList.contains('dark') ? COLOR.oscuro : COLOR.claro
      ctx.clearRect(0, 0, ancho, alto)

      ctx.lineWidth = 0.7
      for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
          const dx = puntos[i].x - puntos[j].x
          const dy = puntos[i].y - puntos[j].y
          const d = Math.hypot(dx, dy)
          if (d < DISTANCIA_LINEA) {
            ctx.strokeStyle = `rgba(${c.punto}, ${((1 - d / DISTANCIA_LINEA) * c.alfaLinea).toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(puntos[i].x, puntos[i].y)
            ctx.lineTo(puntos[j].x, puntos[j].y)
            ctx.stroke()
          }
        }
      }

      ctx.fillStyle = `rgba(${c.punto}, ${c.alfaPunto})`
      for (const p of puntos) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function mover() {
      for (const p of puntos) {
        p.x += p.vx
        p.y += p.vy
        // Rebote suave en los bordes: los puntos nunca se van del lienzo
        if (p.x < 0 || p.x > ancho) p.vx *= -1
        if (p.y < 0 || p.y > alto) p.vy *= -1
      }
    }

    function frame() {
      mover()
      dibujar()
      raf = requestAnimationFrame(frame)
    }

    function arrancar() {
      if (reducir || raf !== undefined || !visible || document.hidden) return
      raf = requestAnimationFrame(frame)
    }

    function detener() {
      if (raf !== undefined) cancelAnimationFrame(raf)
      raf = undefined
    }

    ajustarTamano()
    dibujar()
    arrancar()

    const ro = new ResizeObserver(() => {
      ajustarTamano()
      dibujar()
    })
    ro.observe(canvas)

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) arrancar()
      else detener()
    })
    io.observe(canvas)

    function alCambiarPestana() {
      if (document.hidden) detener()
      else arrancar()
    }
    document.addEventListener('visibilitychange', alCambiarPestana)

    // Con movimiento reducido no hay bucle: se redibuja solo si cambia el tema.
    const mo = new MutationObserver(() => {
      if (raf === undefined) dibujar()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      detener()
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', alCambiarPestana)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
