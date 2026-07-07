import { Fragment, type CSSProperties } from 'react'
import {
  ArrowUpCircle,
  BedDouble,
  Bus,
  Cake,
  Clock,
  Coffee,
  Crown,
  DoorOpen,
  Dumbbell,
  Flower2,
  Gift,
  Headphones,
  Heart,
  Percent,
  Phone,
  Plane,
  Sparkles,
  UtensilsCrossed,
  Waves,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import { priceNumber, formatDate } from '@/lib/utils'
import { translate, type Lang } from '@/lib/i18n'
import { mealLabel, roomLabel } from '@/lib/labels'
import { describeOffer, type HotelGroup } from '@/lib/grouping'
import { PAGE_W, PAGE_H, type FlowBlock, type OfferExportData } from './ClientOfferExport'
import { ExportLogo } from './ExportLogo'
import type { Rate } from '@/types'

/**
 * Premium honeymoon-offer brochure export — a single-subject travel flyer, not a
 * data table. Photo-less by design (no image in the data model): the hero is a
 * decorative navy/gold "HONEYMOON" band. Below it, a bold price badge (or a neat
 * price table for multi-period offers) and a smart-iconed inclusions list
 * (each perk mapped to a fitting icon by keyword), then a navy transfer footer.
 *
 * Mirrors ClientOfferExport's flow-block contract (build → analysis + blocks,
 * Measure/Single/Pages trees with data-m/data-b/data-page anchors) so it reuses
 * the same measure → paginate → capture engine unchanged.
 */

/* ------------------------------------------------------------------ *
 *  Palette — shared ELBAKRI navy/gold.                                 *
 * ------------------------------------------------------------------ */
const PAD_X = 44
const NAVY = '#07184A'
const INK = '#0E1A33'
const GOLD = '#C8A24A'
const GOLD_DARK = '#A8853B'
const GOLD_TEXT = '#E5CE93' // gold that stays readable on navy
const SURFACE = '#F8F5EC'
const DIVIDER = '#ECE6D6' // warm hairline between inclusion rows
const BORDER = '#E7DFC9'
const MUTED = '#5A6B86'
const SUB = '#33508F'
const FAINT = '#C4CEDE'
const COMPANY_PHONE = '+20 12 25279820'
const WORDMARK = 'HONEYMOON'

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
 *  Smart inclusion icons — first keyword match wins, gold sparkle       *
 *  fallback. Ordered so specific perks beat generic room/lounge words.  *
 * ------------------------------------------------------------------ */
const ICON_RULES: { re: RegExp; Icon: LucideIcon }[] = [
  { re: /مطار|طيران|flight|airport/i, Icon: Plane },
  { re: /انتقال|نقل|باص|ترانسفير|transfer|shuttle|\bbus\b/i, Icon: Bus },
  { re: /%|خصم|discount|off\b/i, Icon: Percent },
  { re: /سبا|تدليك|مساج|spa|massage/i, Icon: Flower2 },
  { re: /عشاء|رومانس|dinner|romantic/i, Icon: UtensilsCrossed },
  { re: /افطار|إفطار|فطار|breakfast/i, Icon: Coffee },
  { re: /تورت|كيك|cake/i, Icon: Cake },
  { re: /فواك|فاكه|سلة|هدية|هديه|fruit|basket|gift/i, Icon: Gift },
  { re: /نبيذ|wine|ميني ?بار|مينى ?بار|minibar|مشروب|عصائر|عصير|\bبار\b|drinks/i, Icon: Wine },
  { re: /vip|كبار الشخصيات/i, Icon: Crown },
  { re: /متأخر|مبكر|خروج|تسجيل|check ?-?out|check ?-?in|late|early/i, Icon: Clock },
  { re: /ديكور|زين|ورود|ورد|بالون|شهر العسل|honeymoon|decor|rose/i, Icon: Heart },
  { re: /ترقي|upgrade/i, Icon: ArrowUpCircle },
  { re: /مسبح|ساونا|جاكوز|سكاي|pool|sauna|jacuzzi/i, Icon: Waves },
  { re: /جيم|رياض|gym|fitness/i, Icon: Dumbbell },
  { re: /سويت|جناح|غرف|سي ?فيو|room|suite|view/i, Icon: BedDouble },
  { re: /صالة|لاونج|دخول|lounge|access/i, Icon: DoorOpen },
  { re: /هاتف|مساعد|phone|assist|concierge/i, Icon: Headphones },
]
function featureIcon(text: string): LucideIcon {
  for (const r of ICON_RULES) if (r.re.test(text)) return r.Icon
  return Sparkles
}

/* ------------------------------------------------------------------ *
 *  Density — comfort ≤10 perks, compact ≤18, dense beyond / multi.     *
 * ------------------------------------------------------------------ */
export type Density = 'comfort' | 'compact' | 'dense'

interface DTok {
  blockGap: number
  secMb: number
  radius: number
  wordmarkFs: number
  pillFs: number
  heroPy: number
  capFs: number
  badgePeriodFs: number
  badgePriceFs: number
  badgePy: number
  featRowPy: number
  featFs: number
  featIcon: number
  featIconSize: number
  headFs: number
  cellFs: number
  tPriceFs: number
  rowPy: number
  footFs: number
  nameFs: number
}

const DENS: Record<Density, DTok> = {
  comfort: { blockGap: 16, secMb: 10, radius: 14, wordmarkFs: 30, pillFs: 13, heroPy: 22, capFs: 12.5, badgePeriodFs: 14, badgePriceFs: 40, badgePy: 15, featRowPy: 8.5, featFs: 13.5, featIcon: 34, featIconSize: 17, headFs: 12.5, cellFs: 12.5, tPriceFs: 16.5, rowPy: 7, footFs: 12, nameFs: 30 },
  compact: { blockGap: 12, secMb: 8, radius: 12, wordmarkFs: 26, pillFs: 12, heroPy: 18, capFs: 12, badgePeriodFs: 13, badgePriceFs: 34, badgePy: 12, featRowPy: 6.2, featFs: 12.5, featIcon: 30, featIconSize: 15, headFs: 11.5, cellFs: 11.5, tPriceFs: 15, rowPy: 5.5, footFs: 11.5, nameFs: 26 },
  dense: { blockGap: 9, secMb: 6, radius: 10, wordmarkFs: 22, pillFs: 11, heroPy: 14, capFs: 11, badgePeriodFs: 12, badgePriceFs: 28, badgePy: 10, featRowPy: 4.6, featFs: 11.5, featIcon: 26, featIconSize: 13, headFs: 10.5, cellFs: 10.5, tPriceFs: 13.5, rowPy: 4.5, footFs: 11, nameFs: 22 },
}

function pickDensity(features: number, hotels: number, periodRows: number): Density {
  if (features >= 18 || periodRows >= 12 || hotels >= 4) return 'dense'
  if (features >= 11 || periodRows >= 6 || hotels >= 2) return 'compact'
  return 'comfort'
}

function heroNameSize(name: string): number {
  const n = name.length
  if (n > 42) return 24
  if (n > 30) return 28
  if (n > 20) return 32
  return 36
}
function sectionNameSize(name: string, D: DTok): number {
  if (name.length > 40) return D.nameFs - 5
  if (name.length > 28) return D.nameFs - 3
  return D.nameFs
}

/** "01/06 – 31/10/2026" — drops the redundant start-year when shared. */
const DMY = /^\d{2}\/\d{2}\/\d{4}$/
function compactRange(from: string | null, to: string | null, allLabel: string): string {
  if (!from && !to) return allLabel
  const f = formatDate(from)
  const t = formatDate(to)
  const sameYear = !!from && !!to && from.slice(0, 4) === to.slice(0, 4) && DMY.test(f) && DMY.test(t)
  return `${sameYear ? f.slice(0, 5) : f} – ${t}`
}

/** Split the package description into perks (newline / comma / Arabic comma). */
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
  blockGap: number
  hotelCount: number
  heroName: string
  heroRegion: string | null
  heroCaption: string | null
  today: string
  phone: string
  client: string | null
  transferLine: string | null
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
  const oneHotel = hotelCount === 1

  const feats = splitFeatures(data.features)
  const periodRows = groups.reduce((n, g) => n + g.periods.reduce((m, p) => m + p.rates.length, 0), 0)
  const density = pickDensity(feats.length, hotelCount, periodRows)

  const packageName = clean(shape.packageName) || clean(data.title)
  const heroName = (oneHotel ? clean(groups[0].name) : packageName) || packageName || t('honeymoon.badge')
  const heroRegion = oneHotel
    ? [groups[0].region, groups[0].subRegion].filter(Boolean).join(' · ') || clean(data.subtitle)
    : clean(data.subtitle)

  // Shared meal + duration caption for the hero (only when consistent).
  const meals = Array.from(new Set(items.map((r) => r.meal_plan)))
  const sharedMeal = meals.length === 1 ? meals[0] : null
  const nightsSet = Array.from(new Set(items.map((r) => r.nights).filter((n): n is number => !!n)))
  const daysSet = Array.from(new Set(items.map((r) => r.days).filter((n): n is number => !!n)))
  const nights = nightsSet.length === 1 ? nightsSet[0] : null
  const days = daysSet.length === 1 ? daysSet[0] : null
  const capParts: string[] = []
  if (sharedMeal) capParts.push(mealLabel(sharedMeal, lang))
  if (nights) capParts.push(`${nights} ${t('honeymoon.nights')}`)
  if (days) capParts.push(`${days} ${t('honeymoon.days')}`)
  const heroCaption = capParts.length ? capParts.join(' · ') : null

  // Shared transfer line for the footer (when one transfer detail applies).
  const transfers = Array.from(new Set(items.map((r) => clean(r.transfer_details)).filter(Boolean))) as string[]
  const transferLine = transfers.length === 1 ? transfers[0] : null

  // Offer-wide currency/basis statement for the terms footer.
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
    heroName,
    heroRegion: heroRegion || null,
    heroCaption,
    today: formatDate(new Date().toISOString()),
    phone: data.phone?.trim() || COMPANY_PHONE,
    client: clean(data.client),
    transferLine,
    pricesLine,
  }

  const blocks: FlowBlock[] = []
  groups.forEach((g, i) => {
    blocks.push({
      key: `price-${g.hotelId ?? g.name}-${i}`,
      keepWithNext: false,
      node: <PriceBlock group={g} index={i + 1} numbered={hotelCount > 1} density={density} lang={lang} t={t} />,
    })
  })
  if (feats.length) {
    blocks.push({ key: 'features', keepWithNext: false, node: <InclusionsBlock items={feats} density={density} t={t} /> })
  }
  blocks.push({ key: 'terms', keepWithNext: false, node: <TermsBlock analysis={analysis} /> })

  return { analysis, blocks }
}

/* ------------------------------------------------------------------ *
 *  Price block — one big navy badge for a single period, else a neat   *
 *  navy-headed price table. Multi-hotel offers get a numbered name.    *
 * ------------------------------------------------------------------ */
interface PriceRow {
  key: string
  period: string
  room: string
  meal: Rate['meal_plan']
  price: string
  cur: string
}

function priceRows(g: HotelGroup, allLabel: string): PriceRow[] {
  const rows: PriceRow[] = []
  for (const p of g.periods) {
    const sorted = [...p.rates].sort((a, b) => roomRank(a.room_type) - roomRank(b.room_type))
    for (const r of sorted) {
      rows.push({ key: `${p.key}-${r.id}`, period: compactRange(p.from, p.to, allLabel), room: r.room_type, meal: r.meal_plan, price: priceNumber(r.adult_price), cur: r.currency })
    }
  }
  return rows
}

function PriceBlock({
  group,
  index,
  numbered,
  density,
  lang,
  t,
}: {
  group: HotelGroup
  index: number
  numbered: boolean
  density: Density
  lang: Lang
  t: T
}) {
  const D = DENS[density]
  const rows = priceRows(group, t('export.allPeriods'))
  const distinctRooms = new Set(rows.map((r) => r.room)).size
  const distinctMeals = new Set(rows.map((r) => r.meal)).size
  const showType = distinctRooms > 1 || distinctMeals > 1

  const nameRow = numbered ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: D.secMb }}>
      <span className="nums" style={{ display: 'inline-grid', placeItems: 'center', width: D.featIcon, height: D.featIcon, borderRadius: 8, background: NAVY, color: GOLD_TEXT, fontSize: D.featFs, fontWeight: 800, flexShrink: 0 }}>
        {index}
      </span>
      <h2 style={{ margin: 0, fontSize: sectionNameSize(group.name, D), fontWeight: 800, color: NAVY, lineHeight: 1.18 }}>{group.name}</h2>
      {(group.region || group.subRegion) && (
        <span style={{ fontSize: D.cellFs, fontWeight: 600, color: MUTED }}>{[group.region, group.subRegion].filter(Boolean).join(' · ')}</span>
      )}
      <span style={{ flex: '1 1 24px', minWidth: 24, height: 2, borderRadius: 999, background: GOLD, opacity: 0.35 }} />
    </div>
  ) : null

  // Single price → hero-style badge.
  if (rows.length === 1) {
    const r = rows[0]
    return (
      <section>
        {nameRow}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', background: NAVY, borderRadius: D.radius + 2, padding: `${D.badgePy}px 44px`, textAlign: 'center', minWidth: 360, boxShadow: `inset 0 0 0 2px ${GOLD}` }}>
            <div className="nums" style={{ fontSize: D.badgePeriodFs, fontWeight: 700, color: GOLD_TEXT, letterSpacing: 0.3 }}>{r.period}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              <span className="nums" style={{ fontSize: D.badgePriceFs, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{r.price}</span>
              <span style={{ fontSize: Math.round(D.badgePriceFs * 0.4), fontWeight: 700, color: GOLD_TEXT }}>{r.cur}</span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Multiple prices → compact styled table.
  const cols = showType ? 'minmax(0,1.5fr) minmax(0,1.4fr) minmax(0,1fr)' : 'minmax(0,1.7fr) minmax(0,1fr)'
  const head = (label: string, justify: 'flex-start' | 'center'): CSSProperties => ({
    padding: `${D.rowPy + 1}px 12px`,
    fontSize: D.headFs,
    fontWeight: 700,
    color: '#fff',
    background: NAVY,
    boxShadow: `inset 0 -2px 0 ${GOLD}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    whiteSpace: 'nowrap',
  })
  const cell = (bg: string, bt?: string): CSSProperties => ({ padding: `${D.rowPy}px 12px`, background: bg, borderTop: bt, display: 'flex', alignItems: 'center' })

  return (
    <section>
      {nameRow}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: D.radius, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols }}>
          <div style={head(t('export.period'), 'flex-start')}>{t('export.period')}</div>
          {showType && <div style={head(t('honeymoon.priceType'), 'flex-start')}>{t('honeymoon.priceType')}</div>}
          <div style={head(t('honeymoon.price'), 'center')}>{t('honeymoon.price')}</div>
          {rows.map((r, i) => {
            const bg = i % 2 ? '#FBF8F0' : '#ffffff'
            const bt = i === 0 ? undefined : `1px solid ${BORDER}`
            return (
              <Fragment key={r.key}>
                <div className="nums" style={{ ...cell(bg, bt), fontSize: D.cellFs, fontWeight: 700, color: SUB, whiteSpace: 'nowrap' }}>{r.period}</div>
                {showType && (
                  <div style={{ ...cell(bg, bt), fontSize: D.cellFs, fontWeight: 700, color: INK }}>
                    {roomLabel(r.room, lang)}{distinctMeals > 1 ? ` · ${mealLabel(r.meal, lang)}` : ''}
                  </div>
                )}
                <div className="nums" style={{ ...cell(bg, bt), justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: D.tPriceFs, fontWeight: 800, color: r.price === '—' ? FAINT : NAVY }}>{r.price}</span>
                  {r.price !== '—' && <span style={{ fontSize: Math.round(D.tPriceFs * 0.66), fontWeight: 700, color: GOLD_DARK }}>{r.cur}</span>}
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 *  Inclusions — one perk per row: navy icon disc + text + hairline.    *
 * ------------------------------------------------------------------ */
function InclusionsBlock({ items, density, t }: { items: string[]; density: Density; t: T }) {
  const D = DENS[density]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: D.secMb }}>
        <span style={{ flex: 1, height: 2, borderRadius: 999, background: GOLD, opacity: 0.35 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: D.featFs + 2, fontWeight: 800, color: NAVY, whiteSpace: 'nowrap' }}>
          <Sparkles style={{ width: 16, height: 16, color: GOLD_DARK }} />
          {t('honeymoon.features')}
        </span>
        <span style={{ flex: 1, height: 2, borderRadius: 999, background: GOLD, opacity: 0.35 }} />
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: D.radius, overflow: 'hidden', background: '#fff' }}>
        {items.map((f, i) => {
          const Icon = featureIcon(f)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${D.featRowPy}px 14px`, background: i % 2 ? SURFACE : '#ffffff', borderTop: i === 0 ? undefined : `1px solid ${DIVIDER}` }}>
              <span style={{ width: D.featIcon, height: D.featIcon, borderRadius: 999, background: NAVY, display: 'inline-grid', placeItems: 'center', flexShrink: 0, boxShadow: `inset 0 0 0 1.5px ${GOLD}` }}>
                <Icon style={{ width: D.featIconSize, height: D.featIconSize, color: '#fff' }} strokeWidth={2} />
              </span>
              <span style={{ fontSize: D.featFs, fontWeight: 600, color: INK, lineHeight: 1.35 }}>{f}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Terms — navy footer with transfer line + phone + terms.             *
 * ------------------------------------------------------------------ */
function TermsBlock({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { t, phone, today, pricesLine, transferLine } = analysis
  return (
    <div style={{ background: NAVY, color: '#ffffff', borderRadius: 14, padding: '13px 18px', boxShadow: `inset 0 -3px 0 ${GOLD}` }}>
      {transferLine && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
          <Bus style={{ width: 18, height: 18, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#EAF0FB' }}>{transferLine}</span>
        </div>
      )}
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
 *  Page chrome — brand row (logo left) + decorative HONEYMOON hero.    *
 * ------------------------------------------------------------------ */
export function HoneymoonHeaderFull({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { dir, t, heroName, heroRegion, heroCaption, client, today, density } = analysis
  const D = DENS[density]
  return (
    <div style={{ padding: `20px ${PAD_X}px 10px` }}>
      {/* Direction-locked LTR so the logo sits physically LEFT for Arabic too. */}
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 12 }}>
        <ExportLogo h={50} />
        <div style={{ direction: dir, textAlign: 'end', fontSize: 12, color: MUTED, fontWeight: 600 }}>
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

      {/* HERO — navy band, gold double frame, HONEYMOON wordmark, name. */}
      <div style={{ direction: dir, position: 'relative', overflow: 'hidden', background: NAVY, borderRadius: 18, padding: `${D.heroPy}px 26px ${D.heroPy + 2}px`, textAlign: 'center', boxShadow: `inset 0 0 0 2px ${GOLD}` }}>
        <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(200,162,74,0.38)', borderRadius: 12, pointerEvents: 'none' }} />
        <Plane style={{ position: 'absolute', insetInlineStart: 20, top: 16, width: 22, height: 22, color: GOLD, opacity: 0.55 }} />
        <Plane style={{ position: 'absolute', insetInlineEnd: 20, top: 16, width: 22, height: 22, color: GOLD, opacity: 0.55, transform: 'scaleX(-1)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Heart style={{ width: 15, height: 15, color: GOLD }} strokeWidth={2.5} />
          <span style={{ fontFamily: '"Space Grotesk", Cairo, sans-serif', fontSize: D.wordmarkFs, fontWeight: 800, letterSpacing: 6, color: GOLD }}>{WORDMARK}</span>
          <Heart style={{ width: 15, height: 15, color: GOLD }} strokeWidth={2.5} />
        </div>

        {heroRegion && (
          <div style={{ position: 'relative', marginTop: 9, display: 'inline-block', border: `1.5px solid ${GOLD}`, borderRadius: 999, padding: '3px 18px', fontSize: D.pillFs, fontWeight: 800, color: '#fff', letterSpacing: dir === 'rtl' ? 0 : 1.2 }}>
            {heroRegion}
          </div>
        )}

        <h1 style={{ position: 'relative', margin: '9px 0 0', fontSize: heroNameSize(heroName), fontWeight: 800, color: '#ffffff', lineHeight: 1.18, wordBreak: 'break-word' }}>
          {heroName}
        </h1>

        {heroCaption && (
          <div className="nums" style={{ position: 'relative', marginTop: 5, fontSize: D.capFs, fontWeight: 700, color: GOLD_TEXT }}>{heroCaption}</div>
        )}
      </div>
    </div>
  )
}

export function HoneymoonRunningHeader({ analysis }: { analysis: HoneymoonAnalysis }) {
  const { dir, heroName } = analysis
  return (
    <div style={{ padding: `14px ${PAD_X}px 8px` }}>
      <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
        <ExportLogo h={34} />
        <div style={{ direction: dir, maxWidth: 620, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, fontWeight: 700, color: SUB }}>
          <span style={{ fontFamily: '"Space Grotesk", Cairo, sans-serif', color: GOLD_DARK, letterSpacing: 2 }}>{WORDMARK}</span> · {heroName}
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
 *  exporter (data-m / data-b / data-page anchors).                     *
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
