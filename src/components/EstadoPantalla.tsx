import { AlertCircle, RotateCw } from 'lucide-react'

/** Pantalla completa de carga (sesión o rol). */
export function PantallaCarga() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950" role="status" aria-label="Cargando">
      <div className="w-10 h-10 rounded-full border-4 border-[#DBEAFE] border-t-[#2563EB] animate-spin" />
    </div>
  )
}

/** Pantalla completa de error con acción de reintento. */
export function PantallaError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 p-5">
      <div className="card p-8 max-w-[400px] w-full flex flex-col items-center text-center gap-4">
        <span className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
          <AlertCircle size={24} />
        </span>
        <p role="alert" className="text-[15px] text-[#1E293B] dark:text-slate-200">{mensaje}</p>
        {onReintentar && (
          <button type="button" onClick={onReintentar} className="btn-primary px-5 py-2.5 text-[14px]">
            <RotateCw size={16} /> Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
