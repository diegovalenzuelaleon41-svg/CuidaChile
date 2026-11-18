import { useState } from 'react'
import { HeartPulse, Loader2, Star, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SEGUNDOS_RESPUESTA, type MotivoControl } from '../../hooks/useControlBienestar'

/* ──────────────── "¿Todo bien?" durante la ruta ──────────────── */

export function ModalTodoBien({
  motivo,
  segundos,
  onBien,
  onAyuda,
}: {
  motivo: MotivoControl
  segundos: number
  onBien: () => void
  onAyuda: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="todo-bien-titulo"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300" aria-hidden>
          <HeartPulse size={28} />
        </span>
        <h2 id="todo-bien-titulo" className="mt-4 text-2xl font-bold">
          ¿Todo bien?
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-slate-300">
          {motivo === 'quieta'
            ? 'Llevas un rato sin moverte durante tu ruta.'
            : 'Ya pasó bastante de tu hora estimada de llegada.'}{' '}
          Si no respondes, enviaremos una alerta SOS a la central.
        </p>
        <p className="mt-4 text-center text-5xl font-black tabular-nums text-amber-300" aria-live="polite">
          {segundos}
        </p>
        {/* Barra que se vacía con la cuenta regresiva */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-full rounded-full bg-amber-400 transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${segundos / SEGUNDOS_RESPUESTA})`, transformOrigin: 'left' }}
          />
        </div>
        <button
          type="button"
          onClick={onBien}
          autoFocus
          className="mt-6 h-14 w-full rounded-2xl bg-emerald-600 text-[17px] font-bold transition-colors hover:bg-emerald-500"
        >
          Estoy bien
        </button>
        <button
          type="button"
          onClick={onAyuda}
          className="mt-3 h-12 w-full rounded-2xl border-2 border-red-500/80 text-[15px] font-bold text-red-300 transition-colors hover:bg-red-500/10"
        >
          Necesito ayuda
        </button>
      </div>
    </div>
  )
}

/* ──────────────── Calificar al operador al terminar ──────────────── */

export function ModalCalificar({
  acompanamientoId,
  operador,
  onCerrar,
}: {
  acompanamientoId: string
  operador: string | null
  onCerrar: (gracias: boolean) => void
}) {
  const [nota, setNota] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(false)

  async function enviar() {
    if (!nota || enviando) return
    setEnviando(true)
    const { error: err } = await supabase.from('calificaciones').insert({ acompanamiento_id: acompanamientoId, nota })
    setEnviando(false)
    // 23505: ya la había calificado (otra pestaña): da igual.
    if (err && err.code !== '23505') {
      console.error('[calificacion] no se pudo guardar:', err.code, err.message)
      setError(true)
      return
    }
    onCerrar(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calificar-titulo"
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
        <button
          type="button"
          onClick={() => onCerrar(false)}
          aria-label="Cerrar sin calificar"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>
        <h2 id="calificar-titulo" className="pr-8 text-xl font-bold">
          ¿Cómo te acompañó {operador ? operador.charAt(0).toUpperCase() + operador.slice(1) : 'tu operador'}?
        </h2>
        <p className="mt-1.5 text-[14px] text-slate-400">Tu nota ayuda a la central a mejorar.</p>
        <div className="mt-5 flex justify-center gap-2" role="radiogroup" aria-label="Nota de 1 a 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} de 5`}
              onClick={() => setNota(n)}
              className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform hover:scale-110 active:scale-95"
            >
              <Star size={34} className={n <= nota ? 'fill-amber-400 text-amber-400' : 'text-slate-600'} />
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-center text-[13px] text-amber-300">No pudimos guardar tu nota. Intenta de nuevo.</p>}
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!nota || enviando}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[15px] font-bold transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {enviando && <Loader2 size={18} className="animate-spin" />}
          Enviar
        </button>
      </div>
    </div>
  )
}
