-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — PIN de seguridad del usuario (4 dígitos)
--
-- Si alguien le quita el celular a la víctima durante un SOS, no debe poder
-- tocar "Estoy a salvo" y apagar la ayuda. Cancelar un SOS exige el PIN.
--
-- · El hash (bcrypt) vive en private.pin_seguridad, sin acceso desde el
--   cliente. NO en perfil: perfil tiene grant de tabla para authenticated,
--   así que cualquier columna ahí se puede leer (un PIN de 4 dígitos se
--   adivina offline en milisegundos con el hash) y sobrescribir sin conocer
--   el PIN actual. Se eliminan las columnas pin_* de perfil (nunca se usaron).
-- · Todo pasa por RPC security definer:
--     tiene_pin()                      → boolean
--     crear_pin(p_pin)                 → la primera vez
--     cambiar_pin(p_actual, p_nuevo)   → jsonb { resultado, ... }
--     restablecer_pin(p_nuevo)         → olvidó el PIN: exige login reciente
--     cancelar_sos(p_alerta_id, p_pin) → jsonb { resultado, ... }
-- · 5 intentos fallidos bloquean la verificación 15 minutos (un ladrón no
--   puede probar las 10.000 combinaciones; la alerta sigue activa).
-- · Un trigger impide que el usuario cancele su SOS con un UPDATE directo:
--   solo cancelar_sos() puede hacerlo.
--
-- Las funciones que verifican el PIN devuelven el resultado en vez de lanzar
-- excepción: un raise desharía el contador de intentos fallidos.
-- Requiere 20261029030000_extensiones.sql (pgcrypto) y 20261114000000_alertas_sos.sql.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla privada ────────────────────────────────────────────────────
create schema if not exists private;

create table if not exists private.pin_seguridad (
  usuario_id        uuid primary key references public.perfil(id) on delete cascade,
  pin_hash          text        not null,
  establecido_en    timestamptz not null default now(),
  intentos_fallidos smallint    not null default 0,
  bloqueado_hasta   timestamptz
);

alter table private.pin_seguridad enable row level security;
-- Sin políticas: solo las funciones security definer la tocan.
revoke all on private.pin_seguridad from public, anon, authenticated;

alter table public.perfil
  drop column if exists pin_hash,
  drop column if exists pin_establecido_en,
  drop column if exists pin_intentos_fallidos,
  drop column if exists pin_bloqueado_hasta;

-- ── 2. Helpers internos ─────────────────────────────────────────────────
create or replace function private.pin_formato_valido(p_pin text)
returns boolean
language sql
immutable
as $$
  select p_pin is not null and p_pin ~ '^[0-9]{4}$';
$$;

-- Verifica el PIN del usuario y lleva la cuenta de intentos.
-- Devuelve jsonb: { resultado: 'ok' | 'incorrecto' | 'bloqueado' | 'sin_pin',
--                   intentos_restantes?, bloqueado_hasta? }
create or replace function private.verificar_pin(p_usuario uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila      private.pin_seguridad;
  v_max       constant int := 5;
  v_bloqueo   constant interval := interval '15 minutes';
begin
  select * into v_fila from private.pin_seguridad where usuario_id = p_usuario for update;
  if not found then
    return jsonb_build_object('resultado', 'sin_pin');
  end if;

  if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > now() then
    return jsonb_build_object('resultado', 'bloqueado', 'bloqueado_hasta', v_fila.bloqueado_hasta);
  end if;

  if private.pin_formato_valido(p_pin)
     and v_fila.pin_hash = extensions.crypt(p_pin, v_fila.pin_hash) then
    update private.pin_seguridad
       set intentos_fallidos = 0, bloqueado_hasta = null
     where usuario_id = p_usuario;
    return jsonb_build_object('resultado', 'ok');
  end if;

  if v_fila.intentos_fallidos + 1 >= v_max then
    update private.pin_seguridad
       set intentos_fallidos = 0, bloqueado_hasta = now() + v_bloqueo
     where usuario_id = p_usuario;
    return jsonb_build_object('resultado', 'bloqueado', 'bloqueado_hasta', now() + v_bloqueo);
  end if;

  update private.pin_seguridad
     set intentos_fallidos = v_fila.intentos_fallidos + 1
   where usuario_id = p_usuario;
  return jsonb_build_object('resultado', 'incorrecto', 'intentos_restantes', v_max - v_fila.intentos_fallidos - 1);
end;
$$;

revoke all on function private.pin_formato_valido(text) from public, anon, authenticated;
revoke all on function private.verificar_pin(uuid, text) from public, anon, authenticated;

-- ── 3. RPC públicas ─────────────────────────────────────────────────────
create or replace function public.tiene_pin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.pin_seguridad where usuario_id = auth.uid());
$$;

-- Primera vez. Si ya existe, hay que usar cambiar_pin() o restablecer_pin().
create or replace function public.crear_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not private.pin_formato_valido(p_pin) then
    raise exception 'El PIN debe tener exactamente 4 dígitos.' using errcode = '22023';
  end if;

  insert into private.pin_seguridad (usuario_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (usuario_id) do nothing;

  if not found then
    raise exception 'Ya tienes un PIN de seguridad.' using errcode = 'P0001', hint = 'pin_ya_existe';
  end if;
end;
$$;

create or replace function public.cambiar_pin(p_actual text, p_nuevo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not private.pin_formato_valido(p_nuevo) then
    raise exception 'El PIN debe tener exactamente 4 dígitos.' using errcode = '22023';
  end if;

  v_res := private.verificar_pin(auth.uid(), p_actual);
  if v_res ->> 'resultado' <> 'ok' then
    return v_res;
  end if;

  update private.pin_seguridad
     set pin_hash = extensions.crypt(p_nuevo, extensions.gen_salt('bf')),
         establecido_en = now()
   where usuario_id = auth.uid();
  return v_res;
end;
$$;

-- Olvidó el PIN: el cliente vuelve a autenticar (contraseña o Google) y
-- llama aquí dentro de los 10 minutos siguientes. Se mira el claim amr del
-- JWT, que conserva la hora del login aunque el token se refresque.
-- No se permite con un SOS abierto: quien tenga el celular no podría
-- restablecerlo y cancelar la alerta.
create or replace function public.restablecer_pin(p_nuevo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_login bigint;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not private.pin_formato_valido(p_nuevo) then
    raise exception 'El PIN debe tener exactamente 4 dígitos.' using errcode = '22023';
  end if;

  select max((m ->> 'timestamp')::bigint) into v_login
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m;
  if v_login is null or v_login < extract(epoch from now()) - 600 then
    raise exception 'Por seguridad, vuelve a iniciar sesión para restablecer tu PIN.'
      using errcode = '42501', hint = 'reautenticar';
  end if;

  if exists (
    select 1 from public.alertas
     where usuario_id = auth.uid() and tipo = 'sos' and estado in ('activa', 'en_atencion')
  ) then
    raise exception 'No puedes restablecer el PIN con una alerta SOS activa.' using errcode = '42501';
  end if;

  insert into private.pin_seguridad (usuario_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_nuevo, extensions.gen_salt('bf')))
  on conflict (usuario_id) do update
    set pin_hash = excluded.pin_hash,
        establecido_en = now(),
        intentos_fallidos = 0,
        bloqueado_hasta = null;
end;
$$;

-- Cancela el SOS propio verificando el PIN.
-- resultado: 'cancelada' | 'ya_cerrada' | 'incorrecto' | 'bloqueado'
-- Sin PIN creado (SOS anterior a esta función) se cancela sin pedirlo.
create or replace function public.cancelar_sos(p_alerta_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  v_res := private.verificar_pin(auth.uid(), p_pin);
  if v_res ->> 'resultado' not in ('ok', 'sin_pin') then
    return v_res;
  end if;

  -- Bandera local a la transacción: la lee alertas_cancelar_con_pin.
  perform set_config('cuidachile.cancelando_sos', 'on', true);
  update public.alertas
     set estado = 'cancelada'
   where id = p_alerta_id
     and usuario_id = auth.uid()
     and tipo = 'sos'
     and estado in ('activa', 'en_atencion');

  return jsonb_build_object('resultado', case when found then 'cancelada' else 'ya_cerrada' end);
end;
$$;

revoke all on function public.tiene_pin() from public, anon;
revoke all on function public.crear_pin(text) from public, anon;
revoke all on function public.cambiar_pin(text, text) from public, anon;
revoke all on function public.restablecer_pin(text) from public, anon;
revoke all on function public.cancelar_sos(uuid, text) from public, anon;
grant execute on function public.tiene_pin() to authenticated;
grant execute on function public.crear_pin(text) to authenticated;
grant execute on function public.cambiar_pin(text, text) to authenticated;
grant execute on function public.restablecer_pin(text) to authenticated;
grant execute on function public.cancelar_sos(uuid, text) to authenticated;

-- ── 4. El usuario solo cancela su SOS vía cancelar_sos() ────────────────
-- validar_alerta() sigue decidiendo las transiciones; esto solo agrega que
-- el dueño no puede pasar un SOS a 'cancelada' con un UPDATE directo.
create or replace function public.exigir_pin_cancelar_sos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.usuario_id
     and old.tipo = 'sos'
     and new.estado = 'cancelada'
     and old.estado is distinct from 'cancelada'
     and coalesce(current_setting('cuidachile.cancelando_sos', true), '') <> 'on' then
    raise exception 'Para cancelar la alerta ingresa tu PIN de seguridad.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.exigir_pin_cancelar_sos() from public, anon, authenticated;

drop trigger if exists alertas_cancelar_con_pin on public.alertas;
create trigger alertas_cancelar_con_pin
  before update of estado on public.alertas
  for each row execute function public.exigir_pin_cancelar_sos();
