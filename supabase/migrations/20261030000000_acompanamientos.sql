-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Acompañamientos en tiempo real (Ruta Segura)
--
-- Flujo:
--   1. El usuario inicia una ruta → fila con estado 'PENDIENTE'.
--   2. Un operador aprobado la acepta → 'EN_CURSO' + operador_id = él.
--   3. Mientras está EN_CURSO, el usuario envía lat_actual/lng_actual.
--   4. Termina en 'FINALIZADO' (usuario u operador) o 'CANCELADO'
--      (el usuario se arrepiente antes de que alguien la acepte).
--
-- · rutas sigue siendo el historial del usuario; acompanamientos es la
--   sesión de monitoreo en vivo (ruta_id enlaza ambas).
-- · Coordenadas en double precision, igual que rutas/ubicaciones.
-- · Las transiciones se validan en un trigger: RLS decide QUIÉN puede
--   tocar la fila, el trigger decide QUÉ puede cambiar cada uno.
--
-- Requiere 20261029010000_aprobacion_operador.sql (es_operador_aprobado).
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla ────────────────────────────────────────────────────────────
create table if not exists public.acompanamientos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfil(id) on delete cascade,
  operador_id     uuid references public.perfil(id) on delete set null,
  ruta_id         uuid references public.rutas(id) on delete set null,
  estado          text not null default 'PENDIENTE'
                  check (estado in ('PENDIENTE', 'EN_CURSO', 'FINALIZADO', 'CANCELADO')),
  origen          text not null,
  destino         text not null check (btrim(destino) <> ''),
  lat_actual      double precision check (lat_actual is null or lat_actual between -90 and 90),
  lng_actual      double precision check (lng_actual is null or lng_actual between -180 and 180),
  aceptado_en     timestamptz,
  finalizado_en   timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table public.acompanamientos is
  'Sesión de monitoreo en vivo de una Ruta Segura (usuario ↔ operador). Realtime habilitado.';

-- Un usuario tiene como máximo un acompañamiento abierto.
create unique index if not exists acompanamientos_un_abierto_por_usuario
  on public.acompanamientos (usuario_id)
  where estado in ('PENDIENTE', 'EN_CURSO');

-- Bandeja del operador.
create index if not exists acompanamientos_pendientes
  on public.acompanamientos (creado_en)
  where estado = 'PENDIENTE';

create index if not exists acompanamientos_operador
  on public.acompanamientos (operador_id)
  where operador_id is not null;

create index if not exists acompanamientos_ruta
  on public.acompanamientos (ruta_id)
  where ruta_id is not null;

-- ── 2. Transiciones permitidas ──────────────────────────────────────────
create or replace function public.validar_acompanamiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  new.actualizado_en := now();

  -- SQL Editor / service_role: sin restricciones.
  if v_uid is null then
    return new;
  end if;

  if new.usuario_id is distinct from old.usuario_id
     or new.ruta_id is distinct from old.ruta_id
     or new.origen is distinct from old.origen
     or new.destino is distinct from old.destino
     or new.creado_en is distinct from old.creado_en then
    raise exception 'Solo se puede cambiar el estado y la ubicación del acompañamiento.' using errcode = '42501';
  end if;

  if old.estado in ('FINALIZADO', 'CANCELADO') then
    raise exception 'El acompañamiento ya terminó.' using errcode = '42501';
  end if;

  -- ── Usuario dueño: GPS, cancelar o finalizar ──
  if v_uid = old.usuario_id then
    if new.operador_id is distinct from old.operador_id
       or new.aceptado_en is distinct from old.aceptado_en then
      raise exception 'El usuario no puede asignar operador.' using errcode = '42501';
    end if;

    if new.estado is distinct from old.estado then
      if not (
        (old.estado = 'PENDIENTE' and new.estado = 'CANCELADO')
        or (old.estado = 'EN_CURSO' and new.estado = 'FINALIZADO')
      ) then
        raise exception 'Transición no permitida: % → %', old.estado, new.estado using errcode = '42501';
      end if;
      new.finalizado_en := now();
    end if;
    return new;
  end if;

  -- ── Operador aprobado: aceptar o finalizar ──
  if public.es_operador_aprobado() then
    if new.lat_actual is distinct from old.lat_actual
       or new.lng_actual is distinct from old.lng_actual then
      raise exception 'Solo el usuario envía su ubicación.' using errcode = '42501';
    end if;

    if old.estado = 'PENDIENTE' and new.estado = 'EN_CURSO' then
      if old.operador_id is not null or new.operador_id is distinct from v_uid then
        raise exception 'El operador solo puede asignarse a sí mismo.' using errcode = '42501';
      end if;
      new.aceptado_en := now();
      return new;
    end if;

    if old.estado = 'EN_CURSO' and new.estado = 'FINALIZADO'
       and old.operador_id = v_uid and new.operador_id = v_uid then
      new.finalizado_en := now();
      return new;
    end if;

    raise exception 'Transición no permitida para el operador: % → %', old.estado, new.estado using errcode = '42501';
  end if;

  raise exception 'Sin permiso sobre este acompañamiento.' using errcode = '42501';
end;
$$;

drop trigger if exists acompanamientos_validar on public.acompanamientos;
create trigger acompanamientos_validar
  before update on public.acompanamientos
  for each row execute function public.validar_acompanamiento();

-- ── 3. RLS ──────────────────────────────────────────────────────────────
alter table public.acompanamientos enable row level security;

-- Los operadores ven todos (igual que rutas_operador): así reciben por
-- Realtime cuándo una solicitud se cancela o la toma otro operador.
drop policy if exists acompanamientos_select on public.acompanamientos;
create policy acompanamientos_select on public.acompanamientos
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Solo el propio usuario crea su solicitud, siempre PENDIENTE y sin operador.
drop policy if exists acompanamientos_insert on public.acompanamientos;
create policy acompanamientos_insert on public.acompanamientos
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and estado = 'PENDIENTE'
    and operador_id is null
    and aceptado_en is null
    and finalizado_en is null
  );

-- Quién puede actualizar; qué puede cambiar lo decide validar_acompanamiento().
drop policy if exists acompanamientos_update on public.acompanamientos;
create policy acompanamientos_update on public.acompanamientos
  for update to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()))
  with check (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Sin DELETE: el historial de acompañamientos se conserva.

-- ── 4. Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acompanamientos'
  ) then
    alter publication supabase_realtime add table public.acompanamientos;
  end if;
end $$;
