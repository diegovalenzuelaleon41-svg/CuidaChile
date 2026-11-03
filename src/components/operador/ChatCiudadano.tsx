import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock, MessagesSquare, Send } from 'lucide-react'
import { MAX_MENSAJE, type MensajeChat } from '../../lib/acompanamientos'

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/** Por qué no hay chat activo (cada caso con su estado vacío). */
export type MotivoSinChat = 'sin-seleccion' | 'no-disponible' | 'pendiente'

interface Props {
  /** null = chat activo o en solo lectura; si no, el estado vacío que corresponde. */
  sinChat: MotivoSinChat | null
  /** false = acompañamiento terminado: se ve el historial pero no se escribe. */
  puedeEscribir: boolean
  nombreCiudadano?: string
  mensajes: MensajeChat[]
  cargando: boolean
  error: string | null
  /** Devuelve un mensaje de error o null. */
  onEnviar: (texto: string) => Promise<string | null>
}

const VACIOS: Record<MotivoSinChat, { titulo: string; detalle: string }> = {
  'sin-seleccion': { titulo: 'Selecciona una alerta para chatear', detalle: 'La conversación con el ciudadano aparecerá aquí.' },
  'no-disponible': { titulo: 'Chat no disponible', detalle: 'Por ahora el chat funciona con los acompañamientos de Ruta Segura.' },
  pendiente: { titulo: 'Acepta el monitoreo para chatear', detalle: 'Verás los mensajes que el ciudadano ya te haya escrito.' },
}

/** Chat del operador con el ciudadano (columna derecha, estilo Dark Control Room). */
export default function ChatCiudadano({ sinChat, puedeEscribir, nombreCiudadano, mensajes, cargando, error, onEnviar }: Props) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const puedeEnviar = puedeEscribir && texto.trim().length > 0 && !enviando

  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes.length, sinChat])

  async function enviar() {
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorEnvio(null)
    const err = await onEnviar(texto)
    setEnviando(false)
    if (err) setErrorEnvio(err)
    else setTexto('')
  }

  if (sinChat) {
    const v = VACIOS[sinChat]
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
        <span className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 shadow-[0_0_24px_rgba(59,130,246,0.15)]">
          <MessagesSquare size={22} strokeWidth={1.6} className="text-blue-400" />
        </span>
        <p className="text-sm font-medium text-slate-200">{v.titulo}</p>
        <p className="mt-1 max-w-[220px] text-xs text-slate-500">{v.detalle}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={listaRef} className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5" aria-live="polite">
        {cargando ? (
          <p className="m-auto flex items-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Cargando mensajes…
          </p>
        ) : mensajes.length === 0 ? (
          <p className="m-auto max-w-[220px] text-center text-xs text-slate-500">
            Aún no hay mensajes. Saluda a {nombreCiudadano ?? 'el ciudadano'} para iniciar la conversación.
          </p>
        ) : (
          mensajes.map((m) => {
            const esOperador = m.emisor_rol === 'operador'
            return (
              <div key={m.id} className={`flex max-w-[85%] flex-col ${esOperador ? 'items-end self-end' : 'items-start self-start'}`}>
                <div
                  className={`break-words rounded-2xl px-3 py-2 text-sm ${
                    esOperador
                      ? 'rounded-br-md bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.35)]'
                      : 'rounded-bl-md border border-slate-600/60 bg-slate-700/70 text-slate-100'
                  }`}
                >
                  <span className="whitespace-pre-wrap">{m.contenido}</span>
                </div>
                <span className="mt-0.5 px-1 text-[10px] tabular-nums text-slate-500">
                  {esOperador ? 'Tú' : (nombreCiudadano ?? 'Ciudadano')} · {fmtHora(m.creado_en)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {(errorEnvio || error) && (
        <p role="alert" className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {errorEnvio ?? error}
        </p>
      )}

      {puedeEscribir ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <label htmlFor="chat-operador-texto" className="sr-only">Mensaje para el ciudadano</label>
          <textarea
            id="chat-operador-texto"
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
            placeholder="Escribe al ciudadano…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="submit"
            disabled={!puedeEnviar}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)] transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock size={12} /> Acompañamiento finalizado · solo lectura
        </p>
      )}
    </div>
  )
}
