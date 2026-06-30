import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RateStatus, QuoteStatus } from '@/types'
import { useI18n } from '@/lib/i18n'

export function Badge({ children, className, tone = 'slate' }: { children: ReactNode; className?: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    navy: 'bg-navy-50 text-navy-700 border border-navy-100',
    gold: 'bg-amber-50 text-gold-dark border border-amber-200',
    green: 'bg-green-50 text-green-700 border border-green-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function RateStatusBadge({ status }: { status: RateStatus }) {
  const { t } = useI18n()
  const tone = status === 'Ready' ? 'green' : status === 'Draft' ? 'amber' : 'slate'
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { t } = useI18n()
  const tone = status === 'ready' ? 'green' : status === 'sent' ? 'navy' : status === 'archived' ? 'slate' : 'amber'
  return <Badge tone={tone}>{t(`quoteStatus.${status}`)}</Badge>
}

export function Stars({ count }: { count: number | null }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-gold">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-gold" />
      ))}
    </span>
  )
}
