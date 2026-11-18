import { ChevronRight, X, type LucideIcon } from 'lucide-react'
import { distanciaTexto } from '../../lib/entorno'

export interface FilaEntorno {
  clave: string
  titulo: string
  subtitulo: string
  color: string
  Icono: LucideIcon
  distanciaM: number | null
}

/**
 * "Ver como lista": lo mismo que muestra el mapa, ordenado por distancia. Es la forma accesible de
 * explorar (lector de pantalla, poca visión o simplemente sin ganas de mover el mapa).
 */
export default function ListaEntorno({
  filas,
  onElegir,
  onCerrar,
}: {
  filas: FilaEntorno[]
  onElegir: (clave: string) => void
  onCerrar: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lista-entorno-titulo"
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-slate-900 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="lista-entorno-titulo" className="text-[17px] font-bold">
              Tu entorno
            </h2>
            <p className="text-[12px] text-slate-400">Lo que muestra el mapa, del más cercano al más lejano</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {filas.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] leading-snug text-slate-400">
            No hay nada que mostrar con los filtros que elegiste.
          </p>
        ) : (
          <ul className="overflow-y-auto px-2 py-2">
            {filas.map((f) => (
              <li key={f.clave}>
                <button
                  type="button"
                  onClick={() => onElegir(f.clave)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${f.color}26`, color: f.color }}
                    aria-hidden
                  >
                    <f.Icono size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{f.titulo}</span>
                    <span className="block truncate text-[12px] text-slate-400">
                      {f.subtitulo}
                      {f.distanciaM != null ? ` · ${distanciaTexto(f.distanciaM)}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
