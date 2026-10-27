/**
 * Hook para manejar la persistencia del rol de usuario en localStorage.
 * Clave: cuidaChile_role
 * Valores válidos: 'usuario' | 'operador'
 */

import { useState, useEffect, useCallback } from 'react'

export type Role = 'usuario' | 'operador'

const ROLE_KEY = 'cuidaChile_role'

function esRoleValido(valor: string | null): valor is Role {
  return valor === 'usuario' || valor === 'operador'
}

/**
 * Hook reutilizable para gestionar el rol del usuario.
 * Devuelve el rol actual, estado de carga, y funciones para establecerlo o limpiarlo.
 */
export function useRole() {
  const [role, setRoleState] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  // Leer rol persistido al montar
  useEffect(() => {
    const stored = localStorage.getItem(ROLE_KEY)
    if (esRoleValido(stored)) {
      setRoleState(stored)
    } else {
      setRoleState(null)
    }
    setLoading(false)
  }, [])

  const setRole = useCallback((nuevoRole: Role) => {
    localStorage.setItem(ROLE_KEY, nuevoRole)
    setRoleState(nuevoRole)
  }, [])

  const clearRole = useCallback(() => {
    localStorage.removeItem(ROLE_KEY)
    setRoleState(null)
  }, [])

  return {
    role,
    loading,
    setRole,
    clearRole,
    hasRole: !!role,
  }
}

export { ROLE_KEY }
