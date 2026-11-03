import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MAX_MENSAJE, type MensajeChat } from '../lib/acompanamientos'

const COLUMNAS = 'id, acompanamiento_id, emisor_id, emisor_rol, contenido, creado_en'

function ordenar(lista: MensajeChat[]) {
  return [...lista].sort((a, b) => a.creado_en.localeCompare(b.creado_en))
}

/** Une dos listas sin duplicar (el INSERT propio también llega por Realtime). */
function unir(a: MensajeChat[], b: MensajeChat[]) {
  const porId = new Map<string, MensajeChat>()
  for (const m of [...a, ...b]) porId.set(m.id, m)
  return ordenar([...porId.values()])
}

/**
 * Chat en tiempo real de un acompañamiento (usuario ↔ operador asignado).
 *  · Carga el historial y escucha los INSERT de ese acompañamiento por Realtime.
 *  · enviar() inserta con el rol de quien escribe; RLS valida que sea un
 *    involucrado y que la ruta siga abierta.
 * Pasar null como id para no cargar nada.
 */
export function useChatAcompanamiento(acompanamientoId: string | null, rol: 'usuario' | 'operador') {
  // La lista va atada al id: al cambiar de acompañamiento no se ve la anterior.
  const [estado, setEstado] = useState<{ id: string | null; lista: MensajeChat[]; listo: boolean }>({
    id: null,
    lista: [],
    listo: false,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!acompanamientoId) return
    const id = acompanamientoId
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
        .eq('acompanamiento_id', id)
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
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `acompanamiento_id=eq.${id}` },
        (payload) => agregar([payload.new as MensajeChat]),
      )
      .subscribe((status) => {
        // Al (re)conectar se relee: no se pierde lo enviado mientras no había canal.
        if (status === 'SUBSCRIBED') void cargar()
      })

    return () => {
      vivo = false
      supabase.removeChannel(canal)
    }
  }, [acompanamientoId])

  /** Envía un mensaje. Devuelve un mensaje de error o null. */
  const enviar = useCallback(
    async (texto: string): Promise<string | null> => {
      const contenido = texto.trim()
      if (!contenido || !acompanamientoId) return null
      if (contenido.length > MAX_MENSAJE) return `El mensaje supera los ${MAX_MENSAJE} caracteres.`
      const { data, error } = await supabase
        .from('mensajes')
        .insert({ acompanamiento_id: acompanamientoId, emisor_rol: rol, contenido })
        .select(COLUMNAS)
        .single()
      if (error) {
        console.error('[chat] no se pudo enviar:', error.code, error.message)
        return error.code === '42501'
          ? 'Este chat ya no admite mensajes.'
          : 'No se pudo enviar el mensaje. Revisa tu conexión.'
      }
      const nuevo = data as MensajeChat
      setEstado((prev) => (prev.id === nuevo.acompanamiento_id ? { ...prev, lista: unir(prev.lista, [nuevo]) } : prev))
      return null
    },
    [acompanamientoId, rol],
  )

  const actual = acompanamientoId && estado.id === acompanamientoId
  return {
    mensajes: actual ? estado.lista : [],
    cargando: !!acompanamientoId && !(actual && estado.listo),
    error,
    enviar,
  }
}
