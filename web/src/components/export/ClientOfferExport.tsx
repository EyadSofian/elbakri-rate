import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Baby, Building2, Bus, Info, MapPin, Phone, Sparkles, Tag } from 'lucide-react'
import { priceNumber, formatDateRange, formatDate } from '@/lib/utils'
import { translate, type Lang } from '@/lib/i18n'
import { Logo } from '@/components/layout/Logo'
import { describeOffer, type HotelGroup } from '@/lib/grouping'
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

/* ------------------------------------------------------------------ *
 *  Layout constants — a single A4-proportioned page at a fixed width.  *
 * ------------------------------------------------------------------ */
export const PAGE_W = 1080
export const PAGE_H = Math.round(PAGE_W * (297 / 210)) // 1527
export const BLOCK_GAP = 16
const CONTENT_PAD_X = 52

const NAVY = '#07184A'
const GOLD = '#C8A24A'
const SURFACE = '#F4F6FB'
const BORDER = '#E9EEF6'
const MUTED = '#5A6B86'
const SUB = '#33508F'
const COMPANY_PHONE = '+20 12 25279820'

type Dir = 'rtl' | 'ltr'
type T = (k: string, vars?: Record<string, string | number>) => string

const ROOM_ORDER = ['Single', 'Double', 'Triple', 'Quad', 'Family']
function roomRank(room: string): number {
  const i = ROOM_ORDER.indexOf(room)
  return i === -1 ? ROOM_ORDER.length + 1 : i
}

function titleSize(name: string): number {
  const len = name.length
  if (len > 52) return 21
  if (len > 36) return 24
  return 27
}

function hotelNameSize(name: string): number {
  const len = name.length
  if (len > 40) return 18
  if (len > 28) return 20
  return 22
}

function isPerRoom(basis: Rate['pricing_basis']): boolean {
  return basis === 'per_room_per_night' || basis === 'per_room_package'
}

/* ------------------------------------------------------------------ *
 *  Offer analysis + flow blocks.                                       *
 * ------------------------------------------------------------------ */
export interface OfferAnalysis {
  lang: Lang
  dir: Dir
  t: T
  isPackageOffer: boolean
  resolvedTitle: string | null
  resolvedSubtitle: string | null
  headlineIsHotel: boolean
  today: string
  phone: string
  reference: string | null
  client: string | null
  notes: string | null
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
  const lang: Lang = data.lang ?? 'ar'
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t: T = (k, vars) => translate(lang, k, vars)

  const shape = describeOffer(items)
  const forceHotel = mode === 'hotel'
  const isPackageOffer = forceHotel ? false : shape.isPackageOffer
  const packageName = forceHotel ? null : shape.packageName
  const singleHotel = forceHotel ? shape.groups[0] ?? null : shape.singleHotel

  const resolvedTitle =
    title ||
    (isPackageOffer && packageName ? packageName : null) ||
    (singleHotel ? t('export.offerTitleHotel', { name: singleHotel.name }) : null)

  const resolvedSubtitle =
    subtitle ??
    (singleHotel ? [singleHotel.region, singleHotel.subRegion].filter(Boolean).join(' · ') || null : null)

  const headlineIsHotel = !!singleHotel

  const analysis: OfferAnalysis = {
    lang,
    dir,
    t,
    isPackageOffer,
    resolvedTitle,
    resolvedSubtitle,
    headlineIsHotel,
    today: formatDate(issuedDate ?? new Date().toISOString()),
    phone: phone.trim() || COMPANY_PHONE,
    reference: reference ?? null,
    client: client ?? null,
    notes: notes ?? null,
  }

  const blocks: FlowBlock[] = []
  const info = data.hotelInfo

  for (const h of shape.groups) {
    blocks.push({
      key: `hotel-${h.hotelId ?? h.name}`,
      keepWithNext: false,
      node: (
        <HotelTable
          group={h}
          lang={lang}
          dir={dir}
          t={t}
          showHeader={!headlineIsHotel}
          showPackageBadge={isPackageOffer && !!h.packageName}
          info={h.hotelId != null ? info?.[h.hotelId] : undefined}
        />
      ),
    })
  }

  if (analysis.notes) {
    blocks.push({
      key: 'notes',
      keepWithNext: false,
      node: (
        <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, padding: '11px 15px', fontSize: 13, lineHeight: 1.5 }}>
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
 *  Page chrome — slim header (full / running) and footer.              *
 * ------------------------------------------------------------------ */

/** Full brand header + offer title (slim, single-row lockup). Page 1 only. */
export function OfferHeaderFull({ analysis }: { analysis: OfferAnalysis }) {
  const { dir, t, isPackageOffer, resolvedTitle, resolvedSubtitle, client, reference } = analysis
  return (
    <div style={{ padding: '22px 52px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center' }}>
          <Logo className="h-[58px] max-w-[330px]" />
        </div>
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
          <span style={{ display: 'inline-block', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: 0.5, padding: '5px 13px', borderRadius: 7, textTransform: 'uppercase' }}>
            {t('export.heading')}
          </span>
          {client && (
            <div style={{ marginTop: 5, fontSize: 13, color: MUTED, fontWeight: 600 }}>
              {t('export.presentedTo')}: <span style={{ color: NAVY, fontWeight: 700 }}>{client}</span>
            </div>
          )}
          {reference && (
            <div style={{ marginTop: client ? 3 : 5, fontSize: 12, color: MUTED, fontWeight: 700 }}>
              {t('export.reference')}: <span className="nums" style={{ color: NAVY }}>{reference}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 3, background: GOLD, borderRadius: 999, marginTop: 12 }} />

      {resolvedTitle && (
        <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          {isPackageOffer && (
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: GOLD, flexShrink: 0 }}>
              <Sparkles style={{ width: 17, height: 17, color: NAVY }} />
            </span>
          )}
          <h1 style={{ margin: 0, fontSize: titleSize(resolvedTitle), fontWeight: 800, color: NAVY, lineHeight: 1.15, wordBreak: 'break-word' }}>
            {resolvedTitle}
          </h1>
          {resolvedSubtitle && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: MUTED }}>
              <MapPin style={{ width: 15, height: 15, color: SUB, flexShrink: 0 }} />
              {resolvedSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Slim running header carried on pages 2+. */
export function OfferRunningHeader({ analysis }: { analysis: OfferAnalysis }) {
  const { dir, t, resolvedTitle } = analysis
  return (
    <div style={{ padding: '16px 52px 9px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ direction: 'ltr', display: 'flex', alignItems: 'center' }}>
          <Logo className="h-[38px] max-w-[220px]" />
        </div>
        {resolvedTitle && (
          <div style={{ maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13.5, fontWeight: 700, color: SUB, textAlign: dir === 'rtl' ? 'left' : 'right' }}>
            {t('export.heading')} · {resolvedTitle}
          </div>
        )}
      </div>
      <div style={{ height: 2, background: GOLD, borderRadius: 999, marginTop: 10 }} />
    </div>
  )
}

/** Slim page footer (brand + page number) pinned to the bottom of every page. */
export function PageFooter({ analysis, page }: { analysis: OfferAnalysis; page: { n: number; total: number } }) {
  const { t, dir } = analysis
  return (
    <div style={{ padding: '9px 52px 14px' }}>
      <div style={{ height: 2, background: BORDER, borderRadius: 999 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, letterSpacing: 0.3 }}>ELBAKRI OVERSEAS FOR TRAVEL</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textAlign: dir === 'rtl' ? 'left' : 'right' }}>
          {t('export.page')} <span className="nums">{page.n}/{page.total}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Hotel price table — the dense, space-efficient core.                *
 *  One table per hotel: rows = periods, columns = date · meal · rooms.  *
 * ------------------------------------------------------------------ */

const headCell: CSSProperties = { padding: '7px 10px', fontSize: 12, fontWeight: 700, color: '#fff', background: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

function HotelTable({
  group,
  lang,
  dir,
  t,
  showHeader,
  showPackageBadge,
  info,
}: {
  group: HotelGroup
  lang: Lang
  dir: Dir
  t: T
  showHeader: boolean
  showPackageBadge: boolean
  info?: HotelInfo
}) {
  const allPeriods = t('export.allPeriods')
  // Column set = union of room types across the hotel's periods, sensibly ordered.
  const rooms = Array.from(new Set(group.periods.flatMap((p) => p.rates.map((r) => r.room_type)))).sort(
    (a, b) => roomRank(a) - roomRank(b),
  )

  const currencies = Array.from(new Set(group.periods.flatMap((p) => p.rates.map((r) => r.currency))))
  const bases = Array.from(new Set(group.periods.map((p) => p.basis)))
  const perLabel = bases.length === 1 ? (isPerRoom(bases[0]) ? t('export.perRoom') : t('export.perPerson')) : null

  // Footnotes gathered under the table (kept compact, shown once).
  const anyPeriodChild = group.periods.some((p) => p.childPolicy)
  const sharedChild = group.sharedChildPolicy ?? (!anyPeriodChild ? info?.childPolicyDefault ?? null : null)
  const transfers = Array.from(
    new Set(
      group.periods
        .filter((p) => p.transfer)
        .map((p) => t(`transfer.${p.transfer}`) + (p.transferDetails ? ` · ${p.transferDetails}` : '')),
    ),
  )
  const hotelTransferNotes = info?.transferNotesDefault ?? null

  return (
    <section>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: SURFACE, border: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <Building2 style={{ width: 18, height: 18, color: NAVY }} />
          </span>
          <h2 style={{ margin: 0, fontSize: hotelNameSize(group.name), fontWeight: 800, color: NAVY, lineHeight: 1.15, wordBreak: 'break-word' }}>
            {group.name}
          </h2>
          {showPackageBadge && group.packageName && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, background: '#F4ECD6', border: `1px solid ${GOLD}`, borderRadius: 999, padding: '2px 10px' }}>
              {group.packageName}
            </span>
          )}
          {(group.region || group.subRegion) && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>
              · {[group.region, group.subRegion].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}

      {/* CSS grid (not <table>) so header + body always share identical column
          tracks — a fixed-layout <table> lets thead/tbody widths diverge. */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1.7fr) minmax(0, 0.9fr) ${rooms.map(() => 'minmax(0, 1fr)').join(' ')}` }}>
          <div style={{ ...headCell, textAlign: 'start' }}>{t('export.period')}</div>
          <div style={{ ...headCell, textAlign: 'start' }}>{t('export.meal')}</div>
          {rooms.map((rt) => (
            <div key={rt} style={{ ...headCell, textAlign: 'center' }}>{translate(lang, `room.${rt}`)}</div>
          ))}
          {group.periods.map((p, idx) => {
            const byRoom = new Map(p.rates.map((r) => [r.room_type, r]))
            const dateText = p.from || p.to ? formatDateRange(p.from, p.to, allPeriods) : allPeriods
            const bg = idx % 2 ? '#ffffff' : SURFACE
            const bt = idx === 0 ? undefined : `1px solid ${BORDER}`
            return (
              <Fragment key={p.key}>
                <div className="nums" style={{ padding: '6px 10px', background: bg, borderTop: bt, textAlign: 'start', fontSize: 12.5, fontWeight: 700, color: SUB, whiteSpace: 'nowrap' }}>{dateText}</div>
                <div style={{ padding: '6px 10px', background: bg, borderTop: bt, textAlign: 'start', fontSize: 12.5, fontWeight: 700, color: '#0E1A33' }}>{t(`meal.${p.meal}`)}</div>
                {rooms.map((rt) => {
                  const r = byRoom.get(rt)
                  return (
                    <div key={rt} className="nums" style={{ padding: '6px 8px', background: bg, borderTop: bt, textAlign: 'center', fontSize: 17, fontWeight: 800, color: r ? NAVY : '#C4CEDE' }}>
                      {r ? priceNumber(r.adult_price) : '—'}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* Compact footnotes — currency/basis, transfers, child policy, hotel info */}
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, lineHeight: 1.5, color: MUTED }}>
        {(currencies.length > 0 || perLabel) && (
          <FootLine icon={<Tag style={fnIcon} />}>
            <strong style={{ color: '#0E1A33', fontWeight: 700 }} className="nums">{currencies.join(' / ')}</strong>
            {perLabel ? <> · {perLabel}</> : null}
          </FootLine>
        )}
        {transfers.map((tr, i) => (
          <FootLine key={i} icon={<Bus style={fnIcon} />}>
            {t('export.transfers')}: <strong style={{ color: '#0E1A33', fontWeight: 700 }}>{tr}</strong>
          </FootLine>
        ))}
        {hotelTransferNotes && (
          <FootLine icon={<Bus style={fnIcon} />}>
            <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.transfers')}:</strong> {hotelTransferNotes}
          </FootLine>
        )}
        {sharedChild && (
          <FootLine icon={<Baby style={fnIcon} />}>
            <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.children')}:</strong> {sharedChild}
          </FootLine>
        )}
        {group.periods
          .filter((p) => p.childPolicy)
          .map((p) => (
            <FootLine key={`c-${p.key}`} icon={<Baby style={fnIcon} />}>
              <span className="nums" style={{ fontWeight: 700, color: SUB }}>
                {p.from || p.to ? formatDateRange(p.from, p.to, allPeriods) : allPeriods}
              </span>
              {' — '}
              {p.childPolicy}
            </FootLine>
          ))}
        {info?.description && <FootLine icon={<Info style={fnIcon} />}>{info.description}</FootLine>}
        {info?.facilities && (
          <FootLine icon={<Sparkles style={fnIcon} />}>
            <strong style={{ color: NAVY, fontWeight: 700 }}>{t('export.facilities')}:</strong> {info.facilities}
          </FootLine>
        )}
      </div>
    </section>
  )
}

const fnIcon: CSSProperties = { width: 14, height: 14, color: SUB, flexShrink: 0, marginTop: 2 }
function FootLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
      {icon}
      <span>{children}</span>
    </div>
  )
}

function TermsBlock({ analysis }: { analysis: OfferAnalysis }) {
  const { t, dir, phone, today } = analysis
  return (
    <div style={{ background: NAVY, color: '#fff', borderRadius: 12, padding: '13px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, lineHeight: 1.65, color: '#aebfdd' }}>
          <div>• {t('export.term1')}</div>
          <div>• {t('export.term2')}</div>
        </div>
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
          {phone ? (
            <div className="nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 18, fontWeight: 800, color: GOLD }}>
              <Phone style={{ width: 17, height: 17 }} />
              {phone}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#7e96c6', marginTop: phone ? 4 : 0 }}>{t('export.issued')}: <span className="nums">{today}</span></div>
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
  color: '#0E1A33',
}

const blocksColStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: BLOCK_GAP,
  padding: `2px ${CONTENT_PAD_X}px 0`,
}

/** Hidden tree rendered once to measure chrome + block heights before paging. */
export function MeasureTree({ analysis, blocks }: { analysis: OfferAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, fontFamily: 'Cairo, sans-serif', color: '#0E1A33' }}>
      <div data-m="fh"><OfferHeaderFull analysis={analysis} /></div>
      <div data-m="rh"><OfferRunningHeader analysis={analysis} /></div>
      <div data-m="ft"><PageFooter analysis={analysis} page={{ n: 1, total: 9 }} /></div>
      <div style={blocksColStyle}>
        {blocks.map((b, i) => (
          <div data-b={i} key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

/** Single continuous document (no page splitting) — used by the PNG export. */
export function SingleDocTree({ analysis, blocks }: { analysis: OfferAnalysis; blocks: FlowBlock[] }) {
  return (
    <div dir={analysis.dir} style={{ width: PAGE_W, background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: '#0E1A33' }}>
      <OfferHeaderFull analysis={analysis} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: BLOCK_GAP, padding: `4px ${CONTENT_PAD_X}px 36px` }}>
        {blocks.map((b) => (
          <div key={b.key}>{b.node}</div>
        ))}
      </div>
    </div>
  )
}

/** The final paginated tree — one fixed-size A4 page per entry. */
export function PagesTree({ analysis, pages }: { analysis: OfferAnalysis; pages: FlowBlock[][] }) {
  const total = pages.length
  return (
    <div>
      {pages.map((pageBlocks, idx) => (
        <div data-page={idx} key={idx} dir={analysis.dir} style={pageStyle}>
          {idx === 0 ? <OfferHeaderFull analysis={analysis} /> : <OfferRunningHeader analysis={analysis} />}
          <div style={blocksColStyle}>
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
