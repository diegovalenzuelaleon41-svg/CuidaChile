import type { RefObject } from 'react'
import { MapPin, Navigation, RefreshCw, Search } from 'lucide-react'

export type MapEstado = 'cargando' | 'listo' | 'error'
export type GpsEstado = 'pendiente' | 'ok' | 'denegado' | 'sin-soporte' | 'error'

interface Props {
  mapRef: RefObject<HTMLDivElement | null>
  mapEstado: MapEstado
  gpsEstado: GpsEstado
  detalle?: string | null
  onReintentar: () => void
  onBuscarManual: () => void
}

/**
 * Mapa full-bleed: ocupa el 100% de su contenedor (el fondo de la pantalla).
 * El div del mapa SIEMPRE se monta (para permitir reintentos); los estados
 * cargando/error son overlays con pointer-events controlados para no matar
 * los gestos (drag/pinch) cuando el mapa está vivo.
 */
export default function MapaSeguro({ mapRef, mapEstado, gpsEstado, detalle, onReintentar, onBuscarManual }: Props) {
  return (
    <>
      <div
        ref={mapRef}
        className="absolute inset-0 z-0"
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Mapa de tu ubicación"
      />

      {mapEstado === 'cargando' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F1F5F9] dark:bg-slate-950 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-[#64748B] dark:text-slate-400">
            <span className="w-8 h-8 rounded-full border-[3px] border-[#2563EB]/20 border-t-[#2563EB] animate-spin" aria-hidden />
            <p className="text-[13px] font-medium">Cargando mapa…</p>
          </div>
        </div>
      )}

      {mapEstado === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F1F5F9]/95 dark:bg-slate-950/95 p-4">
          <div className="card w-full max-w-[360px] p-5 text-center">
            <span className="mx-auto w-11 h-11 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <MapPin size={20} />
            </span>
            <h3 className="mt-3 text-[15px] font-bold text-heading dark:text-white">Mapa no disponible</h3>
            <p className="mt-1 text-[13px] text-muted dark:text-slate-400 leading-snug">
              {gpsEstado === 'denegado'
                ? 'Revisa tu conexión y el permiso de ubicación para ver el mapa interactivo.'
                : 'No pudimos cargar los mosaicos. Tu ubicación y el buscador siguen funcionando.'}
            </p>
            {detalle && (
              <p className="mt-2 rounded-lg bg-canvas dark:bg-slate-800 px-3 py-2 text-[11px] text-muted dark:text-slate-400 leading-snug">
                Detalle: {detalle}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={onReintentar} className="btn-secondary flex-1 py-2.5 text-[13px]">
                <RefreshCw size={15} /> Reintentar
              </button>
              <button onClick={onBuscarManual} className="btn-primary flex-1 py-2.5 text-[13px]">
                <Search size={15} /> Buscar destino
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-faint dark:text-slate-500">
              <Navigation size={11} /> Consejo: toca el mapa para fijar tu destino cuando vuelva
            </p>
          </div>
        </div>
      )}
    </>
  )
}
