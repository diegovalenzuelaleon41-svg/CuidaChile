-- Contador público de la landing: personas acompañadas ahora mismo.
-- Cuenta personas distintas con una ruta acompañada abierta (PENDIENTE o EN_CURSO) o una alerta SOS
-- activa. Devuelve solo el total, nunca filas; y null mientras sea menor que el mínimo, para no
-- mostrar una cifra pobre ni dejar inferir la actividad de pocas personas. La landing oculta la
-- píldora cuando recibe null.

create or replace function public.personas_acompanadas_ahora()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with activas as (
    select usuario_id from public.acompanamientos where estado in ('PENDIENTE', 'EN_CURSO')
    union
    select usuario_id from public.alertas where estado = 'activa'
  ),
  total as (
    select count(*)::integer as n from activas
  )
  -- Mínimo para mostrarla: cambiar aquí.
  select case when n >= 50 then n end from total;
$$;

revoke all on function public.personas_acompanadas_ahora() from public;
grant execute on function public.personas_acompanadas_ahora() to anon, authenticated;
