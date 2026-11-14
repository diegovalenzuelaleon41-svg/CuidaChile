import { Loader2, ShieldCheck } from 'lucide-react'

interface Props {
  onClick: () => void
  /** Solicitud en curso: se expande y muestra "Buscando operador…". */
  buscando?: boolean
}

/**
 * Acción principal: pastilla azul neón con brillo (shimmer) en reposo.
 * Al solicitar, se expande levemente y pasa a "Buscando operador…".
 */
export default function BotonIniciarRuta({ onClick, buscando = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={buscando}
      aria-busy={buscando}
      className={`relative overflow-hidden w-full h-14 rounded-2xl bg-blue-600 border border-white/15 text-white text-[16px] font-bold flex items-center justify-center gap-2.5 [-webkit-tap-highlight-color:transparent] shadow-[0_0_22px_rgba(59,130,246,0.6),0_8px_24px_rgba(37,99,235,0.35)] transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${
        buscando ? 'scale-[1.02] cursor-wait' : 'hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.8),0_8px_24px_rgba(37,99,235,0.4)] active:scale-[0.97]'
      }`}
    >
      {!buscando && <span className="shimmer pointer-events-none absolute inset-0" aria-hidden />}
      {buscando ? (
        <>
          <Loader2 size={20} strokeWidth={2.5} className="animate-spin" />
          <span aria-live="polite" className="truncate">Buscando operador…</span>
        </>
      ) : (
        <>
          <ShieldCheck size={20} strokeWidth={2.5} />
          <span className="truncate">Iniciar Ruta Segura</span>
        </>
      )}
    </button>
  )
}
