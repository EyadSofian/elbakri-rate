import { useState } from 'react'
import { Plus, Check, CalendarRange, BedDouble, MapPin } from 'lucide-react'
import { Badge, Stars } from '@/components/ui/badge'
import { useQuoteCart } from '@/context/QuoteCartContext'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { formatPrice, formatDateRange, cn } from '@/lib/utils'
import { mealLabel, roomLabel, pricingText } from '@/lib/labels'
import { ApiError } from '@/lib/api'
import type { Rate } from '@/types'

export function OfferCard({ rate, stars }: { rate: Rate; stars?: number | null }) {
  const { rateIds, addRate } = useQuoteCart()
  const toast = useToast()
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const added = rateIds.has(rate.id)

  const add = async () => {
    if (added || busy) return
    setBusy(true)
    try {
      await addRate(rate.id)
      toast.success(t('offer.addedToast'))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('offer.addFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden p-0">
      <div className="flex items-start justify-between gap-2 border-b border-navy-50 bg-gradient-to-l from-navy-50/60 to-transparent p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold text-navy-900">{rate.hotel_name}</h3>
            {stars ? <Stars count={stars} /> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{rate.region || t('common.none')}{rate.sub_region ? ` · ${rate.sub_region}` : ''}</span>
          </div>
        </div>
        {rate.package_name && <Badge tone="gold">{rate.package_name}</Badge>}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink">
          <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-4 w-4 shrink-0 text-navy-400" />{formatDateRange(rate.date_from, rate.date_to, t('export.allPeriods'))}</span>
          <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4 shrink-0 text-navy-400" />{roomLabel(rate.room_type, lang)} · {mealLabel(rate.meal_plan, lang)}</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="nums text-2xl font-extrabold leading-none text-navy-900">{formatPrice(rate.adult_price, rate.currency)}</div>
            <div className="mt-1 text-[11px] text-ink-muted">{pricingText(rate.pricing_basis, lang)}</div>
          </div>
          <button
            onClick={add}
            disabled={busy}
            className={cn(
              'inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-btn px-4 text-sm font-bold transition',
              added ? 'bg-green-100 text-green-700' : 'bg-navy-900 text-white hover:bg-navy-800',
            )}
          >
            {added ? <><Check className="h-4 w-4" />{t('offer.added')}</> : <><Plus className="h-4 w-4" />{t('offer.add')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
