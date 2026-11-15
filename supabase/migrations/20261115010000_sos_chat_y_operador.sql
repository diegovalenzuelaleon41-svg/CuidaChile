-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Pantalla SOS: nombre del operador y chat de la alerta
--
-- 1. alertas.operador_nombre: el ciudadano no puede leer perfil ajeno, así
--    que la alerta lleva el PRIMER nombre del operador asignado (lo mínimo
--    para "Operador Ana ha recibido tu alerta"). Lo calcula un trigger en
--    cada INSERT/UPDATE desde operador_id: el cliente no puede falsearlo.
--
-- 2. Chat del SOS (mensajes.alerta_id) como plan B cuando la voz falla. Las
--    políticas antiguas usaban private.fn_es_operador() (rol del JWT), que no
--    sirve para los operadores reales (rol en perfil). Ahora:
--    · Leen: el dueño de la alerta y el operador asignado.
--    · Escriben: el ciudadano mientras su alerta está abierta (también antes
--      de que la tomen: el operador lo verá al atenderla); el operador
--      asignado (y aprobado) mientras está en atención.
--    La parte de acompañamientos queda igual.
--
-- Requiere 20261114000000_alertas_sos.sql y 20261030030000_chat_acompanamiento.sql.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Nombre del operador en la alerta ────────────────────────────────
alter table public.alertas
  add column if not exists operador_nombre text;

create or replace function public.alerta_nombre_operador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nunca se acepta lo que mande el cliente. Solo se consulta perfil cuando
  -- cambia el operador (el GPS actualiza la fila cada pocos segundos).
  if tg_op = 'UPDATE' and new.operador_id is not distinct from old.operador_id then
    new.operador_nombre := old.operador_nombre;
    return new;
  end if;
  new.operador_nombre := (
    select nullif(split_part(btrim(p.nombre), ' ', 1), '')
      from public.perfil p
     where p.id = new.operador_id
  );
  return new;
end;
$$;

revoke execute on function public.alerta_nombre_operador() from public, anon, authenticated;

-- Corre antes que alertas_validar (orden alfabético de triggers BEFORE).
drop trigger if exists alertas_nombre_operador on public.alertas;
create trigger alertas_nombre_operador
  before insert or update on public.alertas
  for each row execute function public.alerta_nombre_operador();

update public.alertas a
   set operador_nombre = nullif(split_part(btrim(p.nombre), ' ', 1), '')
  from public.perfil p
 where p.id = a.operador_id and a.operador_nombre is null;

-- ── 2. Chat del SOS ─────────────────────────────────────────────────────
create index if not exists mensajes_alerta_idx
  on public.mensajes (alerta_id, creado_en)
  where alerta_id is not null;

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
      and exists (
        select 1 from public.alertas al
        where al.id = mensajes.alerta_id
          and (al.usuario_id = (select auth.uid()) or al.operador_id = (select auth.uid()))
      )
    )
  );

drop policy if exists mensajes_insert on public.mensajes;
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
        and exists (
          select 1 from public.alertas al
          where al.id = mensajes.alerta_id
            and (
              (mensajes.emisor_rol = 'usuario' and al.usuario_id = (select auth.uid()) and al.estado in ('activa', 'en_atencion'))
              or (
                mensajes.emisor_rol = 'operador' and al.operador_id = (select auth.uid()) and al.estado = 'en_atencion'
                and (select public.es_operador_aprobado())
              )
            )
        )
      )
    )
  );
