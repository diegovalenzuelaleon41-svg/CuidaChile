-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Rol definitivo por usuario (RBAC)
--
-- · perfil.rol: 'usuario' | 'operador' | NULL (NULL = aún no elige).
-- · Todo usuario nuevo (email o Google OAuth) recibe su fila en perfil
--   automáticamente, con rol NULL.
-- · El rol solo se asigna con la función asignar_rol(), una única vez.
--   Después es inmutable desde la app; solo se corrige desde el SQL Editor
--   o con service_role.
--
-- Idempotente: se puede ejecutar más de una vez sin romper nada.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columna rol ──────────────────────────────────────────────────────
alter table public.perfil
  add column if not exists rol text default null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfil_rol_valido' and conrelid = 'public.perfil'::regclass
  ) then
    alter table public.perfil
      add constraint perfil_rol_valido check (rol is null or rol in ('usuario', 'operador'));
  end if;
end $$;

-- ── 2. Crear perfil al registrarse (email y Google OAuth) ───────────────
-- Google entrega el nombre en raw_user_meta_data.full_name o .name;
-- el registro por email lo envía en full_name (ver AuthContext.signUp).
create or replace function public.crear_perfil_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, nombre, rol)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    null
  )
  on conflict (id) do nothing;  -- convive con cualquier trigger previo que ya cree la fila
  return new;
exception when others then
  -- Nunca bloquear el registro por un problema con perfil: la fila se
  -- puede crear después. Queda registrado en los logs de Postgres.
  raise warning 'crear_perfil_usuario_nuevo(%): %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_perfil on auth.users;
create trigger on_auth_user_created_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario_nuevo();

-- Usuarios que ya existían sin fila en perfil.
insert into public.perfil (id, nombre, rol)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  null
from auth.users u
where not exists (select 1 from public.perfil p where p.id = u.id)
on conflict (id) do nothing;

-- ── 3. Rol inmutable ────────────────────────────────────────────────────
-- Un UPDATE directo desde el cliente (aunque la política RLS permita editar
-- el propio perfil) NO puede tocar rol. Solo asignar_rol() levanta la
-- bandera cuidachile.asignando_rol durante su transacción.
-- auth.uid() es NULL en el SQL Editor / service_role → los admins pueden
-- corregir roles a mano.
create or replace function public.proteger_rol_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Un cliente no puede autoinsertarse con un rol ya puesto.
    if coalesce(current_setting('cuidachile.asignando_rol', true), '') <> 'on' then
      new.rol := null;
    end if;
    return new;
  end if;

  if new.rol is distinct from old.rol then
    if old.rol is not null then
      raise exception 'El rol es definitivo y no puede cambiarse.' using errcode = '42501';
    end if;
    if coalesce(current_setting('cuidachile.asignando_rol', true), '') <> 'on' then
      raise exception 'El rol solo se asigna con asignar_rol().' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_proteger_rol on public.perfil;
create trigger perfil_proteger_rol
  before insert or update of rol on public.perfil
  for each row execute function public.proteger_rol_perfil();

-- ── 4. Asignar rol (una sola vez) ───────────────────────────────────────
-- Uso desde el cliente: supabase.rpc('asignar_rol', { p_rol: 'usuario' })
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

  -- true = local a esta transacción; se apaga sola al terminar.
  perform set_config('cuidachile.asignando_rol', 'on', true);

  update public.perfil
     set rol = p_rol
   where id = auth.uid()
     and rol is null;

  if found then
    return p_rol;
  end if;

  select rol into v_actual from public.perfil where id = auth.uid();
  if v_actual is not null then
    raise exception 'Tu rol ya fue asignado (%).', v_actual using errcode = 'P0001', hint = 'rol_ya_asignado';
  end if;
  raise exception 'No encontramos tu perfil.' using errcode = 'P0002';
end;
$$;

revoke all on function public.asignar_rol(text) from public, anon;
grant execute on function public.asignar_rol(text) to authenticated;
