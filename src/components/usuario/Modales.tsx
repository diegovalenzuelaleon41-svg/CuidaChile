import { CarFront, CheckCircle2, Crosshair, Eye, Loader2, MapPin, Siren, TriangleAlert } from 'lucide-react'
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

/* ── Bottom Sheet Reporte Comunitario ──────────────────────────────── */

export type CategoriaReporte = 'robo' | 'sospechoso' | 'accidente'
export type GravedadReporte = 'rojo' | 'amarillo' | 'azul'

export interface FormReporte {
  categoria: CategoriaReporte | ''
  gravedad: GravedadReporte | ''
  descripcion: string
}

const CATEGORIAS: { id: CategoriaReporte; etiqueta: string; Icono: typeof Siren }[] = [
  { id: 'robo', etiqueta: 'Robo', Icono: Siren },
  { id: 'sospechoso', etiqueta: 'Sospechoso', Icono: Eye },
  { id: 'accidente', etiqueta: 'Accidente', Icono: CarFront },
]

const GRAVEDADES: { id: GravedadReporte; etiqueta: string; color: string }[] = [
  { id: 'rojo', etiqueta: 'Alta', color: '#DC2626' },
  { id: 'amarillo', etiqueta: 'Media', color: '#F59E0B' },
  { id: 'azul', etiqueta: 'Info', color: '#2563EB' },
]

interface ModalReporteProps {
  form: FormReporte
  onForm: (patch: Partial<FormReporte>) => void
  coordsTxt: string
  ubicacionElegida: boolean
  guardando: boolean
  onSeleccionarUbicacion: () => void
  onCerrar: () => void
  onGuardar: () => void
}

export function ModalReporte({ form, onForm, coordsTxt, ubicacionElegida, guardando, onSeleccionarUbicacion, onCerrar, onGuardar }: ModalReporteProps) {
  const listo = form.categoria !== '' && form.gravedad !== ''
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onCerrar}>
      <div
        className="card w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 pb-8 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Reportar incidente"
      >
        <span className="mx-auto mb-3 block w-10 h-1.5 rounded-full bg-line" aria-hidden />
        <h3 className="text-[18px] font-bold text-heading dark:text-white flex items-center gap-2">
          <TriangleAlert size={20} className="text-[#DC2626]" /> Reportar incidente
        </h3>
        <p className="mt-1 text-[12px] text-faint dark:text-slate-500 tabular-nums">Se publica en {coordsTxt} · visible 6 h para la comunidad.</p>
        <button
          type="button"
          onClick={onSeleccionarUbicacion}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-[13px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
        >
          {ubicacionElegida ? <CheckCircle2 size={16} /> : <MapPin size={16} />}
          {ubicacionElegida ? 'Ubicación elegida en el mapa · cambiar' : 'Seleccionar ubicación en el mapa'}
        </button>

        <p className="label-cuida mt-4 mb-2">Categoría</p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIAS.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => onForm({ categoria: id })}
              aria-pressed={form.categoria === id}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[12px] font-semibold transition-colors ${
                form.categoria === id
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-muted dark:text-slate-400 hover:border-[#BFDBFE]'
              }`}
            >
              <Icono size={20} />
              {etiqueta}
            </button>
          ))}
        </div>

        <p className="label-cuida mt-4 mb-2">Gravedad</p>
        <div className="grid grid-cols-3 gap-2">
          {GRAVEDADES.map(({ id, etiqueta, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => onForm({ gravedad: id })}
              aria-pressed={form.gravedad === id}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-[12px] font-semibold transition-colors ${
                form.gravedad === id ? 'border-heading bg-heading text-white' : 'border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-muted dark:text-slate-400'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ background: color, boxShadow: form.gravedad === id ? '0 0 0 2px #fff' : 'none' }}
                aria-hidden
              />
              {etiqueta}
            </button>
          ))}
        </div>

        <label className="label-cuida mt-4 mb-2" htmlFor="rep-desc">
          Descripción <span className="font-normal text-faint dark:text-slate-500">(opcional)</span>
        </label>
        <textarea
          id="rep-desc"
          value={form.descripcion}
          onChange={(e) => onForm({ descripcion: e.target.value.slice(0, 280) })}
          placeholder="Ej: auto blanco rondando la esquina…"
          rows={2}
          className="input-cuida resize-none"
        />

        <div className="mt-6 flex gap-3">
          <button onClick={onCerrar} className="btn-secondary flex-1 py-3 text-[14px]">
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={!listo || guardando}
            className="btn-primary flex-1 py-3 text-[14px] !bg-sos hover:!bg-[#B91C1C] disabled:opacity-50"
          >
            {guardando ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal SOS ─────────────────────────────────────────────────────── */

/** enviando → activa (esperando operador) → en_atencion; error si no llegó a la central. */
export type EstadoModalSOS = 'enviando' | 'activa' | 'en_atencion' | 'error'

const TEXTO_SOS: Record<EstadoModalSOS, { titulo: string; detalle: string }> = {
  enviando: { titulo: 'Enviando alerta…', detalle: 'Estamos avisando a la central.' },
  activa: { titulo: 'Tu alerta fue enviada', detalle: 'La central ya la recibió. Un operador te contactará en segundos. Mantén la calma.' },
  en_atencion: { titulo: 'Un operador está contigo', detalle: 'Está viendo tu ubicación en vivo y te llamará. Mantén el teléfono a mano.' },
  error: { titulo: 'No pudimos enviar tu alerta', detalle: 'Revisa tu conexión. Si estás en peligro, llama ahora a Carabineros.' },
}

interface ModalSOSProps {
  estado: EstadoModalSOS
  /** Sin GPS: la central no ve dónde estás. */
  sinUbicacion: boolean
  cancelando: boolean
  onEntendido: () => void
  onCancelar: () => void
  onReintentar: () => void
}

export function ModalSOS({ estado, sinUbicacion, cancelando, onEntendido, onCancelar, onReintentar }: ModalSOSProps) {
  const { titulo, detalle } = TEXTO_SOS[estado]
  const abierta = estado === 'activa' || estado === 'en_atencion'
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      className="fixed inset-0 z-50 bg-sos text-white flex flex-col items-center justify-center gap-5 p-6 text-center"
    >
      {estado === 'enviando' ? (
        <Loader2 size={64} className="animate-spin" />
      ) : estado === 'error' ? (
        <TriangleAlert size={64} />
      ) : (
        <Siren size={64} className="animate-pulse" />
      )}
      <h2 className="text-[26px] font-bold">{titulo}</h2>
      <p className="text-[15px] opacity-90 max-w-[320px]">{detalle}</p>
      {abierta && sinUbicacion && (
        <p className="text-[13px] max-w-[320px] rounded-[10px] bg-black/20 px-4 py-2.5">
          No tenemos tu ubicación GPS. Activa la ubicación del navegador para que la central pueda encontrarte.
        </p>
      )}

      {estado === 'error' ? (
        <button onClick={onReintentar} className="mt-2 px-8 py-3.5 bg-white text-sos rounded-[10px] font-semibold">
          Reintentar
        </button>
      ) : (
        <button
          onClick={onEntendido}
          disabled={estado === 'enviando'}
          className="mt-2 px-8 py-3.5 bg-white text-sos rounded-[10px] font-semibold disabled:opacity-60"
        >
          Entendido
        </button>
      )}
      {/* Respaldo siempre visible: la app nunca reemplaza al número de emergencia. */}
      <a
        href="tel:133"
        className="px-6 py-3 rounded-[10px] border-2 border-white/80 font-semibold text-[15px] hover:bg-white/10 transition-colors"
      >
        Llamar al 133 (Carabineros)
      </a>
      {abierta && (
        <button
          onClick={onCancelar}
          disabled={cancelando}
          className="text-[13px] underline underline-offset-4 opacity-80 disabled:opacity-50"
        >
          {cancelando ? 'Cancelando…' : 'Cancelar alerta (fue un error)'}
        </button>
      )}
      {estado === 'error' && (
        <button onClick={onEntendido} className="text-[13px] underline underline-offset-4 opacity-80">
          Cerrar
        </button>
      )}
    </div>
  )
}
