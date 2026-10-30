import { Headset, Loader2, MessageCircle, X } from 'lucide-react'

interface Props {
  destino: string
  cancelando: boolean
  onCancelar: () => void
  /** Abre el chat: se puede escribir antes de que el operador acepte. */
  onChat: () => void
}

/**
 * Tarjeta flotante mientras el acompañamiento está PENDIENTE: radar animado
 * hasta que un operador acepta la ruta. Permite cancelar la solicitud.
 */
export default function BuscandoOperador({ destino, cancelando, onCancelar, onChat }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 px-4" role="status" aria-live="polite">
      <div className="card mx-auto max-w-md p-5 flex items-center gap-4">
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
          <p className="text-[15px] font-bold text-heading dark:text-white">Buscando operador…</p>
          <p className="text-[13px] text-muted dark:text-slate-400 truncate">Ruta hacia {destino}</p>
          <p className="mt-0.5 text-[12px] text-faint dark:text-slate-500">Te conectaremos en unos segundos.</p>
        </div>

        <button
          type="button"
          onClick={onChat}
          aria-label="Escribir a la central"
          title="Escribir a la central"
          className="shrink-0 w-9 h-9 rounded-[10px] border border-line flex items-center justify-center text-brand-600 hover:bg-[#EFF6FF] dark:border-slate-700 dark:text-[#93C5FD] dark:hover:bg-slate-800"
        >
          <MessageCircle size={16} />
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={cancelando}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[13px] font-semibold text-sos hover:bg-[#FEF2F2] disabled:opacity-60 dark:border-slate-700 dark:hover:bg-[#DC2626]/10"
        >
          {cancelando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} strokeWidth={2.5} />}
          Cancelar
        </button>
      </div>
    </div>
  )
}
