import { useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Flashlight,
  FlashlightOff,
  Loader2,
  MapPinOff,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Volume2,
  WifiOff,
} from 'lucide-react'
import type { useLlamadaVoz } from '../../hooks/useLlamadaVoz'
import type { useLinterna, useSirena } from '../../hooks/useAutoproteccion'
import { formatoDuracion, type EstadoLlamada } from '../../lib/llamadas'
import { ModalPinCancelarSOS } from './PinSeguridad'
import AvisarContactos from './AvisarContactos'
import type { Contacto } from '../../store/usoSeguridad'

/** enviando → activa (esperando operador) → en_atencion; error si no llegó a la central. */
export type EstadoPantallaSOS = 'enviando' | 'activa' | 'en_atencion' | 'error'

interface Props {
  estado: EstadoPantallaSOS
  /** Primer nombre del operador asignado, si lo hay. */
  operadorNombre: string | null
  /** Sin GPS: la central no ve dónde estás. */
  sinUbicacion: boolean
  /** Llamada de voz con la central (si hay sesión). */
  llamada: { estado: EstadoLlamada | undefined; voz: ReturnType<typeof useLlamadaVoz> } | null
  chatNoLeidos: number
  sirena: ReturnType<typeof useSirena>
  linterna: ReturnType<typeof useLinterna>
  cancelando: boolean
  onAbrirChat: () => void
  onReintentarEnvio: () => void
  /** Oculta la pantalla (la alerta sigue activa) o la cierra si hubo error. */
  onOcultar: () => void
  /** Cancela con el PIN de seguridad. Devuelve un mensaje de error o null. */
  onCancelar: (pin: string) => Promise<string | null>
  /** La alerta abierta, para el link de seguimiento de los contactos. */
  alertaId: string | null
  contactos: Contacto[]
  /** Modo discreto: sin rojo que llame la atención y sin sirena ni linterna. */
  discreto: boolean
}

function capitalizar(nombre: string) {
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/**
 * Pantalla de SOS activo, pensada para el pánico: fondo oscuro (no fatiga),
 * una sola acción principal según el estado, autoprotección (sirena y
 * linterna) y las salidas (133 y cancelar con el PIN de seguridad).
 */
export default function PantallaSOS({
  estado,
  operadorNombre,
  sinUbicacion,
  llamada,
  chatNoLeidos,
  sirena,
  linterna,
  cancelando,
  onAbrirChat,
  onReintentarEnvio,
  onOcultar,
  onCancelar,
  alertaId,
  contactos,
  discreto,
}: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const abierta = estado === 'activa' || estado === 'en_atencion'
  const operador = operadorNombre ? capitalizar(operadorNombre) : null

  const subtitulo =
    estado === 'enviando'
      ? 'Enviando tu alerta a la central…'
      : estado === 'error'
        ? 'Tu alerta no llegó a la central'
        : estado === 'activa'
          ? 'Tu alerta llegó a la central. Buscando un operador…'
          : operador
            ? `Operador ${operador} ha recibido tu alerta`
            : 'Un operador ha recibido tu alerta'

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-titulo"
      aria-describedby="sos-subtitulo"
      className={`fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-white ${
        discreto ? '' : 'bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.16),transparent_55%)]'
      }`}
    >
      {/* Borde de transmisión: late mientras el SOS está activo */}
      <div
        className={`sticky top-0 z-10 h-1.5 ${
          estado === 'error'
            ? 'bg-amber-500'
            : discreto
              ? 'bg-slate-700'
              : 'bg-red-500 animate-pulse shadow-[0_0_18px_rgba(239,68,68,0.9)]'
        }`}
        aria-hidden
      />

      <div className="mx-auto flex min-h-[calc(100%-6px)] w-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* ── 1. Estado ── */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="sos-titulo"
              className={`flex items-center gap-2.5 text-[34px] font-black leading-none tracking-wide ${
                estado === 'error' ? 'text-amber-400' : discreto ? 'text-slate-200' : 'text-red-500'
              }`}
            >
              {estado !== 'error' && !discreto && (
                <span className="relative flex h-3.5 w-3.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
                </span>
              )}
              {estado === 'error' ? 'SOS NO ENVIADO' : 'SOS ACTIVO'}
            </h2>
            <p id="sos-subtitulo" className="mt-2 text-[17px] font-semibold leading-snug text-slate-100" aria-live="polite">
              {subtitulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onOcultar}
            aria-label={abierta ? 'Ocultar pantalla (la alerta sigue activa)' : 'Cerrar'}
            title={abierta ? 'Ocultar (la alerta sigue activa)' : 'Cerrar'}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronDown size={24} />
          </button>
        </header>

        {abierta && (
          <p
            className={`mt-3 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[13px] font-medium ${
              sinUbicacion ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {sinUbicacion ? (
              <>
                <MapPinOff size={15} /> Sin GPS: activa la ubicación del navegador
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> Tu ubicación se comparte en vivo
              </>
            )}
          </p>
        )}

        {/* ── 2. Comunicación ── */}
        <TarjetaComunicacion
          estado={estado}
          operador={operador}
          llamada={llamada}
          chatNoLeidos={chatNoLeidos}
          onAbrirChat={onAbrirChat}
          onReintentarEnvio={onReintentarEnvio}
          onContestar={() => {
            // Para hablar, la sirena estorba: se apaga al contestar.
            sirena.detener()
            void llamada?.voz.conectar()
          }}
        />

        {/* ── 3. Contactos: link para que vean dónde estás ── */}
        {abierta && <AvisarContactos tipo="sos" objetivo={alertaId ? { alertaId } : null} contactos={contactos} />}

        {/* ── 4. Autoprotección (no en modo discreto: la sirena y la luz delatan) ── */}
        {!discreto && (
        <section className="mt-7" aria-label="Autoprotección">
          <h3 className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Autoprotección</h3>
          <div className="mt-3 flex justify-center gap-10">
            <BotonHerramienta
              activo={sirena.activa}
              onClick={sirena.alternar}
              etiqueta={sirena.activa ? 'Apagar sirena' : 'Sirena'}
              claseActivo="bg-red-600 text-white shadow-[0_0_28px_rgba(239,68,68,0.85)] animate-pulse"
            >
              <Megaphone size={30} />
            </BotonHerramienta>
            <BotonHerramienta
              activo={linterna.modo === 'linterna' || linterna.modo === 'pantalla'}
              onClick={linterna.alternar}
              etiqueta={linterna.modo === 'apagada' ? 'Linterna' : linterna.modo === 'encendiendo' ? 'Encendiendo…' : 'Apagar luz'}
              claseActivo="bg-amber-400 text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.8)]"
            >
              {linterna.modo === 'encendiendo' ? (
                <Loader2 size={30} className="animate-spin" />
              ) : linterna.modo === 'apagada' ? (
                <Flashlight size={30} />
              ) : (
                <FlashlightOff size={30} />
              )}
            </BotonHerramienta>
          </div>
        </section>
        )}

        {/* ── 5. Salidas ── */}
        <div className="mt-auto pt-8">
          {/* Si el SOS no llegó a la central, el 133 pasa a ser la acción principal */}
          <a
            href="tel:133"
            className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border-2 text-[17px] font-bold text-white transition-colors ${
              estado === 'error'
                ? 'border-red-600 bg-red-600 shadow-[0_0_24px_rgba(239,68,68,0.55)] hover:bg-red-500'
                : 'border-red-500/80 hover:bg-red-500/10 active:bg-red-500/20'
            }`}
          >
            <Phone size={20} className={estado === 'error' ? 'text-white' : 'text-red-400'} /> Llamar al 133 (Carabineros)
          </a>
          {abierta ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={cancelando}
              className="mt-3 h-11 w-full text-[14px] font-medium text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline disabled:opacity-50"
            >
              {cancelando ? 'Cancelando…' : 'Estoy a salvo, cancelar alerta'}
            </button>
          ) : estado === 'error' ? (
            <button
              type="button"
              onClick={onOcultar}
              className="mt-3 h-11 w-full text-[14px] font-medium text-slate-400 hover:text-slate-200"
            >
              Cerrar
            </button>
          ) : null}
        </div>
      </div>

      {confirmando && (
        <ModalPinCancelarSOS
          onMantener={() => setConfirmando(false)}
          onVerificar={async (pin) => {
            const error = await onCancelar(pin)
            if (!error) setConfirmando(false)
            return error
          }}
        />
      )}

      {/* Sin flash disponible: la pantalla en blanco hace de linterna */}
      {linterna.modo === 'pantalla' && (
        <button
          type="button"
          onClick={linterna.apagar}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-white pb-[max(2.5rem,env(safe-area-inset-bottom))] text-[14px] font-medium text-slate-400"
        >
          Toca la pantalla para apagar la luz
        </button>
      )}
    </div>
  )
}

/* ──────────────── Tarjeta de comunicación (una acción principal) ──────────────── */

const BTN_PRINCIPAL =
  'flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-600 text-[17px] font-bold text-white shadow-[0_0_24px_rgba(37,99,235,0.45)] transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60'
const BTN_TEXTO = 'mt-2 h-11 w-full text-[15px] font-semibold text-blue-300 hover:text-blue-200'

function TarjetaComunicacion({
  estado,
  operador,
  llamada,
  chatNoLeidos,
  onAbrirChat,
  onReintentarEnvio,
  onContestar,
}: {
  estado: EstadoPantallaSOS
  operador: string | null
  llamada: Props['llamada']
  chatNoLeidos: number
  onAbrirChat: () => void
  onReintentarEnvio: () => void
  onContestar: () => void
}) {
  const voz = llamada?.voz
  const est = llamada?.estado
  const enSala = !!voz && (voz.fase === 'esperando' || voz.fase === 'conectada' || voz.fase === 'reconectando')
  // Sujeto ("Operador Ana te está llamando") y complemento ("Hablando con Ana").
  const quien = operador ? `Operador ${operador}` : 'La central'
  const conQuien = operador ?? 'la central'

  const badge =
    chatNoLeidos > 0 ? (
      <span className="ml-1 min-w-[22px] rounded-full bg-white px-1.5 text-[12px] font-bold leading-[22px] text-blue-700" aria-label={`${chatNoLeidos} mensajes sin leer`}>
        {chatNoLeidos}
      </span>
    ) : null
  const botonChat = (texto: string) => (
    <button type="button" onClick={onAbrirChat} className={BTN_PRINCIPAL}>
      <MessageCircle size={20} /> {texto}
      {badge}
    </button>
  )
  const linkChat = (
    <button type="button" onClick={onAbrirChat} className={BTN_TEXTO}>
      Abrir chat{chatNoLeidos > 0 ? ` (${chatNoLeidos})` : ''}
    </button>
  )

  let icono: ReactNode = <Phone size={22} />
  let titulo: string
  let texto: string | null = null
  let accion: ReactNode = null
  let tono: 'normal' | 'ok' | 'problema' = 'normal'

  if (estado === 'error') {
    icono = <WifiOff size={22} />
    tono = 'problema'
    titulo = 'No pudimos enviar tu alerta'
    texto = 'Reintentamos solos cada pocos segundos y apenas vuelva la señal. Si estás en peligro, llama ahora al 133.'
    accion = (
      <button type="button" onClick={onReintentarEnvio} className={BTN_PRINCIPAL}>
        <RotateCcw size={20} /> Reintentar envío
      </button>
    )
  } else if (estado === 'enviando') {
    icono = <Loader2 size={22} className="animate-spin" />
    titulo = 'Enviando tu alerta…'
    texto = 'Estamos avisando a la central con tu ubicación.'
  } else if (voz?.fase === 'conectando') {
    icono = <Loader2 size={22} className="animate-spin" />
    titulo = 'Conectando llamada…'
    if (voz.lento) {
      // A los 5 s se sugiere el plan B sin abandonar el intento.
      tono = 'problema'
      texto = 'La red móvil está inestable. Usa el chat o llama al 133.'
      accion = botonChat('Abrir Chat con Operador')
    } else {
      accion = linkChat
    }
  } else if (enSala && voz) {
    tono = voz.fase === 'reconectando' ? 'normal' : 'ok'
    icono = voz.fase === 'reconectando' ? <Loader2 size={22} className="animate-spin" /> : <Phone size={22} />
    titulo =
      voz.fase === 'reconectando'
        ? 'Reconectando…'
        : voz.fase === 'esperando'
          ? `Esperando a ${conQuien}…`
          : voz.duracion != null
            ? `En llamada · ${formatoDuracion(voz.duracion)}`
            : 'En llamada'
    texto = voz.fase === 'conectada' ? `Hablando con ${conQuien}` : null
    accion = (
      <>
        {voz.avisoMicrofono && (
          <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] leading-snug text-amber-200">{voz.avisoMicrofono}</p>
        )}
        {voz.audioBloqueado && (
          <button type="button" onClick={() => void voz.activarAudio()} className={`${BTN_PRINCIPAL} mb-3`}>
            <Volume2 size={20} /> Activar sonido
          </button>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void voz.alternarMicrofono()}
            aria-pressed={!voz.microfonoActivo}
            className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-colors ${
              voz.microfonoActivo ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-amber-500 text-slate-950'
            }`}
          >
            {voz.microfonoActivo ? <Mic size={20} /> : <MicOff size={20} />}
            {voz.microfonoActivo ? 'Silenciar' : 'Silenciado'}
          </button>
          <button
            type="button"
            onClick={() => void voz.colgar()}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 text-[16px] font-bold text-white transition-colors hover:bg-red-500"
          >
            <PhoneOff size={20} /> Colgar
          </button>
        </div>
        {linkChat}
      </>
    )
  } else if (est === 'connecting' && voz?.fase === 'inactiva') {
    tono = 'ok'
    titulo = `${quien} te está llamando`
    texto = 'Contesta para hablar por voz.'
    accion = (
      <>
        {/* Halo que late alrededor (el botón queda sólido: no parece desactivado) */}
        <button type="button" onClick={onContestar} className={`${BTN_PRINCIPAL} halo-llamada`}>
          <Phone size={20} /> Contestar llamada
        </button>
        <button type="button" onClick={onAbrirChat} className={BTN_TEXTO}>
          Prefiero escribir
        </button>
      </>
    )
  } else if (voz?.fase === 'error' || est === 'failed') {
    icono = <WifiOff size={22} />
    tono = 'problema'
    if (voz?.motivo === 'sin_configurar') {
      titulo = 'Llamadas de voz no disponibles'
      texto = 'La central aún no tiene habilitadas las llamadas. Usa el chat o llama al 133.'
    } else if (voz?.motivo === 'sin_https') {
      titulo = 'Micrófono bloqueado'
      texto = voz.error
    } else {
      titulo = 'Problemas de conexión de voz'
      texto = 'La red móvil está inestable. Usa el chat o llama al 133.'
    }
    // Reintentar no arregla una central sin configurar ni una página sin HTTPS.
    const puedeReintentar =
      (est === 'connecting' || est === 'active') && voz?.motivo !== 'sin_configurar' && voz?.motivo !== 'sin_https'
    accion = (
      <>
        {botonChat('Abrir Chat con Operador')}
        {puedeReintentar && voz && (
          <button type="button" onClick={onContestar} className={BTN_TEXTO}>
            Reintentar llamada
          </button>
        )}
      </>
    )
  } else if (estado === 'activa') {
    icono = <Loader2 size={22} className="animate-spin" />
    titulo = 'Buscando un operador…'
    texto = 'Tu alerta y tu ubicación ya están en la central. Puedes escribir mientras tanto.'
    accion = botonChat('Escribir a la central')
  } else {
    titulo = `${quien} está atendiendo tu alerta`
    texto = 'Ve tu ubicación en vivo. Si no puedes hablar, escríbele.'
    accion = botonChat('Abrir Chat con Operador')
  }

  return (
    <section
      className={`mt-6 rounded-3xl border p-5 ${
        tono === 'problema'
          ? 'border-amber-500/30 bg-amber-500/[0.07]'
          : tono === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
            : 'border-slate-800 bg-slate-900/80'
      }`}
      aria-label="Comunicación con la central"
    >
      <div className="flex items-start gap-3.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            tono === 'problema' ? 'bg-amber-500/15 text-amber-300' : tono === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'
          }`}
          aria-hidden
        >
          {icono}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-[19px] font-bold leading-tight tabular-nums">{titulo}</p>
          {texto && <p className="mt-1 text-[15px] leading-snug text-slate-300">{texto}</p>}
        </div>
      </div>
      {accion && <div className="mt-5">{accion}</div>}
    </section>
  )
}

/* ──────────────── Botón circular de autoprotección ──────────────── */

function BotonHerramienta({
  activo,
  onClick,
  etiqueta,
  claseActivo,
  children,
}: {
  activo: boolean
  onClick: () => void
  etiqueta: string
  claseActivo: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        aria-label={etiqueta}
        className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
          activo ? `border-transparent ${claseActivo}` : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500'
        }`}
      >
        {children}
      </button>
      <span className="text-[13px] font-semibold text-slate-300">{etiqueta}</span>
    </div>
  )
}
