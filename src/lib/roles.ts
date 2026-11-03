/**
 * Roles de CuidaChile. La fuente de verdad es perfil.rol y
 * perfil.operador_estado en Supabase (ver supabase/migrations/);
 * nada de esto se persiste en localStorage.
 */

export type Rol = 'usuario' | 'operador'

/** Solo aplica a operadores: un admin debe aprobarlos antes de entrar al panel. */
export type EstadoOperador = 'pendiente' | 'aprobado' | 'rechazado'

export function esRolValido(valor: unknown): valor is Rol {
  return valor === 'usuario' || valor === 'operador'
}

export function esEstadoOperadorValido(valor: unknown): valor is EstadoOperador {
  return valor === 'pendiente' || valor === 'aprobado' || valor === 'rechazado'
}

/** Pantalla de destino según rol. Sin rol → elegirlo; operador no aprobado → espera. */
export function rutaPorRol(rol: Rol | null, estadoOperador: EstadoOperador | null): string {
  if (rol === 'operador') return estadoOperador === 'aprobado' ? '/operador/dashboard' : '/operador/pendiente'
  if (rol === 'usuario') return '/usuario'
  return '/seleccionar-rol'
}
