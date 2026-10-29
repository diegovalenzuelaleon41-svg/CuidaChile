-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Reconciliar perfil con el esquema real de la BD
--
-- 20261029000000 y 20261029010000 asumían perfil.rol text nullable, pero en
-- la BD rol es el enum perfil_rol NOT NULL DEFAULT 'usuario' y email es
-- citext NOT NULL. Resultado: operador_estado no existía (el SELECT del
-- frontend fallaba con 42703), el trigger nuevo fallaba en silencio y
-- asignar_rol() nunca encontraba rol NULL.
--
-- Esta migración:
--  · agrega operador_estado
--  · deja rol nullable y sin default (NULL = aún no elige)
--  · deja UN solo trigger en auth.users que crea el perfil con email y rol NULL
--  · adapta proteger_rol_perfil() y asignar_rol() al enum
--
-- Los perfiles existentes conservan su rol actual. Las políticas RLS no
-- dependen de perfil.rol (usan el JWT vía private.fn_rol_actual()).
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ─────────────────────────────────────────────────────────
alter table public.perfil
  add column if not exists operador_estado text default null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfil_operador_estado_valido' and conrelid = 'public.perfil'::regclass
  ) then
    alter table public.perfil
      add constraint perfil_operador_estado_valido
      check (operador_estado is null or operador_estado in ('pendiente', 'aprobado', 'rechazado'));
  end if;
end $$;

alter table public.perfil alter column rol drop not null;
alter table public.perfil alter column rol drop default;

update public.perfil
   set operador_estado = 'pendiente'
 where rol = 'operador' and operador_estado is null;

-- ── 2. Crear perfil al registrarse (email y Google OAuth) ───────────────
create or replace function public.crear_perfil_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, nombre, email, rol)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    coalesce(new.email, 'usuario-' || new.id || '@cuidachile.local'),
    null
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Nunca bloquear el registro; el frontend crea la fila si falta.
  raise warning 'crear_perfil_usuario_nuevo(%): %', new.id, sqlerrm;
  return new;
end;
$$;

-- El trigger antiguo creaba el perfil con rol = 'usuario' por defecto.
drop trigger if exists trg_crear_perfil_al_registrar on auth.users;
drop trigger if exists on_auth_user_created_perfil on auth.users;
create trigger on_auth_user_created_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario_nuevo();

-- ── 3. Proteger rol y operador_estado ───────────────────────────────────
create or replace function public.proteger_rol_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_desde_rpc boolean := coalesce(current_setting('cuidachile.asignando_rol', true), '') = 'on';
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_desde_rpc then
      new.rol := null;
      new.operador_estado := null;
    end if;
    return new;
  end if;

  if new.rol is distinct from old.rol then
    if old.rol is not null then
      raise exception 'El rol es definitivo y no puede cambiarse.' using errcode = '42501';
    end if;
    if not v_desde_rpc then
      raise exception 'El rol solo se asigna con asignar_rol().' using errcode = '42501';
    end if;
  end if;

  if new.operador_estado is distinct from old.operador_estado and not v_desde_rpc then
    raise exception 'Solo un administrador puede aprobar operadores.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists perfil_proteger_rol on public.perfil;
create trigger perfil_proteger_rol
  before insert or update of rol, operador_estado on public.perfil
  for each row execute function public.proteger_rol_perfil();

-- ── 4. asignar_rol (una sola vez) ───────────────────────────────────────
create or replace function public.asignar_rol(p_rol text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_rol is null or p_rol not in ('usuario', 'operador') then
    raise exception 'Rol inválido: %', p_rol using errcode = '22023';
  end if;

  perform set_config('cuidachile.asignando_rol', 'on', true);

  update public.perfil
     set rol = p_rol::public.perfil_rol,
         operador_estado = case when p_rol = 'operador' then 'pendiente' end
   where id = auth.uid()
     and rol is null;

  if found then
    return p_rol;
  end if;

  select rol::text into v_actual from public.perfil where id = auth.uid();
  if v_actual is not null then
    raise exception 'Tu rol ya fue asignado (%).', v_actual using errcode = 'P0001', hint = 'rol_ya_asignado';
  end if;
  raise exception 'No encontramos tu perfil.' using errcode = 'P0002';
end;
$$;

revoke all on function public.asignar_rol(text) from public, anon;
grant execute on function public.asignar_rol(text) to authenticated;

-- ── 5. aprobar_operador (solo admins) ───────────────────────────────────
create or replace function public.aprobar_operador(p_email text, p_aprobar boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text := case when p_aprobar then 'aprobado' else 'rechazado' end;
begin
  update public.perfil p
     set operador_estado = v_estado
    from auth.users u
   where u.id = p.id
     and lower(u.email) = lower(trim(p_email))
     and p.rol = 'operador';

  if not found then
    raise exception 'No hay un operador con el correo %.', p_email using errcode = 'P0002';
  end if;
  return v_estado;
end;
$$;

revoke all on function public.aprobar_operador(text, boolean) from public, anon, authenticated;

-- ── 6. Helper para políticas RLS ────────────────────────────────────────
create or replace function public.es_operador_aprobado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfil
     where id = auth.uid() and rol = 'operador' and operador_estado = 'aprobado'
  );
$$;

revoke all on function public.es_operador_aprobado() from public, anon;
grant execute on function public.es_operador_aprobado() to authenticated;
