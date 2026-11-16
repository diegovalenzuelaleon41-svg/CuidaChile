-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Reportes barriales moderados (evidencia, anonimato, feedback)
--
-- Antes: cualquier reporte aparecía al instante en el mapa de todos y la
-- política reportes_lectura (using true) dejaba leer usuario_id de cada
-- reporte a cualquiera. Ahora:
--
--   1. El vecino reporta → fila 'pendiente' (solo la ven él y los operadores).
--   2. Un operador aprobado la valida o la descarta con revisar_reportes().
--   3. Al validarla, un trigger la copia a public.reportes_publicos: lo que
--      ve la comunidad, SIN usuario_id ni evidencia (anonimato real).
--   4. El autor recibe el resultado por Realtime (UPDATE de su fila) o, si
--      estaba offline, al volver a abrir la app (usuario_visto = false).
--
-- Evidencia (foto y/o nota de voz) en el bucket privado 'evidencias', ruta
-- {usuario_id}/{reporte_id}/archivo. Solo el autor y los operadores la leen
-- (URL firmada). evidencia_url = foto, audio_url = nota de voz (rutas en el
-- bucket, no URLs públicas).
--
-- Requiere 20261029010000_aprobacion_operador.sql (es_operador_aprobado). Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas ─────────────────────────────────────────────────────────
alter table public.reportes
  add column if not exists estado          text        not null default 'pendiente',
  add column if not exists es_anonimo      boolean     not null default false,
  add column if not exists evidencia_url   text,
  add column if not exists audio_url       text,
  add column if not exists usuario_nombre  text,
  add column if not exists revisado_por    uuid references public.perfil(id) on delete set null,
  add column if not exists revisado_en     timestamptz,
  add column if not exists motivo_descarte text,
  add column if not exists usuario_visto   boolean     not null default true;

-- Categorías nuevas. Los reportes previos (ya expirados) se mapean y quedan
-- como validados: antes se publicaban sin moderación.
alter table public.reportes drop constraint if exists reportes_categoria;
update public.reportes set categoria = case categoria
    when 'robo' then 'personas'
    when 'sospechoso' then 'personas'
    when 'accidente' then 'otro'
    else categoria end
 where categoria not in ('vehiculo', 'personas', 'ruidos', 'otro');
update public.reportes set estado = 'validado' where estado = 'pendiente' and expira_en < now();
alter table public.reportes
  add constraint reportes_categoria check (categoria in ('vehiculo', 'personas', 'ruidos', 'otro'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reportes_estado' and conrelid = 'public.reportes'::regclass) then
    alter table public.reportes
      add constraint reportes_estado check (estado in ('pendiente', 'validado', 'descartado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reportes_motivo_descarte' and conrelid = 'public.reportes'::regclass) then
    alter table public.reportes
      add constraint reportes_motivo_descarte
      check (motivo_descarte is null or char_length(btrim(motivo_descarte)) between 1 and 120);
  end if;
end $$;

-- Bandeja del operador.
create index if not exists reportes_pendientes on public.reportes (creado_en) where estado = 'pendiente';
-- Avisos pendientes del autor.
create index if not exists reportes_sin_ver on public.reportes (usuario_id) where not usuario_visto;

-- ── 2. Tabla pública (lo que ve la comunidad) ───────────────────────────
create table if not exists public.reportes_publicos (
  id          uuid primary key references public.reportes(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  categoria   text not null,
  gravedad    text not null,
  descripcion text,
  creado_en   timestamptz not null,
  validado_en timestamptz not null default now(),
  expira_en   timestamptz not null
);

create index if not exists reportes_publicos_vigentes on public.reportes_publicos (expira_en);

alter table public.reportes_publicos enable row level security;
revoke all on public.reportes_publicos from anon;
revoke insert, update, delete, truncate on public.reportes_publicos from authenticated;
grant select on public.reportes_publicos to authenticated;

drop policy if exists reportes_publicos_lectura on public.reportes_publicos;
create policy reportes_publicos_lectura on public.reportes_publicos
  for select to authenticated
  using (expira_en > now());

-- ── 3. Al insertar: estado inicial, gravedad por categoría, nombre ──────
create or replace function public.completar_reporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text := new.usuario_id::text || '/' || new.id::text || '/';
begin
  -- SQL Editor / service_role: sin restricciones (pruebas).
  if auth.uid() is null then
    return new;
  end if;

  new.estado          := 'pendiente';
  new.revisado_por    := null;
  new.revisado_en     := null;
  new.motivo_descarte := null;
  new.usuario_visto   := true;
  new.creado_en       := now();
  new.expira_en       := now() + interval '6 hours';
  -- La gravedad la define la categoría (el vecino no tiene que decidirla).
  new.gravedad := case new.categoria
    when 'ruidos'   then 'rojo'
    when 'otro'     then 'azul'
    else 'amarillo' end;

  -- La evidencia solo puede apuntar a la carpeta propia de este reporte.
  if (new.evidencia_url is not null and left(new.evidencia_url, length(v_prefijo)) <> v_prefijo)
     or (new.audio_url is not null and left(new.audio_url, length(v_prefijo)) <> v_prefijo) then
    raise exception 'Evidencia inválida.' using errcode = '42501';
  end if;

  if new.es_anonimo then
    new.usuario_nombre := null;
  else
    select p.nombre into new.usuario_nombre from public.perfil p where p.id = new.usuario_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.completar_reporte() from public, anon, authenticated;

drop trigger if exists reportes_completar on public.reportes;
create trigger reportes_completar
  before insert on public.reportes
  for each row execute function public.completar_reporte();

-- ── 4. Validado ↔ reportes_publicos ─────────────────────────────────────
create or replace function public.publicar_reporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'validado' then
    insert into public.reportes_publicos (id, lat, lng, categoria, gravedad, descripcion, creado_en, validado_en, expira_en)
    values (new.id, new.lat, new.lng, new.categoria, new.gravedad, new.descripcion, new.creado_en,
            coalesce(new.revisado_en, now()), new.expira_en)
    on conflict (id) do update
      set lat = excluded.lat, lng = excluded.lng, categoria = excluded.categoria,
          gravedad = excluded.gravedad, descripcion = excluded.descripcion, expira_en = excluded.expira_en;
  else
    delete from public.reportes_publicos where id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.publicar_reporte() from public, anon, authenticated;

drop trigger if exists reportes_publicar on public.reportes;
create trigger reportes_publicar
  after insert or update on public.reportes
  for each row execute function public.publicar_reporte();

-- Los ya validados (expirados o no) pasan a la tabla pública.
insert into public.reportes_publicos (id, lat, lng, categoria, gravedad, descripcion, creado_en, validado_en, expira_en)
select id, lat, lng, categoria, gravedad, descripcion, creado_en, creado_en, expira_en
  from public.reportes where estado = 'validado'
on conflict (id) do nothing;

-- ── 5. RLS de reportes ──────────────────────────────────────────────────
alter table public.reportes enable row level security;
revoke all on public.reportes from anon;
-- Sin UPDATE directo: el operador revisa con revisar_reportes() y el autor
-- marca vistos con marcar_reportes_vistos().
revoke update, truncate on public.reportes from authenticated;

drop policy if exists reportes_lectura on public.reportes;
drop policy if exists reportes_operador on public.reportes;
drop policy if exists reportes_select on public.reportes;

-- El autor ve los suyos (cualquier estado); los operadores aprobados, todos.
create policy reportes_select on public.reportes
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_operador_aprobado()));

-- reportes_insert (usuario_id = auth.uid()) y reportes_borrar_propio se mantienen.

-- ── 6. RPC ──────────────────────────────────────────────────────────────
-- Valida o descarta un grupo de reportes pendientes (p. ej. 3 del mismo
-- lugar). Devuelve cuántos cambió (0 = otro operador se adelantó).
create or replace function public.revisar_reportes(p_ids uuid[], p_estado text, p_motivo text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.es_operador_aprobado() then
    raise exception 'Solo un operador aprobado puede revisar reportes.' using errcode = '42501';
  end if;
  if p_estado not in ('validado', 'descartado') then
    raise exception 'Estado inválido: %', p_estado using errcode = '22023';
  end if;

  update public.reportes
     set estado          = p_estado,
         revisado_por    = auth.uid(),
         revisado_en     = now(),
         motivo_descarte = case when p_estado = 'descartado' then nullif(btrim(p_motivo), '') end,
         -- Desde que se difunde, 6 horas visible para los vecinos.
         expira_en       = case when p_estado = 'validado' then now() + interval '6 hours' else expira_en end,
         usuario_visto   = false
   where id = any(p_ids)
     and estado = 'pendiente';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- El autor ya vio el resultado de sus reportes.
create or replace function public.marcar_reportes_vistos(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.reportes
     set usuario_visto = true
   where id = any(p_ids)
     and usuario_id = auth.uid()
     and not usuario_visto;
$$;

revoke all on function public.revisar_reportes(uuid[], text, text) from public, anon;
revoke all on function public.marcar_reportes_vistos(uuid[]) from public, anon;
grant execute on function public.revisar_reportes(uuid[], text, text) to authenticated;
grant execute on function public.marcar_reportes_vistos(uuid[]) to authenticated;

-- ── 7. Storage: bucket privado de evidencias ────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias', 'evidencias', false, 8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp',
        'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidencias_subir on storage.objects;
drop policy if exists evidencias_leer on storage.objects;
drop policy if exists evidencias_borrar on storage.objects;

-- Cada vecino sube solo a su carpeta.
create policy evidencias_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Leer (y firmar URLs): el autor y los operadores aprobados.
create policy evidencias_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.es_operador_aprobado()))
  );

create policy evidencias_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 8. Realtime ─────────────────────────────────────────────────────────
-- reportes ya está publicada (operador: INSERT; autor: UPDATE de su fila).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reportes_publicos'
  ) then
    alter publication supabase_realtime add table public.reportes_publicos;
  end if;
end $$;
