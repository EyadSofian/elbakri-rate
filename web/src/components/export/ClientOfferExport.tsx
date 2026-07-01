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
  /** Internal export pipeline controls for fitting oversized offers into A3. */
  fitScale?: number
  pageHeight?: number
}

const NAVY = '#07184A'
const GOLD = '#C8A24A'
const SURFACE = '#F4F6FB'
const BORDER = '#E9EEF6'
const MUTED = '#5A6B86'
const SUB = '#33508F'
type ExportDensity = 'regular' | 'compact' | 'dense'

const EXPORT_WIDTH = 1080
const DENSITY: Record<ExportDensity, {
  headerPad: string
  bodyPad: string
  footerPad: string
  logoClass: string
  ruleTop: number
  titleTop: number
  bodyGap: number
}> = {
  regular: {
    headerPad: '40px 52px 24px',
    bodyPad: '6px 52px 36px',
    footerPad: '22px 52px',
    logoClass: 'h-[76px] max-w-[360px]',
    ruleTop: 22,
    titleTop: 20,
    bodyGap: 30,
  },
  compact: {
    headerPad: '28px 42px 16px',
    bodyPad: '4px 42px 24px',
    footerPad: '16px 42px',
    logoClass: 'h-[62px] max-w-[310px]',
    ruleTop: 16,
    titleTop: 14,
    bodyGap: 18,
  },
  dense: {
    headerPad: '20px 34px 12px',
    bodyPad: '2px 34px 18px',
    footerPad: '12px 34px',
    logoClass: 'h-[50px] max-w-[260px]',
    ruleTop: 11,
    titleTop: 10,
    bodyGap: 11,
  },
}

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

function cleanText(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

function infoFromRates(group: HotelGroup): HotelInfo | undefined {
  const rates = group.periods.flatMap((p) => p.rates)
  const first = rates.find(
    (r) =>
      cleanText(r.hotel_description) ||
      cleanText(r.hotel_child_policy_default) ||
      cleanText(r.hotel_transfer_notes_default) ||
      cleanText(r.hotel_facilities),
  )
  if (!first) return undefined
  return {
    description: cleanText(first.hotel_description),
    childPolicyDefault: cleanText(first.hotel_child_policy_default),
    transferNotesDefault: cleanText(first.hotel_transfer_notes_default),
    facilities: cleanText(first.hotel_facilities),
  }
}

function densityFor(groups: HotelGroup[], items: Rate[]): ExportDensity {
  const totalPeriods = groups.reduce((sum, g) => sum + g.periods.length, 0)
  if (groups.length > 4 || totalPeriods > 8 || items.length > 16) return 'dense'
  if (groups.length > 1 || totalPeriods > 4 || items.length > 6) return 'compact'
  return 'regular'
}

/**
 * Fixed-width branded offer captured by html-to-image at high resolution.
 * Rendered off-viewport, portrait-first, content-driven height, fully bilingual
 * (AR rtl / EN ltr). Hotels are single entities (grouped by hotel_id); periods
 * nest inside; room prices nest inside periods.
 */
export const ClientOfferExport = forwardRef<HTMLDivElement, OfferExportData>(function ClientOfferExport(
  { client, title, subtitle, notes, reference, issuedDate, phone = '', items, lang = 'ar', mode = 'auto', hotelInfo, fitScale, pageHeight },
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
  const density = fitScale && fitScale < 0.92 ? 'dense' : densityFor(groups, items)
  const compact = density !== 'regular'
  const dense = density === 'dense'
  const m = DENSITY[density]
  const scale = fitScale && fitScale < 1 ? fitScale : 1
  // A single standalone hotel is presented as the headline itself — no repeated
  // per-hotel section header. Packages / multi-hotel offers show a section per hotel.
  const headlineIsHotel = !!singleHotel && (forceHotel || (!title && !isPackageOffer))

  return (
    <div
      ref={ref}
      dir={dir}
      style={{ width: EXPORT_WIDTH, height: pageHeight, overflow: pageHeight ? 'hidden' : undefined, background: '#ffffff' }}
    >
      <div
        dir={dir}
        style={{
          width: scale < 1 ? EXPORT_WIDTH / scale : EXPORT_WIDTH,
          minHeight: pageHeight && scale < 1 ? pageHeight / scale : pageHeight,
          background: '#ffffff',
          fontFamily: 'Cairo, sans-serif',
          color: '#0E1A33',
          display: 'flex',
          flexDirection: 'column',
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: dir === 'rtl' ? 'top right' : 'top left',
        }}
      >
      {/* ---- Header (transparent logo, no white box) ---- */}
      <div style={{ padding: m.headerPad }}>
        <div style={{ direction: 'ltr', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Logo className={m.logoClass} />
          </div>
          <div style={{ direction: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', background: NAVY, color: '#fff', fontSize: dense ? 10.5 : 13, fontWeight: 800, letterSpacing: 0.5, padding: dense ? '5px 11px' : '7px 16px', borderRadius: 8, textTransform: 'uppercase' }}>
              {t('export.heading')}
            </div>
            {client && (
              <div style={{ marginTop: dense ? 5 : 8, fontSize: dense ? 11.5 : 14, color: MUTED, fontWeight: 600 }}>
                {t('export.presentedTo')}: <span style={{ color: NAVY, fontWeight: 700 }}>{client}</span>
              </div>
            )}
            {reference && (
              <div style={{ marginTop: client ? 4 : 8, fontSize: dense ? 11 : 13, color: MUTED, fontWeight: 700 }}>
                {t('export.reference')}: <span className="nums" style={{ color: NAVY }}>{reference}</span>
              </div>
            )}
          </div>
        </div>

        {/* gold rule */}
        <div style={{ height: dense ? 2 : 3, background: GOLD, borderRadius: 999, marginTop: m.ruleTop }} />

        {resolvedTitle && (
          <div style={{ marginTop: m.titleTop, display: 'flex', alignItems: 'flex-start', gap: dense ? 9 : 14 }}>
            {isPackageOffer && (
              <span style={{ display: 'inline-grid', placeItems: 'center', width: dense ? 32 : 46, height: dense ? 32 : 46, borderRadius: dense ? 8 : 12, background: GOLD, flexShrink: 0, marginTop: 2 }}>
                <Sparkles style={{ width: dense ? 17 : 24, height: dense ? 17 : 24, color: NAVY }} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: dense ? Math.max(22, titleSize(resolvedTitle) - 9) : titleSize(resolvedTitle), fontWeight: 800, color: NAVY, lineHeight: 1.15, maxWidth: dense ? 900 : 860, wordBreak: 'break-word' }}>
                {resolvedTitle}
              </h1>
              {resolvedSubtitle && (
                <div style={{ marginTop: dense ? 3 : 6, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: dense ? 12.5 : 16, fontWeight: 600, color: MUTED }}>
                  <MapPin style={{ width: dense ? 13 : 17, height: dense ? 13 : 17, color: SUB, flexShrink: 0 }} />
                  {resolvedSubtitle}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- Body ---- */}
      <div style={{ padding: m.bodyPad, display: 'flex', flexDirection: 'column', gap: m.bodyGap }}>
        {groups.map((h) => (
          <HotelSection
            key={h.hotelId ?? h.name}
            group={h}
            lang={lang}
            t={t}
            allPeriods={allPeriods}
            showHeader={!headlineIsHotel}
            showPackageBadge={isPackageOffer && !!h.packageName}
            info={(h.hotelId != null ? hotelInfo?.[h.hotelId] : undefined) ?? infoFromRates(h)}
            compact={compact}
            dense={dense}
          />
        ))}

        {notes && (
          <div style={{ borderRadius: dense ? 10 : 14, border: `1px solid ${BORDER}`, background: SURFACE, padding: dense ? '8px 10px' : '16px 18px', fontSize: dense ? 11.5 : 15, lineHeight: dense ? 1.35 : 1.6 }}>
            <span style={{ fontWeight: 800, color: NAVY }}>{t('export.notes')}: </span>
            {notes}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div style={{ marginTop: 'auto', background: NAVY, color: '#fff', padding: m.footerPad }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: dense ? 10.5 : 13, lineHeight: dense ? 1.45 : 1.8, color: '#aebfdd' }}>
            <div>• {t('export.term1')}</div>
            <div>• {t('export.term2')}</div>
          </div>
          <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
            {phone ? (
              <div className="nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, fontSize: dense ? 15 : 20, fontWeight: 800, color: GOLD }}>
                <Phone style={{ width: dense ? 15 : 19, height: dense ? 15 : 19 }} />
                {phone}
              </div>
            ) : null}
            <div style={{ fontSize: dense ? 10.5 : 13, fontWeight: 700, color: '#fff', marginTop: phone ? 5 : 0 }}>ELBAKRI OVERSEAS FOR TRAVEL</div>
            <div style={{ fontSize: dense ? 9.5 : 11.5, color: '#7e96c6', marginTop: 3 }}>{t('export.issued')}: <span className="nums">{today}</span></div>
          </div>
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
  dense,
}: {
  group: HotelGroup
  lang: Lang
  t: (k: string, vars?: Record<string, string | number>) => string
  allPeriods: string
  showHeader: boolean
  showPackageBadge: boolean
  info?: HotelInfo
  compact: boolean
  dense: boolean
}) {
  // Hotel-level child policy is shown once; period-level policy is not rendered.
  // default when NO period carries its own — shown a single time.
  const hotelChild = group.sharedChildPolicy ?? info?.childPolicyDefault ?? null
  const description = info?.description ?? null
  const transferNotes = info?.transferNotesDefault ?? null
  const facilities = info?.facilities ?? null
  const hasInfo = !!(description || hotelChild || transferNotes || facilities)
  const denseTextClamp = dense
    ? { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
    : undefined

  return (
    <section>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: dense ? 8 : 14, marginBottom: dense ? 6 : 14 }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: dense ? 28 : 42, height: dense ? 28 : 42, borderRadius: dense ? 8 : 11, background: SURFACE, border: `1px solid ${BORDER}`, flexShrink: 0, marginTop: 2 }}>
            <Building2 style={{ width: dense ? 15 : 22, height: dense ? 15 : 22, color: NAVY }} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: dense ? Math.max(17, hotelNameSize(group.name) - 8) : hotelNameSize(group.name), fontWeight: 800, color: NAVY, lineHeight: 1.1, maxWidth: dense ? 900 : 760, wordBreak: 'break-word' }}>
                {group.name}
              </h2>
              {showPackageBadge && group.packageName && (
                <span style={{ fontSize: dense ? 10 : 12.5, fontWeight: 700, color: NAVY, background: '#F4ECD6', border: `1px solid ${GOLD}`, borderRadius: 999, padding: dense ? '2px 8px' : '3px 12px' }}>
                  {group.packageName}
                </span>
              )}
            </div>
            {(group.region || group.subRegion) && (
              <div style={{ marginTop: dense ? 1 : 4, fontSize: dense ? 10.5 : 14, fontWeight: 600, color: MUTED }}>
                {[group.region, group.subRegion].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Periods */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? 6 : compact ? 10 : 16 }}>
        {group.periods.map((p) => (
          <PeriodBlock key={p.key} period={p} lang={lang} t={t} allPeriods={allPeriods} compact={compact} dense={dense} />
        ))}
      </div>

      {/* General hotel info — once per hotel */}
      {hasInfo && (
        <div style={{ marginTop: dense ? 7 : 14, borderRadius: dense ? 8 : 12, border: `1px solid ${BORDER}`, background: SURFACE, padding: dense ? '6px 8px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: dense ? 4 : 8 }}>
          {description && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: dense ? 6 : 9, fontSize: dense ? 9.5 : 13.5, lineHeight: dense ? 1.25 : 1.6, color: '#2A3852' }}>
              <Info style={{ width: dense ? 12 : 16, height: dense ? 12 : 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span style={denseTextClamp}>{description}</span>
            </div>
          )}
          {hotelChild && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: dense ? 6 : 9, fontSize: dense ? 9.5 : 13.5, lineHeight: dense ? 1.25 : 1.6, color: '#2A3852' }}>
              <Baby style={{ width: dense ? 12 : 16, height: dense ? 12 : 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span style={denseTextClamp}><strong style={{ color: NAVY }}>{t('export.children')}:</strong> {hotelChild}</span>
            </div>
          )}
          {transferNotes && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: dense ? 6 : 9, fontSize: dense ? 9.5 : 13.5, lineHeight: dense ? 1.25 : 1.6, color: '#2A3852' }}>
              <Bus style={{ width: dense ? 12 : 16, height: dense ? 12 : 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span style={denseTextClamp}><strong style={{ color: NAVY }}>{t('export.transfers')}:</strong> {transferNotes}</span>
            </div>
          )}
          {facilities && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: dense ? 6 : 9, fontSize: dense ? 9.5 : 13.5, lineHeight: dense ? 1.25 : 1.6, color: '#2A3852' }}>
              <Sparkles style={{ width: dense ? 12 : 16, height: dense ? 12 : 16, color: SUB, flexShrink: 0, marginTop: 2 }} />
              <span style={denseTextClamp}><strong style={{ color: NAVY }}>{t('export.facilities')}:</strong> {facilities}</span>
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
  dense,
}: {
  period: PeriodGroup
  lang: Lang
  t: (k: string, vars?: Record<string, string | number>) => string
  allPeriods: string
  compact: boolean
  dense: boolean
}) {
  const cols = Math.min(Math.max(p.rates.length, 1), 4)
  const dateText = p.from || p.to ? formatDateRange(p.from, p.to, allPeriods) : allPeriods
  const pricingLabel = t(`pricing.${p.basis}`)

  return (
    <div>
      {/* Date / meal bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: dense ? '2px 8px' : compact ? '4px 12px' : '4px 18px', background: NAVY, borderRadius: dense ? 7 : 12, padding: dense ? '4px 8px' : compact ? '8px 14px' : '11px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: dense ? 5 : 9 }}>
          <CalendarDays style={{ width: dense ? 12 : 18, height: dense ? 12 : 18, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: dense ? 9.5 : 13, fontWeight: 600, color: '#aebfdd' }}>{t('export.period')}</span>
          <span className="nums" style={{ fontSize: dense ? 11 : compact ? 14 : 16, fontWeight: 700, color: '#fff' }}>{dateText}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: dense ? 5 : 8 }}>
          <Utensils style={{ width: dense ? 11 : 16, height: dense ? 11 : 16, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: dense ? 10.5 : compact ? 13 : 14.5, fontWeight: 700, color: '#fff' }}>{t(`meal.${p.meal}`)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: dense ? 5 : 7 }}>
          <span style={{ fontSize: dense ? 9.5 : compact ? 12 : 13, fontWeight: 600, color: '#aebfdd' }}>{t('export.pricingBasis')}</span>
          <span style={{ fontSize: dense ? 10.5 : compact ? 13 : 14, fontWeight: 800, color: '#fff' }}>{pricingLabel}</span>
        </div>
      </div>

      {/* Equal-width / equal-height price cells */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: dense ? 4 : compact ? 8 : 12, marginTop: dense ? 4 : compact ? 8 : 12 }}>
        {p.rates.map((r) => (
          <div
            key={r.id}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: dense ? 7 : compact ? 10 : 14, padding: dense ? '5px 6px' : compact ? '10px 8px' : '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ fontSize: dense ? 10.5 : compact ? 13 : 15, fontWeight: 700, color: SUB }}>{translate(lang, `room.${r.room_type}`)}</div>
            <div className="nums" style={{ fontSize: dense ? 20 : compact ? 26 : 34, fontWeight: 800, color: NAVY, lineHeight: 1.02, marginTop: dense ? 2 : compact ? 5 : 7 }}>{priceNumber(r.adult_price)}</div>
            <div style={{ marginTop: dense ? 1 : compact ? 4 : 6, fontSize: dense ? 8.5 : compact ? 10.5 : 12, fontWeight: 700, letterSpacing: 0.5, color: MUTED }}>
              <span className="nums">{r.currency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Period-specific notes only. Hotel child policy / transfers are shown once at hotel level. */}
      {p.bookingNotes && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px 22px', marginTop: dense ? 4 : 8, fontSize: dense ? 9.5 : compact ? 12 : 13, color: MUTED }}>
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: dense ? 5 : 7, maxWidth: dense ? 900 : 620 }}>
            <Info style={{ width: dense ? 11 : 16, height: dense ? 11 : 16, color: SUB, flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: dense ? 1.25 : 1.5, ...(dense ? { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>{p.bookingNotes}</span>
          </span>
        </div>
      )}
    </div>
  )
}
