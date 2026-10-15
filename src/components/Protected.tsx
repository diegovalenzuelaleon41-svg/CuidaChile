import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function Protected({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 rounded-full border-4 border-[#DBEAFE] border-t-[#2563EB] animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}
