import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { canAccessNavKey, homeForUser } from '@/lib/nav'
import { PageLoader } from '@/components/ui/misc'
import type { Role } from '@/types'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

export function RoleRoute({ roles, navKey, children }: { roles: Role[]; navKey?: string; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/auth" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeForUser(user)} replace />
  if (navKey && !canAccessNavKey(user, navKey)) return <Navigate to={homeForUser(user)} replace />
  return <>{children}</>
}
