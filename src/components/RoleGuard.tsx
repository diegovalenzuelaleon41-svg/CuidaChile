/**
 * RoleGuard — protege los paneles según perfil.rol (equivalente al
 * middleware de Next.js en esta app Vite). Va dentro de <Protected>, que ya
 * garantiza sesión.
 *
 * · Sin rol                 → /seleccionar-rol
 * · Rol distinto            → su propio panel (usuario ↔ operador)
 * · Operador no aprobado    → /operador/pendiente
 *
 * Es solo UX: la protección real de los datos está en RLS
 * (es_operador_aprobado()) y en asignar_rol().
 */

import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from '../auth/AuthContext'
import { rutaPorRol, type Rol } from '../lib/roles'
import { PantallaCarga, PantallaError } from './EstadoPantalla'

interface RoleGuardProps {
  children: ReactElement
  requiredRole: Rol
}

export default function RoleGuard({ children, requiredRole }: RoleGuardProps) {
  const { rol, estadoOperador, rolLoading, rolError, recargarRol } = useAuth()

  if (rolLoading) return <PantallaCarga />
  if (rolError) return <PantallaError mensaje={rolError} onReintentar={recargarRol} />

  const permitido = requiredRole === 'operador'
    ? rol === 'operador' && estadoOperador === 'aprobado'
    : rol === requiredRole
  if (!permitido) return <Navigate to={rutaPorRol(rol, estadoOperador)} replace />

  return children
}
