import { forwardRef, useMemo, type ReactNode } from 'react'
import { Baby, Bus, CalendarDays, Hotel, MapPin, Phone, ShieldCheck, Utensils } from 'lucide-react'
import { formatDateRange, formatPrice } from '@/lib/utils'
import { dirFor, translate, type Lang } from '@/lib/i18n'
import { mealLabel, roomLabel, transferText } from '@/lib/labels'
import { groupRatesByHotel, groupRatesByPeriod } from '@/lib/rateGrouping'
import type { Rate } from '@/types'

export interface OfferExportData {
  client?: string | null
  title?: string | null
  subtitle?: string | null
  notes?: string | null
  phone?: string
  lang?: Lang
  items: Rate[]
}

const navy = '#07184A'
const navy2 = '#0B2461'
const gold = '#C8A24A'
const border = '#D9E2F1'
const surface = '#F4F7FC'

function firstText(values: Array<string | null | undefined>) {
  return values.find((v) => v && v.trim().length > 0) ?? null
}

function priceParts(value: Rate['adult_price'], currency: Rate['currency']) {
  const price = formatPrice(value, currency)
  if (price === '—') return { amount: '—', currency: '' }
  const suffix = ` ${currency}`
  return price.endsWith(suffix)
    ? { amount: price.slice(0, -suffix.length), currency }
    : { amount: price, currency: '' }
}

function TextNote({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-[16px] bg-white px-4 py-3 text-right">
      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: '#EEF3FB', color: navy }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[18px] font-extrabold leading-[1.25]" style={{ color: navy }}>{label}</div>
        <div className="mt-1 text-[18px] font-semibold leading-[1.45]" style={{ color: '#34415D' }}>{children}</div>
      </div>
    </div>
  )
}

export const ClientOfferExport = forwardRef<HTMLDivElement, OfferExportData>(function ClientOfferExport(
  { client, title, subtitle, notes, phone = '', lang = 'ar', items },
  ref,
) {
  const groups = useMemo(() => groupRatesByHotel(items), [items])
  const first = items[0]
  const dir = dirFor(lang)
  const t = (key: string) => translate(lang, key)
  const offerTitle = title || first?.package_name || t('export.heading')
  const offerSubtitle = subtitle || firstText([first?.region, first?.hotel_group]) || (lang === 'ar' ? 'الأسعار للفرد حسب الفترة والغرفة' : 'Prices per person by period and room type')

  return (
    <div
      ref={ref}
      dir={dir}
      style={{
        width: 1080,
        minHeight: 1320,
        background: '#FFFFFF',
        color: navy,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Cairo, Tajawal, sans-serif',
        fontKerning: 'normal',
        lineHeight: 1.35,
      }}
    >
      <header className="relative overflow-hidden px-11 pb-9 pt-9" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #EEF6FF 100%)' }}>
        <div
          className="absolute inset-x-0 bottom-0 h-28"
          style={{ background: 'linear-gradient(90deg, rgba(7,24,74,0.04), rgba(40,147,216,0.18), rgba(255,255,255,0))' }}
        />
        <div
          className="absolute -left-20 top-12 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(40,147,216,0.28), rgba(40,147,216,0))' }}
        />
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(200,162,74,0.18), rgba(200,162,74,0))' }}
        />

        <div className="relative flex items-center justify-end">
          <img src="/elbakri-logo.png" alt="" className="h-[118px] w-auto max-w-[520px] object-contain" />
        </div>

        <div className="relative mt-8 overflow-hidden rounded-[28px] px-8 py-8 text-white shadow-[0_16px_40px_rgba(7,24,74,0.18)]" style={{ background: `linear-gradient(135deg, ${navy} 0%, ${navy2} 100%)` }}>
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 right-12 h-56 w-56 rounded-full" style={{ background: 'rgba(200,162,74,0.16)' }} />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full px-5 py-2 text-[21px] font-black leading-[1.2]" style={{ background: gold, color: navy }}>
                {t('export.heading')}
              </div>
              {client && (
                <div className="rounded-full bg-white/10 px-5 py-2 text-[19px] font-extrabold leading-[1.25] text-white">
                  {t('export.presentedTo')}: {client}
                </div>
              )}
            </div>
            <div className="text-left text-[22px] font-extrabold leading-[1.25] text-white/90">
              ELBAKRI OVERSEAS FOR TRAVEL
            </div>
          </div>
          <h1 className="relative mt-5 break-words text-[58px] font-black leading-[1.12] text-white">
            {offerTitle}
          </h1>
          <p className="relative mt-3 max-w-[820px] text-[27px] font-bold leading-[1.3] text-white/80">
            {offerSubtitle}
          </p>
        </div>
      </header>

      <main className="flex-1 px-9 py-8" style={{ background: '#FFFFFF' }}>
        {groups.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed px-8 py-14 text-center text-[28px] font-extrabold" style={{ borderColor: border, color: '#52617E' }}>
            {t('export.noItems')}
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map(([hotel, rates]) => {
              const hotelFirst = rates[0]
              const location = [hotelFirst?.region, hotelFirst?.sub_region].filter(Boolean).join(' · ')
              const periods = groupRatesByPeriod(rates)

              return (
                <section key={hotel} className="overflow-hidden rounded-[28px] border shadow-[0_10px_28px_rgba(7,24,74,0.10)]" style={{ borderColor: border }}>
                  <div className="flex items-start justify-between gap-6 px-7 py-5 text-white" style={{ background: `linear-gradient(135deg, ${navy} 0%, ${navy2} 100%)` }}>
                    <div className="flex min-w-0 max-w-[720px] items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10">
                        <Hotel className="h-9 w-9" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-[34px] font-black leading-[1.12] text-white">{hotel}</h2>
                        {location && (
                          <div className="mt-2 flex items-center gap-2 text-[19px] font-bold leading-[1.3] text-white/75">
                            <MapPin className="h-5 w-5 shrink-0" />
                            <span>{location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {hotelFirst?.hotel_group && (
                      <div className="max-w-[260px] rounded-full bg-white/10 px-5 py-2 text-center text-[20px] font-extrabold leading-[1.25] text-white">
                        {hotelFirst.hotel_group}
                      </div>
                    )}
                  </div>

                  <div className="space-y-5 p-5" style={{ background: surface }}>
                    {periods.map((period) => {
                      const periodFirst = period.rates[0]
                      const policy = firstText(period.rates.map((r) => r.child_policy))
                      const bookingNotes = firstText(period.rates.map((r) => r.booking_notes))
                      const showTransfer = periodFirst.transfer_included !== 'Not Included'
                      const transferDetails = showTransfer ? firstText(period.rates.map((r) => r.transfer_details)) : null
                      const cols = Math.min(Math.max(period.rates.length, 1), 4)

                      return (
                        <div key={`${hotel}-${period.key}`} className="overflow-hidden rounded-[22px] border bg-white" style={{ borderColor: border }}>
                          <div className="grid gap-3 px-5 py-4 text-white" style={{ background: navy, gridTemplateColumns: showTransfer ? '1.45fr 0.8fr 1fr' : '1.45fr 0.8fr' }}>
                            <div className="flex min-h-[62px] items-center gap-3 rounded-[18px] bg-white/10 px-4">
                              <CalendarDays className="h-7 w-7 shrink-0 text-white" />
                              <div className="min-w-0">
                                <div className="text-[15px] font-extrabold leading-[1.2] text-white/70">{t('export.period')}</div>
                                <div className="nums mt-1 text-[23px] font-black leading-none text-white" style={{ whiteSpace: 'nowrap' }}>
                                  {formatDateRange(periodFirst.date_from, periodFirst.date_to)}
                                </div>
                              </div>
                            </div>
                            <div className="flex min-h-[62px] items-center gap-3 rounded-[18px] bg-white/10 px-4">
                              <Utensils className="h-7 w-7 shrink-0 text-white" />
                              <div>
                                <div className="text-[15px] font-extrabold leading-[1.2] text-white/70">{t('export.meal')}</div>
                                <div className="mt-1 text-[22px] font-black leading-none text-white">{mealLabel(periodFirst.meal_plan, lang)}</div>
                              </div>
                            </div>
                            {showTransfer && (
                              <div className="flex min-h-[62px] items-center gap-3 rounded-[18px] bg-white/10 px-4">
                                <Bus className="h-7 w-7 shrink-0 text-white" />
                                <div className="min-w-0">
                                  <div className="text-[15px] font-extrabold leading-[1.2] text-white/70">{t('export.transfers')}</div>
                                  <div className="mt-1 truncate text-[20px] font-black leading-none text-white">{transferText(periodFirst.transfer_included, lang)}</div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                            {period.rates.map((rate) => {
                              const price = priceParts(rate.adult_price, rate.currency)

                              return (
                                <div key={rate.id} className="flex min-h-[158px] flex-col items-center justify-center border-l px-4 py-5 text-center last:border-l-0" style={{ borderColor: border, background: '#FFFFFF' }}>
                                  <div className="text-[25px] font-black leading-[1.2]" style={{ color: navy }}>
                                    {roomLabel(rate.room_type, lang)}
                                  </div>
                                  <div className="nums mt-3 text-[47px] font-black leading-none" style={{ color: navy }}>
                                    {price.amount}
                                  </div>
                                  {price.currency && (
                                    <div className="mt-2 text-[23px] font-black leading-[1.1]" style={{ color: navy }}>
                                      {price.currency}
                                    </div>
                                  )}
                                  <div className="mt-2 text-[17px] font-bold leading-[1.2]" style={{ color: '#52617E' }}>
                                    {t('export.perPerson')}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {(policy || bookingNotes || transferDetails) && (
                            <div className="grid gap-3 border-t p-4" style={{ borderColor: border, background: '#F8FAFD', gridTemplateColumns: policy && (bookingNotes || transferDetails) ? '1fr 1fr' : '1fr' }}>
                              {policy && (
                                <TextNote icon={<Baby className="h-5 w-5" />} label={t('export.children')}>
                                  {policy}
                                </TextNote>
                              )}
                              {(bookingNotes || transferDetails) && (
                                <TextNote icon={<ShieldCheck className="h-5 w-5" />} label={t('export.bookingNotes')}>
                                  {bookingNotes || transferDetails}
                                </TextNote>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {notes && (
          <div className="mt-7 rounded-[22px] border px-6 py-5 text-[21px] font-bold leading-[1.45]" style={{ borderColor: border, background: '#F8FAFD', color: '#34415D' }}>
            <span className="font-black" style={{ color: navy }}>{t('export.notes')}: </span>
            {notes}
          </div>
        )}
      </main>

      <footer className="px-10 py-7 text-white" style={{ background: navy }}>
        <div className="flex items-center justify-between gap-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: gold, color: navy }}>
              <Bus className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <div className="text-[26px] font-black leading-[1.2]">{t('export.term1')}</div>
              <div className="mt-1 text-[20px] font-bold leading-[1.35] text-white/75">{t('export.term2')}</div>
            </div>
          </div>
          <div className="shrink-0 text-left">
            {phone ? (
              <div className="nums mb-2 flex items-center justify-end gap-2 text-[27px] font-black" style={{ color: gold }}>
                <Phone className="h-6 w-6" />
                {phone}
              </div>
            ) : null}
            <div className="text-[18px] font-black leading-[1.25] text-white/70">ELBAKRI OVERSEAS FOR TRAVEL</div>
          </div>
        </div>
      </footer>
    </div>
  )
})
