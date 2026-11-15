import { Loader2, Mic, MicOff, Phone, PhoneOff, RotateCcw, Volume2, WifiOff } from 'lucide-react'
import type { useLlamadaVoz } from '../../hooks/useLlamadaVoz'
import { formatoDuracion, type EstadoLlamada } from '../../lib/llamadas'

type Voz = ReturnType<typeof useLlamadaVoz>

interface Props {
  voz: Voz
  /** Estado oficial de la sesión (call_sessions.status). */
  estadoSesion: EstadoLlamada | undefined
  /** "la central" / nombre del ciudadano. */
  nombreOtro: string
  /** Texto del botón para entrar a la sala ("Contestar", "Conectar audio"). */
  textoConectar: string
  /** Fondo donde va: el modal SOS (rojo) o el panel del operador (oscuro). */
  tono: 'rojo' | 'oscuro'
  /** Operador: volver a llamar tras un corte o fallo. */
  onVolverALlamar?: () => void
}

const ESTILOS = {
  rojo: {
    caja: 'bg-black/20 text-white',
    secundario: 'text-white/80',
    btnPrincipal: 'bg-white text-sos hover:bg-white/90',
    btnNeutro: 'bg-white/15 text-white hover:bg-white/25',
    btnApagado: 'bg-white text-sos',
    aviso: 'bg-black/25 text-amber-100',
  },
  oscuro: {
    caja: 'bg-slate-800/60 border border-slate-700/60 text-slate-100',
    secundario: 'text-slate-400',
    btnPrincipal: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]',
    btnNeutro: 'bg-slate-700/70 text-slate-100 hover:bg-slate-600/80',
    btnApagado: 'bg-amber-500 text-slate-950',
    aviso: 'bg-amber-500/10 border border-amber-500/30 text-amber-200',
  },
} as const

/**
 * Estado + controles de una llamada de voz (micrófono, colgar, reintentar).
 * Mismo componente para el ciudadano (modal SOS) y el operador (panel).
 */
export default function ControlesLlamada({ voz, estadoSesion, nombreOtro, textoConectar, tono, onVolverALlamar }: Props) {
  const e = ESTILOS[tono]
  const enSala = voz.fase === 'esperando' || voz.fase === 'conectada' || voz.fase === 'reconectando'
  const puedeConectar = (estadoSesion === 'connecting' || estadoSesion === 'active') && (voz.fase === 'inactiva' || voz.fase === 'error')
  const terminada = estadoSesion === 'ended' || estadoSesion === 'failed' || estadoSesion === 'cancelled'

  let titulo: string
  let detalle: string | null = null
  if (voz.fase === 'conectando') {
    titulo = 'Conectando llamada…'
    if (voz.lento) detalle = 'Está tardando más de lo normal: puede ser la red.'
  }
  else if (voz.fase === 'reconectando') {
    titulo = 'Reconectando…'
    detalle = 'Se perdió la señal. Estamos reintentando.'
  } else if (voz.fase === 'esperando') {
    titulo = `Esperando a ${nombreOtro}…`
    detalle = 'Ya estás en la llamada.'
  } else if (voz.fase === 'conectada') {
    titulo = voz.duracion != null ? `En llamada · ${formatoDuracion(voz.duracion)}` : 'En llamada'
    detalle = `Hablando con ${nombreOtro}`
  } else if (voz.fase === 'error') {
    titulo = 'No se pudo conectar la llamada'
    detalle = voz.error
  } else if (estadoSesion === 'connecting' || estadoSesion === 'active') {
    titulo = tono === 'rojo' ? `${nombreOtro.charAt(0).toUpperCase()}${nombreOtro.slice(1)} te está llamando` : 'Llamada lista'
    detalle = tono === 'rojo' ? 'Contesta para hablar por voz.' : `Conecta el audio para hablar con ${nombreOtro}.`
  } else if (terminada) {
    titulo = 'Llamada finalizada'
  } else {
    titulo = 'Sin llamada'
  }

  return (
    <div className={`w-full rounded-2xl p-3.5 text-left ${e.caja}`} role="group" aria-label="Llamada de voz">
      <div className="flex items-center gap-3">
        <span
          className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
            voz.fase === 'conectada' ? 'bg-emerald-500 text-white' : 'bg-white/10'
          }`}
          aria-hidden
        >
          {voz.fase === 'conectando' || voz.fase === 'reconectando' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : voz.fase === 'error' ? (
            <WifiOff size={18} />
          ) : (
            <Phone size={18} />
          )}
          {voz.fase === 'conectada' && (
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping [animation-duration:2s]" />
          )}
        </span>
        <div className="flex-1 min-w-0" aria-live="polite">
          <p className="text-[14px] font-bold leading-snug tabular-nums">{titulo}</p>
          {detalle && <p className={`text-[12px] leading-snug ${e.secundario}`}>{detalle}</p>}
        </div>
      </div>

      {voz.avisoMicrofono && enSala && (
        <p className={`mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-snug ${e.aviso}`}>{voz.avisoMicrofono}</p>
      )}

      {voz.audioBloqueado && enSala && (
        <button
          type="button"
          onClick={() => void voz.activarAudio()}
          className={`mt-2.5 w-full h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 ${e.btnNeutro}`}
        >
          <Volume2 size={17} /> Activar sonido
        </button>
      )}

      <div className="mt-3 flex gap-2">
        {puedeConectar && (
          <button
            type="button"
            onClick={() => void voz.conectar()}
            className={`flex-1 h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 transition-colors ${e.btnPrincipal}`}
          >
            {voz.fase === 'error' ? <RotateCcw size={18} /> : <Phone size={18} />}
            {voz.fase === 'error' ? 'Reintentar' : textoConectar}
          </button>
        )}

        {enSala && (
          <>
            <button
              type="button"
              onClick={() => void voz.alternarMicrofono()}
              aria-pressed={!voz.microfonoActivo}
              aria-label={voz.microfonoActivo ? 'Silenciar micrófono' : 'Activar micrófono'}
              className={`flex-1 h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors ${
                voz.microfonoActivo ? e.btnNeutro : e.btnApagado
              }`}
            >
              {voz.microfonoActivo ? <Mic size={18} /> : <MicOff size={18} />}
              {voz.microfonoActivo ? 'Silenciar' : 'Silenciado'}
            </button>
            <button
              type="button"
              onClick={() => void voz.colgar()}
              aria-label="Colgar"
              className="flex-1 h-12 rounded-xl bg-red-600 text-white text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-red-500 transition-colors"
            >
              <PhoneOff size={18} /> Colgar
            </button>
          </>
        )}

        {voz.fase === 'conectando' && (
          <button
            type="button"
            onClick={() => void voz.colgar()}
            className={`flex-1 h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 ${e.btnNeutro}`}
          >
            <PhoneOff size={18} /> Cancelar
          </button>
        )}

        {terminada && onVolverALlamar && (voz.fase === 'inactiva' || voz.fase === 'error') && (
          <button
            type="button"
            onClick={onVolverALlamar}
            className={`flex-1 h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 transition-colors ${e.btnPrincipal}`}
          >
            <Phone size={18} /> Volver a llamar
          </button>
        )}
      </div>
    </div>
  )
}
