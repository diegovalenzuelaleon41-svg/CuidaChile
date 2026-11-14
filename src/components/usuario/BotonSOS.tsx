import { useEffect, useRef, useState } from 'react'
import { Fingerprint } from 'lucide-react'

/** Tiempo que hay que mantener presionado para enviar el SOS. */
const HOLD_MS = 1500

const TAMANOS = {
  lg: { boton: 72, trazo: 4, texto: 'text-[20px]' },
  sm: { boton: 44, trazo: 3, texto: 'text-[12px]' },
} as const

interface Props {
  onActivar: () => void
  /** Ya hay una alerta abierta: un toque simple vuelve a mostrar su estado. */
  abierta?: boolean
  size?: keyof typeof TAMANOS
}

function vibrar(patron: number | number[]) {
  try {
    navigator.vibrate?.(patron)
  } catch {
    /* sin API de vibración (iOS, escritorio) */
  }
}

/**
 * Botón de pánico: mantener presionado 1,5 s (anti toques accidentales).
 * Mientras se mantiene, un anillo SVG se completa; si se suelta antes, se
 * cancela. Funciona con dedo, mouse y teclado (mantener Enter / Espacio).
 */
export default function BotonSOS({ onActivar, abierta = false, size = 'lg' }: Props) {
  const { boton, trazo, texto } = TAMANOS[size]
  const anillo = boton + 14
  const radio = (anillo - trazo) / 2
  const circunferencia = 2 * Math.PI * radio

  const [progreso, setProgreso] = useState(0)
  const [presionando, setPresionando] = useState(false)
  const [soltoAntes, setSoltoAntes] = useState(false)
  const inicioRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const onActivarRef = useRef(onActivar)
  useEffect(() => {
    onActivarRef.current = onActivar
  })

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  // "Mantén presionado" se muestra un momento si soltó antes de tiempo.
  useEffect(() => {
    if (!soltoAntes) return
    const t = setTimeout(() => setSoltoAntes(false), 1800)
    return () => clearTimeout(t)
  }, [soltoAntes])

  function detener() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    inicioRef.current = null
    setPresionando(false)
    setProgreso(0)
  }

  function empezar() {
    if (inicioRef.current != null) return
    if (abierta) {
      onActivarRef.current()
      return
    }
    inicioRef.current = performance.now()
    setPresionando(true)
    setSoltoAntes(false)
    vibrar(25)
    const tick = (ahora: number) => {
      if (inicioRef.current == null) return
      const p = Math.min(1, (ahora - inicioRef.current) / HOLD_MS)
      setProgreso(p)
      if (p >= 1) {
        detener()
        vibrar([90, 50, 180])
        onActivarRef.current()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function soltar() {
    if (inicioRef.current == null) return
    detener()
    setSoltoAntes(true)
  }

  // Texto secundario dentro del botón (solo lg).
  const ayuda = abierta ? 'Ver' : soltoAntes ? 'Mantén' : presionando ? 'Sigue…' : '1,5 s'

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: anillo, height: anillo }}>
      {/* Halo de "respiración": se apaga mientras se presiona para que mande el anillo */}
      {!presionando && (
        <>
          <span
            className="sos-ring absolute rounded-full bg-[#EF4444]/35"
            style={{ width: boton, height: boton, animationDuration: '2.4s' }}
            aria-hidden
          />
          <span
            className="sos-ring absolute rounded-full bg-[#EF4444]/25"
            style={{ width: boton, height: boton, animationDuration: '2.4s', animationDelay: '0.8s' }}
            aria-hidden
          />
        </>
      )}

      {/* Anillo de progreso (z-10: el resplandor del botón no lo tapa) */}
      <svg width={anillo} height={anillo} className="absolute inset-0 z-10 -rotate-90 pointer-events-none" aria-hidden>
        <circle cx={anillo / 2} cy={anillo / 2} r={radio} fill="none" stroke="rgba(239,68,68,0.18)" strokeWidth={trazo} />
        <circle
          cx={anillo / 2}
          cy={anillo / 2}
          r={radio}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={trazo}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - progreso)}
          style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.95))', opacity: presionando ? 1 : 0 }}
        />
      </svg>

      <button
        type="button"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          empezar()
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onLostPointerCapture={soltar}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault()
            empezar()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') soltar()
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={
          abierta
            ? 'Alerta SOS activa. Toca para ver su estado.'
            : 'Botón de pánico SOS. Mantén presionado 1,5 segundos para enviar la alerta.'
        }
        className={`relative rounded-full bg-[#EF4444] text-white border-2 border-white/80 flex items-center justify-center select-none touch-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] shadow-[0_0_18px_rgba(239,68,68,0.75),0_8px_24px_rgba(239,68,68,0.45)] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${
          presionando ? 'scale-95 shadow-[0_0_32px_rgba(239,68,68,1),0_8px_24px_rgba(239,68,68,0.55)]' : 'hover:scale-105'
        }`}
        style={{ width: boton, height: boton }}
      >
        <span className="flex flex-col items-center gap-0.5">
          <span className={`${texto} font-extrabold leading-none tracking-widest`}>SOS</span>
          {size === 'lg' && (
            <span
              className={`flex items-center gap-0.5 text-[9px] font-bold uppercase leading-none tracking-wide ${
                soltoAntes ? 'text-amber-200' : 'text-white/90'
              }`}
              aria-hidden
            >
              {!abierta && <Fingerprint size={10} strokeWidth={2.5} />}
              {ayuda}
            </span>
          )}
        </span>
      </button>
      {/* Lectores de pantalla: avisa si soltó antes de tiempo. */}
      <span className="sr-only" aria-live="polite">
        {soltoAntes ? 'Mantén presionado 1,5 segundos para enviar la alerta.' : ''}
      </span>
    </div>
  )
}
