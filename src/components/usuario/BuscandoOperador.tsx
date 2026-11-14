import { Headset, Loader2, MessageCircle, X } from 'lucide-react'

interface Props {
  destino: string
  cancelando: boolean
  onCancelar: () => void
  /** Abre el chat: se puede escribir antes de que el operador acepte. */
  onChat: () => void
}

/**
 * Tarjeta mientras el acompañamiento está PENDIENTE: radar animado hasta que
 * un operador acepta la ruta. Permite cancelar la solicitud. Se apila sobre
 * la barra de acciones (que muestra "Buscando operador…").
 */
export default function BuscandoOperador({ destino, cancelando, onCancelar, onChat }: Props) {
  return (
    <div role="status" aria-live="polite">
      <div className="mx-auto max-w-md rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4 flex items-center gap-3">
        {/* Radar */}
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center" aria-hidden>
          <span className="sos-ring absolute inset-0 rounded-full bg-[#2563EB]/25" />
          <span className="sos-ring absolute inset-0 rounded-full bg-[#2563EB]/20" style={{ animationDelay: '0.7s' }} />
          <span className="sos-ring absolute inset-0 rounded-full bg-[#2563EB]/15" style={{ animationDelay: '1.4s' }} />
          <span className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-brand">
            <Headset size={20} strokeWidth={2} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white">Solicitud enviada</p>
          <p className="text-[13px] text-slate-300 truncate">Ruta hacia {destino}</p>
          <p className="mt-0.5 text-[12px] text-slate-400">Te conectaremos en unos segundos.</p>
        </div>

        <button
          type="button"
          onClick={onChat}
          aria-label="Escribir a la central"
          title="Escribir a la central"
          className="shrink-0 w-11 h-11 rounded-xl border border-white/15 flex items-center justify-center text-[#93C5FD] hover:bg-white/10"
        >
          <MessageCircle size={16} />
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={cancelando}
          className="shrink-0 h-11 inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[13px] font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
        >
          {cancelando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} strokeWidth={2.5} />}
          Cancelar
        </button>
      </div>
    </div>
  )
}
