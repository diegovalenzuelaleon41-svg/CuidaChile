import { MapPin } from 'lucide-react'
import type { RutaHistorial } from '../../store/usoSeguridad'

export default function HistorialLista({ historial }: { historial: RutaHistorial[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-[16px] font-bold text-heading dark:text-white mb-3">Historial de rutas</h2>
      {historial.length === 0 ? (
        <p className="text-[13px] text-muted dark:text-slate-400">Sin rutas registradas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {historial.map((r) => (
            <li key={r.id} className="rounded-xl border border-line dark:border-slate-700 p-3 flex items-center gap-3">
              <MapPin size={18} className="text-brand-600 dark:text-[#93C5FD] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-heading dark:text-white truncate">{r.origen} → {r.destino}</p>
                <p className="text-[12px] text-muted dark:text-slate-400">
                  {new Date(r.inicio).toLocaleDateString('es-CL')} · {r.estado}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
