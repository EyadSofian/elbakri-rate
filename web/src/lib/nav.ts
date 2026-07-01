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
import type { Role } from '@/types'

export interface NavItem {
  key: string
  labelKey: string
  path: string
  icon: LucideIcon
  roles: Role[]
  mobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operations'], mobile: true },
  { key: 'hotels', labelKey: 'nav.hotels', path: '/hotels', icon: Building2, roles: ['admin', 'operations'], mobile: true },
  { key: 'groups', labelKey: 'nav.groups', path: '/hotel-groups', icon: Boxes, roles: ['admin', 'operations'], mobile: false },
  { key: 'packages', labelKey: 'nav.packages', path: '/packages', icon: Package, roles: ['admin', 'operations'], mobile: true },
  { key: 'sales', labelKey: 'nav.sales', path: '/sales', icon: Tags, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: true },
  { key: 'quotes', labelKey: 'nav.quotes', path: '/quotes', icon: FileText, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'users', labelKey: 'nav.users', path: '/users', icon: Users, roles: ['admin'], mobile: false },
  { key: 'system', labelKey: 'nav.system', path: '/system-check', icon: Activity, roles: ['admin', 'operations'], mobile: false },
  { key: 'settings', labelKey: 'nav.settings', path: '/settings', icon: Settings, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: false },
]

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}

export function homeForRole(role: Role): string {
  if (role === 'sales' || role === 'viewer') return '/sales'
  return '/dashboard'
}
