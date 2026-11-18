-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Mapa "Explora tu entorno"
--
-- 1. Avisos públicos con ubicación aproximada: al publicarse, la ubicación
--    se redondea a 3 decimales (~100 m). Así un aviso hecho desde la casa de
--    alguien no marca su puerta. El operador sigue viendo el punto exacto en
--    public.reportes; el autor ve el suyo exacto (es su propio dato).
-- 2. lugares_ayuda: comisarías, PDI, urgencias y bomberos de Santiago desde
--    OpenStreetMap (scripts/lugares-ayuda.mjs). Datos públicos: los lee
--    cualquier usuario con sesión; nadie los escribe desde la app.
--    CuidaChile no los verifica: guardan la fuente y la fecha de revisión.
--
-- Requiere 20261115040000_reportes_barriales.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Ubicación aproximada en reportes_publicos ────────────────────────
create or replace function public.publicar_reporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'validado' then
    insert into public.reportes_publicos (id, lat, lng, categoria, gravedad, descripcion, creado_en, validado_en, expira_en)
    values (new.id, round(new.lat::numeric, 3)::double precision, round(new.lng::numeric, 3)::double precision,
            new.categoria, new.gravedad, new.descripcion, new.creado_en,
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

-- Los ya publicados también pasan a aproximados.
update public.reportes_publicos
   set lat = round(lat::numeric, 3)::double precision,
       lng = round(lng::numeric, 3)::double precision
 where lat <> round(lat::numeric, 3)::double precision
    or lng <> round(lng::numeric, 3)::double precision;

-- ── 2. Lugares de ayuda ─────────────────────────────────────────────────
create table if not exists public.lugares_ayuda (
  id          uuid primary key default gen_random_uuid(),
  osm_id      text not null unique,
  tipo        text not null check (tipo in ('carabineros', 'pdi', 'salud', 'bomberos')),
  nombre      text not null check (char_length(nombre) between 1 and 160),
  direccion   text check (direccion is null or char_length(direccion) <= 200),
  telefono    text check (telefono is null or char_length(telefono) <= 40),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  fuente      text not null default 'OpenStreetMap',
  revisado_en date not null default current_date
);

create index if not exists lugares_ayuda_tipo on public.lugares_ayuda (tipo);

alter table public.lugares_ayuda enable row level security;

drop policy if exists lugares_ayuda_lectura on public.lugares_ayuda;
create policy lugares_ayuda_lectura on public.lugares_ayuda
  for select to authenticated
  using (true);

revoke all on public.lugares_ayuda from public, anon, authenticated;
grant select on public.lugares_ayuda to authenticated;
