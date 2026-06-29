import {
  LayoutDashboard,
  Building2,
  Boxes,
  Package,
  Grid3x3,
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
  label: string
  path: string
  icon: LucideIcon
  roles: Role[]
  mobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operations'], mobile: true },
  { key: 'hotels', label: 'الفنادق', path: '/hotels', icon: Building2, roles: ['admin', 'operations'], mobile: true },
  { key: 'groups', label: 'المجموعات', path: '/hotel-groups', icon: Boxes, roles: ['admin', 'operations'], mobile: false },
  { key: 'packages', label: 'الباقات', path: '/packages', icon: Package, roles: ['admin', 'operations'], mobile: true },
  { key: 'matrix', label: 'مصفوفة الأسعار', path: '/rates/matrix/new', icon: Grid3x3, roles: ['admin', 'operations'], mobile: false },
  { key: 'sales', label: 'عروض المبيعات', path: '/sales', icon: Tags, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: true },
  { key: 'quotes', label: 'عروض الأسعار', path: '/quotes', icon: FileText, roles: ['admin', 'operations', 'sales'], mobile: true },
  { key: 'users', label: 'المستخدمون', path: '/users', icon: Users, roles: ['admin'], mobile: false },
  { key: 'system', label: 'فحص النظام', path: '/system-check', icon: Activity, roles: ['admin', 'operations'], mobile: false },
  { key: 'settings', label: 'الإعدادات', path: '/settings', icon: Settings, roles: ['admin', 'operations', 'sales', 'viewer'], mobile: false },
]

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}

export function homeForRole(role: Role): string {
  if (role === 'sales' || role === 'viewer') return '/sales'
  return '/dashboard'
}
