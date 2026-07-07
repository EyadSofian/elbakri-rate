import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Baby, Bus, Info, Phone, Sparkles, Utensils } from 'lucide-react'
import { priceNumber, formatDate } from '@/lib/utils'
import { translate, type Lang } from '@/lib/i18n'
import { mealLabel, roomLabel } from '@/lib/labels'
import { describeOffer, type HotelGroup } from '@/lib/grouping'
import { ExportLogo } from './ExportLogo'
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
  /** Free-text selling points for the honeymoon brochure (package description).
   * Split on newline / comma / Arabic comma into feature chips. Ignored by the
   * standard offer/hotel/package export path. */
  features?: string | null
  /** 'hotel' forces a hotel-focused offer (no package framing) even if every
   *  rate happens to share one package — used by the Hotel Detail / Hotels-list
   *  exports. 'auto' (default) derives the shape from the rates. */
  mode?: 'auto' | 'hotel'
  detailsMode?: 'full' | 'prices-only'
  /** General hotel info (shown once per hotel), keyed by hotel_id. Only passed
   *  from the Hotel Detail export — quotes/packages omit it. */
  hotelInfo?: Record<number, HotelInfo>
}

/* ------------------------------------------------------------------ *
 *  Layout constants — a single A-series page at a fixed width.        *
 * ------------------------------------------------------------------ */
export const PAGE_W = 1080
export const PAGE_H = Math.round(PAGE_W * (297 / 210)) // 1527
const PAD_X = 44

const NAVY = '#07184A'
const INK = '#0E1A33'
const GOLD = '#C8A24A'
const GOLD_DARK = '#A8853B'
const GOLD_TEXT = '#E5CE93' // gold that stays readable on navy
const GOLD_TINT = '#F6EFDC'
const SURFACE = '#F5F7FC'
const BORDER = '#E3E9F4'
const MUTED = '#5A6B86'
const SUB = '#33508F'
const FAINT = '#C4CEDE'
const COMPANY_PHONE = '+20 12 25279820'

type Dir = 'rtl' | 'ltr'
type T = (k: string, vars?: Record<string, string | number>) => string

const ROOM_ORDER = ['Single', 'Double', 'Triple', 'Quad', 'Family']
function roomRank(room: string): number {
  const i = ROOM_ORDER.indexOf(room)
  return i === -1 ? ROOM_ORDER.length + 1 : i
}

function isPerRoom(basis: Rate['pricing_basis']): boolean {
  return basis === 'per_room_per_night' || basis === 'per_room_package'
}

/* ------------------------------------------------------------------ *
 *  Density system — the offer automatically tightens as it grows.      *
 *  comfort → brochure spacing (1–4 hotels), compact → 5–8 hotels,      *
 *  dense → ultra-compact for 9+ hotels / very long offers.             *
 * ------------------------------------------------------------------ */
export type Density = 'comfort' | 'compact' | 'dense'

interface DensityTokens {
  blockGap: number
  secMb: number
  headPy: number
  headFs: number
  cellPy: number
  dateFs: number
  mealFs: number
  priceFs: number
  nameFs: number
  badge: number
  badgeFs: number
  badgeR: number
  chipFs: number
  chipPy: number
  footFs: number
  radius: number
}

const DENSITIES: Record<Density, DensityTokens> = {
  comfort: { blockGap: 18, secMb: 8, headPy: 8, headFs: 12.5, cellPy: 7.5, dateFs: 13, mealFs: 12.5, priceFs: 18, nameFs: 22, badge: 30, badgeFs: 15, badgeR: 9, chipFs: 12, chipPy: 3, footFs: 12, radius: 12 },
  compact: { blockGap: 13, secMb: 6, headPy: 6, headFs: 11.5, cellPy: 5.5, dateFs: 12, mealFs: 11.5, priceFs: 15.5, nameFs: 19, badge: 26, badgeFs: 13.5, badgeR: 8, chipFs: 11.5, chipPy: 2.5, footFs: 11.5, radius: 10 },
  dense: { blockGap: 10, secMb: 5, headPy: 4.5, headFs: 10.5, cellPy: 4, dateFs: 11, mealFs: 10.5, priceFs: 13.5, nameFs: 16.5, badge: 22, badgeFs: 12, badgeR: 7, chipFs: 10.5, chipPy: 2, footFs: 11, radius: 9 },
}

function pickDensity(hotels: number, periodRows: number): Density {
  if (hotels >= 9 || periodRows >= 26) return 'dense'
  if (hotels >= 5 || periodRows >= 14) return 'compact'
  return 'comfort'
}

function bandTitleSize(title: string): number {
  const len = title.length
  if (len > 52) return 20
  if (len > 34) return 23
  return 26
}

function hotelNameSize(name: string, D: DensityTokens): number {
  if (name.length > 40) return D.nameFs - 4
  if (name.length > 28) return D.nameFs - 2
  return D.nameFs
}

/** "01/07 – 31/08/2026" — drops the redundant year on the start date so period
 *  cells stay short even in the dense layout. Digits render LTR via `.nums`. */
const DMY = /^\d{2}\/\d{2}\/\d{4}$/
function compactRange(from: string | null, to: string | null, allLabel: string): string {
  if (!from && !to) return allLabel
  const f = formatDate(from)
  const t = formatDate(to)
  const sameYear = !!from && !!to && from.slice(0, 4) === to.slice(0, 4) && DMY.test(f) && DMY.test(t)
  return `${sameYear ? f.slice(0, 5) : f} – ${t}`
}

/* ------------------------------------------------------------------ *
 *  Offer analysis + flow blocks.                                       *
 * ------------------------------------------------------------------ */
export interface OfferAnalysis {
  lang: Lang
  dir: Dir
  t: T
  density: Density
  /** Vertical gap between flow blocks — the paginator must use the same value. */
  blockGap: number
  hotelCount: number
  isPackageOffer: boolean
  resolvedTitle: string | null
  resolvedSubtitle: string | null
  headlineIsHotel: boolean
  today: string
  phone: string
  reference: string | null
  client: string | null
  notes: string | null
  /** Offer-wide "all prices in {currency} · per person" line for the terms
   *  footer. Null when currencies/bases are mixed — the per-hotel fallback
   *  line covers that case instead. */
  pricesLine: string | null
  mixedCurrency: boolean
}

/** One atomic, un-splittable unit of the offer flow (a whole hotel table, the
 *  notes box, or the terms box). The paginator packs these into pages. */
export interface FlowBlock {
  key: string
  keepWithNext: boolean
  node: ReactNode
}

export function buildOffer(data: OfferExportData): { analysis: OfferAnalysis; blocks: FlowBlock[] } {
  const { items, mode = 'auto', title, subtitle, client, notes, reference, issuedDate, phone = '' } = data
  const pricesOnly = data.detailsMode === 'prices-only'
  const lang: Lang = data.lang ?? 'ar'
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t: T = (k, vars) => translate(lang, k, vars)

  const shape = describeOffer(items)
  const forceHotel = mode === 'hotel'
  const isPackageOffer = pricesOnly ? true : forceHotel ? false : shape.isPackageOffer
  const packageName = forceHotel || pricesOnly ? null : shape.packageName
  const singleHotel = forceHotel ? shape.groups[0] ?? null : pricesOnly ? null : shape.singleHotel

  const hotelCount = shape.groups.length
  const periodRows = shape.groups.reduce((n, g) => n + g.periods.length, 0)
  const density = pickDensity(hotelCount, periodRows)

  const resolvedTitle =
    title ||
    (isPackageOffer && packageName ? packageName : null) ||
    (singleHotel ? t('export.offerTitleHotel', { name: singleHotel.name }) : null)

  const subtitleBase =
    subtitle ??
    (singleHotel ? [singleHotel.region, singleHotel.subRegion].filter(Boolean).join(' · ') || null : null)
  // Package offers surface the hotel count next to the region (≥3 keeps the
  // Arabic plural natural).
  const countLabel = isPackageOffer && hotelCount >= 3 ? t('export.hotelsCount', { n: hotelCount }) : null
  const resolvedSubtitle = [subtitleBase, countLabel].filter(Boolean).join(' · ') || null

  const headlineIsHotel = !!singleHotel

  // One offer-wide currency/basis statement (goes in the terms footer) instead
  // of repeating it under every hotel.
  const currencies = Array.from(new Set(items.map((r) => r.currency)))
  const bases = Array.from(new Set(items.map((r) => r.pricing_basis)))
  const curLabel = currencies.length === 1 ? t(`currency.${currencies[0]}`) : null
  const basisLabel =
    bases.length === 1 ? t(isPerRoom(bases[0]) ? 'export.basisPerRoom' : 'export.basisPerPerson') : null
  const pricesLine = curLabel
    ? `${t('export.allPricesIn', { cur: curLabel })}${basisLabel ? ` · ${basisLabel}` : ''}`
    : basisLabel
  const mixedCurrency = currencies.length > 1

  const analysis: OfferAnalysis = {
    lang,
    dir,
    t,
    density,
    blockGap: DENSITIES[density].blockGap,
    hotelCount,
    isPackageOffer,
    resolvedTitle,
    resolvedSubtitle,
    headlineIsHotel,
    today: formatDate(issuedDate ?? new Date().toISOString()),
    phone: phone.trim() || COMPANY_PHONE,
    reference: reference ?? null,
    client: client ?? null,
    notes: notes ?? null,
    pricesLine,
    mixedCurrency,
  }

  const blocks: FlowBlock[] = []
  const info = data.hotelInfo

  shape.groups.forEach((h, i) => {
    blocks.push({
      key: `hotel-${h.hotelId ?? h.name}`,
      keepWithNext: false,
      node: (
        <HotelSection
          group={h}
          index={i + 1}
          numbered={hotelCount > 1}
          showHeader={!headlineIsHotel}
          // Package exports are strictly price-only: no policies, transfers,
          // currency notes or badges under the hotels. Hotel/quote exports keep
          // one compact details area per hotel.
          showDetails={!pricesOnly && !isPackageOffer}
          showPackageChip={!pricesOnly && !isPackageOffer && hotelCount > 1 && !!h.packageName}
          mixedCurrency={!pricesOnly && mixedCurrency}
          density={density}
          lang={lang}
          t={t}
          info={h.hotelId != null ? info?.[h.hotelId] : undefined}
        />
      ),
    })
  })

  if (analysis.notes) {
    blocks.push({
      key: 'notes',
      keepWithNext: false,
      node: (
        <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.55 }}>
          <span style={{ fontWeight: 800, color: NAVY }}>{t('export.notes')}: </span>
          {analysis.notes}
        </div>
      ),
    })
  }

  blocks.push({ key: 'terms', keepWithNext: false, node: <TermsBlock analysis={analysis} /> })

  return { analysis, blocks }
}

/* ------------------------------------------------------------------ *
 *  Page chrome — brand row (logo locked LEFT in both languages), navy  *
 *  title band, running header and footer.                              *
 * ------------------------------------------------------------------ */

/** Full brand header + navy title band. Page 1 only. */
export function OfferHeaderFull({ analysis }: { analysis: OfferAnalysis }) {
  const { dir, t, resolvedTitle, resolvedSubtitle, client, reference } = analysis
  const bandTitle = resolvedTitle ?? t('export.heading')
  return (
    <div style={{ padding: `20px ${PAD_X}px 10px` }}>
      {/* Direction-locked LTR so the logo sits physically LEFT for Arabic too. */}
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <ExportLogo height={54} />
        <div style={{ direction: dir, textAlign: 'end' }}>
          {resolvedTitle && (
            <span style={{ display: 'inline-block', border: `1.5px solid ${GOLD}`, color: NAVY, background: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: dir === 'rtl' ? 0 : 1.1, padding: '4px 14px', borderRadius: 999, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {t('export.heading')}
            </span>
          )}
          {client && (
            <div style={{ marginTop: 6, fontSize: 12.5, color: MUTED, fontWeight: 600 }}>
              {t('export.presentedTo')}: <span style={{ color: NAVY, fontWeight: 800 }}>{client}</span>
            </div>
          )}
          {reference && (
            <div style={{ marginTop: client ? 3 : 6, fontSize: 12, color: MUTED, fontWeight: 700 }}>
              {t('export.reference')}: <span className="nums" style={{ color: NAVY, fontWeight: 800 }}>{reference}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ direction: dir, marginTop: 13, background: NAVY, borderRadius: 13, padding: '13px 22px', textAlign: 'center', boxShadow: `inset 0 -3px 0 ${GOLD}` }}>
        <h1 style={{ margin: 0, fontSize: bandTitleSize(bandTitle), fontWeight: 800, color: '#ffffff', lineHeight: 1.22, wordBreak: 'break-word' }}>
          {bandTitle}
        </h1>
        {resolvedSubtitle && (
          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: GOLD_TEXT }}>{resolvedSubtitle}</div>
        )}
      </div>
    </div>
  )
}

/** Slim running header carried on pages 2+. */
export function OfferRunningHeader({ analysis }: { analysis: OfferAnalysis }) {
  const { dir, t, resolvedTitle } = analysis
  return (
    <div style={{ padding: `14px ${PAD_X}px 8px` }}>
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
        <ExportLogo height={34} />
        <div style={{ direction: dir, maxWidth: 620, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, fontWeight: 700, color: SUB }}>
          {t('export.heading')}{resolvedTitle ? ` · ${resolvedTitle}` : ''}
        </div>
      </div>
      <div style={{ height: 2, background: GOLD, borderRadius: 999, marginTop: 9 }} />
    </div>
  )
}

/** Slim page footer (brand + page number) pinned to the bottom of every page. */
export function PageFooter({ analysis, page }: { analysis: OfferAnalysis; page: { n: number; total: number } }) {
  const { t } = analysis
  return (
    <div style={{ padding: `8px ${PAD_X}px 13px` }}>
      <div style={{ height: 1.5, background: BORDER, borderRadius: 999 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 7 }}>
        <div style={{ direction: 'ltr', fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: 0.4 }}>ELBAKRI OVERSEAS FOR TRAVEL</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: MUTED }}>
          {t('export.page')} <span className="nums">{page.n}/{page.total}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Hotel section — numbered name row + the compact price grid.         *
 *  Package exports: name + table only. Hotel/quote exports may add a   *
 *  single compact details area under the table.                        *
 * ------------------------------------------------------------------ */

function headCell(D: DensityTokens): CSSProperties {
  return {
    padding: `${D.headPy}px 10px`,
    fontSize: D.headFs,
    fontWeight: 700,
    color: '#ffffff',
    background: NAVY,
    // Gold seam under the header row — table hierarchy without extra chrome.
    boxShadow: `inset 0 -2px 0 ${GOLD}`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
  }
}

function HotelSection({
  group,
  index,
  numbered,
  showHeader,
  showDetails,
  showPackageChip,
  mixedCurrency,
  density,
  lang,
  t,
  info,
}: {
  group: HotelGroup
  index: number
  numbered: boolean
  showHeader: boolean
  showDetails: boolean
  showPackageChip: boolean
  mixedCurrency: boolean
  density: Density
  lang: Lang
  t: T
  info?: HotelInfo
}) {
  const D = DENSITIES[density]
  const allPeriods = t('export.allPeriods')

  // Column set = union of room types across the hotel's periods, sensibly ordered.
  const rooms = Array.from(new Set(group.periods.flatMap((p) => p.rates.map((r) => r.room_type)))).sort(
    (a, b) => roomRank(a) - roomRank(b),
  )

  // When every period shares one meal plan it moves up next to the hotel name
  // as a chip and the meal column disappears — shorter rows, wider prices.
  const meals = Array.from(new Set(group.periods.map((p) => p.meal)))
  const sharedMeal = meals.length === 1 ? meals[0] : null
  const showMealCol = !sharedMeal

  const mealChip = sharedMeal ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: GOLD_TINT, border: `1px solid ${GOLD}`, borderRadius: 999, padding: `${D.chipPy}px 10px`, fontSize: D.chipFs, fontWeight: 700, color: NAVY, flexShrink: 0, whiteSpace: 'nowrap' }}>
      <Utensils style={{ width: D.chipFs + 1, height: D.chipFs + 1, color: GOLD_DARK, flexShrink: 0 }} />
      {mealLabel(sharedMeal, lang)}
    </span>
  ) : null

  /* ---- compact details area (hotel/quote exports only) ---- */
  const foot: ReactNode[] = []
  if (mixedCurrency) {
    // Mixed currencies across the offer: the hotel row must say which currency
    // applies (shown even in package exports — ambiguity is worse than the
    // price-only rule).
    const currencies = Array.from(new Set(group.periods.flatMap((p) => p.rates.map((r) => r.currency))))
    const bases = Array.from(new Set(group.periods.map((p) => p.basis)))
    const perLabel = bases.length === 1 ? t(isPerRoom(bases[0]) ? 'export.perRoom' : 'export.perPerson') : null
    foot.push(
      <FootLine key="cur" icon={<Info style={fnIcon} />}>
        <strong style={{ color: INK, fontWeight: 700 }} className="nums">{currencies.join(' / ')}</strong>
        {perLabel ? <> · {perLabel}</> : null}
      </FootLine>,
    )
  }
  if (showDetails) {
    const anyPeriodChild = group.periods.some((p) => p.childPolicy)
    const sharedChild = group.sharedChildPolicy ?? (!anyPeriodChild ? info?.childPolicyDefault ?? null : null)
    const transfers = Array.from(
      new Set(
        group.periods
          .filter((p) => p.transfer)
          .map((p) => t(`transfer.${p.transfer}`) + (p.transferDetails ? ` · ${p.transferDetails}` : '')),
      ),
    )
    transfers.forEach((tr, i) =>
      foot.push(
        <FootLine key={`tr-${i}`} icon={<Bus style={fnIcon} />}>
          {t('export.transfers')}: <strong style={{ color: INK, fontWeight: 700 }}>{tr}</strong>
        </FootLine>,
      ),
    )
    if (info?.transferNotesDefault) {
      foot.push(
        <FootLine key="hotel-transfer" icon={<Bus style={fnIcon} />}>
          <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.transfers')}:</strong> {info.transferNotesDefault}
        </FootLine>,
      )
    }
    if (sharedChild) {
      foot.push(
        <FootLine key="child" icon={<Baby style={fnIcon} />}>
          <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.children')}:</strong> {sharedChild}
        </FootLine>,
      )
    }
    group.periods
      .filter((p) => p.childPolicy)
      .forEach((p) =>
        foot.push(
          <FootLine key={`c-${p.key}`} icon={<Baby style={fnIcon} />}>
            <span className="nums" style={{ fontWeight: 700, color: SUB }}>{compactRange(p.from, p.to, allPeriods)}</span>
            {' — '}
            {p.childPolicy}
          </FootLine>,
        ),
      )
    if (info?.description) foot.push(<FootLine key="desc" icon={<Info style={fnIcon} />}>{info.description}</FootLine>)
    if (info?.facilities) {
      foot.push(
        <FootLine key="fac" icon={<Sparkles style={fnIcon} />}>
          <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.facilities')}:</strong> {info.facilities}
        </FootLine>,
      )
    }
  }

  const gridCols = `minmax(0, 1.55fr)${showMealCol ? ' minmax(0, 1fr)' : ''} ${rooms
    .map(() => 'minmax(0, 1fr)')
    .join(' ')}`

  const cell = (bg: string, bt: string | undefined): CSSProperties => ({
    padding: `${D.cellPy}px 10px`,
    background: bg,
    borderTop: bt,
    display: 'flex',
    alignItems: 'center',
  })

  return (
    <section>
      {showHeader ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: D.secMb, flexWrap: 'wrap' }}>
          {numbered && (
            <span className="nums" style={{ display: 'inline-grid', placeItems: 'center', width: D.badge, height: D.badge, borderRadius: D.badgeR, background: NAVY, color: GOLD_TEXT, fontSize: D.badgeFs, fontWeight: 800, flexShrink: 0 }}>
              {index}
            </span>
          )}
          <h2 style={{ margin: 0, fontSize: hotelNameSize(group.name, D), fontWeight: 800, color: NAVY, lineHeight: 1.18, wordBreak: 'break-word' }}>
            {group.name}
          </h2>
          {mealChip}
          {showPackageChip && group.packageName && (
            <span style={{ fontSize: D.chipFs, fontWeight: 700, color: SUB, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999, padding: `${D.chipPy}px 10px`, flexShrink: 0 }}>
              {group.packageName}
            </span>
          )}
          {showDetails && (group.region || group.subRegion) && (
            <span style={{ fontSize: D.chipFs + 0.5, fontWeight: 600, color: MUTED }}>
              {[group.region, group.subRegion].filter(Boolean).join(' · ')}
            </span>
          )}
          {/* thin brochure rule filling the rest of the name row */}
          <span style={{ flex: '1 1 28px', minWidth: 28, height: 2, borderRadius: 999, background: GOLD, opacity: 0.35 }} />
        </div>
      ) : mealChip ? (
        <div style={{ display: 'flex', marginBottom: D.secMb }}>{mealChip}</div>
      ) : null}

      {/* CSS grid (not <table>) so header + body always share identical column
          tracks — a fixed-layout <table> lets thead/tbody widths diverge. */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: D.radius, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
          <div style={{ ...headCell(D), justifyContent: 'flex-start' }}>{t('export.period')}</div>
          {showMealCol && <div style={{ ...headCell(D), justifyContent: 'flex-start' }}>{t('export.meal')}</div>}
          {rooms.map((rt) => (
            <div key={rt} style={{ ...headCell(D), justifyContent: 'center' }}>{roomLabel(rt, lang)}</div>
          ))}
          {group.periods.map((p, idx) => {
            const byRoom = new Map(p.rates.map((r) => [r.room_type, r]))
            const dateText = compactRange(p.from, p.to, allPeriods)
            const bg = idx % 2 ? '#ffffff' : SURFACE
            const bt = idx === 0 ? undefined : `1px solid ${BORDER}`
            return (
              <Fragment key={p.key}>
                <div className="nums" style={{ ...cell(bg, bt), fontSize: D.dateFs, fontWeight: 700, color: SUB, whiteSpace: 'nowrap' }}>
                  {dateText}
                </div>
                {showMealCol && (
                  <div style={{ ...cell(bg, bt), fontSize: D.mealFs, fontWeight: 700, color: INK }}>
                    {mealLabel(p.meal, lang)}
                  </div>
                )}
                {rooms.map((rt) => {
                  const r = byRoom.get(rt)
                  return (
                    <div key={rt} className="nums" style={{ ...cell(bg, bt), padding: `${D.cellPy}px 8px`, justifyContent: 'center', fontSize: D.priceFs, fontWeight: 800, color: r ? NAVY : FAINT }}>
                      {r ? priceNumber(r.adult_price) : '—'}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>

      {foot.length > 0 && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3, fontSize: D.footFs, lineHeight: 1.5, color: MUTED }}>
          {foot}
        </div>
      )}
    </section>
  )
}

const fnIcon: CSSProperties = { width: 13, height: 13, color: SUB, flexShrink: 0, marginTop: 2 }
function FootLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      {icon}
      <span>{children}</span>
    </div>
  )
}

function TermsBlock({ analysis }: { analysis: OfferAnalysis }) {
  const { t, phone, today, pricesLine } = analysis
  return (
    <div style={{ background: NAVY, color: '#ffffff', borderRadius: 12, padding: '12px 18px', boxShadow: `inset 0 -3px 0 ${GOLD}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, lineHeight: 1.7, color: '#AEBFDD' }}>
          {pricesLine && <div style={{ color: GOLD_TEXT, fontWeight: 700 }}>• {pricesLine}</div>}
          <div>• {t('export.term1')}</div>
          <div>• {t('export.term2')}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          {phone ? (
            <div className="nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 17, fontWeight: 800, color: GOLD }}>
              <Phone style={{ width: 16, height: 16 }} />
              {phone}
            </div>
          ) : null}
          <div style={{ fontSize: 10.5, color: '#7E96C6', marginTop: phone ? 3 : 0 }}>
            {t('export.issued')}: <span className="nums">{today}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Off-screen render trees consumed by the exporter.                   *
 * ------------------------------------------------------------------ */

const pageStyle: CSSProperties = {
  width: PAGE_W,
  height: PAGE_H,
  background: '#ffffff',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Cairo, sans-serif',
  color: INK,
}

function blocksColStyle(gap: number): CSSProperties {
  return {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap,
    padding: `2px ${PAD_X}px 0`,
  }
}

/** Hidden tree rendered once to measure chrome + block heights before paging. */
export function MeasureTree({ analysis, blocks }: { analysis: OfferAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, fontFamily: 'Cairo, sans-serif', color: INK }}>
      <div data-m="fh"><OfferHeaderFull analysis={analysis} /></div>
      <div data-m="rh"><OfferRunningHeader analysis={analysis} /></div>
      <div data-m="ft"><PageFooter analysis={analysis} page={{ n: 1, total: 9 }} /></div>
      <div style={blocksColStyle(analysis.blockGap)}>
        {blocks.map((b, i) => (
          <div data-b={i} key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

/** Single continuous document (no page splitting) — used by the PNG export
 *  when the whole offer fits a safe poster height. */
export function SingleDocTree({ analysis, blocks }: { analysis: OfferAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: INK }}>
      <OfferHeaderFull analysis={analysis} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: analysis.blockGap, padding: `4px ${PAD_X}px 28px` }}>
        {blocks.map((b) => (
          <div key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

/** The final paginated tree — one fixed-size page per entry. */
export function PagesTree({ analysis, pages }: { analysis: OfferAnalysis; pages: FlowBlock[][] }) {
  const total = pages.length
  return (
    <div>
      {pages.map((pageBlocks, idx) => (
        <div data-page={idx} key={idx} dir={analysis.dir} style={pageStyle}>
          {idx === 0 ? <OfferHeaderFull analysis={analysis} /> : <OfferRunningHeader analysis={analysis} />}
          <div style={blocksColStyle(analysis.blockGap)}>
            {pageBlocks.map((b) => (
              <div key={b.key}>{b.node}</div>
            ))}
          </div>
          <PageFooter analysis={analysis} page={{ n: idx + 1, total }} />
        </div>
      ))}
    </div>
  )
}
