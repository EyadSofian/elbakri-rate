import { Pencil, Trash2, CalendarRange, BedDouble } from 'lucide-react'
import { RateStatusBadge, Badge } from '@/components/ui/badge'
import { formatPrice, formatDateRange, cn } from '@/lib/utils'
import { mealLabel, roomLabel } from '@/lib/labels'
import { useI18n } from '@/lib/i18n'
import type { Rate } from '@/types'

export function RateRow({
  rate,
  showHotel,
  selectable,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  rate: Rate
  showHotel?: boolean
  selectable?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { t, lang } = useI18n()
  return (
    <div className={cn('flex items-center gap-3 rounded-card border border-navy-100 bg-white p-3', selected && 'border-navy-300 ring-1 ring-navy-200')}>
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-navy-700"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showHotel && <span className="truncate font-bold text-navy-900">{rate.hotel_name}</span>}
          {rate.package_name && <Badge tone="navy">{rate.package_name}</Badge>}
          <RateStatusBadge status={rate.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5 shrink-0" />{formatDateRange(rate.date_from, rate.date_to, t('export.allPeriods'))}</span>
          <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 shrink-0" />{roomLabel(rate.room_type, lang)} · {mealLabel(rate.meal_plan, lang)}</span>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="nums text-base font-extrabold text-navy-900">{formatPrice(rate.adult_price, rate.currency)}</div>
        {rate.season_name && <div className="text-[11px] text-ink-muted">{rate.season_name}</div>}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" aria-label={t('common.edit')}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label={t('common.delete')}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
