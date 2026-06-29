import type { ReactNode } from 'react'
import { Loader2, Inbox, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-navy-500', className)} />
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-navy-200 bg-white/60 px-6 py-12 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-navy-50 text-navy-400">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-base font-bold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-extrabold text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[]
  active: T
  onChange: (k: T) => void
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-card bg-navy-50 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-sm font-semibold transition',
            active === t.key ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-600 hover:text-navy-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('nums rounded-full px-1.5 text-xs', active === t.key ? 'bg-navy-100 text-navy-700' : 'bg-navy-100/60 text-navy-500')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
