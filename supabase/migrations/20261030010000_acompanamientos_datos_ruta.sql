-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Acompañamientos: datos del usuario y extremos de la ruta
--
-- El operador no podía ver el nombre del usuario ni las coords de la ruta:
-- perfil y rutas dan acceso a operadores vía private.fn_es_operador(), que
-- lee el rol del JWT (app_metadata.rol), mientras que los operadores reales
-- tienen el rol en perfil.rol. En vez de abrir perfil (pin_hash,
-- info_medica…), la fila del acompañamiento lleva lo que el operador necesita:
--
-- · usuario_nombre / usuario_telefono: copiados desde perfil por un trigger
--   SECURITY DEFINER al insertar (el cliente no puede falsearlos).
-- · origen_lat/lng, destino_lat/lng: los envía el usuario al solicitar.
--
-- Todos son inmutables después del INSERT. Requiere 20261030000000. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.acompanamientos
  add column if not exists usuario_nombre   text,
  add column if not exists usuario_telefono text,
  add column if not exists origen_lat       double precision check (origen_lat is null or origen_lat between -90 and 90),
  add column if not exists origen_lng       double precision check (origen_lng is null or origen_lng between -180 and 180),
  add column if not exists destino_lat      double precision check (destino_lat is null or destino_lat between -90 and 90),
  add column if not exists destino_lng      double precision check (destino_lng is null or destino_lng between -180 and 180);

-- ── Nombre y teléfono desde perfil al insertar ─────────────────────────
create or replace function public.completar_acompanamiento()
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
  return new;
end;
$$;

revoke execute on function public.completar_acompanamiento() from public, anon, authenticated;

drop trigger if exists acompanamientos_completar on public.acompanamientos;
create trigger acompanamientos_completar
  before insert on public.acompanamientos
  for each row execute function public.completar_acompanamiento();

-- ── Inmutables también en UPDATE ────────────────────────────────────────
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
     or new.creado_en is distinct from old.creado_en
     or new.usuario_nombre is distinct from old.usuario_nombre
     or new.usuario_telefono is distinct from old.usuario_telefono
     or new.origen_lat is distinct from old.origen_lat
     or new.origen_lng is distinct from old.origen_lng
     or new.destino_lat is distinct from old.destino_lat
     or new.destino_lng is distinct from old.destino_lng then
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

-- ── Rellenar las filas existentes (auth.uid() es NULL aquí: el trigger no restringe) ──
update public.acompanamientos a
   set usuario_nombre   = coalesce(a.usuario_nombre, p.nombre),
       usuario_telefono = coalesce(a.usuario_telefono, p.telefono)
  from public.perfil p
 where p.id = a.usuario_id
   and a.usuario_nombre is null;

update public.acompanamientos a
   set origen_lat  = coalesce(a.origen_lat, r.origen_lat),
       origen_lng  = coalesce(a.origen_lng, r.origen_lng),
       destino_lat = coalesce(a.destino_lat, r.destino_lat),
       destino_lng = coalesce(a.destino_lng, r.destino_lng)
  from public.rutas r
 where r.id = a.ruta_id
   and a.destino_lat is null;
