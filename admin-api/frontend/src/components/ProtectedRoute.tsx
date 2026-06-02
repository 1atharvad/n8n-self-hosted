import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const init = useAuthStore((s) => s.init)
  const authenticated = useAuthStore((s) => s.authenticated)
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    init()
  }, [init])

  if (!initialized) return null
  if (!authenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
