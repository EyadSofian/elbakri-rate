import { forwardRef, useMemo } from 'react'
import { Baby, Bus, CalendarDays, Phone, Utensils } from 'lucide-react'
import { formatPrice, formatDateRange, formatDate } from '@/lib/utils'
import { mealLabel, roomLabel, transferLabel } from '@/lib/labels'
import type { Rate } from '@/types'

export interface OfferExportData {
  client?: string | null
  title?: string | null
  subtitle?: string | null
  notes?: string | null
  phone?: string
  items: Rate[]
}

/**
 * Fixed 1080px-wide branded layout captured by html-to-image.
 * Rendered off-viewport (see .export-stage) so it never breaks the page.
 */
export const ClientOfferExport = forwardRef<HTMLDivElement, OfferExportData>(function ClientOfferExport(
  { client, title, subtitle, notes, phone = '', items },
  ref,
) {
  const groups = useMemo(() => {
    const map = new Map<string, Rate[]>()
    for (const r of items) {
      const key = r.hotel_name ?? 'فندق'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries())
  }, [items])

  const today = formatDate(new Date().toISOString())

  return (
    <div ref={ref} dir="rtl" style={{ width: 1080, background: '#ffffff', fontFamily: 'Cairo, sans-serif' }} className="text-ink">
      {/* Header */}
      <div style={{ background: '#07184A' }} className="relative overflow-hidden px-12 py-9 text-white">
        <div style={{ position: 'absolute', insetInlineStart: -80, top: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(200,162,74,0.12)' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div style={{ background: '#ffffff' }} className="flex h-16 w-64 items-center rounded-xl px-3 py-2">
              <img src="/elbakri-logo.png" alt="" className="h-12 w-auto object-contain" />
            </div>
            <div>
              <div className="text-2xl font-extrabold tracking-tight">ELBAKRI OVERSEAS</div>
              <div className="text-sm font-semibold text-navy-200">FOR TRAVEL · للسياحة والسفر</div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm text-navy-200">التاريخ</div>
            <div className="nums text-lg font-bold">{today}</div>
          </div>
        </div>
        <div className="relative mt-7">
          <div style={{ background: '#C8A24A' }} className="inline-block rounded-md px-3 py-1 text-sm font-extrabold text-navy-950">
            عرض سعر{client ? ` مقدم إلى: ${client}` : ''}
          </div>
          {(title || subtitle) && (
            <h1 className="mt-3 text-3xl font-extrabold leading-snug">
              {title}
              {subtitle && <span className="block text-xl font-semibold text-navy-200">{subtitle}</span>}
            </h1>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-12 py-8">
        {groups.map(([hotel, rates]) => (
          <div key={hotel} className="mb-7">
            <div className="mb-3 flex items-center justify-between border-b-2 pb-2" style={{ borderColor: '#07184A' }}>
              <h2 className="text-2xl font-extrabold text-navy-900">{hotel}</h2>
              <div className="flex items-center gap-2 text-base font-semibold text-ink-muted">
                {rates[0]?.region}
                {rates[0]?.region && rates[0]?.sub_region ? ' · ' : ''}
                {rates[0]?.sub_region}
              </div>
            </div>

            <div className="space-y-3">
              {rates.map((r) => (
                <div key={r.id} className="flex items-stretch overflow-hidden rounded-xl border" style={{ borderColor: '#E9EEF6' }}>
                  <div className="flex-1 p-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-lg">
                      <span className="font-bold text-navy-900">{roomLabel(r.room_type)}</span>
                      <span className="inline-flex items-center gap-2 text-ink">
                        <Utensils className="h-5 w-5 text-navy-500" />
                        {mealLabel(r.meal_plan)}
                      </span>
                      <span className="nums inline-flex items-center gap-2 text-ink">
                        <CalendarDays className="h-5 w-5 text-navy-500" />
                        {formatDateRange(r.date_from, r.date_to)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base text-ink-muted">
                      <span className="inline-flex items-center gap-2">
                        <Bus className="h-4 w-4 text-navy-500" />
                        الانتقالات: {transferLabel[r.transfer_included]}
                      </span>
                      {r.child_policy && (
                        <span className="inline-flex items-center gap-2">
                          <Baby className="h-4 w-4 text-navy-500" />
                          {r.child_policy.slice(0, 80)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: '#F4F6FB' }} className="flex w-56 shrink-0 flex-col items-center justify-center border-r p-3 text-center">
                    <div className="nums text-3xl font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                    <div className="mt-1 text-sm font-semibold text-ink-muted">للفرد</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {notes && (
          <div className="mt-4 rounded-xl border p-4 text-lg" style={{ borderColor: '#E9EEF6', background: '#F4F6FB' }}>
            <span className="font-bold text-navy-900">ملاحظات: </span>
            {notes}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#07184A' }} className="px-12 py-7 text-white">
        <div className="flex items-center justify-between">
          <div className="text-base leading-relaxed text-navy-200">
            <div>• الأسعار قابلة للتغيير حسب التوافر.</div>
            <div>• برجاء التأكيد قبل الحجز.</div>
          </div>
          <div className="text-left">
            {phone ? (
              <div className="nums flex items-center justify-end gap-2 text-xl font-extrabold" style={{ color: '#C8A24A' }}>
                <Phone className="h-5 w-5" />
                {phone}
              </div>
            ) : null}
            <div className="text-sm font-semibold text-navy-200">ELBAKRI OVERSEAS FOR TRAVEL</div>
          </div>
        </div>
      </div>
    </div>
  )
})
