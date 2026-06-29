import { Archive, BedDouble, Bus, CalendarRange, Pencil, Trash2, Utensils } from 'lucide-react'
import { Badge, RateStatusBadge } from '@/components/ui/badge'
import { formatDateRange, formatPrice, cn } from '@/lib/utils'
import { mealLabel, pricingBasisLabel, roomLabel, transferLabel } from '@/lib/labels'
import type { Rate } from '@/types'

export function RatePeriodCard({
  rates,
  selectable,
  selectedIds,
  onToggleRate,
  onToggleGroup,
  onEditRate,
  onDeleteRate,
  compact = false,
}: {
  rates: Rate[]
  selectable?: boolean
  selectedIds?: Set<number>
  onToggleRate?: (id: number, checked: boolean) => void
  onToggleGroup?: (ids: number[], checked: boolean) => void
  onEditRate?: (rate: Rate) => void
  onDeleteRate?: (rate: Rate) => void
  compact?: boolean
}) {
  const first = rates[0]
  const ids = rates.map((r) => r.id)
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds?.has(id))
  const statuses = Array.from(new Set(rates.map((r) => r.status)))

  return (
    <div className={cn('rounded-card border border-navy-100 bg-white p-3', allSelected && 'border-gold ring-1 ring-gold/40')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {selectable && (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleGroup?.(ids, e.target.checked)}
                className="h-5 w-5 accent-navy-700"
                aria-label="تحديد الفترة"
              />
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-900">
              <CalendarRange className="h-4 w-4 text-navy-500" />
              {formatDateRange(first.date_from, first.date_to)}
            </span>
            {first.season_name && <Badge tone="gold">{first.season_name}</Badge>}
            {statuses.length === 1 ? (
              <RateStatusBadge status={statuses[0]} />
            ) : (
              <Badge tone="slate">{statuses.length} حالات</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Utensils className="h-3.5 w-3.5" />
              {mealLabel(first.meal_plan)}
            </span>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {pricingBasisLabel[first.pricing_basis]}
            </span>
            <span className={cn('inline-flex items-center gap-1', first.transfer_included === 'Included' && 'text-green-600')}>
              <Bus className="h-3.5 w-3.5" />
              {transferLabel[first.transfer_included]}
            </span>
          </div>
        </div>
        {!compact && first.child_policy && <p className="max-w-md text-xs text-ink-muted">{first.child_policy}</p>}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rates.map((rate) => {
          const selected = selectedIds?.has(rate.id) ?? false
          return (
            <div
              key={rate.id}
              className={cn('flex min-h-[58px] items-center gap-2 rounded-btn border border-navy-100 bg-surface px-3 py-2', selected && 'border-gold bg-gold/10')}
            >
              {selectable && (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => onToggleRate?.(rate.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-navy-700"
                  aria-label={`تحديد ${roomLabel(rate.room_type)}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-bold text-navy-900">
                  {roomLabel(rate.room_type)}
                  {statuses.length > 1 && <RateStatusBadge status={rate.status} />}
                </div>
                <div className="nums mt-0.5 text-base font-extrabold text-navy-900">{formatPrice(rate.adult_price, rate.currency)}</div>
              </div>
              {(onEditRate || onDeleteRate) && (
                <div className="flex shrink-0 items-center gap-1">
                  {onEditRate && (
                    <button onClick={() => onEditRate(rate)} className="grid h-8 w-8 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" aria-label="تعديل السعر">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteRate && (
                    <button onClick={() => onDeleteRate(rate)} className="grid h-8 w-8 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label="حذف السعر">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {first.booking_notes && !compact && (
        <div className="mt-2 inline-flex items-start gap-1.5 text-xs text-ink-muted">
          <Archive className="mt-0.5 h-3.5 w-3.5" />
          {first.booking_notes}
        </div>
      )}
    </div>
  )
}
