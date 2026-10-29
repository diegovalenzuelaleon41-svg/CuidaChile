/**
 * RoleGuard — protege los paneles según perfil.rol (equivalente al
 * middleware de Next.js en esta app Vite). Va dentro de <Protected>, que ya
 * garantiza sesión.
 *
 * · Sin rol            → /seleccionar-rol
 * · Rol distinto       → su propio panel (usuario ↔ operador)
 *
 * Es solo UX: la protección real de los datos está en RLS y en asignar_rol().
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
  const { rol, rolLoading, rolError, recargarRol } = useAuth()

  if (rolLoading) return <PantallaCarga />
  if (rolError) return <PantallaError mensaje={rolError} onReintentar={recargarRol} />
  if (rol !== requiredRole) return <Navigate to={rutaPorRol(rol)} replace />

  return children
}
