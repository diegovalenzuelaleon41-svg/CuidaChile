import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from '../auth/AuthContext'
import { PantallaCarga } from './EstadoPantalla'

export default function Protected({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth()
  if (loading) return <PantallaCarga />
  if (!session) return <Navigate to="/login" replace />
  return children
}
