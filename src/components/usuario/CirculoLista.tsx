import { Phone, Share2, Trash2, Plus } from 'lucide-react'
import type { Contacto } from '../../store/usoSeguridad'

interface Props {
  contactos: Contacto[]
  onAgregar: () => void
  onCompartir: (c: Contacto) => void
  onEliminar: (id: string) => void
}

export default function CirculoLista({ contactos, onAgregar, onCompartir, onEliminar }: Props) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold text-heading dark:text-white">Círculo de confianza ({contactos.length}/5)</h2>
        <button
          onClick={onAgregar}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 dark:text-[#93C5FD] hover:underline underline-offset-4"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>
      {contactos.length === 0 ? (
        <p className="text-[13px] text-muted dark:text-slate-400 rounded-xl border border-dashed border-line dark:border-slate-700 p-4 text-center">
          Aún no tienes contactos. Agrega hasta 5 personas de confianza.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contactos.map((c) => (
            <li key={c.id} className="rounded-xl border border-line dark:border-slate-700 p-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-[#93C5FD] font-bold flex items-center justify-center shrink-0">
                {c.nombre.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-heading dark:text-white truncate">{c.nombre}</p>
                <p className="text-[12px] text-muted dark:text-slate-400">{c.relacion} · {c.telefono}</p>
              </div>
              <a
                href={`tel:${c.telefono}`}
                aria-label={`Llamar a ${c.nombre}`}
                className="w-9 h-9 rounded-full hover:bg-brand-50 dark:hover:bg-slate-700 text-brand-600 dark:text-[#93C5FD] flex items-center justify-center transition-colors"
              >
                <Phone size={17} />
              </a>
              <button
                onClick={() => onCompartir(c)}
                aria-label="Enviar ubicación"
                className="w-9 h-9 rounded-full hover:bg-brand-50 dark:hover:bg-slate-700 text-brand-600 dark:text-[#93C5FD] flex items-center justify-center transition-colors"
              >
                <Share2 size={17} />
              </button>
              <button
                onClick={() => onEliminar(c.id)}
                aria-label="Eliminar contacto"
                className="w-9 h-9 rounded-full hover:bg-[#FEF2F2] text-sos flex items-center justify-center transition-colors"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
