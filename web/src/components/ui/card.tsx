import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn('card p-4', onClick && 'cursor-pointer transition hover:shadow-soft hover:border-navy-200', className)}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'navy',
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'navy' | 'gold' | 'green' | 'amber' | 'slate'
}) {
  const tones: Record<string, string> = {
    navy: 'bg-navy-50 text-navy-700',
    gold: 'bg-amber-50 text-gold-dark',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon && <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-card', tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="nums text-2xl font-extrabold leading-tight text-navy-900">{value}</div>
        <div className="truncate text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-bold text-navy-900">{children}</h2>
      {action}
    </div>
  )
}
