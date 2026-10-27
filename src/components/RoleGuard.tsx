/**
 * RoleGuard — protege rutas privadas verificando el rol persistido.
 * Si no hay rol, redirige a /seleccionar-rol.
 * Si se requiere un rol específico y no coincide, redirige al dashboard correcto.
 */

import { Navigate, useNavigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useRole, type Role } from '../hooks/useRole'

interface RoleGuardProps {
  children: ReactElement
  /** Rol requerido para acceder a esta ruta. Si se omite, solo se requiere tener algún rol. */
  requiredRole?: Role
}

export default function RoleGuard({ children, requiredRole }: RoleGuardProps) {
  const { role, loading } = useRole()
  const navigate = useNavigate()

  while (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 rounded-full border-4 border-[#DBEAFE] border-t-[#2563EB] animate-spin" />
      </div>
    )
  }

  if (!role) {
    return <Navigate to="/seleccionar-rol" replace />
  }

  if (requiredRole && role !== requiredRole) {
    const target = role === 'operador' ? '/operador/dashboard' : '/usuario'
    navigate(target, { replace: true })
    return null
  }

  return children
}
