/**
 * Roles de CuidaChile. La fuente de verdad es la columna perfil.rol en
 * Supabase (ver supabase/migrations/20261029000000_rol_perfil.sql);
 * nada de esto se persiste en localStorage.
 */

export type Rol = 'usuario' | 'operador'

export function esRolValido(valor: unknown): valor is Rol {
  return valor === 'usuario' || valor === 'operador'
}

/** Pantalla de destino para cada rol. Sin rol → elegirlo. */
export function rutaPorRol(rol: Rol | null): string {
  if (rol === 'operador') return '/operador/dashboard'
  if (rol === 'usuario') return '/usuario'
  return '/seleccionar-rol'
}
