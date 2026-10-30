import { useEffect, useRef, useState } from 'react'
import { Headset, Loader2, Send, X } from 'lucide-react'
import { MAX_MENSAJE, type EstadoAcompanamiento, type MensajeChat } from '../../lib/acompanamientos'

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  estado: EstadoAcompanamiento
  mensajes: MensajeChat[]
  cargando: boolean
  error: string | null
  /** Devuelve un mensaje de error o null. */
  onEnviar: (texto: string) => Promise<string | null>
}

/**
 * Chat real con el operador de la central (panel deslizable desde abajo).
 * Los mensajes viven en Supabase (tabla mensajes) y llegan por Realtime.
 */
export default function ChatConOperador({ abierto, onCerrar, estado, mensajes, cargando, error, onEnviar }: Props) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const conectado = estado === 'EN_CURSO'
  const puedeEnviar = texto.trim().length > 0 && !enviando

  // Ir al último mensaje al abrir y con cada mensaje nuevo.
  useEffect(() => {
    if (!abierto) return
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [abierto, mensajes.length])

  // Escape cierra; al abrir, foco en el campo.
  const onCerrarRef = useRef(onCerrar)
  useEffect(() => {
    onCerrarRef.current = onCerrar
  })
  useEffect(() => {
    if (!abierto) return
    inputRef.current?.focus()
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrarRef.current()
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [abierto])

  async function enviar() {
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorEnvio(null)
    const err = await onEnviar(texto)
    setEnviando(false)
    if (err) setErrorEnvio(err)
    else setTexto('')
  }

  if (!abierto) return null

  return (
    <div
      role="dialog"
      aria-label="Chat con la central"
      className="fixed inset-x-0 bottom-20 z-50 px-3 sm:left-4 sm:right-auto sm:px-0"
    >
      <div className="card mx-auto flex h-[min(60vh,520px)] w-full max-w-md flex-col overflow-hidden sm:w-[380px]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 bg-brand-600 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20" aria-hidden>
              <Headset size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight">Central CuidaChile</p>
              <p className="flex items-center gap-1.5 text-[11px] opacity-85">
                <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-[#34C759] animate-pulse' : 'bg-white/60'}`} aria-hidden />
                {conectado ? 'Operador conectado' : 'Buscando operador…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar chat"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          >
            <X size={17} />
          </button>
        </div>

        {/* Mensajes */}
        <div ref={listaRef} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-canvas p-3 dark:bg-slate-900" aria-live="polite">
          {cargando ? (
            <p className="m-auto flex items-center gap-2 text-[12px] text-faint dark:text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Cargando mensajes…
            </p>
          ) : mensajes.length === 0 ? (
            <p className="m-auto max-w-[240px] text-center text-[12px] leading-snug text-faint dark:text-slate-500">
              {conectado
                ? 'Tu operador está en línea. Escríbele si necesitas algo.'
                : 'Puedes escribir ahora: el operador verá tus mensajes al conectarse.'}
            </p>
          ) : (
            mensajes.map((m) => {
              const esMio = m.emisor_rol === 'usuario'
              return (
                <div key={m.id} className={`flex max-w-[85%] flex-col ${esMio ? 'items-end self-end' : 'items-start self-start'}`}>
                  {!esMio && (
                    <span className="mb-0.5 px-1 text-[10px] font-semibold text-muted dark:text-slate-400">Operador</span>
                  )}
                  <div
                    className={`break-words rounded-xl px-3 py-2 text-[13px] ${
                      esMio
                        ? 'rounded-br-sm bg-brand-600 text-white'
                        : 'rounded-bl-sm border border-line bg-white text-ink dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                    }`}
                  >
                    <span className="whitespace-pre-wrap">{m.contenido}</span>
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] tabular-nums text-faint dark:text-slate-500">{fmtHora(m.creado_en)}</span>
                </div>
              )
            })
          )}
        </div>

        {(errorEnvio || error) && (
          <p role="alert" className="border-t border-line bg-[#FEF2F2] px-3 py-1.5 text-[12px] text-sos dark:border-slate-700 dark:bg-[#DC2626]/10">
            {errorEnvio ?? error}
          </p>
        )}

        {/* Entrada */}
        <form
          className="flex items-end gap-2 border-t border-line p-2 dark:border-slate-700"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <label htmlFor="chat-usuario-texto" className="sr-only">Mensaje para el operador</label>
          <textarea
            id="chat-usuario-texto"
            ref={inputRef}
            rows={1}
            value={texto}
            maxLength={MAX_MENSAJE}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter hace salto de línea.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviar()
              }
            }}
            placeholder="Escribe un mensaje…"
            className="input-cuida max-h-28 flex-1 resize-none !py-2 text-[14px]"
          />
          <button
            type="submit"
            disabled={!puedeEnviar}
            aria-label="Enviar mensaje"
            className="btn-primary h-10 w-10 shrink-0 !px-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </form>
      </div>
    </div>
  )
}
