-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Chat en tiempo real usuario ↔ operador
--
-- Reutiliza public.mensajes (estaba vacía y sin uso en el frontend):
-- · emisor → emisor_rol ('usuario' | 'operador' | 'sistema').
-- · emisor_id: quién escribió (siempre auth.uid(), no se puede falsear).
-- · acompanamiento_id: el chat de una Ruta Segura. alerta_id se mantiene
--   para el SOS futuro; cada mensaje pertenece a uno de los dos.
--
-- RLS (acompañamientos): solo los involucrados.
-- · Leen: el usuario dueño y el operador asignado (historial incluido).
-- · Escriben: el usuario mientras su ruta está PENDIENTE/EN_CURSO; el
--   operador asignado solo mientras está EN_CURSO. 'sistema' no se inserta
--   desde el cliente. Sin UPDATE ni DELETE: los mensajes son inmutables.
-- Las políticas antiguas daban a cualquier "operador" (JWT) acceso a TODOS
-- los mensajes; para alerta_id se conserva esa regla hasta conectar el SOS.
--
-- Requiere 20261030000000_acompanamientos.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ─────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mensajes' and column_name = 'emisor'
  ) then
    alter table public.mensajes rename column emisor to emisor_rol;
  end if;
end $$;

alter table public.mensajes
  add column if not exists emisor_id uuid default auth.uid() references auth.users(id) on delete set null,
  add column if not exists acompanamiento_id uuid references public.acompanamientos(id) on delete cascade;

alter table public.mensajes alter column alerta_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mensajes_un_destino' and conrelid = 'public.mensajes'::regclass
  ) then
    alter table public.mensajes
      add constraint mensajes_un_destino check (num_nonnulls(alerta_id, acompanamiento_id) = 1);
  end if;
end $$;

create index if not exists mensajes_acompanamiento_idx
  on public.mensajes (acompanamiento_id, creado_en)
  where acompanamiento_id is not null;

-- ── 2. La hora la pone el servidor ──────────────────────────────────────
create or replace function public.sellar_mensaje()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.creado_en := now();
  return new;
end;
$$;

drop trigger if exists mensajes_sellar on public.mensajes;
create trigger mensajes_sellar
  before insert on public.mensajes
  for each row execute function public.sellar_mensaje();

-- ── 3. RLS ──────────────────────────────────────────────────────────────
alter table public.mensajes enable row level security;

drop policy if exists mensajes_lectura on public.mensajes;
drop policy if exists mensajes_insert on public.mensajes;
drop policy if exists mensajes_select on public.mensajes;

create policy mensajes_select on public.mensajes
  for select to authenticated
  using (
    (
      acompanamiento_id is not null
      and exists (
        select 1 from public.acompanamientos a
        where a.id = mensajes.acompanamiento_id
          and (a.usuario_id = (select auth.uid()) or a.operador_id = (select auth.uid()))
      )
    )
    or (
      alerta_id is not null
      and (
        (select private.fn_es_operador())
        or exists (select 1 from public.alertas al where al.id = mensajes.alerta_id and al.usuario_id = (select auth.uid()))
      )
    )
  );

create policy mensajes_insert on public.mensajes
  for insert to authenticated
  with check (
    emisor_id = (select auth.uid())
    and (
      (
        acompanamiento_id is not null
        and exists (
          select 1 from public.acompanamientos a
          where a.id = mensajes.acompanamiento_id
            and (
              (mensajes.emisor_rol = 'usuario' and a.usuario_id = (select auth.uid()) and a.estado in ('PENDIENTE', 'EN_CURSO'))
              or (mensajes.emisor_rol = 'operador' and a.operador_id = (select auth.uid()) and a.estado = 'EN_CURSO')
            )
        )
      )
      or (
        alerta_id is not null
        and (
          (mensajes.emisor_rol = 'operador' and (select private.fn_es_operador()))
          or (
            mensajes.emisor_rol = 'usuario'
            and exists (select 1 from public.alertas al where al.id = mensajes.alerta_id and al.usuario_id = (select auth.uid()))
          )
        )
      )
    )
  );

-- ── 4. Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes'
  ) then
    alter publication supabase_realtime add table public.mensajes;
  end if;
end $$;
