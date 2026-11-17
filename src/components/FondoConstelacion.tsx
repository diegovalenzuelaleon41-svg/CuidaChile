import { useEffect, useRef } from 'react'

/** Velocidad máxima por eje, en px por frame (~60 fps): deriva lenta. */
const VELOCIDAD = 0.18

/**
 * sutil: sigue el tema claro/oscuro y apenas se nota.
 * neon: siempre sobre fondo oscuro, más densa y brillante, con algunos nodos violeta y con halo.
 */
type Variante = 'sutil' | 'neon'

const CONFIG = {
  /** Un punto cada `area` px² con tope `max`: densidad pareja en cualquier pantalla. */
  sutil: { area: 16000, max: 80, distancia: 130, violeta: 0, brillantes: 0, cometas: 0 },
  neon: { area: 11000, max: 120, distancia: 140, violeta: 0.22, brillantes: 0.12, cometas: 2 },
}

/** Colores en RGB sin alfa: la opacidad de cada punto y línea se calcula al dibujar. */
const COLOR = {
  claro: { punto: '37, 99, 235', alfaPunto: 0.28, alfaLinea: 0.14 },
  oscuro: { punto: '96, 165, 250', alfaPunto: 0.4, alfaLinea: 0.16 },
  neon: { punto: '96, 165, 250', alfaPunto: 0.85, alfaLinea: 0.3 },
}
const VIOLETA = '167, 139, 250'

/** Cometa: cian de la paleta (#06b6d4) para el halo y un núcleo casi blanco. */
const COMETA = {
  halo: '#06b6d4',
  estela: '6, 182, 212',
  nucleo: 'rgba(207, 250, 254, 0.95)',
  /** px por frame mientras recorre una línea */
  velocidad: 4,
  /** Posiciones guardadas para la estela */
  largoEstela: 28,
  /** Líneas que recorre antes de apagarse */
  saltos: [4, 8],
  /** Frames de pausa antes de reaparecer en otro nodo: entre ~0,7 s y ~2,3 s */
  espera: [40, 140],
}

interface Punto {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  violeta: boolean
  /** Nodo con halo: da la sensación de red de datos con puntos activos. */
  brillante: boolean
}

/**
 * Destello que viaja de nodo en nodo por las líneas de la red. Sigue la posición actual de los
 * nodos (que derivan), así que siempre va pegado a una línea visible.
 */
interface Cometa {
  origen: number
  destino: number
  /** Avance sobre la línea origen→destino, de 0 a 1 */
  t: number
  velocidad: number
  saltos: number
  historial: { x: number; y: number }[]
  alfa: number
  estado: 'viajando' | 'apagando' | 'esperando'
  espera: number
}

const azar = ([min, max]: number[]) => min + Math.random() * (max - min)

function crearCometa(): Cometa {
  return {
    origen: -1,
    destino: -1,
    t: 0,
    velocidad: COMETA.velocidad,
    saltos: 0,
    historial: [],
    alfa: 0,
    estado: 'esperando',
    // Escalonados: no aparecen todos a la vez al cargar
    espera: azar(COMETA.espera) * Math.random() * 0.5,
  }
}

function crearPuntos(ancho: number, alto: number, variante: Variante): Punto[] {
  const c = CONFIG[variante]
  const n = Math.min(c.max, Math.round((ancho * alto) / c.area))
  return Array.from({ length: n }, () => ({
    x: Math.random() * ancho,
    y: Math.random() * alto,
    vx: (Math.random() * 2 - 1) * VELOCIDAD,
    vy: (Math.random() * 2 - 1) * VELOCIDAD,
    r: 1 + Math.random() * 0.9,
    violeta: Math.random() < c.violeta,
    brillante: Math.random() < c.brillantes,
  }))
}

/**
 * Fondo de constelación del hero: puntos azules tenues que derivan y se unen con líneas finas
 * cuando quedan cerca. En la variante neon, hasta 2 cometas cian recorren las líneas dejando una
 * estela. Decorativo. Se pausa fuera de pantalla o con la pestaña oculta, y con movimiento
 * reducido se dibuja una sola vez, quieto y sin cometas.
 */
export default function FondoConstelacion({ className = '', variante = 'sutil' }: { className?: string; variante?: Variante }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ancho = 0
    let alto = 0
    let puntos: Punto[] = []
    let cometas: Cometa[] = []
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
      puntos = crearPuntos(ancho, alto, variante)
      // Los cometas guardan índices de nodos: con puntos nuevos se reinician
      cometas = reducir ? [] : Array.from({ length: CONFIG[variante].cometas }, crearCometa)
    }

    /** Vecinos de `i` unidos por una línea visible, sin volver a `excluir`. */
    function vecinos(i: number, excluir: number) {
      const distancia = CONFIG[variante].distancia
      const res: number[] = []
      for (let j = 0; j < puntos.length; j++) {
        if (j === i || j === excluir) continue
        if (Math.hypot(puntos[i].x - puntos[j].x, puntos[i].y - puntos[j].y) < distancia) res.push(j)
      }
      return res
    }

    /**
     * Siguiente nodo: prefiere seguir en la misma dirección para que el recorrido se lea como una
     * trayectoria y no como un zigzag. Devuelve -1 si no hay salida razonable.
     */
    function siguienteNodo(desde: number, previo: number) {
      const opciones = vecinos(desde, previo)
      if (opciones.length === 0) return -1
      if (previo < 0) return opciones[Math.floor(Math.random() * opciones.length)]
      const dx = puntos[desde].x - puntos[previo].x
      const dy = puntos[desde].y - puntos[previo].y
      let mejor = -1
      let mejorPuntaje = -Infinity
      for (const j of opciones) {
        const ex = puntos[j].x - puntos[desde].x
        const ey = puntos[j].y - puntos[desde].y
        const coseno = (dx * ex + dy * ey) / (Math.hypot(dx, dy) * Math.hypot(ex, ey) || 1)
        const puntaje = coseno + Math.random() * 0.6
        if (puntaje > mejorPuntaje) {
          mejorPuntaje = puntaje
          mejor = j
        }
      }
      return mejorPuntaje > -0.2 ? mejor : -1
    }

    function encender(k: Cometa) {
      // Algunos intentos por si cae en un nodo aislado
      for (let intento = 0; intento < 8; intento++) {
        const origen = Math.floor(Math.random() * puntos.length)
        const destino = siguienteNodo(origen, -1)
        if (destino < 0) continue
        k.origen = origen
        k.destino = destino
        k.t = 0
        k.saltos = Math.round(azar(COMETA.saltos))
        k.historial = []
        k.alfa = 0
        k.estado = 'viajando'
        return
      }
      k.espera = 30
    }

    function moverCometa(k: Cometa) {
      if (k.estado === 'esperando') {
        if (--k.espera <= 0) encender(k)
        return
      }

      if (k.estado === 'viajando') {
        k.alfa = Math.min(1, k.alfa + 0.1)
        const a = puntos[k.origen]
        const b = puntos[k.destino]
        k.t += k.velocidad / (Math.hypot(b.x - a.x, b.y - a.y) || 1)
        if (k.t >= 1) {
          k.saltos--
          const siguiente = k.saltos > 0 ? siguienteNodo(k.destino, k.origen) : -1
          if (siguiente < 0) {
            k.t = 1
            k.estado = 'apagando'
          } else {
            k.t -= 1
            k.origen = k.destino
            k.destino = siguiente
          }
        }
      } else {
        // Llegó a su destino: se desvanece y luego reaparece en otro lugar
        k.alfa -= 0.05
        if (k.alfa <= 0) {
          k.estado = 'esperando'
          k.espera = azar(COMETA.espera)
          k.historial = []
          return
        }
      }

      const a = puntos[k.origen]
      const b = puntos[k.destino]
      k.historial.push({ x: a.x + (b.x - a.x) * k.t, y: a.y + (b.y - a.y) * k.t })
      if (k.historial.length > COMETA.largoEstela) k.historial.shift()
    }

    function dibujarCometa(k: Cometa) {
      if (!ctx || k.estado === 'esperando' || k.historial.length < 2) return
      const h = k.historial
      const n = h.length

      // La línea que recorre se enciende un poco: el destello se lee como dato viajando por ella
      if (k.estado === 'viajando') {
        const a = puntos[k.origen]
        const b = puntos[k.destino]
        ctx.strokeStyle = `rgba(${COMETA.estela}, ${(0.35 * k.alfa).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // Estela: tramos cada vez más finos y transparentes hacia la cola
      ctx.lineCap = 'round'
      for (let i = 1; i < n; i++) {
        const f = i / (n - 1)
        ctx.strokeStyle = `rgba(${COMETA.estela}, ${(f * f * 0.95 * k.alfa).toFixed(3)})`
        ctx.lineWidth = 0.6 + f * 2.2
        ctx.beginPath()
        ctx.moveTo(h[i - 1].x, h[i - 1].y)
        ctx.lineTo(h[i].x, h[i].y)
        ctx.stroke()
      }
      ctx.lineCap = 'butt'

      // Cabeza: único trazo con shadowBlur (lo caro), uno por cometa
      const cabeza = h[n - 1]
      ctx.save()
      ctx.globalAlpha = k.alfa
      ctx.shadowColor = COMETA.halo
      ctx.shadowBlur = 18
      ctx.fillStyle = COMETA.nucleo
      ctx.beginPath()
      ctx.arc(cabeza.x, cabeza.y, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function dibujar() {
      if (!ctx) return
      const c =
        variante === 'neon' ? COLOR.neon : document.documentElement.classList.contains('dark') ? COLOR.oscuro : COLOR.claro
      const distancia = CONFIG[variante].distancia
      ctx.clearRect(0, 0, ancho, alto)

      ctx.lineWidth = 0.7
      for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
          const dx = puntos[i].x - puntos[j].x
          const dy = puntos[i].y - puntos[j].y
          const d = Math.hypot(dx, dy)
          if (d < distancia) {
            ctx.strokeStyle = `rgba(${c.punto}, ${((1 - d / distancia) * c.alfaLinea).toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(puntos[i].x, puntos[i].y)
            ctx.lineTo(puntos[j].x, puntos[j].y)
            ctx.stroke()
          }
        }
      }

      for (const p of puntos) {
        const color = p.violeta ? VIOLETA : c.punto
        if (p.brillante) {
          ctx.fillStyle = `rgba(${color}, 0.14)`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = `rgba(${color}, ${c.alfaPunto})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.brillante ? p.r * 1.5 : p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const k of cometas) dibujarCometa(k)
    }

    function mover() {
      for (const p of puntos) {
        p.x += p.vx
        p.y += p.vy
        // Rebote suave en los bordes: los puntos nunca se van del lienzo
        if (p.x < 0 || p.x > ancho) p.vx *= -1
        if (p.y < 0 || p.y > alto) p.vy *= -1
      }
      for (const k of cometas) moverCometa(k)
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
  }, [variante])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
