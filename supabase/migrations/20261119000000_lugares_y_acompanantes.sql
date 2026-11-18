-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Lugares guardados, contactos que acompañan y "llegó bien"
--
-- 1. lugares: Casa y Trabajo del usuario (uno de cada uno). Solo los ve y
--    edita su dueño: ni los operadores los leen.
-- 2. seguimiento_acompanantes: quien abre el link de seguimiento puede
--    "acompañar" con su nombre. El usuario ve quién lo acompaña mientras la
--    página siga abierta (latido cada 30 s) y recibe sus "Aquí estoy".
--    · Sin cuenta: se identifica con un uuid aleatorio de su navegador.
--    · Solo mientras el SOS o la ruta siguen abiertos (y hasta 12 h).
--    · Máximo 10 acompañantes por link; un "Aquí estoy" cada 10 s.
-- 3. acompanamientos.finalizado_por: si el propio usuario terminó la ruta
--    ("Llegué"), el link muestra que marcó su llegada. Lo pone un trigger;
--    el cliente no puede falsearlo.
--
-- Requiere 20261118000000_coaccion_seguimiento_calificacion.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Lugares guardados ───────────────────────────────────────────────
create table if not exists public.lugares (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null default auth.uid() references public.perfil(id) on delete cascade,
  tipo           text not null check (tipo in ('casa', 'trabajo')),
  direccion      text not null check (char_length(direccion) between 1 and 200),
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  actualizado_en timestamptz not null default now(),
  constraint lugares_uno_por_tipo unique (usuario_id, tipo)
);

alter table public.lugares enable row level security;

drop policy if exists lugares_propios on public.lugares;
create policy lugares_propios on public.lugares
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

revoke all on public.lugares from public, anon;
grant select, insert, update, delete on public.lugares to authenticated;

-- ── 2. Quién terminó la ruta ────────────────────────────────────────────
alter table public.acompanamientos add column if not exists finalizado_por text
  check (finalizado_por is null or finalizado_por in ('usuario', 'operador', 'sistema'));

-- Corre después de acompanamientos_validar (orden alfabético).
create or replace function private.marcar_finalizado_por()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'FINALIZADO' and old.estado is distinct from 'FINALIZADO' then
    new.finalizado_por := case
      when auth.uid() is null then 'sistema'
      when auth.uid() = old.usuario_id then 'usuario'
      else 'operador'
    end;
  else
    new.finalizado_por := old.finalizado_por;
  end if;
  return new;
end;
$$;

drop trigger if exists acompanamientos_zz_finalizado_por on public.acompanamientos;
create trigger acompanamientos_zz_finalizado_por
  before update on public.acompanamientos
  for each row execute function private.marcar_finalizado_por();

-- ── 3. Acompañantes del link ────────────────────────────────────────────
create table if not exists public.seguimiento_acompanantes (
  token           uuid not null references public.seguimientos(token) on delete cascade,
  visitante       uuid not null,
  nombre          text not null check (char_length(nombre) between 1 and 30),
  visto_en        timestamptz not null default now(),
  toques          integer not null default 0,
  ultimo_toque_en timestamptz,
  creado_en       timestamptz not null default now(),
  primary key (token, visitante)
);

alter table public.seguimiento_acompanantes enable row level security;
-- Sin políticas: solo las funciones de abajo.
revoke all on public.seguimiento_acompanantes from public, anon, authenticated;

-- El link sigue mostrando la ubicación (mismas reglas que ver_seguimiento).
create or replace function private.seguimiento_abierto(p_token uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.seguimientos s
      left join public.alertas a on a.id = s.alerta_id
      left join public.acompanamientos r on r.id = s.acompanamiento_id
     where s.token = p_token
       and s.creado_en >= now() - interval '12 hours'
       and (a.estado in ('activa', 'en_atencion') or r.estado in ('PENDIENTE', 'EN_CURSO'))
  );
$$;

revoke all on function private.seguimiento_abierto(uuid) from public, anon, authenticated;

-- Unirse como acompañante, latido (p_toque = false) o "Aquí estoy" (p_toque = true).
-- Devuelve false si el link ya no está abierto o ya hay 10 acompañantes.
create or replace function public.acompanar_seguimiento(
  p_token uuid,
  p_visitante uuid,
  p_nombre text,
  p_toque boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 30);
begin
  if p_token is null or p_visitante is null or v_nombre = '' then
    raise exception 'Falta tu nombre.' using errcode = '22023';
  end if;
  if not private.seguimiento_abierto(p_token) then
    return false;
  end if;

  if not exists (select 1 from public.seguimiento_acompanantes where token = p_token and visitante = p_visitante)
     and (select count(*) from public.seguimiento_acompanantes where token = p_token) >= 10 then
    return false;
  end if;

  insert into public.seguimiento_acompanantes as t (token, visitante, nombre, toques, ultimo_toque_en)
  values (p_token, p_visitante, v_nombre, case when p_toque then 1 else 0 end, case when p_toque then now() end)
  on conflict (token, visitante) do update
    set nombre   = excluded.nombre,
        visto_en = now(),
        toques   = t.toques + case
                     when p_toque and (t.ultimo_toque_en is null or t.ultimo_toque_en < now() - interval '10 seconds')
                     then 1 else 0 end,
        ultimo_toque_en = case
                     when p_toque and (t.ultimo_toque_en is null or t.ultimo_toque_en < now() - interval '10 seconds')
                     then now() else t.ultimo_toque_en end;
  return true;
end;
$$;

-- Lo que ve el usuario: quién lo acompaña en su SOS o su ruta abierta.
create or replace function public.mis_acompanantes(p_alerta_id uuid default null, p_acompanamiento_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'visitante', t.visitante,
           'nombre', t.nombre,
           'activo', t.visto_en > now() - interval '90 seconds',
           'ultimo_toque_en', t.ultimo_toque_en
         ) order by t.creado_en), '[]'::jsonb)
    from public.seguimientos s
    join public.seguimiento_acompanantes t on t.token = s.token
   where s.usuario_id = auth.uid()
     and ((p_alerta_id is not null and s.alerta_id = p_alerta_id)
          or (p_acompanamiento_id is not null and s.acompanamiento_id = p_acompanamiento_id));
$$;

revoke all on function public.acompanar_seguimiento(uuid, uuid, text, boolean) from public;
revoke all on function public.mis_acompanantes(uuid, uuid) from public, anon;
grant execute on function public.acompanar_seguimiento(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.mis_acompanantes(uuid, uuid) to authenticated;

-- ── 4. ver_seguimiento: "marcó que llegó" ───────────────────────────────
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
  if not found then
    return jsonb_build_object('estado', 'terminado', 'tipo', 'ruta');
  end if;
  -- La propia persona terminó la ruta con "Llegué": sin ubicación, solo la hora.
  if v_r.estado = 'FINALIZADO' and v_r.finalizado_por = 'usuario' then
    return jsonb_build_object(
      'tipo', 'ruta',
      'estado', 'llego',
      'nombre', split_part(coalesce(v_r.usuario_nombre, ''), ' ', 1),
      'destino', v_r.destino,
      'llego_en', v_r.finalizado_en
    );
  end if;
  if v_r.estado not in ('PENDIENTE', 'EN_CURSO') then
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
