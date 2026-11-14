-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — SOS real (botón de pánico → panel del operador)
--
-- La tabla public.alertas ya existía pero el SOS nunca llegaba al operador:
-- · operador_id apuntaba a public.operador (vacía) en vez de perfil.
-- · RLS usaba private.fn_es_operador() (rol del JWT); los operadores reales
--   tienen el rol en perfil → ahora es_operador_aprobado(), igual que
--   acompanamientos.
-- · No estaba en Realtime.
--
-- Flujo (tipo = 'sos'):
--   1. El usuario toca SOS → fila 'activa' (sin confirmación).
--   2. Un operador aprobado la atiende → 'en_atencion' + operador_id = él.
--   3. Mientras está abierta, el usuario envía lat/lng cada pocos segundos.
--   4. Termina en 'resuelta' (operador asignado), 'cancelada' (usuario) o
--      'descartada' (operador, con motivo_cierre).
--
-- RLS decide QUIÉN toca la fila; validar_alerta() decide QUÉ puede cambiar.
-- Requiere 20261029010000_aprobacion_operador.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ─────────────────────────────────────────────────────────
alter table public.alertas
  add column if not exists usuario_nombre   text,
  add column if not exists usuario_telefono text,
  add column if not exists actualizado_en   timestamptz not null default now(),
  add column if not exists cerrada_en       timestamptz,
  add column if not exists motivo_cierre    text
    check (motivo_cierre is null or char_length(btrim(motivo_cierre)) between 1 and 200);

-- operador_id → perfil (antes public.operador, que nunca se pobló).
alter table public.alertas drop constraint if exists alertas_operador_id_fkey;
update public.alertas set operador_id = null
 where operador_id is not null
   and not exists (select 1 from public.perfil p where p.id = alertas.operador_id);
alter table public.alertas
  add constraint alertas_operador_id_fkey
  foreign key (operador_id) references public.perfil(id) on delete set null;

alter table public.alertas drop constraint if exists alertas_estado;
alter table public.alertas
  add constraint alertas_estado
  check (estado in ('activa', 'en_atencion', 'resuelta', 'cancelada', 'falsa_alarma', 'descartada'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alertas_coords_validas' and conrelid = 'public.alertas'::regclass
  ) then
    alter table public.alertas
      add constraint alertas_coords_validas
      check ((lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180));
  end if;
end $$;

-- ── 2. Datos de prueba previos ──────────────────────────────────────────
-- SOS de demo que quedaron 'activa' para siempre (antes nadie podía cerrarlos).
update public.alertas
   set estado = 'cancelada', cerrada_en = now()
 where tipo = 'sos' and estado in ('activa', 'en_atencion')
   and creada_en < now() - interval '12 hours';

-- Duplicados abiertos del mismo usuario: queda solo el más reciente.
update public.alertas a
   set estado = 'cancelada', cerrada_en = now()
 where a.tipo = 'sos' and a.estado in ('activa', 'en_atencion')
   and exists (
     select 1 from public.alertas b
      where b.usuario_id = a.usuario_id and b.tipo = 'sos'
        and b.estado in ('activa', 'en_atencion')
        and (b.creada_en, b.id) > (a.creada_en, a.id)
   );

update public.alertas a
   set usuario_nombre = p.nombre, usuario_telefono = p.telefono
  from public.perfil p
 where p.id = a.usuario_id and a.usuario_nombre is null;

-- ── 3. Índices ──────────────────────────────────────────────────────────
-- Un usuario tiene como máximo un SOS abierto (un segundo toque reutiliza el actual).
create unique index if not exists alertas_un_sos_abierto_por_usuario
  on public.alertas (usuario_id)
  where tipo = 'sos' and estado in ('activa', 'en_atencion');

-- Bandeja del operador.
create index if not exists alertas_abiertas
  on public.alertas (creada_en)
  where estado in ('activa', 'en_atencion');

-- ── 4. Al insertar: datos del usuario y estado inicial forzado ──────────
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

  -- SQL Editor / service_role pueden insertar lo que quieran (pruebas).
  if auth.uid() is not null then
    new.estado         := 'activa';
    new.operador_id    := null;
    new.atendida_en    := null;
    new.cerrada_en     := null;
    new.motivo_cierre  := null;
    new.creada_en      := now();
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

revoke execute on function public.completar_alerta() from public, anon, authenticated;

drop trigger if exists alertas_completar on public.alertas;
create trigger alertas_completar
  before insert on public.alertas
  for each row execute function public.completar_alerta();

-- ── 5. Transiciones permitidas ──────────────────────────────────────────
create or replace function public.validar_alerta()
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
     or new.tipo is distinct from old.tipo
     or new.creada_en is distinct from old.creada_en
     or new.usuario_nombre is distinct from old.usuario_nombre
     or new.usuario_telefono is distinct from old.usuario_telefono then
    raise exception 'Solo se puede cambiar el estado y la ubicación de la alerta.' using errcode = '42501';
  end if;

  if old.estado not in ('activa', 'en_atencion') then
    raise exception 'La alerta ya terminó.' using errcode = '42501';
  end if;

  -- ── Usuario dueño: GPS o cancelar ──
  if v_uid = old.usuario_id then
    if new.operador_id is distinct from old.operador_id
       or new.atendida_en is distinct from old.atendida_en
       or new.motivo_cierre is distinct from old.motivo_cierre then
      raise exception 'El usuario no puede asignar operador.' using errcode = '42501';
    end if;

    if new.estado is distinct from old.estado then
      if new.estado <> 'cancelada' then
        raise exception 'Transición no permitida: % → %', old.estado, new.estado using errcode = '42501';
      end if;
      new.cerrada_en := now();
    end if;
    return new;
  end if;

  -- ── Operador aprobado: atender, resolver o descartar ──
  if public.es_operador_aprobado() then
    if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
      raise exception 'Solo el usuario envía su ubicación.' using errcode = '42501';
    end if;

    -- Descartar: una activa (de nadie) o una propia en atención. Queda a su nombre.
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

drop trigger if exists alertas_validar on public.alertas;
create trigger alertas_validar
  before update on public.alertas
  for each row execute function public.validar_alerta();

-- ── 6. RLS ──────────────────────────────────────────────────────────────
alter table public.alertas enable row level security;

drop policy if exists alertas_operador on public.alertas;
drop policy if exists alertas_propio on public.alertas;
drop policy if exists alertas_select on public.alertas;
drop policy if exists alertas_insert on public.alertas;
drop policy if exists alertas_update on public.alertas;

-- Los operadores ven todas: así reciben por Realtime cuándo otra la toma o se cancela.
create policy alertas_select on public.alertas
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Solo el propio usuario crea su alerta (estado inicial lo fuerza completar_alerta()).
create policy alertas_insert on public.alertas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Quién puede actualizar; qué puede cambiar lo decide validar_alerta().
create policy alertas_update on public.alertas
  for update to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()))
  with check (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- Sin DELETE: el historial de alertas se conserva.

-- ── 7. Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alertas'
  ) then
    alter publication supabase_realtime add table public.alertas;
  end if;
end $$;
