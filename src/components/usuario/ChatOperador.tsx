import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Maximize2, MessageCircle, Minimize2, Phone, Route, Send, Siren, X } from 'lucide-react'
import type { ChatMsg } from '../../store/usoSeguridad'
import { OPERADOR_NOMBRE } from '../../lib/operador'

/* ── Utilidades de hora/fecha estilo WhatsApp ───────────────────────── */
function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function etiquetaDia(iso: string): string {
  try {
    const f = new Date(iso)
    const hoy = new Date()
    if (esMismoDia(f, hoy)) return 'Hoy'
    const ayer = new Date()
    ayer.setDate(hoy.getDate() - 1)
    if (esMismoDia(f, ayer)) return 'Ayer'
    return f.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

interface Props {
  abierto: boolean
  mensajes: ChatMsg[]
  onToggle: () => void
  onEnviar: (texto: string) => void
  /** Si es false, no muestra el FAB (se abre desde la card de ruta activa). */
  fab?: boolean
  /** 'acompanamiento' = operador en ruta · 'operador' = genérico / emergencia. */
  modo?: 'acompanamiento' | 'operador'
  /** Nombre del operador que acompaña (Capa 1). */
  nombreOperador?: string
  /** Foto de perfil del operador. Si falla, se usa la inicial. */
  fotoOperador?: string
  /** Muestra "está escribiendo…" mientras el operador prepara su respuesta. */
  escribiendo?: boolean
  /** Botón "Solicitar llamada" (acompañamiento). */
  onSolicitarLlamada?: () => void
  /** Botón inline "Activar SOS" cuando el operador sugiere el SOS. */
  onActivarSOS?: () => void
  /** true = última sesión finalizada → estado vacío, input bloqueado. */
  sesionFinalizada?: boolean
  /** Acción del botón "Iniciar nueva ruta" en estado finalizado. */
  onIniciarNuevaRuta?: () => void
}

/** Chat Fase 1: mensajes locales con un operador con nombre y foto. */
export default function ChatOperador({
  abierto, mensajes, onToggle, onEnviar, fab = true,
  modo = 'operador', nombreOperador = OPERADOR_NOMBRE, fotoOperador,
  escribiendo = false, onSolicitarLlamada, onActivarSOS,
  sesionFinalizada = false, onIniciarNuevaRuta,
}: Props) {
  const [input, setInput] = useState('')
  const [expandido, setExpandido] = useState(false)
  const [fotoError, setFotoError] = useState(false)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const enRuta = modo === 'acompanamiento'
  const nombreVisible = enRuta ? nombreOperador : 'Operador'

  // Hora actual del sistema para el header (se actualiza cada 30 s con el chat abierto)
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    if (!abierto) return
    setAhora(new Date())
    const t = window.setInterval(() => setAhora(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [abierto])
  const horaHeader = useMemo(
    () => ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    [ahora],
  )

  function enviar() {
    if (!input.trim() || sesionFinalizada) return
    onEnviar(input.trim())
    setInput('')
  }

  // Vista de historial de la sesión finalizada (solo lectura, opcional)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  // Al iniciar una nueva sesión se vuelve al chat vivo
  useEffect(() => {
    if (!sesionFinalizada) setMostrarHistorial(false)
  }, [sesionFinalizada])
  const verHistorial = sesionFinalizada && mostrarHistorial
  const estadoVacio = sesionFinalizada && !mostrarHistorial

  // Ir al último mensaje al abrir, con cada mensaje nuevo o al escribir.
  useEffect(() => {
    if (!abierto) return
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [abierto, mensajes, escribiendo])

  // Escape cierra el panel (solo cuando está abierto).
  useEffect(() => {
    if (!abierto) return
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle()
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [abierto, onToggle])

  return (
    <>
      {fab && (
        <button
          onClick={onToggle}
          aria-label="Chat con operador"
          className="fixed bottom-6 left-4 md:left-6 z-40 w-14 h-14 rounded-full bg-brand-600 text-white shadow-brand flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          {abierto ? <X size={22} /> : <MessageCircle size={22} />}
        </button>
      )}
      {abierto && (
        <div
          role="dialog"
          aria-label={`Chat con ${nombreVisible}`}
          className={`fixed bottom-24 left-4 md:left-6 z-40 card overflow-hidden flex flex-col transition-all ${
            expandido ? 'w-[min(430px,calc(100vw-2rem))] h-[min(62vh,540px)]' : 'w-[320px] max-w-[calc(100vw-2rem)]'
          }`}
        >
          {/* Header con foto y nombre del operador */}
          <div className="px-4 py-3 bg-brand-600 text-white flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {fotoOperador && !fotoError ? (
                <img
                  src={fotoOperador}
                  alt={`Foto de ${nombreVisible}`}
                  onError={() => setFotoError(true)}
                  className="w-9 h-9 rounded-full object-cover border border-white/40 shrink-0 bg-white/20"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-[16px] font-bold shrink-0" aria-hidden>
                  {nombreVisible.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight flex items-center gap-1.5">
                  {nombreVisible}
                  <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" aria-label="En línea" />
                </p>
                <p className="text-[11px] font-normal opacity-80 truncate">
                  {enRuta ? 'Acompañándote en tu ruta' : 'Fase 1: interfaz visual, mensajes locales'}
                  {' · '}
                  <span className="tabular-nums">{horaHeader} hrs</span>
                  {' · En línea'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpandido((v) => !v)}
                aria-label={expandido ? 'Contraer chat' : 'Expandir chat'}
                title={expandido ? 'Contraer' : 'Expandir'}
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                {expandido ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={onToggle}
                aria-label="Cerrar chat"
                title="Cerrar"
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div
            ref={listaRef}
            className={`overflow-y-auto p-3 flex flex-col gap-2 bg-canvas dark:bg-slate-900 ${
              expandido ? 'flex-1 min-h-0' : 'h-56'
            }`}
          >
            {estadoVacio ? (
              /* ── Sesión finalizada: estado vacío ── */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8 px-4">
                <span className="w-12 h-12 rounded-full bg-[#EFF6FF] dark:bg-slate-800 text-brand-600 dark:text-[#93C5FD] flex items-center justify-center">
                  <Route size={22} />
                </span>
                <p className="text-[14px] font-bold text-heading dark:text-white">Tu ruta anterior ha finalizado</p>
                <p className="text-[12px] text-muted dark:text-slate-400 leading-snug max-w-[240px]">
                  Inicia una nueva ruta para chatear con un operador.
                </p>
                {mensajes.length > 0 && (
                  <button
                    onClick={() => setMostrarHistorial(true)}
                    className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 dark:text-[#93C5FD] hover:text-brand-700"
                  >
                    <History size={14} /> Ver historial ({mensajes.length})
                  </button>
                )}
              </div>
            ) : (
              <>
                {verHistorial && (
                  <p className="self-center rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[10px] font-semibold px-3 py-1">
                    Historial finalizado · solo lectura
                  </p>
                )}
                {mensajes.length === 0 && !sesionFinalizada && (
                  <p className="text-[12px] text-faint dark:text-slate-500 text-center mt-4">Escríbenos, un operador te responderá.</p>
                )}
                {mensajes.map((m, i) => {
              const anterior = i > 0 ? mensajes[i - 1] : null
              const nuevoDia =
                !anterior ||
                !esMismoDia(new Date(anterior.creado_en), new Date(m.creado_en))
              const esMio = m.emisor === 'usuario'
              return (
                <div key={m.id} className="contents">
                  {nuevoDia && (
                    <p className="self-center rounded-full bg-heading/70 text-white text-[10px] font-semibold px-3 py-1 backdrop-blur">
                      {etiquetaDia(m.creado_en)}
                    </p>
                  )}
                  <div className={`max-w-[85%] flex flex-col ${esMio ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div
                      className={`rounded-xl px-3 pt-2 pb-1 text-[13px] break-words ${
                        esMio
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-700 border border-line dark:border-slate-600 rounded-bl-sm'
                      }`}
                    >
                      <span className="whitespace-pre-wrap">{m.contenido}</span>
                      <span
                        className={`mt-0.5 block text-right text-[10px] leading-none tabular-nums ${
                          esMio ? 'text-white/70' : 'text-gray-400'
                        }`}
                      >
                        {fmtHora(m.creado_en)}
                      </span>
                    </div>
                    {/* Sugerencia de SOS del operador: botón directo */}
                    {m.accion === 'sugerirSOS' && onActivarSOS && (
                      <button
                        onClick={onActivarSOS}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] border border-[#FECACA] px-3 py-1.5 text-[12px] font-semibold text-sos hover:bg-[#FEE2E2] transition-colors"
                      >
                        <Siren size={14} /> Activar SOS
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
                {verHistorial && (
                  <button
                    onClick={() => setMostrarHistorial(false)}
                    className="self-center text-[12px] font-semibold text-muted dark:text-slate-400 hover:text-heading dark:hover:text-white"
                  >
                    ← Volver
                  </button>
                )}
              </>
            )}
            {!sesionFinalizada && escribiendo && (
              <div className="self-start bg-white dark:bg-slate-700 border border-line dark:border-slate-600 rounded-xl px-3 py-2.5 flex items-center gap-1" aria-label={`${nombreVisible} está escribiendo`}>
                <span className="w-1.5 h-1.5 rounded-full bg-faint dark:bg-slate-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-faint dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-faint dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
          {sesionFinalizada ? (
            /* ── Sesión finalizada: input bloqueado →CTA nueva ruta ── */
            <div className="p-2 border-t border-line dark:border-slate-700">
              <button
                onClick={onIniciarNuevaRuta}
                disabled={!onIniciarNuevaRuta}
                className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50"
              >
                <Route size={16} /> Iniciar nueva ruta
              </button>
            </div>
          ) : (
          <div className="p-2 flex gap-2 border-t border-line dark:border-slate-700">
            {/* Llamada opcional (solo en acompañamiento) */}
            {enRuta && onSolicitarLlamada && (
              <button
                onClick={onSolicitarLlamada}
                aria-label="Solicitar llamada"
                title="Prefiero que me llamen"
                className="w-10 shrink-0 rounded-[10px] border border-[#E2E8F0] dark:border-slate-600 text-[#007AFF] dark:text-[#93C5FD] flex items-center justify-center hover:bg-[#EFF6FF] dark:hover:bg-slate-700 transition-colors"
              >
                <Phone size={17} />
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder={enRuta ? 'Cuéntame…' : 'Escribe un mensaje…'}
              className="input-cuida flex-1 !py-2 text-[14px]"
            />
            <button onClick={enviar} aria-label="Enviar mensaje" className="btn-primary w-10 !px-0">
              <Send size={17} />
            </button>
          </div>
          )}
        </div>
      )}
    </>
  )
}
