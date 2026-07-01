import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, clearToken, setToken } from '@/lib/api'
import type { CurrentUser, Role } from '@/types'

interface AuthCtx {
  user: CurrentUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
  canEdit: boolean
  canExport: boolean
  canAccessTab: (key: string) => boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const me = await api.get<CurrentUser | null>('/auth/me')
      setUser(me)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: CurrentUser }>('/auth/login', { email, password })
    if (res.token) setToken(res.token)
    await refresh()
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    clearToken()
    setUser(null)
  }

  const value: AuthCtx = {
    user,
    loading,
    login,
    logout,
    refresh,
    hasRole: (...roles) => !!user && roles.includes(user.role),
    canEdit: !!user?.can_edit,
    canExport: !!user?.can_export,
    canAccessTab: (key) => {
      if (!user?.nav_tabs || user.nav_tabs.length === 0) return true
      return user.nav_tabs.includes(key)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
