import { forwardRef, useMemo } from 'react'
import { Baby, Building2, Bus, CalendarDays, Info, MapPin, Phone, Sparkles, Utensils } from 'lucide-react'
import { priceNumber, formatDateRange, formatDate } from '@/lib/utils'
import { translate, type Lang } from '@/lib/i18n'
import { Logo } from '@/components/layout/Logo'
import { describeOffer, type HotelGroup, type PeriodGroup } from '@/lib/grouping'
import type { Rate } from '@/types'

export interface HotelInfo {
  description?: string | null
  childPolicyDefault?: string | null
  transferNotesDefault?: string | null
  facilities?: string | null
}

export interface OfferExportData {
  client?: string | null
  /** Explicit title override. When omitted, a meaningful title is derived from
   *  the items (single hotel → "عرض سعر {hotel}", package → package name). */
  title?: string | null
  subtitle?: string | null
  notes?: string | null
  reference?: string | null
  issuedDate?: string | null
  phone?: string
  items: Rate[]
  lang?: Lang
  /** 'hotel' forces a hotel-focused offer (no package framing) even if every
   *  rate happens to share one package — used by the Hotel Detail / Hotels-list
   *  exports. 'auto' (default) derives the shape from the rates. */
  mode?: 'auto' | 'hotel'
  /** General hotel info (shown once per hotel), keyed by hotel_id. Only passed
   *  from the Hotel Detail export — quotes/packages omit it. */
  hotelInfo?: Record<number, HotelInfo>
}

const NAVY = '#07184A'
const GOLD = '#C8A24A'
const SURFACE = '#F4F6FB'
const BORDER = '#E9EEF6'
const MUTED = '#5A6B86'
const SUB = '#33508F'

function titleSize(name: string): number {
  const len = name.length
  if (len > 52) return 26
  if (len > 36) return 30
  return 34
}

function hotelNameSize(name: string): number {
  const len = name.length
  if (len > 46) return 22
  if (len > 32) return 25
  return 28
}

/**
 * Fixed-width branded offer captured by html-to-image at high resolution.
 * Rendered off-viewport, portrait-first, content-driven height, fully bilingual
 * (AR rtl / EN ltr). Hotels are single entities (grouped by hotel_id); periods
 * nest inside; room prices nest inside periods.
 */
export const ClientOfferExport = forwardRef<HTMLDivElement, OfferExportData>(function ClientOfferExport(
  { client, title, subtitle, notes, reference, issuedDate, phone = '', items, lang = 'ar', mode = 'auto', hotelInfo },
  ref,
) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars)
  const allPeriods = t('export.allPeriods')

  const shape = useMemo(() => describeOffer(items), [items])
  const { groups } = shape
  // 'hotel' mode pins the offer to a single hotel: never package framing/badge.
  const forceHotel = mode === 'hotel'
  const isPackageOffer = forceHotel ? false : shape.isPackageOffer
  const packageName = forceHotel ? null : shape.packageName
  const singleHotel = forceHotel ? groups[0] ?? null : shape.singleHotel

  // ---- Resolve a clean, human title (never an internal code) ----
  const resolvedTitle =
    title ||
    (isPackageOffer && packageName ? packageName : null) ||
    (singleHotel ? t('export.offerTitleHotel', { name: singleHotel.name }) : null)

  const resolvedSubtitle =
    subtitle ??
    (singleHotel ? [singleHotel.region, singleHotel.subRegion].filter(Boolean).join(' · ') || null : null)

  const today = formatDate(issuedDate ?? new Date().toISOString())
  const compact = groups.length > 1 || items.length > 6
  // A single standalone hotel is presented as the headline itself — no repeated
  // per-hotel section header. Packages / multi-hotel offers show a section per hotel.
  const headlineIsHotel = !!singleHotel && (forceHotel || (!title && !isPackageOffer))

  return (
    <div
      ref={ref}
      dir={dir}
      style={{ width: 1080, background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: '#0E1A33', display: 'flex', flexDirection: 'column' }}
    >
      {/* ---- Header (transparent logo, no white box) ---- */}
      <div style={{ padding: '40px 52px 24px' }}>
        <div style={{ direction: 'ltr', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Logo className="h-[76px] max-w-[360px]" />
          </div>
          <div style={{ direction: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', background: NAVY, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 0.5, padding: '7px 16px', borderRadius: 8, textTransform: 'uppercase' }}>
              {t('export.heading')}
            </div>
            {client && (
              <div style={{ marginTop: 8, fontSize: 14, color: MUTED, fontWeight: 600 }}>
                {t('export.presentedTo')}: <span style={{ color: NAVY, fontWeight: 700 }}>{client}</span>
              </div>
            )}
            {reference && (
              <div style={{ marginTop: client ? 4 : 8, fontSize: 13, color: MUTED, fontWeight: 700 }}>
                {t('export.reference')}: <span className="nums" style={{ color: NAVY }}>{reference}</span>
              </div>
            )}
          </div>
        </div>

        {/* gold rule */}
        <div style={{ height: 3, background: GOLD, borderRadius: 999, marginTop: 22 }} />

        {resolvedTitle && (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {isPackageOffer && (
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 46, height: 46, borderRadius: 12, background: GOLD, flexShrink: 0, marginTop: 2 }}>
                <Sparkles style={{ width: 24, height: 24, color: NAVY }} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: titleSize(resolvedTitle), fontWeight: 800, color: NAVY, lineHeight: 1.2, maxWidth: 860, wordBreak: 'break-word' }}>
                {resolvedTitle}
              </h1>
              {resolvedSubtitle && (
                <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 16, fontWeight: 600, color: MUTED }}>
                  <MapPin style={{ width: 17, height: 17, color: SUB, flexShrink: 0 }} />
                  {resolvedSubtitle}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- Body ---- */}
      <div style={{ padding: '6px 52px 36px', display: 'flex', flexDirection: 'column', gap: 30 }}>
        {groups.map((h) => (
          <HotelSection
            key={h.hotelId ?? h.name}
            group={h}
            lang={lang}
            t={t}
            allPeriods={allPeriods}
            showHeader={!headlineIsHotel}
            showPackageBadge={isPackageOffer && !!h.packageName}
            info={h.hotelId != null ? hotelInfo?.[h.hotelId] : undefined}
            compact={compact}
          />
        ))}

        {notes && (
          <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: SURFACE, padding: '16px 18px', fontSize: 15, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 800, color: NAVY }}>{t('export.notes')}: </span>
            {notes}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div style={{ marginTop: 'auto', background: NAVY, color: '#fff', padding: '22px 52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: '#aebfdd' }}>
            <div>• {t('export.term1')}</div>
            <div>• {t('export.term2')}</div>
          </div>
          <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
            {phone ? (
              <div className="nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, fontSize: 20, fontWeight: 800, color: GOLD }}>
                <Phone style={{ width: 19, height: 19 }} />
                {phone}
              </div>
            ) : null}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: phone ? 5 : 0 }}>ELBAKRI OVERSEAS FOR TRAVEL</div>
            <div style={{ fontSize: 11.5, color: '#7e96c6', marginTop: 3 }}>{t('export.issued')}: <span className="nums">{today}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
})

function HotelSection({
  group,
  lang,
  t,
  allPeriods,
  showHeader,
  showPackageBadge,
  info,
  compact,
}: {
  group: HotelGroup
  lang: Lang
  t: (k: string, vars?: Record<string, string | number>) => string
  allPeriods: string
  showHeader: boolean
  showPackageBadge: boolean
  info?: HotelInfo
  compact: boolean
}) {
  // Hotel-level child policy is shown once; period-level policy is not rendered.
  // default when NO period carries its own — shown a single time.
  const hotelChild = group.sharedChildPolicy ?? info?.childPolicyDefault ?? null
  const description = info?.description ?? null
  const transferNotes = info?.transferNotesDefault ?? null
  const facilities = info?.facilities ?? null
  const hasInfo = !!(description || hotelChild || transferNotes || facilities)

  return (
    <section>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 42, height: 42, borderRadius: 11, background: SURFACE, border: `1px solid ${BORDER}`, flexShrink: 0, marginTop: 2 }}>
            <Building2 style={{ width: 22, height: 22, color: NAVY }} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: hotelNameSize(group.name), fontWeight: 800, color: NAVY, lineHeight: 1.2, maxWidth: 760, wordBreak: 'break-word' }}>
                {group.name}
              </h2>
              {showPackageBadge && group.packageName && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, background: '#F4ECD6', border: `1px solid ${GOLD}`, borderRadius: 999, padding: '3px 12px' }}>
                  {group.packageName}
                </span>
              )}
            </div>
            {(group.region || group.subRegion) && (
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: MUTED }}>
                {[group.region, group.subRegion].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Periods */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16 }}>
        {group.periods.map((p) => (
          <PeriodBlock key={p.key} period={p} lang={lang} t={t} allPeriods={allPeriods} compact={compact} />
        ))}
      </div>

      {/* General hotel info — once per hotel */}
      {hasInfo && (
        <div style={{ marginTop: 14, borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {description && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 1.6, color: '#2A3852' }}>
              <Info style={{ width: 16, height: 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span>{description}</span>
            </div>
          )}
          {hotelChild && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 1.6, color: '#2A3852' }}>
              <Baby style={{ width: 16, height: 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span><strong style={{ color: NAVY }}>{t('export.children')}:</strong> {hotelChild}</span>
            </div>
          )}
          {transferNotes && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 1.6, color: '#2A3852' }}>
              <Bus style={{ width: 16, height: 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span><strong style={{ color: NAVY }}>{t('export.transfers')}:</strong> {transferNotes}</span>
            </div>
          )}
          {facilities && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 1.6, color: '#2A3852' }}>
              <Sparkles style={{ width: 16, height: 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span><strong style={{ color: NAVY }}>{t('export.facilities')}:</strong> {facilities}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PeriodBlock({
  period: p,
  lang,
  t,
  allPeriods,
  compact,
}: {
  period: PeriodGroup
  lang: Lang
  t: (k: string, vars?: Record<string, string | number>) => string
  allPeriods: string
  compact: boolean
}) {
  const cols = Math.min(Math.max(p.rates.length, 1), 4)
  const dateText = p.from || p.to ? formatDateRange(p.from, p.to, allPeriods) : allPeriods
  const pricingLabel = t(`pricing.${p.basis}`)

  return (
    <div>
      {/* Date / meal bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: compact ? '4px 12px' : '4px 18px', background: NAVY, borderRadius: 12, padding: compact ? '8px 14px' : '11px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <CalendarDays style={{ width: 18, height: 18, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#aebfdd' }}>{t('export.period')}</span>
          <span className="nums" style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: '#fff' }}>{dateText}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Utensils style={{ width: 16, height: 16, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: compact ? 13 : 14.5, fontWeight: 700, color: '#fff' }}>{t(`meal.${p.meal}`)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: '#aebfdd' }}>{t('export.pricingBasis')}</span>
          <span style={{ fontSize: compact ? 13 : 14, fontWeight: 800, color: '#fff' }}>{pricingLabel}</span>
        </div>
      </div>

      {/* Equal-width / equal-height price cells */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: compact ? 8 : 12, marginTop: compact ? 8 : 12 }}>
        {p.rates.map((r) => (
          <div
            key={r.id}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: compact ? 10 : 14, padding: compact ? '10px 8px' : '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: SUB }}>{translate(lang, `room.${r.room_type}`)}</div>
            <div className="nums" style={{ fontSize: compact ? 26 : 34, fontWeight: 800, color: NAVY, lineHeight: 1.05, marginTop: compact ? 5 : 7 }}>{priceNumber(r.adult_price)}</div>
            <div style={{ marginTop: compact ? 4 : 6, fontSize: compact ? 10.5 : 12, fontWeight: 700, letterSpacing: 0.5, color: MUTED }}>
              <span className="nums">{r.currency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Period-specific notes only. Hotel child policy / transfers are shown once at hotel level. */}
      {p.bookingNotes && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px 22px', marginTop: 8, fontSize: compact ? 12 : 13, color: MUTED }}>
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 7, maxWidth: 620 }}>
            <Info style={{ width: 16, height: 16, color: SUB, flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.5 }}>{p.bookingNotes}</span>
          </span>
        </div>
      )}
    </div>
  )
}
