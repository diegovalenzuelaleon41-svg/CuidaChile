-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Llamadas de voz (VoIP) usuario ↔ operador sobre LiveKit
--
-- El "incidente" es la alerta SOS existente (public.alertas): no se crea
-- otra tabla de incidentes. Cada alerta SOS recibe una sesión de llamada.
--
-- Flujo de public.call_sessions.status:
--   pending     → la alerta se creó; nadie la ha tomado.
--   connecting  → un operador aceptó (aceptar_llamada): ambos pueden pedir
--                 token y entrar a la sala, pero aún no están los dos.
--   active      → los DOS participantes están conectados (lo confirma el
--                 webhook de LiveKit o reportar_conexion_llamada()).
--   ended       → alguien colgó, se desconectó o se cerró la alerta.
--   failed      → no se pudo establecer la comunicación.
--   cancelled   → se cerró antes de que un operador aceptara.
--
-- · El audio va por LiveKit; aquí solo hay coordinación (sin audio, sin
--   grabaciones, sin tokens).
-- · room_name es aleatorio: no lleva datos personales.
-- · El cliente NO escribe la tabla directo: solo funciones SECURITY DEFINER
--   (con auth.uid() verificado) y las Edge Functions con service_role.
--
-- Requiere 20261114000000_alertas_sos.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla ────────────────────────────────────────────────────────────
create table if not exists public.call_sessions (
  id                 uuid primary key default gen_random_uuid(),
  incident_id        uuid not null references public.alertas(id) on delete cascade,
  room_name          text not null unique
                     default ('cc-' || replace(gen_random_uuid()::text, '-', '')),
  user_id            uuid not null references public.perfil(id) on delete cascade,
  operator_id        uuid references public.perfil(id) on delete set null,
  status             text not null default 'pending'
                     check (status in ('pending', 'connecting', 'active', 'ended', 'failed', 'cancelled')),
  user_connected     boolean not null default false,
  operator_connected boolean not null default false,
  end_reason         text check (end_reason is null or char_length(end_reason) <= 60),
  started_at         timestamptz,
  ended_at           timestamptz,
  duration_seconds   integer check (duration_seconds is null or duration_seconds >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.call_sessions is
  'Sesiones de llamada VoIP (LiveKit) por alerta SOS. Sin audio ni grabaciones: solo coordinación.';

-- Una sola llamada abierta por incidente (evita llamadas duplicadas).
create unique index if not exists call_sessions_una_abierta_por_incidente
  on public.call_sessions (incident_id)
  where status in ('pending', 'connecting', 'active');

create index if not exists call_sessions_usuario on public.call_sessions (user_id, created_at desc);
create index if not exists call_sessions_operador on public.call_sessions (operator_id) where operator_id is not null;

-- ── 2. RLS: solo lectura para los involucrados ──────────────────────────
alter table public.call_sessions enable row level security;

drop policy if exists call_sessions_select on public.call_sessions;
create policy call_sessions_select on public.call_sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or operator_id = (select auth.uid())
    -- Operadores aprobados ven las pendientes (para aceptarlas) y por
    -- Realtime saben cuándo otra la tomó.
    or (status = 'pending' and (select public.es_operador_aprobado()))
  );
-- Sin INSERT / UPDATE / DELETE para clientes: todo pasa por las funciones de abajo.

-- ── 3. Cierre común (duración y motivo) ─────────────────────────────────
create or replace function public.cerrar_call_session(p_id uuid, p_status text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.call_sessions
     set status           = case
                              -- Nunca se conectaron los dos: no fue una llamada.
                              when p_status = 'ended' and status = 'pending' then 'cancelled'
                              when p_status = 'ended' and status = 'connecting' then 'failed'
                              else p_status
                            end,
         end_reason       = coalesce(p_motivo, end_reason),
         ended_at         = now(),
         duration_seconds = case when started_at is not null
                                 then greatest(0, extract(epoch from now() - started_at))::int end,
         user_connected   = false,
         operator_connected = false,
         updated_at       = now()
   where id = p_id
     and status in ('pending', 'connecting', 'active');
end;
$$;

revoke execute on function public.cerrar_call_session(uuid, text, text) from public, anon, authenticated;

-- Llamadas que quedaron colgadas (navegador cerrado sin colgar, webhook perdido).
create or replace function public.cerrar_llamadas_abandonadas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in
    select id from public.call_sessions
     where (status = 'connecting' and updated_at < now() - interval '3 minutes')
        or (status = 'active' and not user_connected and not operator_connected
            and updated_at < now() - interval '2 minutes')
  loop
    perform public.cerrar_call_session(r.id, 'ended', 'abandonada');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.cerrar_llamadas_abandonadas() from public, anon, authenticated;

-- ── 4. Alerta SOS ↔ sesión de llamada ───────────────────────────────────
-- Cada SOS nuevo nace con su sesión 'pending'.
create or replace function public.crear_call_session_sos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'sos' and new.estado in ('activa', 'en_atencion') then
    insert into public.call_sessions (incident_id, user_id)
    values (new.id, new.usuario_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.crear_call_session_sos() from public, anon, authenticated;

drop trigger if exists alertas_crear_call_session on public.alertas;
create trigger alertas_crear_call_session
  after insert on public.alertas
  for each row execute function public.crear_call_session_sos();

-- Al cerrarse la alerta (resuelta, cancelada, descartada…) se cuelga la llamada.
create or replace function public.cerrar_call_session_por_alerta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.estado not in ('activa', 'en_atencion') and old.estado in ('activa', 'en_atencion') then
    for r in
      select id from public.call_sessions
       where incident_id = new.id and status in ('pending', 'connecting', 'active')
    loop
      perform public.cerrar_call_session(r.id, 'ended', 'alerta_' || new.estado);
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function public.cerrar_call_session_por_alerta() from public, anon, authenticated;

drop trigger if exists alertas_cerrar_call_session on public.alertas;
create trigger alertas_cerrar_call_session
  after update of estado on public.alertas
  for each row execute function public.cerrar_call_session_por_alerta();

-- SOS abiertos de antes de esta migración también reciben su sesión.
insert into public.call_sessions (incident_id, user_id)
select a.id, a.usuario_id
  from public.alertas a
 where a.tipo = 'sos' and a.estado in ('activa', 'en_atencion')
   and not exists (
     select 1 from public.call_sessions c
      where c.incident_id = a.id and c.status in ('pending', 'connecting', 'active')
   )
on conflict do nothing;

-- ── 5. Aceptar (atómico: alerta + llamada en una transacción) ───────────
-- Uso: supabase.rpc('aceptar_llamada', { p_call_id })
-- Bloquea la fila de la llamada y de la alerta (FOR UPDATE): si dos
-- operadores aceptan a la vez, el segundo espera y luego recibe el error.
create or replace function public.aceptar_llamada(p_call_id uuid)
returns public.call_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_call   public.call_sessions;
  v_alerta public.alertas;
begin
  if v_uid is null or not public.es_operador_aprobado() then
    raise exception 'Solo un operador aprobado puede aceptar llamadas.' using errcode = '42501';
  end if;

  perform public.cerrar_llamadas_abandonadas();

  select * into v_call from public.call_sessions where id = p_call_id for update;
  if not found then
    raise exception 'La llamada no existe.' using errcode = 'P0002';
  end if;

  select * into v_alerta from public.alertas where id = v_call.incident_id for update;

  if v_call.status <> 'pending' then
    if v_call.operator_id = v_uid and v_call.status in ('connecting', 'active') then
      return v_call;  -- reintento del mismo operador (doble clic, recarga)
    end if;
    raise exception 'Esta llamada ya no está disponible.' using errcode = 'P0001', hint = 'llamada_tomada';
  end if;

  if v_alerta.estado = 'activa' and v_alerta.operador_id is null then
    -- validar_alerta() sigue aplicando: auth.uid() es este operador.
    update public.alertas set estado = 'en_atencion', operador_id = v_uid where id = v_alerta.id;
  elsif not (v_alerta.estado = 'en_atencion' and v_alerta.operador_id = v_uid) then
    raise exception 'Otro operador ya atiende esta alerta.' using errcode = 'P0001', hint = 'llamada_tomada';
  end if;

  update public.call_sessions
     set operator_id = v_uid, status = 'connecting', updated_at = now()
   where id = p_call_id
  returning * into v_call;
  return v_call;
end;
$$;

revoke all on function public.aceptar_llamada(uuid) from public, anon;
grant execute on function public.aceptar_llamada(uuid) to authenticated;

-- ── 6. Volver a llamar (tras colgar o fallar), solo el operador asignado ─
create or replace function public.nueva_llamada(p_alerta_id uuid)
returns public.call_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_alerta public.alertas;
  v_call   public.call_sessions;
begin
  if v_uid is null or not public.es_operador_aprobado() then
    raise exception 'Solo un operador aprobado puede iniciar llamadas.' using errcode = '42501';
  end if;

  perform public.cerrar_llamadas_abandonadas();

  select * into v_alerta from public.alertas where id = p_alerta_id for update;
  if not found or v_alerta.tipo <> 'sos' or v_alerta.estado <> 'en_atencion' or v_alerta.operador_id <> v_uid then
    raise exception 'Solo puedes llamar a alertas que estás atendiendo.' using errcode = '42501';
  end if;

  -- Si ya hay una abierta, se reutiliza (protección contra duplicadas).
  select * into v_call from public.call_sessions
   where incident_id = p_alerta_id and status in ('pending', 'connecting', 'active')
   for update;
  if found then
    if v_call.status = 'pending' then
      update public.call_sessions set operator_id = v_uid, status = 'connecting', updated_at = now()
       where id = v_call.id returning * into v_call;
    end if;
    return v_call;
  end if;

  insert into public.call_sessions (incident_id, user_id, operator_id, status)
  values (p_alerta_id, v_alerta.usuario_id, v_uid, 'connecting')
  returning * into v_call;
  return v_call;
end;
$$;

revoke all on function public.nueva_llamada(uuid) from public, anon;
grant execute on function public.nueva_llamada(uuid) to authenticated;

-- ── 7. Colgar (cualquiera de los dos participantes) ─────────────────────
create or replace function public.finalizar_llamada(p_call_id uuid)
returns public.call_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_call public.call_sessions;
begin
  select * into v_call from public.call_sessions where id = p_call_id for update;
  if not found or v_uid is null or (v_uid <> v_call.user_id and v_uid is distinct from v_call.operator_id) then
    raise exception 'Sin permiso sobre esta llamada.' using errcode = '42501';
  end if;

  perform public.cerrar_call_session(
    p_call_id, 'ended',
    case when v_uid = v_call.user_id then 'colgo_usuario' else 'colgo_operador' end
  );
  select * into v_call from public.call_sessions where id = p_call_id;
  return v_call;
end;
$$;

revoke all on function public.finalizar_llamada(uuid) from public, anon;
grant execute on function public.finalizar_llamada(uuid) to authenticated;

-- ── 8. Conexión real reportada por el cliente ───────────────────────────
-- p_conectado = true cuando el cliente ya está en la sala de LiveKit. La
-- llamada pasa a 'active' recién cuando los dos están conectados. El webhook
-- de LiveKit hace lo mismo desde el servidor (fuente de verdad).
-- p_fallo: el cliente no pudo conectarse (micrófono denegado, red…).
create or replace function public.reportar_conexion_llamada(p_call_id uuid, p_conectado boolean, p_fallo text default null)
returns public.call_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_call public.call_sessions;
begin
  select * into v_call from public.call_sessions where id = p_call_id for update;
  if not found or v_uid is null or (v_uid <> v_call.user_id and v_uid is distinct from v_call.operator_id) then
    raise exception 'Sin permiso sobre esta llamada.' using errcode = '42501';
  end if;
  if v_call.status not in ('connecting', 'active') then
    return v_call;
  end if;

  if p_fallo is not null then
    perform public.cerrar_call_session(p_call_id, 'failed', left('fallo_' || p_fallo, 60));
    select * into v_call from public.call_sessions where id = p_call_id;
    return v_call;
  end if;

  update public.call_sessions
     set user_connected     = case when v_uid = user_id then p_conectado else user_connected end,
         operator_connected = case when v_uid = operator_id then p_conectado else operator_connected end,
         updated_at         = now()
   where id = p_call_id
  returning * into v_call;

  if v_call.status = 'connecting' and v_call.user_connected and v_call.operator_connected then
    update public.call_sessions set status = 'active', started_at = now(), updated_at = now()
     where id = p_call_id returning * into v_call;
  end if;
  return v_call;
end;
$$;

revoke all on function public.reportar_conexion_llamada(uuid, boolean, text) from public, anon;
grant execute on function public.reportar_conexion_llamada(uuid, boolean, text) to authenticated;

-- ── 9. Eventos del webhook de LiveKit (solo service_role) ──────────────
-- p_evento: 'participant_joined' | 'participant_left' | 'room_finished'
-- p_rol: 'usuario' | 'operador' (viene de la identidad firmada en el token).
create or replace function public.evento_livekit(p_room text, p_evento text, p_rol text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.call_sessions;
begin
  select * into v_call from public.call_sessions
   where room_name = p_room and status in ('connecting', 'active')
   for update;
  if not found then
    return;
  end if;

  if p_evento = 'room_finished' then
    perform public.cerrar_call_session(v_call.id, 'ended', 'sala_cerrada');
    return;
  end if;

  if p_evento = 'participant_joined' then
    update public.call_sessions
       set user_connected     = user_connected or p_rol = 'usuario',
           operator_connected = operator_connected or p_rol = 'operador',
           updated_at         = now()
     where id = v_call.id
    returning * into v_call;
    if v_call.status = 'connecting' and v_call.user_connected and v_call.operator_connected then
      update public.call_sessions set status = 'active', started_at = now(), updated_at = now()
       where id = v_call.id;
    end if;
    return;
  end if;

  -- LiveKit emite participant_left solo tras agotar la reconexión del cliente:
  -- en una llamada activa significa que esa persona se fue.
  if p_evento = 'participant_left' then
    if v_call.status = 'active' then
      perform public.cerrar_call_session(v_call.id, 'ended', 'desconexion_' || coalesce(p_rol, 'desconocido'));
    else
      update public.call_sessions
         set user_connected     = case when p_rol = 'usuario' then false else user_connected end,
             operator_connected = case when p_rol = 'operador' then false else operator_connected end,
             updated_at         = now()
       where id = v_call.id;
    end if;
  end if;
end;
$$;

revoke all on function public.evento_livekit(text, text, text) from public, anon, authenticated;
grant execute on function public.evento_livekit(text, text, text) to service_role;

-- ── 10. Realtime ────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_sessions'
  ) then
    alter publication supabase_realtime add table public.call_sessions;
  end if;
end $$;
