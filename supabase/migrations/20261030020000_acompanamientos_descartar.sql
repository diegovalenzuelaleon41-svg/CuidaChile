-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Acompañamientos: el operador puede descartar solicitudes
--
-- · Nuevo estado terminal 'DESCARTADA' (falsa, duplicada, fuera de zona…).
-- · Un operador aprobado puede descartar una PENDIENTE (queda registrado
--   como operador_id) o una EN_CURSO que sea suya.
-- · motivo_cierre: bitácora de por qué se descartó. Solo lo escribe el
--   operador al descartar; después es inmutable.
--
-- Requiere 20261030010000. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.acompanamientos
  drop constraint if exists acompanamientos_estado_check;
alter table public.acompanamientos
  add constraint acompanamientos_estado_check
  check (estado in ('PENDIENTE', 'EN_CURSO', 'FINALIZADO', 'CANCELADO', 'DESCARTADA'));

alter table public.acompanamientos
  add column if not exists motivo_cierre text
  check (motivo_cierre is null or char_length(btrim(motivo_cierre)) between 1 and 200);

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

  if old.estado in ('FINALIZADO', 'CANCELADO', 'DESCARTADA') then
    raise exception 'El acompañamiento ya terminó.' using errcode = '42501';
  end if;

  -- ── Usuario dueño: GPS, cancelar o finalizar ──
  if v_uid = old.usuario_id then
    if new.operador_id is distinct from old.operador_id
       or new.aceptado_en is distinct from old.aceptado_en
       or new.motivo_cierre is distinct from old.motivo_cierre then
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

  -- ── Operador aprobado: aceptar, finalizar o descartar ──
  if public.es_operador_aprobado() then
    if new.lat_actual is distinct from old.lat_actual
       or new.lng_actual is distinct from old.lng_actual then
      raise exception 'Solo el usuario envía su ubicación.' using errcode = '42501';
    end if;

    -- Descartar: una pendiente (de nadie) o una propia en curso. Queda a su nombre.
    if new.estado = 'DESCARTADA' then
      if not (
        (old.estado = 'PENDIENTE' and old.operador_id is null)
        or (old.estado = 'EN_CURSO' and old.operador_id = v_uid)
      ) or new.operador_id is distinct from v_uid then
        raise exception 'No puedes descartar este acompañamiento.' using errcode = '42501';
      end if;
      new.finalizado_en := now();
      return new;
    end if;

    if new.motivo_cierre is distinct from old.motivo_cierre then
      raise exception 'El motivo solo se registra al descartar.' using errcode = '42501';
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
