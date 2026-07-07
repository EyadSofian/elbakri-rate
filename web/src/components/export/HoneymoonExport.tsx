import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Check, Heart, Phone, Sparkles, Utensils } from 'lucide-react'
import { priceNumber, formatDate } from '@/lib/utils'
import { translate, type Lang } from '@/lib/i18n'
import { mealLabel, roomLabel } from '@/lib/labels'
import { describeOffer, type HotelGroup } from '@/lib/grouping'
import { PAGE_W, PAGE_H, type FlowBlock, type OfferExportData } from './ClientOfferExport'
import { ExportLogo } from './ExportLogo'
import type { Rate } from '@/types'

/**
 * Premium honeymoon-offer brochure export.
 *
 * A honeymoon package (package_type = "Honeymoon") is a single-subject offer:
 * one hotel (or a small package of hotels) sold to a couple. It reads badly in
 * the generic multi-hotel room-price grid, so this builds a dedicated brochure:
 *   • navy/gold ELBAKRI identity with a subtle romantic accent (no clutter)
 *   • a compact Period / Price type / Price / Notes table (CSS grid so AR & EN
 *     columns align exactly, empty Notes column dropped rather than dashed)
 *   • a "Features & Details" chip list (one/two columns by count)
 *
 * It mirrors ClientOfferExport's flow-block contract (build → analysis + blocks,
 * plus Measure/Single/Pages trees carrying `data-m`/`data-b`/`data-page`
 * anchors) so it reuses the same measure → paginate → capture engine unchanged.
 */

/* ------------------------------------------------------------------ *
 *  Palette — shared ELBAKRI navy/gold, with a warm brochure surface.   *
 * ------------------------------------------------------------------ */
const PAD_X = 44
const NAVY = '#07184A'
const INK = '#0E1A33'
const GOLD = '#C8A24A'
const GOLD_DARK = '#A8853B'
const GOLD_TEXT = '#E5CE93' // gold that stays readable on navy
const ROW_ALT = '#FBF8F0' // warm zebra tint (vs. the offer's cool grey)
const SURFACE = '#F8F5EC'
const BORDER = '#E7DFC9'
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

function clean(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

/* ------------------------------------------------------------------ *
 *  Density — comfort ≤4 price rows, compact 5–9, dense 10+.            *
 * ------------------------------------------------------------------ */
export type Density = 'comfort' | 'compact' | 'dense'

interface DTok {
  blockGap: number
  secMb: number
  headPy: number
  headFs: number
  rowPy: number
  periodFs: number
  typeFs: number
  priceFs: number
  curFs: number
  noteFs: number
  nameFs: number
  badge: number
  badgeFs: number
  badgeR: number
  chipFs: number
  chipPy: number
  featFs: number
  radius: number
}

const DENS: Record<Density, DTok> = {
  comfort: { blockGap: 18, secMb: 9, headPy: 9, headFs: 12.5, rowPy: 9, periodFs: 13, typeFs: 12.5, priceFs: 18, curFs: 11, noteFs: 11.5, nameFs: 21, badge: 30, badgeFs: 14, badgeR: 9, chipFs: 12, chipPy: 4, featFs: 12.5, radius: 13 },
  compact: { blockGap: 13, secMb: 7, headPy: 7, headFs: 11.5, rowPy: 6.5, periodFs: 12, typeFs: 11.5, priceFs: 15.5, curFs: 10, noteFs: 11, nameFs: 18.5, badge: 26, badgeFs: 13, badgeR: 8, chipFs: 11.5, chipPy: 3, featFs: 11.5, radius: 11 },
  dense: { blockGap: 10, secMb: 5, headPy: 5, headFs: 10.5, rowPy: 4.5, periodFs: 11, typeFs: 10.5, priceFs: 13.5, curFs: 9.5, noteFs: 10.5, nameFs: 16.5, badge: 22, badgeFs: 12, badgeR: 7, chipFs: 10.5, chipPy: 2.5, featFs: 11, radius: 9 },
}

function pickDensity(rows: number): Density {
  if (rows >= 10) return 'dense'
  if (rows >= 5) return 'compact'
  return 'comfort'
}

function heroTitleSize(title: string): number {
  const n = title.length
  if (n > 50) return 22
  if (n > 34) return 26
  if (n > 22) return 30
  return 34
}

function sectionNameSize(name: string, D: DTok): number {
  if (name.length > 40) return D.nameFs - 4
  if (name.length > 28) return D.nameFs - 2
  return D.nameFs
}

/** "01/07 – 31/08/2026" — drops the redundant start-year when both dates share
 *  it so period cells stay short. Digits render LTR via `.nums`. */
const DMY = /^\d{2}\/\d{2}\/\d{4}$/
function compactRange(from: string | null, to: string | null, allLabel: string): string {
  if (!from && !to) return allLabel
  const f = formatDate(from)
  const t = formatDate(to)
  const sameYear = !!from && !!to && from.slice(0, 4) === to.slice(0, 4) && DMY.test(f) && DMY.test(t)
  return `${sameYear ? f.slice(0, 5) : f} – ${t}`
}

/** Split the package description into feature chips (newline / comma / Arabic
 *  comma / bullet), trimming blanks so empty descriptions render nothing. */
function splitFeatures(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\n\r،؛;,•·|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ------------------------------------------------------------------ *
 *  Analysis + flow-block builder.                                      *
 * ------------------------------------------------------------------ */
export interface HoneymoonAnalysis {
  lang: Lang
  dir: Dir
  t: T
  density: Density
  /** Gap between flow blocks — the paginator must use the same value. */
  blockGap: number
  hotelCount: number
  resolvedTitle: string
  resolvedSubtitle: string | null
  /** When the offer is one standalone hotel, the hero already names it, so the
   *  hotel sections don't repeat the name. */
  headlineIsHotel: boolean
  today: string
  phone: string
  client: string | null
  /** "All prices in EGP · per person" line for the terms footer (null when
   *  currencies/bases are mixed). */
  pricesLine: string | null
}

export function buildHoneymoon(data: OfferExportData): { analysis: HoneymoonAnalysis; blocks: FlowBlock[] } {
  const { items } = data
  const lang: Lang = data.lang ?? 'ar'
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t: T = (k, vars) => translate(lang, k, vars)

  const shape = describeOffer(items)
  const groups = shape.groups
  const hotelCount = groups.length
  const isPackageOffer = shape.isPackageOffer
  const singleHotel = shape.singleHotel

  const totalRows = groups.reduce((n, g) => n + g.periods.reduce((m, p) => m + p.rates.length, 0), 0)
  const density = pickDensity(totalRows)

  const resolvedTitle =
    clean(data.title) ||
    (isPackageOffer ? clean(shape.packageName) : null) ||
    (singleHotel ? clean(singleHotel.name) : null) ||
    t('honeymoon.badge')

  const subtitleBase =
    data.subtitle ??
    (singleHotel ? [singleHotel.region, singleHotel.subRegion].filter(Boolean).join(' · ') || null : null)
  const countLabel = isPackageOffer && hotelCount >= 3 ? t('export.hotelsCount', { n: hotelCount }) : null
  const resolvedSubtitle = [subtitleBase, countLabel].filter(Boolean).join(' · ') || null

  // One offer-wide currency/basis statement (goes in the terms footer).
  const currencies = Array.from(new Set(items.map((r) => r.currency)))
  const bases = Array.from(new Set(items.map((r) => r.pricing_basis)))
  const curLabel = currencies.length === 1 ? t(`currency.${currencies[0]}`) : null
  const perLabel = bases.length === 1 ? t(isPerRoom(bases[0]) ? 'export.basisPerRoom' : 'export.basisPerPerson') : null
  const pricesLine = curLabel
    ? `${t('export.allPricesIn', { cur: curLabel })}${perLabel ? ` · ${perLabel}` : ''}`
    : perLabel

  const analysis: HoneymoonAnalysis = {
    lang,
    dir,
    t,
    density,
    blockGap: DENS[density].blockGap,
    hotelCount,
    resolvedTitle,
    resolvedSubtitle,
    headlineIsHotel: !!singleHotel,
    today: formatDate(new Date().toISOString()),
    phone: data.phone?.trim() || COMPANY_PHONE,
    client: clean(data.client),
    pricesLine,
  }

  const blocks: FlowBlock[] = []
  groups.forEach((g, i) => {
    blocks.push({
      key: `hotel-${g.hotelId ?? g.name}-${i}`,
      keepWithNext: false,
      node: (
        <HotelBlock
          group={g}
          index={i + 1}
          showName={!analysis.headlineIsHotel}
          numbered={hotelCount > 1}
          density={density}
          lang={lang}
          t={t}
        />
      ),
    })
  })

  const feats = splitFeatures(data.features)
  if (feats.length) {
    blocks.push({ key: 'features', keepWithNext: false, node: <FeaturesBlock items={feats} density={density} t={t} /> })
  }

  blocks.push({ key: 'terms', keepWithNext: false, node: <TermsBlock analysis={analysis} /> })

  return { analysis, blocks }
}

/* ------------------------------------------------------------------ *
 *  Row model — flatten a hotel's periods × rooms into table rows.      *
 * ------------------------------------------------------------------ */
interface Row {
  key: string
  period: string
  showPeriod: boolean
  type: string
  price: string
  cur: string
  note: string | null
}

/** Prefer a short booking note, else the transfer detail — kept concise so the
 *  Notes column never stretches a row. Long child policies stay out of it. */
function pickNote(r: Rate): string | null {
  return clean(r.booking_notes) || clean(r.transfer_details)
}

function hotelRows(g: HotelGroup, sharedMeal: boolean, allLabel: string, lang: Lang): { rows: Row[]; hasNotes: boolean } {
  const rows: Row[] = []
  let hasNotes = false
  for (const p of g.periods) {
    const sorted = [...p.rates].sort((a, b) => roomRank(a.room_type) - roomRank(b.room_type))
    const periodText = compactRange(p.from, p.to, allLabel)
    sorted.forEach((r, idx) => {
      const type = sharedMeal ? roomLabel(r.room_type, lang) : `${roomLabel(r.room_type, lang)} · ${mealLabel(r.meal_plan, lang)}`
      const note = pickNote(r)
      if (note) hasNotes = true
      rows.push({ key: `${p.key}-${r.id}`, period: periodText, showPeriod: idx === 0, type, price: priceNumber(r.adult_price), cur: r.currency, note })
    })
  }
  return { rows, hasNotes }
}

/* ------------------------------------------------------------------ *
 *  Hotel section — optional name/meal row + the Period/Type/Price/Note *
 *  table (CSS grid, not <table>, so header + body share column tracks).*
 * ------------------------------------------------------------------ */
function headCell(D: DTok, justify: 'flex-start' | 'center'): CSSProperties {
  return {
    padding: `${D.headPy}px 11px`,
    fontSize: D.headFs,
    fontWeight: 700,
    color: '#ffffff',
    background: NAVY,
    boxShadow: `inset 0 -2px 0 ${GOLD}`, // gold seam under the header row
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
  }
}

function MealChip({ meal, D, lang }: { meal: Rate['meal_plan']; D: DTok; lang: Lang }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: SURFACE, border: `1px solid ${GOLD}`, borderRadius: 999, padding: `${D.chipPy}px 10px`, fontSize: D.chipFs, fontWeight: 700, color: NAVY, flexShrink: 0, whiteSpace: 'nowrap' }}>
      <Utensils style={{ width: D.chipFs + 1, height: D.chipFs + 1, color: GOLD_DARK, flexShrink: 0 }} />
      {mealLabel(meal, lang)}
    </span>
  )
}

function HotelBlock({
  group,
  index,
  showName,
  numbered,
  density,
  lang,
  t,
}: {
  group: HotelGroup
  index: number
  showName: boolean
  numbered: boolean
  density: Density
  lang: Lang
  t: T
}) {
  const D = DENS[density]
  const meals = Array.from(new Set(group.periods.map((p) => p.meal)))
  const sharedMeal = meals.length === 1 ? meals[0] : null
  const { rows, hasNotes } = hotelRows(group, !!sharedMeal, t('export.allPeriods'), lang)

  const cols = hasNotes
    ? 'minmax(0, 1.4fr) minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1.75fr)'
    : 'minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1fr)'

  const cell = (bg: string, bt: string | undefined): CSSProperties => ({
    padding: `${D.rowPy}px 11px`,
    background: bg,
    borderTop: bt,
    display: 'flex',
    alignItems: 'center',
  })

  return (
    <section>
      {showName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: D.secMb, flexWrap: 'wrap' }}>
          {numbered && (
            <span className="nums" style={{ display: 'inline-grid', placeItems: 'center', width: D.badge, height: D.badge, borderRadius: D.badgeR, background: NAVY, color: GOLD_TEXT, fontSize: D.badgeFs, fontWeight: 800, flexShrink: 0 }}>
              {index}
            </span>
          )}
          <h2 style={{ margin: 0, fontSize: sectionNameSize(group.name, D), fontWeight: 800, color: NAVY, lineHeight: 1.18, wordBreak: 'break-word' }}>
            {group.name}
          </h2>
          {sharedMeal && <MealChip meal={sharedMeal} D={D} lang={lang} />}
          {(group.region || group.subRegion) && (
            <span style={{ fontSize: D.chipFs + 0.5, fontWeight: 600, color: MUTED }}>
              {[group.region, group.subRegion].filter(Boolean).join(' · ')}
            </span>
          )}
          <span style={{ flex: '1 1 28px', minWidth: 28, height: 2, borderRadius: 999, background: GOLD, opacity: 0.35 }} />
        </div>
      ) : sharedMeal ? (
        <div style={{ display: 'flex', marginBottom: D.secMb }}>
          <MealChip meal={sharedMeal} D={D} lang={lang} />
        </div>
      ) : null}

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: D.radius, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols }}>
          <div style={headCell(D, 'flex-start')}>{t('export.period')}</div>
          <div style={headCell(D, 'flex-start')}>{t('honeymoon.priceType')}</div>
          <div style={headCell(D, 'center')}>{t('honeymoon.price')}</div>
          {hasNotes && <div style={headCell(D, 'flex-start')}>{t('honeymoon.notes')}</div>}

          {rows.map((row, i) => {
            const bg = i % 2 ? ROW_ALT : '#ffffff'
            const bt = i === 0 ? undefined : `1px solid ${BORDER}`
            return (
              <Fragment key={row.key}>
                <div className="nums" style={{ ...cell(bg, bt), fontSize: D.periodFs, fontWeight: 700, color: SUB, whiteSpace: 'nowrap' }}>
                  {row.showPeriod ? row.period : ''}
                </div>
                <div style={{ ...cell(bg, bt), fontSize: D.typeFs, fontWeight: 700, color: INK }}>{row.type}</div>
                <div className="nums" style={{ ...cell(bg, bt), justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: D.priceFs, fontWeight: 800, color: row.price === '—' ? FAINT : NAVY }}>{row.price}</span>
                  {row.price !== '—' && <span style={{ fontSize: D.curFs, fontWeight: 700, color: GOLD_DARK }}>{row.cur}</span>}
                </div>
                {hasNotes && (
                  <div style={{ ...cell(bg, bt), fontSize: D.noteFs, fontWeight: 500, color: MUTED, lineHeight: 1.4 }}>
                    {row.note ?? ''}
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 *  Features — chip list, one column ≤4 items, two columns beyond.      *
 * ------------------------------------------------------------------ */
function FeaturesBlock({ items, density, t }: { items: string[]; density: Density; t: T }) {
  const D = DENS[density]
  const twoCol = items.length > 4
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: D.radius, background: SURFACE, padding: '13px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Sparkles style={{ width: 16, height: 16, color: GOLD_DARK, flexShrink: 0 }} />
        <span style={{ fontSize: D.featFs + 1.5, fontWeight: 800, color: NAVY }}>{t('honeymoon.features')}</span>
        <span style={{ flex: 1, height: 2, borderRadius: 999, background: GOLD, opacity: 0.3 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr', columnGap: 22, rowGap: 6 }}>
        {items.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: D.featFs, color: INK, lineHeight: 1.45 }}>
            <Check style={{ width: 14, height: 14, color: GOLD_DARK, marginTop: 2, flexShrink: 0 }} />
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Terms — navy footer band with phone + terms line.                   *
 * ------------------------------------------------------------------ */
function TermsBlock({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { t, phone, today, pricesLine } = analysis
  return (
    <div style={{ background: NAVY, color: '#ffffff', borderRadius: 12, padding: '13px 18px', boxShadow: `inset 0 -3px 0 ${GOLD}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, lineHeight: 1.7, color: '#AEBFDD' }}>
          {pricesLine && <div style={{ color: GOLD_TEXT, fontWeight: 700 }}>• {pricesLine}</div>}
          <div>• {t('export.term1')}</div>
          <div>• {t('export.term2')}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className="nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 17, fontWeight: 800, color: GOLD }}>
            <Phone style={{ width: 16, height: 16 }} />
            {phone}
          </div>
          <div style={{ fontSize: 10.5, color: '#7E96C6', marginTop: 3 }}>
            {t('export.issued')}: <span className="nums">{today}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Page chrome — brand row (logo locked LEFT), romantic hero band,     *
 *  slim running header + footer.                                       *
 * ------------------------------------------------------------------ */
export function HoneymoonHeaderFull({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { dir, t, resolvedTitle, resolvedSubtitle, client, today } = analysis
  return (
    <div style={{ padding: `20px ${PAD_X}px 10px` }}>
      {/* Direction-locked LTR so the logo sits physically LEFT for Arabic too. */}
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <ExportLogo height={54} />
        <div style={{ direction: dir, textAlign: 'end' }}>
          <span style={{ display: 'inline-block', border: `1.5px solid ${GOLD}`, color: NAVY, background: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: dir === 'rtl' ? 0 : 1, padding: '4px 14px', borderRadius: 999, textTransform: dir === 'rtl' ? 'none' : 'uppercase', whiteSpace: 'nowrap' }}>
            {t('honeymoon.badge')}
          </span>
          <div style={{ marginTop: 6, fontSize: 12, color: MUTED, fontWeight: 600 }}>
            {client ? (
              <>
                {t('export.presentedTo')}: <span style={{ color: NAVY, fontWeight: 800 }}>{client}</span>
              </>
            ) : (
              <>
                {t('export.issued')}: <span className="nums">{today}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero band — subtle heart motif, romantic eyebrow, responsive title. */}
      <div style={{ direction: dir, position: 'relative', overflow: 'hidden', marginTop: 13, background: NAVY, borderRadius: 16, padding: '18px 24px', textAlign: 'center', boxShadow: `inset 0 -3px 0 ${GOLD}` }}>
        <Heart style={{ position: 'absolute', insetInlineEnd: -14, top: -14, width: 96, height: 96, color: GOLD, opacity: 0.08 }} />
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <span style={{ width: 30, height: 2, borderRadius: 999, background: GOLD, opacity: 0.6 }} />
          <Heart style={{ width: 15, height: 15, color: GOLD_TEXT }} />
          <span style={{ width: 30, height: 2, borderRadius: 999, background: GOLD, opacity: 0.6 }} />
        </div>
        <h1 style={{ position: 'relative', margin: 0, fontSize: heroTitleSize(resolvedTitle), fontWeight: 800, color: '#ffffff', lineHeight: 1.2, wordBreak: 'break-word' }}>
          {resolvedTitle}
        </h1>
        {resolvedSubtitle && (
          <div style={{ position: 'relative', marginTop: 4, fontSize: 13.5, fontWeight: 700, color: GOLD_TEXT }}>{resolvedSubtitle}</div>
        )}
      </div>
    </div>
  )
}

export function HoneymoonRunningHeader({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { dir, t, resolvedTitle } = analysis
  return (
    <div style={{ padding: `14px ${PAD_X}px 8px` }}>
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
        <ExportLogo height={34} />
        <div style={{ direction: dir, maxWidth: 620, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, fontWeight: 700, color: SUB }}>
          {t('honeymoon.badge')} · {resolvedTitle}
        </div>
      </div>
      <div style={{ height: 2, background: GOLD, borderRadius: 999, marginTop: 9 }} />
    </div>
  )
}

export function PageFooter({ analysis, page }: { analysis: HoneymoonAnalysis; page: { n: number; total: number } }) {
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
 *  Off-screen render trees — same measurement contract as the offer    *
 *  exporter (data-m / data-b / data-page anchors), consumed unchanged  *
 *  by the shared exporter engine.                                      *
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
  return { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap, padding: `2px ${PAD_X}px 0` }
}

export function HoneymoonMeasureTree({ analysis, blocks }: { analysis: HoneymoonAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, fontFamily: 'Cairo, sans-serif', color: INK }}>
      <div data-m="fh"><HoneymoonHeaderFull analysis={analysis} /></div>
      <div data-m="rh"><HoneymoonRunningHeader analysis={analysis} /></div>
      <div data-m="ft"><PageFooter analysis={analysis} page={{ n: 1, total: 9 }} /></div>
      <div style={blocksColStyle(analysis.blockGap)}>
        {blocks.map((b, i) => (
          <div data-b={i} key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

export function HoneymoonSingleTree({ analysis, blocks }: { analysis: HoneymoonAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: INK }}>
      <HoneymoonHeaderFull analysis={analysis} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: analysis.blockGap, padding: `4px ${PAD_X}px 28px` }}>
        {blocks.map((b) => (
          <div key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

export function HoneymoonPagesTree({ analysis, pages }: { analysis: HoneymoonAnalysis; pages: FlowBlock[][] }) {
  const total = pages.length
  return (
    <div>
      {pages.map((pageBlocks, idx) => (
        <div data-page={idx} key={idx} dir={analysis.dir} style={pageStyle}>
          {idx === 0 ? <HoneymoonHeaderFull analysis={analysis} /> : <HoneymoonRunningHeader analysis={analysis} />}
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
