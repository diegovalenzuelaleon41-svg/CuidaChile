// ════════════════════════════════════════════════════════════════════════
// CuidaChile — Token de LiveKit para una llamada (POST { call_id })
//
// Único lugar donde se usa LIVEKIT_API_SECRET para firmar. Verifica:
//   1. Sesión de Supabase válida (Authorization: Bearer <jwt del usuario>).
//   2. Que quien pide sea el usuario de la llamada o su operador asignado
//      (y que ese operador siga aprobado).
//   3. Que la llamada esté 'connecting' o 'active'.
// El token sirve solo para esa sala, solo audio de micrófono, 10 minutos.
// Nunca se registra el token en logs.
// ════════════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { AccessToken, RoomServiceClient, TrackSource } from 'npm:livekit-server-sdk@2.19.3'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function responder(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' })

  const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')
  const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')
  const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('[livekit-token] faltan secretos LIVEKIT_*')
    return responder(503, { error: 'Las llamadas de voz no están configuradas.', codigo: 'sin_configurar' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // ── 1. Quién llama ──
  const comoUsuario = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: auth, error: authError } = await comoUsuario.auth.getUser()
  if (authError || !auth.user) return responder(401, { error: 'Sesión no válida.' })
  const uid = auth.user.id

  let callId: unknown
  try {
    callId = (await req.json())?.call_id
  } catch {
    return responder(400, { error: 'Cuerpo inválido.' })
  }
  if (typeof callId !== 'string' || !UUID.test(callId)) return responder(400, { error: 'call_id inválido.' })

  // ── 2. ¿Participa en esta llamada? (service_role: la decisión es nuestra, no de RLS) ──
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: call, error: callError } = await admin
    .from('call_sessions')
    .select('id, room_name, user_id, operator_id, status')
    .eq('id', callId)
    .maybeSingle()
  if (callError) {
    console.error('[livekit-token] error leyendo la llamada:', callError.code)
    return responder(500, { error: 'No se pudo leer la llamada.' })
  }
  // Mismo mensaje si no existe o si es ajena: no revela qué llamadas existen.
  if (!call) return responder(403, { error: 'Sin acceso a esta llamada.' })

  let rol: 'usuario' | 'operador'
  if (call.user_id === uid) {
    rol = 'usuario'
  } else if (call.operator_id === uid) {
    const { data: perfil } = await admin.from('perfil').select('rol, operador_estado').eq('id', uid).maybeSingle()
    if (perfil?.rol !== 'operador' || perfil?.operador_estado !== 'aprobado') {
      return responder(403, { error: 'Sin acceso a esta llamada.' })
    }
    rol = 'operador'
  } else {
    return responder(403, { error: 'Sin acceso a esta llamada.' })
  }

  if (call.status !== 'connecting' && call.status !== 'active') {
    return responder(409, { error: 'La llamada no está disponible.', estado: call.status })
  }

  // ── 3. Sala privada: máx. 2 participantes, se cierra sola si queda vacía ──
  try {
    const salas = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, 'http'), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    await salas.createRoom({ name: call.room_name, emptyTimeout: 120, departureTimeout: 30, maxParticipants: 2 })
  } catch (e) {
    console.error('[livekit-token] no se pudo preparar la sala:', (e as Error).message)
    return responder(502, { error: 'No se pudo conectar con el servidor de llamadas.' })
  }

  // ── 4. Token mínimo ──
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `${rol}:${uid}`,
    name: rol === 'operador' ? 'Central CuidaChile' : 'Ciudadano',
    ttl: '10m',
  })
  at.addGrant({
    room: call.room_name,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.MICROPHONE],
  })

  return responder(200, { token: await at.toJwt(), url: LIVEKIT_URL, rol })
})
