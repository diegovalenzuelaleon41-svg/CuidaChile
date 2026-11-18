-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — PIN de coacción, links de seguimiento y calificación de rutas
--
-- 1. PIN de coacción: un segundo PIN que el usuario elige. Si alguien lo
--    obliga a cancelar el SOS y usa ese PIN, el teléfono muestra la alerta
--    como cancelada, pero en la central sigue abierta y marcada `coaccion`.
--    · El hash vive junto al PIN real en private.pin_seguridad.
--    · El dueño deja de ver esa alerta (RLS): una recarga no la delata.
--    · El teléfono sigue mandando su ubicación con ubicacion_silenciosa().
--    · Solo cancelar_sos() marca `coaccion` (bandera cuidachile.coaccion).
--    · El índice de "un SOS abierto por usuario" ignora las de coacción, así
--      un SOS nuevo sigue funcionando.
-- 2. Seguimientos: un link (token uuid) que el usuario manda a sus contactos
--    para ver en vivo su SOS o su ruta acompañada, sin cuenta. Solo muestra
--    datos mientras la alerta o la ruta están abiertas (y hasta 12 h).
-- 3. Calificaciones: nota de 1 a 5 al operador de una ruta finalizada.
--
-- Requiere 20261115030000_pin_seguridad.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. PIN de coacción ──────────────────────────────────────────────────
alter table private.pin_seguridad add column if not exists coaccion_hash text;

alter table public.alertas
  add column if not exists coaccion    boolean not null default false,
  add column if not exists coaccion_en timestamptz;

-- Un SOS nuevo no choca con uno de coacción que sigue abierto en la central.
drop index if exists public.alertas_un_sos_abierto_por_usuario;
create unique index alertas_un_sos_abierto_por_usuario
  on public.alertas (usuario_id)
  where tipo = 'sos' and estado in ('activa', 'en_atencion') and not coaccion;

-- El dueño no ve su alerta de coacción; los operadores sí.
drop policy if exists alertas_select on public.alertas;
create policy alertas_select on public.alertas
  for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and not coaccion)
    or (select public.es_operador_aprobado())
  );

drop policy if exists alertas_update on public.alertas;
create policy alertas_update on public.alertas
  for update to authenticated
  using (
    (usuario_id = (select auth.uid()) and not coaccion)
    or (select public.es_operador_aprobado())
  )
  with check (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Al insertar: nunca nace en coacción.
create or replace function public.completar_alerta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.nombre, p.telefono
    into new.usuario_nombre, new.usuario_telefono
    from public.perfil p
   where p.id = new.usuario_id;

  if auth.uid() is not null then
    new.estado         := 'activa';
    new.operador_id    := null;
    new.atendida_en    := null;
    new.cerrada_en     := null;
    new.motivo_cierre  := null;
    new.creada_en      := now();
    new.coaccion       := false;
    new.coaccion_en    := null;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

revoke execute on function public.completar_alerta() from public, anon, authenticated;

-- Transiciones: igual que antes, más la regla de `coaccion`.
create or replace function public.validar_alerta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  new.actualizado_en := now();

  if v_uid is null then
    return new;
  end if;

  if new.usuario_id is distinct from old.usuario_id
     or new.tipo is distinct from old.tipo
     or new.creada_en is distinct from old.creada_en
     or new.usuario_nombre is distinct from old.usuario_nombre
     or new.usuario_telefono is distinct from old.usuario_telefono then
    raise exception 'Solo se puede cambiar el estado y la ubicación de la alerta.' using errcode = '42501';
  end if;

  -- Solo cancelar_sos() con el PIN de coacción la marca; nadie la desmarca.
  if (new.coaccion is distinct from old.coaccion or new.coaccion_en is distinct from old.coaccion_en)
     and not (new.coaccion and not old.coaccion
              and coalesce(current_setting('cuidachile.coaccion', true), '') = 'on') then
    raise exception 'No se puede cambiar la marca de coacción.' using errcode = '42501';
  end if;

  if old.estado not in ('activa', 'en_atencion') then
    raise exception 'La alerta ya terminó.' using errcode = '42501';
  end if;

  if v_uid = old.usuario_id then
    if new.operador_id is distinct from old.operador_id
       or new.atendida_en is distinct from old.atendida_en
       or new.motivo_cierre is distinct from old.motivo_cierre then
      raise exception 'El usuario no puede asignar operador.' using errcode = '42501';
    end if;

    if new.estado is distinct from old.estado then
      -- Una alerta de coacción solo la cierra la central.
      if new.estado <> 'cancelada' or old.coaccion then
        raise exception 'Transición no permitida: % → %', old.estado, new.estado using errcode = '42501';
      end if;
      new.cerrada_en := now();
    end if;
    return new;
  end if;

  if public.es_operador_aprobado() then
    if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
      raise exception 'Solo el usuario envía su ubicación.' using errcode = '42501';
    end if;

    if new.estado = 'descartada' then
      if not (
        (old.estado = 'activa' and old.operador_id is null)
        or (old.estado = 'en_atencion' and old.operador_id = v_uid)
      ) or new.operador_id is distinct from v_uid then
        raise exception 'No puedes descartar esta alerta.' using errcode = '42501';
      end if;
      new.cerrada_en := now();
      return new;
    end if;

    if new.motivo_cierre is distinct from old.motivo_cierre then
      raise exception 'El motivo solo se registra al descartar.' using errcode = '42501';
    end if;

    if old.estado = 'activa' and new.estado = 'en_atencion' then
      if old.operador_id is not null or new.operador_id is distinct from v_uid then
        raise exception 'El operador solo puede asignarse a sí mismo.' using errcode = '42501';
      end if;
      new.atendida_en := now();
      return new;
    end if;

    if old.estado = 'en_atencion' and new.estado = 'resuelta'
       and old.operador_id = v_uid and new.operador_id = v_uid then
      new.cerrada_en := now();
      return new;
    end if;

    raise exception 'Transición no permitida para el operador: % → %', old.estado, new.estado using errcode = '42501';
  end if;

  raise exception 'Sin permiso sobre esta alerta.' using errcode = '42501';
end;
$$;

create or replace function public.tiene_pin_coaccion()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.pin_seguridad where usuario_id = auth.uid() and coaccion_hash is not null
  );
$$;

-- Crea o cambia el PIN de coacción. Exige el PIN real y que sean distintos.
create or replace function public.establecer_pin_coaccion(p_pin text, p_coaccion text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res  jsonb;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not private.pin_formato_valido(p_coaccion) then
    raise exception 'El PIN de coacción debe tener exactamente 4 dígitos.' using errcode = '22023';
  end if;

  v_res := private.verificar_pin(auth.uid(), p_pin);
  if v_res ->> 'resultado' <> 'ok' then
    return v_res;
  end if;

  select pin_hash into v_hash from private.pin_seguridad where usuario_id = auth.uid();
  if v_hash = extensions.crypt(p_coaccion, v_hash) then
    raise exception 'El PIN de coacción tiene que ser distinto de tu PIN.' using errcode = '22023';
  end if;

  update private.pin_seguridad
     set coaccion_hash = extensions.crypt(p_coaccion, extensions.gen_salt('bf'))
   where usuario_id = auth.uid();
  return v_res;
end;
$$;

create or replace function public.quitar_pin_coaccion(p_pin text)
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
  if v_res ->> 'resultado' = 'ok' then
    update private.pin_seguridad set coaccion_hash = null where usuario_id = auth.uid();
  end if;
  return v_res;
end;
$$;

-- El PIN real nunca puede quedar igual al de coacción.
create or replace function private.pin_choca_con_coaccion(p_usuario uuid, p_pin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.pin_seguridad
     where usuario_id = p_usuario
       and coaccion_hash is not null
       and coaccion_hash = extensions.crypt(p_pin, coaccion_hash)
  );
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

  if private.pin_choca_con_coaccion(auth.uid(), p_nuevo) then
    raise exception 'Tu PIN tiene que ser distinto del PIN de coacción.' using errcode = '22023';
  end if;

  update private.pin_seguridad
     set pin_hash = extensions.crypt(p_nuevo, extensions.gen_salt('bf')),
         establecido_en = now()
   where usuario_id = auth.uid();
  return v_res;
end;
$$;

-- Restablecer (olvidó el PIN) borra también el de coacción: hay que volver a crearlo.
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
     where usuario_id = auth.uid() and tipo = 'sos' and estado in ('activa', 'en_atencion') and not coaccion
  ) then
    raise exception 'No puedes restablecer el PIN con una alerta SOS activa.' using errcode = '42501';
  end if;

  insert into private.pin_seguridad (usuario_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_nuevo, extensions.gen_salt('bf')))
  on conflict (usuario_id) do update
    set pin_hash = excluded.pin_hash,
        establecido_en = now(),
        intentos_fallidos = 0,
        bloqueado_hasta = null,
        coaccion_hash = null;
end;
$$;

-- Cancela el SOS propio. Con el PIN de coacción responde lo mismo que una
-- cancelación normal (más `seguir`, para que el teléfono siga mandando su
-- ubicación sin mostrar nada), pero la alerta sigue abierta en la central.
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

  if private.pin_formato_valido(p_pin) and private.pin_choca_con_coaccion(auth.uid(), p_pin) then
    perform set_config('cuidachile.coaccion', 'on', true);
    update public.alertas
       set coaccion = true, coaccion_en = now()
     where id = p_alerta_id
       and usuario_id = auth.uid()
       and tipo = 'sos'
       and estado in ('activa', 'en_atencion')
       and not coaccion;
    if found then
      return jsonb_build_object('resultado', 'cancelada', 'seguir', true);
    end if;
    return jsonb_build_object('resultado', 'ya_cerrada');
  end if;

  v_res := private.verificar_pin(auth.uid(), p_pin);
  if v_res ->> 'resultado' not in ('ok', 'sin_pin') then
    return v_res;
  end if;

  perform set_config('cuidachile.cancelando_sos', 'on', true);
  update public.alertas
     set estado = 'cancelada'
   where id = p_alerta_id
     and usuario_id = auth.uid()
     and tipo = 'sos'
     and estado in ('activa', 'en_atencion')
     and not coaccion;

  return jsonb_build_object('resultado', case when found then 'cancelada' else 'ya_cerrada' end);
end;
$$;

-- El teléfono sigue mandando su ubicación tras una cancelación con coacción.
-- Devuelve false cuando la central ya cerró la alerta (el teléfono deja de enviar).
create or replace function public.ubicacion_silenciosa(p_alerta_id uuid, p_lat double precision, p_lng double precision)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.alertas
     set lat = p_lat, lng = p_lng
   where id = p_alerta_id
     and usuario_id = auth.uid()
     and coaccion
     and estado in ('activa', 'en_atencion');
  return found;
end;
$$;

revoke all on function private.pin_choca_con_coaccion(uuid, text) from public, anon, authenticated;
revoke all on function public.tiene_pin_coaccion() from public, anon;
revoke all on function public.establecer_pin_coaccion(text, text) from public, anon;
revoke all on function public.quitar_pin_coaccion(text) from public, anon;
revoke all on function public.ubicacion_silenciosa(uuid, double precision, double precision) from public, anon;
grant execute on function public.tiene_pin_coaccion() to authenticated;
grant execute on function public.establecer_pin_coaccion(text, text) to authenticated;
grant execute on function public.quitar_pin_coaccion(text) to authenticated;
grant execute on function public.ubicacion_silenciosa(uuid, double precision, double precision) to authenticated;

-- ── 2. Seguimientos (link para los contactos) ───────────────────────────
create table if not exists public.seguimientos (
  token             uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.perfil(id) on delete cascade,
  alerta_id         uuid references public.alertas(id) on delete cascade,
  acompanamiento_id uuid references public.acompanamientos(id) on delete cascade,
  creado_en         timestamptz not null default now(),
  constraint seguimientos_un_objetivo check ((alerta_id is null) <> (acompanamiento_id is null))
);

create unique index if not exists seguimientos_por_alerta on public.seguimientos (alerta_id) where alerta_id is not null;
create unique index if not exists seguimientos_por_acompanamiento
  on public.seguimientos (acompanamiento_id) where acompanamiento_id is not null;
create index if not exists seguimientos_usuario on public.seguimientos (usuario_id);

alter table public.seguimientos enable row level security;
-- Sin políticas: solo las funciones de abajo.
revoke all on public.seguimientos from public, anon, authenticated;

-- Devuelve el token del SOS o de la ruta propia y abierta (lo reutiliza si ya existe).
create or replace function public.crear_seguimiento(p_alerta_id uuid default null, p_acompanamiento_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if (p_alerta_id is null) = (p_acompanamiento_id is null) then
    raise exception 'Indica una alerta o una ruta.' using errcode = '22023';
  end if;

  if p_alerta_id is not null then
    if not exists (
      select 1 from public.alertas
       where id = p_alerta_id and usuario_id = auth.uid() and estado in ('activa', 'en_atencion')
    ) then
      raise exception 'La alerta no está abierta.' using errcode = '42501';
    end if;
    select token into v_token from public.seguimientos where alerta_id = p_alerta_id;
    if v_token is null then
      insert into public.seguimientos (usuario_id, alerta_id) values (auth.uid(), p_alerta_id)
      on conflict do nothing
      returning token into v_token;
      if v_token is null then
        select token into v_token from public.seguimientos where alerta_id = p_alerta_id;
      end if;
    end if;
  else
    if not exists (
      select 1 from public.acompanamientos
       where id = p_acompanamiento_id and usuario_id = auth.uid() and estado in ('PENDIENTE', 'EN_CURSO')
    ) then
      raise exception 'La ruta no está abierta.' using errcode = '42501';
    end if;
    select token into v_token from public.seguimientos where acompanamiento_id = p_acompanamiento_id;
    if v_token is null then
      insert into public.seguimientos (usuario_id, acompanamiento_id) values (auth.uid(), p_acompanamiento_id)
      on conflict do nothing
      returning token into v_token;
      if v_token is null then
        select token into v_token from public.seguimientos where acompanamiento_id = p_acompanamiento_id;
      end if;
    end if;
  end if;
  return v_token;
end;
$$;

-- Lo que ve un contacto con el link, sin cuenta. Fuera de una alerta o ruta
-- abierta (o pasadas 12 h) solo dice que terminó: nunca la ubicación vieja.
create or replace function public.ver_seguimiento(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.seguimientos;
  v_a public.alertas;
  v_r public.acompanamientos;
begin
  select * into v_s from public.seguimientos where token = p_token;
  if not found then
    return jsonb_build_object('estado', 'no_encontrado');
  end if;
  if v_s.creado_en < now() - interval '12 hours' then
    return jsonb_build_object('estado', 'terminado');
  end if;

  if v_s.alerta_id is not null then
    select * into v_a from public.alertas where id = v_s.alerta_id;
    if not found or v_a.estado not in ('activa', 'en_atencion') then
      return jsonb_build_object('estado', 'terminado', 'tipo', 'sos');
    end if;
    return jsonb_build_object(
      'tipo', 'sos',
      'estado', v_a.estado,
      'nombre', split_part(coalesce(v_a.usuario_nombre, ''), ' ', 1),
      'lat', v_a.lat,
      'lng', v_a.lng,
      'actualizado_en', v_a.actualizado_en,
      'atendida', v_a.estado = 'en_atencion'
    );
  end if;

  select * into v_r from public.acompanamientos where id = v_s.acompanamiento_id;
  if not found or v_r.estado not in ('PENDIENTE', 'EN_CURSO') then
    return jsonb_build_object('estado', 'terminado', 'tipo', 'ruta');
  end if;
  return jsonb_build_object(
    'tipo', 'ruta',
    'estado', v_r.estado,
    'nombre', split_part(coalesce(v_r.usuario_nombre, ''), ' ', 1),
    'lat', v_r.lat_actual,
    'lng', v_r.lng_actual,
    'destino', v_r.destino,
    'destino_lat', v_r.destino_lat,
    'destino_lng', v_r.destino_lng,
    'actualizado_en', v_r.actualizado_en,
    'atendida', v_r.estado = 'EN_CURSO'
  );
end;
$$;

revoke all on function public.crear_seguimiento(uuid, uuid) from public, anon;
revoke all on function public.ver_seguimiento(uuid) from public;
grant execute on function public.crear_seguimiento(uuid, uuid) to authenticated;
grant execute on function public.ver_seguimiento(uuid) to anon, authenticated;

-- ── 3. Calificación del operador al terminar una ruta ───────────────────
create table if not exists public.calificaciones (
  acompanamiento_id uuid primary key references public.acompanamientos(id) on delete cascade,
  usuario_id        uuid not null default auth.uid() references public.perfil(id) on delete cascade,
  nota              smallint not null check (nota between 1 and 5),
  creado_en         timestamptz not null default now()
);

alter table public.calificaciones enable row level security;

drop policy if exists calificaciones_select on public.calificaciones;
create policy calificaciones_select on public.calificaciones
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Una sola vez, solo de una ruta propia ya finalizada con operador.
drop policy if exists calificaciones_insert on public.calificaciones;
create policy calificaciones_insert on public.calificaciones
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1 from public.acompanamientos a
       where a.id = acompanamiento_id
         and a.usuario_id = (select auth.uid())
         and a.estado = 'FINALIZADO'
         and a.operador_id is not null
    )
  );

grant select, insert on public.calificaciones to authenticated;
