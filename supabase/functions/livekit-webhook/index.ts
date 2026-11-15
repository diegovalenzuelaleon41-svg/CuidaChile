// ════════════════════════════════════════════════════════════════════════
// CuidaChile — Webhook de LiveKit (fuente de verdad del estado de la sala)
//
// LiveKit firma cada evento con la API key/secret (header Authorization);
// WebhookReceiver valida la firma y el hash del cuerpo. Sin firma válida → 401.
// Se despliega con verify_jwt = false: la autenticación es la firma.
//
// Eventos usados:
//   participant_joined → marca conectado; con los dos dentro → 'active'.
//   participant_left   → en una llamada activa, la cierra (desconexión).
//   room_finished      → cierra la llamada (sala vacía o expirada).
// ════════════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { WebhookReceiver } from 'npm:livekit-server-sdk@2.19.3'

const EVENTOS = new Set(['participant_joined', 'participant_left', 'room_finished'])

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  const key = Deno.env.get('LIVEKIT_API_KEY')
  const secret = Deno.env.get('LIVEKIT_API_SECRET')
  if (!key || !secret) {
    console.error('[livekit-webhook] faltan secretos LIVEKIT_*')
    return new Response('Sin configurar', { status: 503 })
  }

  const cuerpo = await req.text()
  let evento
  try {
    evento = await new WebhookReceiver(key, secret).receive(cuerpo, req.headers.get('Authorization') ?? undefined)
  } catch {
    return new Response('Firma inválida', { status: 401 })
  }

  const sala = evento.room?.name
  // Solo salas de CuidaChile (room_name = 'cc-…') y eventos que nos importan.
  if (!sala?.startsWith('cc-') || !EVENTOS.has(evento.event)) return new Response('ok')

  const prefijo = evento.participant?.identity?.split(':')[0]
  const rol = prefijo === 'usuario' || prefijo === 'operador' ? prefijo : null

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { error } = await admin.rpc('evento_livekit', { p_room: sala, p_evento: evento.event, p_rol: rol })
  if (error) {
    console.error('[livekit-webhook] evento_livekit falló:', error.code, error.message)
    // 500: LiveKit reintenta la entrega.
    return new Response('Error', { status: 500 })
  }
  return new Response('ok')
})
