import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, ShoppingCart, MoreHorizontal, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useQuoteCart } from '@/context/QuoteCartContext'
import { useI18n } from '@/lib/i18n'
import { navForRole, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { dir, t } = useI18n()
  const [drawer, setDrawer] = useState(false)
  const navigate = useNavigate()
  if (!user) return <>{children}</>

  const items = navForRole(user.role)
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4)
  const showCart = ['admin', 'operations', 'sales'].includes(user.role)

  return (
    <div className="flex min-h-screen bg-surface" dir={dir}>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-navy-100 bg-white lg:flex">
        <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-4 py-4">
          <Logo />
          <LanguageToggle />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((i) => (
            <SideLink key={i.key} item={i} />
          ))}
        </nav>
        <UserCard onLogout={async () => { await logout(); navigate('/auth') }} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-100 bg-white/95 px-3 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            {showCart && <CartButton onClick={() => navigate('/quotes/new')} />}
            <button
              onClick={() => setDrawer(true)}
              className="grid h-11 w-11 place-items-center rounded-btn text-navy-700 hover:bg-navy-50"
              aria-label={t('common.menu')}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 pb-28 sm:px-5 lg:pb-8">{children}</main>
      </div>

      {/* Sticky quote bar (mobile + desktop) */}
      {showCart && <QuoteBar />}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-navy-100 bg-white lg:hidden">
        {mobileItems.map((i) => (
          <BottomLink key={i.key} item={i} />
        ))}
        <button
          onClick={() => setDrawer(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-navy-500"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-semibold">{t('common.more')}</span>
        </button>
      </nav>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-pop animate-slide-up">
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-4">
              <Logo />
              <button onClick={() => setDrawer(false)} className="grid h-9 w-9 place-items-center rounded-btn hover:bg-navy-50" aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" onClick={() => setDrawer(false)}>
              {items.map((i) => (
                <SideLink key={i.key} item={i} />
              ))}
            </nav>
            <div className="border-t border-navy-100 px-3 py-2">
              <LanguageToggle />
            </div>
            <UserCard onLogout={async () => { await logout(); navigate('/auth') }} />
          </div>
        </div>
      )}
    </div>
  )
}

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  const { t } = useI18n()
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-3 rounded-btn px-3 text-sm font-semibold transition',
          isActive ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-700 hover:bg-navy-50',
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  const { t } = useI18n()
  const { pathname } = useLocation()
  const active = pathname === item.path || pathname.startsWith(item.path + '/')
  return (
    <NavLink to={item.path} className="flex flex-1 flex-col items-center justify-center gap-0.5">
      <Icon className={cn('h-5 w-5', active ? 'text-navy-900' : 'text-navy-400')} />
      <span className={cn('text-[10px] font-semibold', active ? 'text-navy-900' : 'text-navy-400')}>{t(item.labelKey)}</span>
    </NavLink>
  )
}

function UserCard({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const { t } = useI18n()
  if (!user) return null
  return (
    <div className="flex items-center gap-2 border-t border-navy-100 p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-100 text-sm font-bold text-navy-800">
        {user.full_name?.charAt(0) ?? 'U'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-navy-900">{user.full_name}</div>
        <div className="text-xs text-ink-muted">{t(`role.${user.role}`)}</div>
      </div>
      <button onClick={onLogout} className="grid h-10 w-10 place-items-center rounded-btn text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={t('common.logout')}>
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}

function CartButton({ onClick }: { onClick: () => void }) {
  const { count } = useQuoteCart()
  const { t } = useI18n()
  return (
    <button onClick={onClick} className="relative grid h-11 w-11 place-items-center rounded-btn text-navy-700 hover:bg-navy-50" aria-label={t('nav.quotes')}>
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="nums absolute -top-0.5 left-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-navy-950">
          {count}
        </span>
      )}
    </button>
  )
}

function QuoteBar() {
  const { count } = useQuoteCart()
  const { t } = useI18n()
  const navigate = useNavigate()
  if (count === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-16 z-20 px-3 lg:bottom-4 lg:right-4 lg:left-auto lg:px-0">
      <button
        onClick={() => navigate('/quotes/new')}
        className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-card bg-gold px-4 py-3 text-navy-950 shadow-pop transition hover:bg-gold-dark hover:text-white lg:w-80"
      >
        <span className="flex items-center gap-2 font-bold">
          <ShoppingCart className="h-5 w-5" />
          {t('quote.continue')}
        </span>
        <span className="flex items-center gap-1">
          <span className="nums grid h-6 min-w-[24px] place-items-center rounded-full bg-navy-900 px-1.5 text-sm font-bold text-white">{count}</span>
          <ChevronLeft className="h-5 w-5" />
        </span>
      </button>
    </div>
  )
}
