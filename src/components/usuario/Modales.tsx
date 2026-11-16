import { CheckCircle2, Crosshair, Loader2, MapPin } from 'lucide-react'
import type { ResultadoGeo } from '../../lib/geocoding'

/* ── Modal Ruta Segura ─────────────────────────────────────────────── */

interface ModalRutaProps {
  dirActual: string | null
  pos: [number, number]
  acc: number | null
  origen: string
  origenSel: ResultadoGeo | null
  sugsOrigen: ResultadoGeo[]
  buscandoOrigen: boolean
  destino: string
  sugs: ResultadoGeo[]
  buscando: boolean
  destSel: ResultadoGeo | null
  onOrigenChange: (v: string) => void
  onElegirOrigen: (s: ResultadoGeo) => void
  onUsarGps: () => void
  onDestinoChange: (v: string) => void
  onElegir: (s: ResultadoGeo) => void
  onCerrar: () => void
  onConfirmar: () => void
  /** Cierra el modal y activa el pin central para elegir el destino en el mapa. */
  onElegirEnMapa: () => void
}

export function ModalRuta({
  dirActual, pos, acc, origen, origenSel, sugsOrigen, buscandoOrigen,
  destino, sugs, buscando, destSel,
  onOrigenChange, onElegirOrigen, onUsarGps,
  onDestinoChange, onElegir, onCerrar, onConfirmar, onElegirEnMapa,
}: ModalRutaProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onCerrar}>
      <div className="card w-full max-w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-bold text-heading dark:text-white">Iniciar Ruta Segura</h3>
        <div className="mt-4 mb-2 flex items-center justify-between gap-2">
          <label className="label-cuida !mt-0 !mb-0" htmlFor="origen">Origen (tu ubicación exacta)</label>
          <button
            type="button"
            onClick={onUsarGps}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-[#93C5FD] hover:text-brand-700 shrink-0"
          >
            <Crosshair size={13} /> Usar mi GPS
          </button>
        </div>
        <div className="relative">
          <input
            id="origen"
            value={origen}
            onChange={(e) => onOrigenChange(e.target.value)}
            placeholder={dirActual ?? 'Ej: Av. Libertador 1234'}
            className="input-cuida pr-10"
            autoComplete="off"
            role="combobox"
            aria-expanded={sugsOrigen.length > 0}
            aria-controls="sugs-origen"
          />
          {buscandoOrigen && (
            <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-600 dark:text-[#93C5FD]" />
          )}
          {sugsOrigen.length > 0 && (
            <ul id="sugs-origen" role="listbox" className="absolute z-10 mt-1 w-full card overflow-hidden !rounded-[10px] max-h-56 overflow-y-auto">
              {sugsOrigen.map((s) => (
                <li key={`${s.lat},${s.lng}`}>
                  <button
                    type="button" role="option" aria-selected={origenSel?.lat === s.lat && origenSel?.lng === s.lng}
                    onClick={() => onElegirOrigen(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-slate-700 flex items-start gap-2"
                  >
                    <MapPin size={16} className="text-brand-600 dark:text-[#93C5FD] shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-medium text-heading dark:text-white">{s.etiqueta}</span>
                      <span className="block text-[11px] text-faint dark:text-slate-500 tabular-nums">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {origenSel ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#059669]">
            <CheckCircle2 size={15} /> Origen exacto:{' '}
            <span className="tabular-nums">{origenSel.lat.toFixed(5)}, {origenSel.lng.toFixed(5)}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-faint dark:text-slate-500 tabular-nums">
            GPS: {pos[1].toFixed(5)}, {pos[0].toFixed(5)}{acc != null ? ` · ±${Math.round(acc)} m` : ''}
            {' '}· escribe para corregir la dirección exacta.
          </p>
        )}
        <div className="mt-4 mb-2 flex items-center justify-between gap-2">
          <label className="label-cuida !mt-0 !mb-0" htmlFor="destino">Destino</label>
          <button
            type="button"
            onClick={onElegirEnMapa}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-[#93C5FD] hover:text-brand-700 shrink-0"
          >
            <MapPin size={13} /> Elegir en el mapa
          </button>
        </div>
        <div className="relative">
          <input
            id="destino" value={destino} onChange={(e) => onDestinoChange(e.target.value)}
            placeholder="Ej: Av. Providencia 1200" className="input-cuida pr-10" autoFocus
            role="combobox" aria-expanded={sugs.length > 0} aria-controls="sugs-destino" autoComplete="off"
          />
          {buscando && (
            <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-600 dark:text-[#93C5FD]" />
          )}
          {sugs.length > 0 && (
            <ul id="sugs-destino" role="listbox" className="absolute z-10 mt-1 w-full card overflow-hidden !rounded-[10px] max-h-56 overflow-y-auto">
              {sugs.map((s) => (
                <li key={`${s.lat},${s.lng}`}>
                  <button
                    type="button" role="option" aria-selected={destSel?.lat === s.lat && destSel?.lng === s.lng}
                    onClick={() => onElegir(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-slate-700 flex items-start gap-2"
                  >
                    <MapPin size={16} className="text-brand-600 dark:text-[#93C5FD] shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-medium text-heading dark:text-white">{s.etiqueta}</span>
                      <span className="block text-[11px] text-faint dark:text-slate-500 tabular-nums">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {destSel ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#059669]">
            <CheckCircle2 size={15} /> Ubicación exacta:{' '}
            <span className="tabular-nums">{destSel.lat.toFixed(5)}, {destSel.lng.toFixed(5)}</span>
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-faint dark:text-slate-500">
            Selecciona una sugerencia para guardar las coordenadas exactas del destino.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={onCerrar} className="btn-secondary flex-1 py-3 text-[14px]">Cancelar</button>
          <button onClick={onConfirmar} disabled={!destino.trim()} className="btn-primary flex-1 py-3 text-[14px] disabled:opacity-50">
            Activar tracking
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal Contacto ────────────────────────────────────────────────── */

export interface FormContacto {
  nombre: string
  telefono: string
  relacion: string
}

interface ModalContactoProps {
  form: FormContacto
  onForm: (patch: Partial<FormContacto>) => void
  onCerrar: () => void
  onGuardar: () => void
}

export function ModalContacto({ form, onForm, onCerrar, onGuardar }: ModalContactoProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onCerrar}>
      <div className="card w-full max-w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-bold text-heading dark:text-white">Agregar contacto</h3>
        <label className="label-cuida mt-4 mb-2" htmlFor="cn">Nombre</label>
        <input id="cn" value={form.nombre} onChange={(e) => onForm({ nombre: e.target.value })} className="input-cuida" placeholder="Nombre" />
        <label className="label-cuida mt-4 mb-2" htmlFor="ct">Teléfono</label>
        <input id="ct" value={form.telefono} onChange={(e) => onForm({ telefono: e.target.value })} className="input-cuida" placeholder="+56912345678" />
        <label className="label-cuida mt-4 mb-2" htmlFor="cr">Relación</label>
        <select id="cr" value={form.relacion} onChange={(e) => onForm({ relacion: e.target.value })} className="input-cuida">
          <option value="familia">Familia</option>
          <option value="amigo">Amigo/a</option>
          <option value="pareja">Pareja</option>
          <option value="vecino">Vecino/a</option>
          <option value="otro">Otro</option>
        </select>
        <div className="mt-6 flex gap-3">
          <button onClick={onCerrar} className="btn-secondary flex-1 py-3 text-[14px]">Cancelar</button>
          <button onClick={onGuardar} className="btn-primary flex-1 py-3 text-[14px]">Guardar</button>
        </div>
      </div>
    </div>
  )
}
