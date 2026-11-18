import { Navigation, Phone, Shield, Trash2, X, type LucideIcon } from 'lucide-react'
import { CATEGORIAS_REPORTE, ETIQUETA_CATEGORIA, type CategoriaReporte, type EstadoReporte } from '../../lib/reportes'
import { ETIQUETA_AYUDA, type LugarAyuda } from '../../lib/lugaresAyuda'
import { distanciaTexto, ICONO_AYUDA } from '../../lib/entorno'

export type ItemMapa =
  | {
      tipo: 'aviso'
      id: string
      categoria: CategoriaReporte
      descripcion: string | null
      creadoEn: string
      estado: EstadoReporte
      propio: boolean
      color: string
    }
  | { tipo: 'ayuda'; id: string; lugar: LugarAyuda }

function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.round(min / 60)} h`
}

function mesRevision(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}

/**
 * Tarjeta de vidrio al tocar algo en el mapa. Dice de dónde sale cada dato: un aviso validado por
 * la central, un reporte propio en revisión, o un lugar de OpenStreetMap (no verificado por nosotros).
 */
export default function TarjetaMapa({
  item,
  distanciaM,
  onCerrar,
  onComoLlegar,
  onEliminar,
}: {
  item: ItemMapa
  distanciaM: number | null
  onCerrar: () => void
  /** null: hay una ruta en curso, no se puede trazar otra. */
  onComoLlegar: ((lugar: LugarAyuda) => void) | null
  onEliminar: (id: string) => void
}) {
  const distancia = distanciaTexto(distanciaM)

  let Icono: LucideIcon
  let color: string
  let categoria: string
  let titulo: string
  let estado: string
  let detalle: string | null = null
  let pie: string
  if (item.tipo === 'aviso') {
    Icono = CATEGORIAS_REPORTE.find((c) => c.id === item.categoria)?.Icono ?? Shield
    color = item.color
    categoria = item.propio && item.estado === 'pendiente' ? 'Tu reporte' : 'Aviso de vecinos'
    titulo = ETIQUETA_CATEGORIA[item.categoria]
    estado =
      item.estado === 'pendiente'
        ? `En revisión por la central · solo tú lo ves · ${hace(item.creadoEn)}`
        : `Validado por la central · ${hace(item.creadoEn)}`
    detalle = item.descripcion
    pie = item.estado === 'pendiente' ? 'Si la central lo valida, tus vecinos lo verán.' : 'Zona aproximada. Las rutas de CuidaChile la esquivan.'
  } else {
    const l = item.lugar
    Icono = ICONO_AYUDA[l.tipo]
    color = '#22D3EE'
    categoria = 'Ayuda cercana'
    titulo = l.nombre
    estado = ETIQUETA_AYUDA[l.tipo]
    detalle = l.direccion
    const mes = mesRevision(l.revisado_en)
    pie = `Fuente: OpenStreetMap${mes ? ` · revisado en ${mes}` : ''}. Si es urgente, llama al ${l.tipo === 'bomberos' ? '132' : l.tipo === 'salud' ? '131' : '133'}.`
  }

  return (
    <section
      className="tarjeta-mapa pointer-events-auto w-full max-w-[440px] mx-auto rounded-3xl border border-white/10 bg-slate-900/85 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      aria-label={`${categoria}: ${titulo}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${color}26`, color }}
          aria-hidden
        >
          <Icono size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
            {categoria}
          </p>
          <h2 className="mt-0.5 text-[16px] font-bold leading-snug">{titulo}</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
            {estado}
            {distancia ? ` · ${distancia}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {detalle && <p className="mt-3 text-[14px] leading-snug text-slate-200">{detalle}</p>}

      {item.tipo === 'ayuda' && (
        <div className="mt-3 flex gap-2">
          {onComoLlegar && (
          <button
            type="button"
            onClick={() => onComoLlegar(item.lugar)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-[14px] font-bold transition-colors hover:bg-blue-500 active:scale-[0.98]"
          >
            <Navigation size={16} /> Cómo llegar
          </button>
          )}
          {item.lugar.telefono && (
            <a
              href={`tel:${item.lugar.telefono.replace(/[^\d+]/g, '')}`}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-[14px] font-semibold text-slate-100 transition-colors hover:bg-white/10"
            >
              <Phone size={16} /> Llamar
            </a>
          )}
        </div>
      )}
      {item.tipo === 'aviso' && item.propio && (
        <button
          type="button"
          onClick={() => onEliminar(item.id)}
          className="mt-3 flex h-10 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-[13px] font-semibold text-red-300 transition-colors hover:bg-red-500/10"
        >
          <Trash2 size={15} /> Eliminar mi reporte
        </button>
      )}

      <p className="mt-3 text-[11px] leading-snug text-slate-500">{pie}</p>
    </section>
  )
}
