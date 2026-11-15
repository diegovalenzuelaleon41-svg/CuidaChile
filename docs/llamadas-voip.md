# Llamadas de voz (VoIP) — CuidaChile

Llamadas de audio entre el ciudadano que activó un **SOS** y el **operador** que lo atiende, sobre **LiveKit Cloud** (WebRTC).

## Arquitectura

| Pieza | Responsabilidad |
|---|---|
| **LiveKit Cloud** | Transporte del audio (WebRTC). |
| **Supabase Postgres** (`call_sessions`) | Estado de cada llamada y quién participa. Sin audio. |
| **Supabase Realtime** | Avisar cambios de estado (llamada entrante, aceptada, terminada). Nunca se usa para autorizar. |
| **Edge Function `livekit-token`** | Único lugar que firma tokens con `LIVEKIT_API_SECRET`. |
| **Edge Function `livekit-webhook`** | Recibe eventos firmados de LiveKit (entró / salió / sala cerrada). |
| **Frontend (Vite + React)** | `livekit-client`, cargado bajo demanda solo cuando hay una llamada. |

El proyecto no es Next.js: los endpoints de servidor son Supabase Edge Functions y funciones SQL.

| Operación | Implementación |
|---|---|
| Crear incidente SOS | `insert` en `alertas` (ya existía). El trigger `alertas_crear_call_session` crea la sesión `pending`. |
| Aceptar llamada | `rpc('aceptar_llamada', { p_call_id })`: asigna alerta + llamada en una transacción con `FOR UPDATE`. |
| Volver a llamar | `rpc('nueva_llamada', { p_alerta_id })`: solo el operador asignado; reutiliza la abierta si existe. |
| Token | `functions.invoke('livekit-token', { body: { call_id } })` |
| Colgar | `rpc('finalizar_llamada', { p_call_id })` |
| Conexión reportada | `rpc('reportar_conexion_llamada', …)` + webhook (fuente de verdad). |
| Leer estado | `select` sobre `call_sessions` (RLS) + Realtime. |

### Estados (`call_sessions.status`)

```
pending ──aceptar──▶ connecting ──ambos en la sala──▶ active ──colgar/desconexión──▶ ended
   │                     │
   │                     └──no se logró conectar / abandonada──▶ failed
   └──alerta cerrada antes de aceptar──▶ cancelled
```

- **`active` solo cuando los dos participantes están realmente en la sala**: lo confirma el webhook de LiveKit (`participant_joined`) o ambos clientes ya conectados.
- Al cerrarse la alerta (resuelta, cancelada, descartada) la llamada se cuelga sola.
- Llamadas colgadas (navegador cerrado sin colgar) se cierran como `abandonada`: la sala de LiveKit expira 2 min después de quedar vacía y llega `room_finished`. Además se limpian las que llevan más de 3 min en `connecting` cada vez que se acepta una llamada o se pide un token.

## Seguridad

- **El secreto nunca llega al navegador**: está solo en los secretos de Supabase. El `.env` del frontend no lo contiene. Vite expone al navegador todo lo que empiece con `VITE_`.
- `livekit-token` verifica la sesión de Supabase, que quien pide sea **el usuario de la llamada o su operador asignado (aprobado)**, y que la llamada esté `connecting` o `active`. A una llamada ajena o inexistente responde lo mismo (403), sin revelar si existe.
- **Token mínimo**: una sola sala, solo micrófono (`canPublishSources: [MICROPHONE]`), sin datos, **10 minutos**.
- **Sala**: máximo 2 participantes y se cierra si queda vacía.
- **Webhook**: firma de LiveKit validada (`WebhookReceiver`). Sin firma válida responde 401.
- **Base de datos**: los clientes no pueden insertar ni modificar `call_sessions`: solo las funciones `SECURITY DEFINER` (que verifican `auth.uid()`) y el webhook con `service_role`. RLS deja leer solo al usuario, a su operador y, si está `pending`, a los operadores aprobados.
- **Doble aceptación**: `aceptar_llamada` bloquea la llamada y la alerta (`FOR UPDATE`). Si dos operadores aceptan a la vez, el segundo recibe "Esta llamada ya no está disponible" y no se asigna nada. Además hay un índice único (una llamada abierta por incidente).
- Los tokens no se registran en logs.

## Privacidad (Ley 19.628 y Ley 21.719)

- **No se graba** ninguna llamada: no se usa LiveKit Egress y no se guarda audio en ningún lado.
- **Nombre de sala aleatorio** (`cc-<uuid>`), sin datos personales. La identidad del participante en LiveKit es `usuario:<uuid>` / `operador:<uuid>` (seudónimo) y el nombre visible es genérico ("Ciudadano" / "Central CuidaChile").
- **Se guarda solo metadato** en `call_sessions`: quién, cuándo, duración y motivo de cierre. Conviene definir un **plazo de retención** (sugerencia: 12 meses) y documentarlo en la política de privacidad.
- **Transferencia internacional**: el audio pasa por servidores de LiveKit Cloud fuera de Chile (región según el proyecto de LiveKit). Debe informarse en la política de privacidad y el aviso de términos, indicando el proveedor (LiveKit, Inc., EE. UU.), la finalidad (comunicación de emergencia) y que el audio no se almacena. Revisar el DPA de LiveKit antes de producción.
- El micrófono **solo se pide al contestar/conectar**, nunca antes.

## Instalación

### 1. Crear el proyecto en LiveKit Cloud
1. Crear una cuenta en <https://cloud.livekit.io> y un proyecto.
2. En **Settings → Keys** copiar: URL (`wss://…livekit.cloud`), API Key y API Secret.

### 2. Cargar los secretos en Supabase
Supabase Dashboard → **Edge Functions → Secrets** → agregar:

```
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

o con la CLI: `supabase secrets set --env-file supabase/functions/.env` (copiando antes `supabase/functions/.env.example`).

### 3. Configurar el webhook en LiveKit
LiveKit Cloud → **Settings → Webhooks** → agregar la URL:

```
https://fjnnbwfsuovtcxeivsri.supabase.co/functions/v1/livekit-webhook
```

y elegir la API Key del paso 1 para firmar.

### 4. Base de datos y funciones
Ya aplicadas en el proyecto de Supabase:
- `supabase/migrations/20261115000000_llamadas_voip.sql`
- Edge Functions `livekit-token` (verify JWT: sí) y `livekit-webhook` (verify JWT: no; se autentica con la firma).

Para redesplegar: `supabase functions deploy livekit-token` y `supabase functions deploy livekit-webhook --no-verify-jwt`.

### 5. Frontend
`npm install` (incluye `livekit-client`) y `npm run dev`. No requiere variables nuevas.

## Probar una llamada entre dos navegadores

Necesitas una cuenta **usuario** y una cuenta **operador aprobado**. Para aprobar un operador desde el SQL Editor: `select public.aprobar_operador('correo@ejemplo.com');`.

1. **Navegador A (o celular)**: inicia sesión como usuario → `/usuario`. Mantén presionado **SOS** 1,5 s.
2. **Navegador B (otra ventana privada u otro navegador)**: inicia sesión como operador → `/operador/dashboard`. Suena la alarma y aparece la tarjeta SOS.
3. En B, **Atender**: la alerta y la llamada se asignan juntas y el operador entra a la sala (el navegador pide el micrófono).
4. En A aparece **"La central te está llamando" → Contestar**. El navegador pide el micrófono.
5. Ambos ven **"En llamada · 00:0X"**: habla de un lado y escucha del otro.
6. Prueba **Silenciar** en cada lado, y luego **Colgar** en cualquiera de los dos.
7. En el SQL Editor: `select status, end_reason, duration_seconds from call_sessions order by created_at desc limit 1;` debería mostrar `ended`, `colgo_…` y la duración.

Pruebas negativas:
- **Dos operadores**: con un segundo operador aprobado en otro navegador, ambos presionan Atender; el segundo ve "Otro operador ya tomó esta alerta".
- **Corte de red**: con la llamada activa, desconecta el Wi-Fi de un lado. Aparece "Reconectando…"; si no vuelve, la llamada se cierra (`desconexion_…`).
- **Micrófono denegado**: se sigue escuchando al otro y aparece el aviso para activar el permiso.

> Safari iOS exige un toque para reproducir audio: por eso el ciudadano debe tocar "Contestar". Si igual quedara en silencio, aparece **"Activar sonido"**.

## Archivos

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20261115000000_llamadas_voip.sql` | Tabla `call_sessions`, RLS, triggers y funciones (`aceptar_llamada`, `nueva_llamada`, `finalizar_llamada`, `reportar_conexion_llamada`, `evento_livekit`). |
| `supabase/functions/livekit-token/index.ts` | Firma de tokens. |
| `supabase/functions/livekit-webhook/index.ts` | Eventos de LiveKit → estado en la base de datos. |
| `supabase/functions/.env.example` | Variables de LiveKit (secretos de servidor). |
| `src/lib/llamadas.ts` | Tipos, pedido de token, formato de duración. |
| `src/hooks/useSesionLlamada.ts` | Sesión de llamada de una alerta, en vivo. |
| `src/hooks/useLlamadaVoz.ts` | Conexión a la sala: micrófono, audio, reconexión, limpieza. |
| `src/components/llamada/ControlesLlamada.tsx` | Interfaz de la llamada (ciudadano y operador). |
| `src/pages/OperadorDashboard.tsx` | Atender = aceptar alerta + llamada; panel de llamada; volver a llamar. |
| `src/pages/Usuario.tsx`, `src/components/usuario/Modales.tsx` | Llamada entrante, contestar y controles en el modal SOS; píldora "En llamada". |
