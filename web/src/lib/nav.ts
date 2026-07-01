import {
  LayoutDashboard,
  Building2,
  Boxes,
  Package,
  Tags,
  FileText,
  Users,
  Activity,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { CurrentUser, Role } from '@/types'

export interface NavItem {
  key: string
  labelKey: string
  path: string
  icon: LucideIcon
  roles: Role[]
  mobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'hotels', labelKey: 'nav.hotels', path: '/hotels', icon: Building2, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'groups', labelKey: 'nav.groups', path: '/hotel-groups', icon: Boxes, roles: ['admin', 'operations', 'sales'], mobile: false },
  { key: 'packages', labelKey: 'nav.packages', path: '/packages', icon: Package, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'sales', labelKey: 'nav.sales', path: '/sales', icon: Tags, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: true },
  { key: 'quotes', labelKey: 'nav.quotes', path: '/quotes', icon: FileText, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'users', labelKey: 'nav.users', path: '/users', icon: Users, roles: ['admin'], mobile: false },
  { key: 'system', labelKey: 'nav.system', path: '/system-check', icon: Activity, roles: ['admin', 'operations'], mobile: false },
  { key: 'settings', labelKey: 'nav.settings', path: '/settings', icon: Settings, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: false },
]

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}

export function navForUser(user: CurrentUser): NavItem[] {
  const roleItems = navForRole(user.role)
  if (!user.nav_tabs || user.nav_tabs.length === 0) return roleItems
  const allowed = new Set(user.nav_tabs)
  return roleItems.filter((i) => allowed.has(i.key))
}

export function canAccessNavKey(user: CurrentUser, key: string): boolean {
  return navForUser(user).some((i) => i.key === key)
}

export function homeForRole(role: Role): string {
  if (role === 'sales' || role === 'viewer') return '/sales'
  return '/dashboard'
}

export function homeForUser(user: CurrentUser): string {
  return navForUser(user)[0]?.path ?? homeForRole(user.role)
}
