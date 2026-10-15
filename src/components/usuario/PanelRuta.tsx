import { useState } from 'react'
import { Play, Square, Share2, CheckCircle2 } from 'lucide-react'

export interface RutaPanel {
  origen: string
  destino: string
  inicioEpoch: number
}

interface Props {
  ruta: RutaPanel | null
  elapsed: string
  ahoraHora: string
  distanciaKm: string | null
  etaHora: string | null
  pos: [number, number]
  onIniciar: () => void
  onTerminar: () => void
  onSOS: () => void
  onAvisar: (msg: string) => void
}

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function PanelRuta({
  ruta, elapsed, ahoraHora, distanciaKm, etaHora, pos, onIniciar, onTerminar, onSOS, onAvisar,
}: Props) {
  const [vivo, setVivo] = useState(false)

  function toggleVivo() {
    const next = !vivo
    setVivo(next)
    if (!next) return
    const link = `https://maps.google.com/?q=${pos[1].toFixed(5)},${pos[0].toFixed(5)}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`Estoy en ruta segura — CuidaChile: ${link}`).then(
        () => onAvisar('Enlace en vivo copiado. Compártelo con tu círculo.'),
        () => onAvisar('Enlace listo para compartir.'),
      )
    } else {
      onAvisar('Enlace listo para compartir.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* SOS */}
      <div className="card p-5 border-sos/20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint dark:text-slate-500">
          Emergencia
        </p>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={onSOS}
            aria-label="Botón de pánico SOS. Un solo toque, sin confirmación."
            className="relative w-[72px] h-[72px] rounded-full bg-sos text-white border-4 border-white shadow-[0_8px_24px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
          >
            <span className="text-[19px] font-bold leading-[1.1] tracking-widest">SOS</span>
            <span className="text-[8px] uppercase leading-[1.1] opacity-90">1 toque</span>
          </button>
          <p className="text-[13px] text-muted dark:text-slate-400 leading-relaxed">
            Un toque, sin confirmación. Un operador te contactará en segundos.
          </p>
        </div>
      </div>

      {/* Mi ruta */}
      <div className="card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint dark:text-slate-500">
          Mi ruta
        </p>
        {ruta ? (
          <>
            <p className="mt-2 text-[15px] font-bold text-heading dark:text-white">
              {ruta.origen} <span className="text-muted dark:text-slate-400 font-medium">→</span> {ruta.destino}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted dark:text-slate-400">
              <span className="font-bold text-brand-600 dark:text-[#93C5FD] tabular-nums">{elapsed}</span>
              {distanciaKm && <span className="tabular-nums">{distanciaKm} km</span>}
              {etaHora && <span>Llegada ~{etaHora}</span>}
            </div>
            {/* Timeline */}
            <ol className="mt-4 flex flex-col gap-0">
              {[
                { t: hora(ruta.inicioEpoch), label: 'Inicio de ruta', dot: 'bg-ok', done: true },
                { t: ahoraHora, label: 'Tu posición ahora', dot: 'bg-brand-600', done: true },
                { t: etaHora ?? '—', label: 'Destino', dot: 'bg-sos', done: false },
              ].map((h, i, arr) => (
                <li key={h.label} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className={`w-3 h-3 rounded-full ${h.dot} mt-1`} />
                    {i < arr.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                  </span>
                  <span className="pb-4">
                    <span className="block text-[13px] font-semibold text-heading dark:text-white">{h.label}</span>
                    <span className="block text-[12px] text-muted dark:text-slate-400 tabular-nums">{h.t}</span>
                  </span>
                </li>
              ))}
            </ol>
            <button
              onClick={toggleVivo}
              aria-pressed={vivo}
              className={`w-full py-2.5 rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-all ${
                vivo ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]' : 'btn-secondary'
              }`}
            >
              {vivo ? <CheckCircle2 size={16} /> : <Share2 size={16} />}
              {vivo ? 'Compartiendo en vivo' : 'Compartir en vivo'}
            </button>
            <button onClick={onTerminar} className="btn-primary w-full py-3 text-[14px] mt-3">
              <Square size={16} /> Finalizar Ruta · <span className="tabular-nums">{elapsed}</span>
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] text-muted dark:text-slate-400">
              Sin ruta activa. Actívala para compartir tu trayecto con tu círculo.
            </p>
            <button onClick={onIniciar} className="btn-primary w-full py-3.5 text-[15px] mt-4">
              <Play size={18} /> Iniciar Ruta Segura
            </button>
          </>
        )}
      </div>
    </div>
  )
}
