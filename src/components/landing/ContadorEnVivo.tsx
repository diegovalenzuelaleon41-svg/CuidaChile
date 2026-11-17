import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const DURACION = 2000
const REFRESCO_MS = 60_000
const formatear = (n: number) => Math.round(n).toLocaleString('es-CL')

/**
 * En desarrollo, `?contador=1245` en la URL simula la cifra para ver la píldora: la real no llega
 * al mínimo todavía. En producción solo vale lo que devuelve la base.
 */
function cifraSimulada(): number | null {
  if (!import.meta.env.DEV) return null
  const v = Number(new URLSearchParams(window.location.search).get('contador'))
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Píldora del hero: personas acompañadas ahora mismo (ruta acompañada abierta o SOS activo), desde
 * la RPC personas_acompanadas_ahora. La base devuelve null bajo el mínimo y entonces no se muestra
 * nada. El número sube desde el valor anterior (0 al cargar) en 2 s y se refresca cada minuto.
 */
export default function ContadorEnVivo() {
  const [cifra, setCifra] = useState<number | null>(null)
  const ref = useRef<HTMLSpanElement | null>(null)
  const mostrado = useRef(0)

  useEffect(() => {
    let cancelado = false
    async function pedir() {
      if (document.hidden) return
      const simulada = cifraSimulada()
      if (simulada != null) {
        setCifra(simulada)
        return
      }
      const { data, error } = await supabase.rpc('personas_acompanadas_ahora')
      if (!cancelado && !error) setCifra(typeof data === 'number' ? data : null)
    }
    void pedir()
    const intervalo = window.setInterval(pedir, REFRESCO_MS)
    return () => {
      cancelado = true
      window.clearInterval(intervalo)
    }
  }, [])

  // Sube del número mostrado al nuevo, escribiendo directo en el nodo (sin un render por frame).
  useEffect(() => {
    const el = ref.current
    if (!el || cifra == null) return
    const desde = mostrado.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formatear(cifra)
      mostrado.current = cifra
      return
    }
    let frame = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION)
      const valor = desde + (cifra - desde) * (1 - Math.pow(1 - t, 3))
      el.textContent = formatear(valor)
      mostrado.current = valor
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [cifra])

  if (cifra == null) return null

  return (
    <p className="aparecer-pildora mt-6 inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-300 backdrop-blur-md">
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <span>
        <span className="sr-only">{formatear(cifra)}</span>
        <span ref={ref} aria-hidden className="font-semibold tabular-nums text-white">
          0
        </span>{' '}
        personas acompañadas ahora mismo
      </span>
    </p>
  )
}
