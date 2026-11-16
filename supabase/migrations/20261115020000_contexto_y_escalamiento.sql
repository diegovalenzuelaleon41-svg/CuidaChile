-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Panel del operador: contexto del ciudadano y escalamiento
--
-- 1. contexto_ciudadano(usuario): lo mínimo que el operador necesita saber
--    del ciudadano que está atendiendo, SOLO conteos:
--      · alertas SOS previas (y cuándo fue la última),
--      · cuántos contactos de confianza tiene configurados.
--    No expone nombres ni teléfonos de los contactos. Solo para operadores
--    aprobados y solo sobre ciudadanos con una alerta o ruta abierta (no se
--    puede consultar a cualquier usuario).
--
-- 2. alerta_escalamientos: bitácora de escalamientos a supervisor
--    (violencia, rehén, falla técnica…). Solo puede escalar el operador
--    asignado y mientras el caso está abierto. Uno por caso. Lo leen quien
--    escaló y los perfiles supervisor/admin. Está en Realtime para un futuro
--    panel de supervisor.
--
-- Requiere 20261114000000_alertas_sos.sql y 20261030000000_acompanamientos.sql.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Contexto del ciudadano ───────────────────────────────────────────
create or replace function public.contexto_ciudadano(p_usuario_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_operador_aprobado() then
    raise exception 'Solo operadores aprobados.' using errcode = '42501';
  end if;

  -- Solo ciudadanos que hoy están pidiendo ayuda.
  if not exists (
    select 1 from public.alertas
     where usuario_id = p_usuario_id and estado in ('activa', 'en_atencion')
    union all
    select 1 from public.acompanamientos
     where usuario_id = p_usuario_id and estado in ('PENDIENTE', 'EN_CURSO')
  ) then
    raise exception 'Este ciudadano no tiene casos abiertos.' using errcode = '42501';
  end if;

  return json_build_object(
    'alertas_previas', (
      select count(*) from public.alertas
       where usuario_id = p_usuario_id and tipo = 'sos' and estado not in ('activa', 'en_atencion')
    ),
    'ultima_alerta_previa', (
      select max(creada_en) from public.alertas
       where usuario_id = p_usuario_id and tipo = 'sos' and estado not in ('activa', 'en_atencion')
    ),
    'contactos', (select count(*) from public.contactos where usuario_id = p_usuario_id)
  );
end;
$$;

revoke all on function public.contexto_ciudadano(uuid) from public, anon;
grant execute on function public.contexto_ciudadano(uuid) to authenticated;

-- ── 2. Escalamientos a supervisor ───────────────────────────────────────
create table if not exists public.alerta_escalamientos (
  id                uuid primary key default gen_random_uuid(),
  alerta_id         uuid references public.alertas(id) on delete cascade,
  acompanamiento_id uuid references public.acompanamientos(id) on delete cascade,
  operador_id       uuid not null default auth.uid() references public.perfil(id) on delete cascade,
  motivo            text not null check (motivo in ('violencia', 'rehen', 'falla_tecnica', 'otro')),
  creado_en         timestamptz not null default now(),
  constraint alerta_escalamientos_un_caso check (num_nonnulls(alerta_id, acompanamiento_id) = 1)
);

comment on table public.alerta_escalamientos is
  'Escalamientos a supervisor (bitácora). Uno por caso; solo los crea el operador asignado.';

create unique index if not exists alerta_escalamientos_uno_por_alerta
  on public.alerta_escalamientos (alerta_id) where alerta_id is not null;
create unique index if not exists alerta_escalamientos_uno_por_acompanamiento
  on public.alerta_escalamientos (acompanamiento_id) where acompanamiento_id is not null;

-- La hora la pone el servidor.
create or replace function public.sellar_escalamiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.creado_en := now();
  return new;
end;
$$;

drop trigger if exists alerta_escalamientos_sellar on public.alerta_escalamientos;
create trigger alerta_escalamientos_sellar
  before insert on public.alerta_escalamientos
  for each row execute function public.sellar_escalamiento();

alter table public.alerta_escalamientos enable row level security;

drop policy if exists alerta_escalamientos_select on public.alerta_escalamientos;
create policy alerta_escalamientos_select on public.alerta_escalamientos
  for select to authenticated
  using (
    operador_id = (select auth.uid())
    or exists (
      select 1 from public.perfil p
       where p.id = (select auth.uid()) and p.rol in ('supervisor', 'admin')
    )
  );

drop policy if exists alerta_escalamientos_insert on public.alerta_escalamientos;
create policy alerta_escalamientos_insert on public.alerta_escalamientos
  for insert to authenticated
  with check (
    operador_id = (select auth.uid())
    and (select public.es_operador_aprobado())
    and (
      (
        alerta_id is not null
        and exists (
          select 1 from public.alertas al
           where al.id = alerta_escalamientos.alerta_id
             and al.operador_id = (select auth.uid()) and al.estado = 'en_atencion'
        )
      )
      or (
        acompanamiento_id is not null
        and exists (
          select 1 from public.acompanamientos a
           where a.id = alerta_escalamientos.acompanamiento_id
             and a.operador_id = (select auth.uid()) and a.estado = 'EN_CURSO'
        )
      )
    )
  );
-- Sin UPDATE ni DELETE: es bitácora.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerta_escalamientos'
  ) then
    alter publication supabase_realtime add table public.alerta_escalamientos;
  end if;
end $$;
