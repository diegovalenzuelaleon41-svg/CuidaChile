import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { MAX_MENSAJE, type MensajeChat } from '../lib/acompanamientos'

const COLUMNAS = 'id, acompanamiento_id, alerta_id, emisor_id, emisor_rol, contenido, creado_en'

/** A qué pertenece el chat: una Ruta Segura o una alerta SOS. */
export type CampoChat = 'acompanamiento_id' | 'alerta_id'

/** Cada cuánto, como máximo, se avisa "estoy escribiendo" mientras se tipea. */
const AVISO_ESCRIBIENDO_MS = 2000
/** Sin un aviso nuevo en este tiempo, el indicador del otro se apaga solo. */
const EXPIRA_ESCRIBIENDO_MS = 4000

function ordenar(lista: MensajeChat[]) {
  return [...lista].sort((a, b) => a.creado_en.localeCompare(b.creado_en))
}

/** Une dos listas sin duplicar (el INSERT propio también llega por Realtime). */
function unir(a: MensajeChat[], b: MensajeChat[]) {
  const porId = new Map<string, MensajeChat>()
  for (const m of [...a, ...b]) porId.set(m.id, m)
  return ordenar([...porId.values()])
}

/** Chat de un acompañamiento (Ruta Segura). */
export function useChatAcompanamiento(acompanamientoId: string | null, rol: 'usuario' | 'operador') {
  return useChat('acompanamiento_id', acompanamientoId, rol)
}

/**
 * Chat en tiempo real usuario ↔ operador asignado, de una ruta o de un SOS.
 *  · Carga el historial y escucha los INSERT de ese chat por Realtime.
 *  · enviar() inserta con el rol de quien escribe; RLS valida que sea un
 *    involucrado y que la ruta / alerta siga abierta.
 * Pasar null como id para no cargar nada.
 */
export function useChat(campo: CampoChat, chatId: string | null, rol: 'usuario' | 'operador') {
  // La clave incluye el campo: un id de ruta y uno de alerta nunca se mezclan.
  const clave = chatId ? `${campo}:${chatId}` : null
  // La lista va atada a la clave: al cambiar de chat no se ve el anterior.
  const [estado, setEstado] = useState<{ id: string | null; lista: MensajeChat[]; listo: boolean }>({
    id: null,
    lista: [],
    listo: false,
  })
  const [error, setError] = useState<string | null>(null)
  // "Escribiendo…" del otro lado (Realtime Broadcast: efímero, nunca se guarda).
  const [otroEscribiendo, setOtroEscribiendo] = useState<{ clave: string | null; hasta: number }>({ clave: null, hasta: 0 })
  const canalRef = useRef<RealtimeChannel | null>(null)
  const ultimoAvisoRef = useRef(0)

  useEffect(() => {
    if (!clave || !chatId) return
    const id = clave
    let vivo = true

    const agregar = (nuevos: MensajeChat[], listo?: boolean) =>
      setEstado((prev) =>
        prev.id === id
          ? { id, lista: unir(prev.lista, nuevos), listo: listo ?? prev.listo }
          : { id, lista: ordenar(nuevos), listo: listo ?? false },
      )

    async function cargar() {
      const { data, error } = await supabase
        .from('mensajes')
        .select(COLUMNAS)
        .eq(campo, chatId)
        .order('creado_en', { ascending: true })
      if (!vivo) return
      if (error) {
        console.error('[chat] no se pudo cargar:', error.code, error.message)
        setError('No pudimos cargar los mensajes.')
        agregar([], true)
        return
      }
      setError(null)
      agregar((data ?? []) as MensajeChat[], true)
    }

    // Historial de inmediato: no depende de que Realtime conecte (redes que
    // bloquean websockets igual ven la conversación).
    void cargar()

    const canal = supabase
      .channel(`chat-${campo}-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `${campo}=eq.${chatId}` },
        (payload) => {
          const m = payload.new as MensajeChat
          agregar([m])
          // Llegó su mensaje: deja de "escribir".
          if (m.emisor_rol !== rol) setOtroEscribiendo({ clave: id, hasta: 0 })
        },
      )
      // Solo dice QUIÉN escribe (nunca el texto). Los propios no llegan (self: false).
      .on('broadcast', { event: 'escribiendo' }, ({ payload }) => {
        if (payload?.rol && payload.rol !== rol) setOtroEscribiendo({ clave: id, hasta: Date.now() + EXPIRA_ESCRIBIENDO_MS })
      })
      .subscribe((status) => {
        // Al (re)conectar se relee: no se pierde lo enviado mientras no había canal.
        if (status === 'SUBSCRIBED') void cargar()
      })
    canalRef.current = canal

    return () => {
      vivo = false
      canalRef.current = null
      supabase.removeChannel(canal)
    }
  }, [clave, campo, chatId, rol])

  // Apagar el indicador cuando vence (si no llegan más avisos).
  const hasta = otroEscribiendo.hasta
  useEffect(() => {
    const resto = hasta - Date.now()
    if (resto <= 0) return
    const t = setTimeout(() => setOtroEscribiendo((prev) => ({ ...prev, hasta: 0 })), resto)
    return () => clearTimeout(t)
  }, [hasta])

  /** Llamar en cada tecla: avisa al otro como máximo cada 2 s. */
  const avisarEscribiendo = useCallback(() => {
    const ahora = Date.now()
    if (!canalRef.current || ahora - ultimoAvisoRef.current < AVISO_ESCRIBIENDO_MS) return
    ultimoAvisoRef.current = ahora
    void canalRef.current.send({ type: 'broadcast', event: 'escribiendo', payload: { rol } })
  }, [rol])

  /** Envía un mensaje. Devuelve un mensaje de error o null. */
  const enviar = useCallback(
    async (texto: string): Promise<string | null> => {
      const contenido = texto.trim()
      if (!contenido || !clave || !chatId) return null
      if (contenido.length > MAX_MENSAJE) return `El mensaje supera los ${MAX_MENSAJE} caracteres.`
      const { data, error } = await supabase
        .from('mensajes')
        .insert({ [campo]: chatId, emisor_rol: rol, contenido })
        .select(COLUMNAS)
        .single()
      if (error) {
        console.error('[chat] no se pudo enviar:', error.code, error.message)
        return error.code === '42501'
          ? 'Este chat ya no admite mensajes.'
          : 'No se pudo enviar el mensaje. Revisa tu conexión.'
      }
      const nuevo = data as MensajeChat
      setEstado((prev) => (prev.id === clave ? { ...prev, lista: unir(prev.lista, [nuevo]) } : prev))
      return null
    },
    [clave, campo, chatId, rol],
  )

  const actual = clave && estado.id === clave
  return {
    mensajes: actual ? estado.lista : [],
    cargando: !!clave && !(actual && estado.listo),
    error,
    enviar,
    otroEscribiendo: !!clave && otroEscribiendo.clave === clave && otroEscribiendo.hasta > 0,
    avisarEscribiendo,
  }
}
