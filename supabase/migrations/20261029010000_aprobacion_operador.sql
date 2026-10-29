-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Aprobación de operadores
--
-- Elegir "Soy Operador" deja rol = 'operador' (definitivo) pero con
-- operador_estado = 'pendiente'. El panel de operador solo se abre con
-- operador_estado = 'aprobado', que solo un admin puede poner:
--
--   select public.aprobar_operador('persona@correo.com');          -- aprobar
--   select public.aprobar_operador('persona@correo.com', false);   -- rechazar
--
-- Solicitudes pendientes:
--   select p.id, u.email, p.nombre, u.created_at
--     from public.perfil p join auth.users u on u.id = p.id
--    where p.operador_estado = 'pendiente' order by u.created_at;
--
-- Requiere 20261029000000_rol_perfil.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columna operador_estado ──────────────────────────────────────────
-- NULL para usuarios (y para quien aún no elige rol).
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

-- Operadores que eligieron antes de esta migración: quedan pendientes de revisión.
update public.perfil
   set operador_estado = 'pendiente'
 where rol = 'operador' and operador_estado is null;

-- ── 2. Proteger rol y operador_estado ───────────────────────────────────
-- Igual que antes para rol, y ahora operador_estado tampoco se puede tocar
-- desde el cliente: solo asignar_rol() (que lo deja en 'pendiente') o un
-- admin desde el SQL Editor / service_role (auth.uid() es NULL).
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
    -- Un cliente no puede autoinsertarse con rol ni con aprobación.
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

-- ── 3. asignar_rol: operador entra como pendiente ───────────────────────
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
     set rol = p_rol,
         operador_estado = case when p_rol = 'operador' then 'pendiente' end
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

-- ── 4. aprobar_operador (solo admins) ───────────────────────────────────
-- Sin grant a anon/authenticated: solo se ejecuta desde el SQL Editor
-- (rol postgres) o con service_role.
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

-- ── 5. Helper para políticas RLS ────────────────────────────────────────
-- Para las políticas de alertas/reportes del panel, p. ej.:
--   create policy "operadores leen alertas" on public.alertas
--     for select to authenticated using (public.es_operador_aprobado());
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
