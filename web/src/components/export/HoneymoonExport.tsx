import { createRoot, type Root } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { CalendarDays, Gift, Hotel, Phone, Sparkles } from 'lucide-react'
import { downloadBlob, formatDate, formatPrice } from '@/lib/utils'
import type { HoneymoonOffer, HoneymoonPeriod } from '@/types'
import type { Lang } from '@/lib/i18n'

const PAGE_W = 1080
const NAVY = '#07184A'
const INK = '#0E1A33'
const MUTED = '#5A6B86'
const GOLD = '#C8A24A'
const GOLD_DARK = '#A8853B'
const SURFACE = '#F5F7FC'
const BORDER = '#E3E9F4'
const PHONE = '+20 12 25279820'

const TX = {
  ar: {
    badge: 'عرض هاني مون',
    hotel: 'الفندق',
    region: 'المنطقة',
    period: 'الفترة',
    priceType: 'نوع السعر',
    price: 'السعر',
    notes: 'ملاحظات',
    features: 'المميزات / التفاصيل',
    noPeriods: 'لا توجد فترات مسجلة',
    contact: 'للتواصل',
    terms: 'الأسعار قابلة للتغيير حسب التوافر. برجاء التأكيد قبل الحجز.',
    issued: 'صدر بتاريخ',
  },
  en: {
    badge: 'Honeymoon Offer',
    hotel: 'Hotel',
    region: 'Region',
    period: 'Period',
    priceType: 'Price type',
    price: 'Price',
    notes: 'Notes',
    features: 'Features / details',
    noPeriods: 'No periods saved',
    contact: 'Contact',
    terms: 'Prices are subject to availability. Please confirm before booking.',
    issued: 'Issued',
  },
} as const

function clean(v: string | null | undefined) {
  return v?.trim() || '—'
}

function periodRange(p: HoneymoonPeriod, lang: Lang) {
  if (!p.date_from && !p.date_to) return lang === 'ar' ? 'كل الفترات' : 'All periods'
  return `${formatDate(p.date_from)} — ${formatDate(p.date_to)}`
}

function splitLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n|،|,/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function nextFrames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

async function settle(host: HTMLElement): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  await nextFrames()
  try {
    await fonts?.ready
  } catch {
    /* best effort */
  }
  const imgs = Array.from(host.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => img.complete ? undefined : new Promise((resolve) => {
    img.onload = resolve
    img.onerror = resolve
  })))
  await nextFrames()
}

async function urlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

async function renderPoster(offer: HoneymoonOffer, lang: Lang): Promise<string> {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    insetInlineStart: '-100000px',
    top: '0',
    width: `${PAGE_W}px`,
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  try {
    root.render(<HoneymoonExportPoster offer={offer} lang={lang} />)
    await settle(host)
    const node = host.firstElementChild as HTMLElement | null
    if (!node) throw new Error('honeymoon export node failed')
    const opts = {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: PAGE_W,
      height: node.offsetHeight,
    }
    await toPng(node, opts)
    return toPng(node, opts)
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function exportHoneymoonPng(offer: HoneymoonOffer, lang: Lang, filename: string): Promise<void> {
  const url = await renderPoster(offer, lang)
  downloadBlob(await urlToBlob(url), filename)
}

export async function exportHoneymoonPdf(offer: HoneymoonOffer, lang: Lang, filename: string): Promise<void> {
  const url = await renderPoster(offer, lang)
  const image = new Image()
  image.src = url
  await new Promise((resolve) => {
    image.onload = resolve
    image.onerror = resolve
  })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const scale = Math.min(pageW / image.width, pageH / image.height)
  const w = image.width * scale
  const h = image.height * scale
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2
  pdf.addImage(url, 'PNG', x, y, w, h, undefined, 'FAST')
  pdf.save(filename)
}

export function honeymoonWhatsAppText(offer: HoneymoonOffer, lang: Lang): string {
  const t = TX[lang]
  const lines = [
    `*ELBAKRI OVERSEAS*`,
    `${t.badge}: ${offer.offer_name}`,
    `${t.hotel}: ${offer.hotel_name}`,
  ]
  if (offer.region) lines.push(`${t.region}: ${offer.region}`)
  if (offer.periods?.length) {
    lines.push('', `${t.period}:`)
    offer.periods.forEach((p) => {
      lines.push(`- ${periodRange(p, lang)} | ${clean(p.price_label)}: ${formatPrice(p.price, p.currency)}`)
      if (p.notes) lines.push(`  ${p.notes}`)
    })
  }
  if (offer.features) lines.push('', `${t.features}:`, offer.features)
  lines.push('', `${t.contact}: ${PHONE}`)
  return lines.join('\n')
}

function HoneymoonExportPoster({ offer, lang }: { offer: HoneymoonOffer; lang: Lang }) {
  const t = TX[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const features = splitLines(offer.features)
  const periods = offer.periods ?? []

  return (
    <div
      dir={dir}
      style={{
        width: PAGE_W,
        minHeight: 820,
        background: '#fff',
        color: INK,
        fontFamily: 'Cairo, Arial, sans-serif',
        padding: '38px 46px 0',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `4px solid ${GOLD}`, paddingBottom: 24 }}>
        <img src="/elbakri-logo-blue.png" alt="ELBAKRI OVERSEAS" style={{ width: 235, height: 'auto', objectFit: 'contain' }} />
        <div style={{ borderRadius: 999, background: NAVY, color: '#fff', padding: '10px 22px', fontSize: 18, fontWeight: 800 }}>{t.badge}</div>
      </header>

      <section style={{ marginTop: 26, borderRadius: 24, background: NAVY, color: '#fff', padding: '28px 34px', position: 'relative', overflow: 'hidden' }}>
        <Sparkles size={96} color="rgba(255,255,255,.09)" style={{ position: 'absolute', insetInlineEnd: 28, top: 18 }} />
        <div style={{ position: 'relative', display: 'grid', gap: 10 }}>
          <div style={{ color: GOLD, fontSize: 18, fontWeight: 800 }}>{t.badge}</div>
          <h1 style={{ margin: 0, fontSize: offer.offer_name.length > 34 ? 42 : 50, lineHeight: 1.12, fontWeight: 900 }}>{offer.offer_name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: '#DDE6F4', fontSize: 20, fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Hotel size={22} />{offer.hotel_name}</span>
            {offer.region && <span>{offer.region}</span>}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 26, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 45px rgba(7,24,74,.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr .9fr 1.2fr', background: NAVY, color: '#fff', fontSize: 17, fontWeight: 800 }}>
          <div style={{ padding: '13px 16px' }}>{t.period}</div>
          <div style={{ padding: '13px 16px' }}>{t.priceType}</div>
          <div style={{ padding: '13px 16px' }}>{t.price}</div>
          <div style={{ padding: '13px 16px' }}>{t.notes}</div>
        </div>
        {periods.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 18 }}>{t.noPeriods}</div>
        ) : periods.map((p, idx) => (
          <div
            key={p.id ?? idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr .9fr 1.2fr',
              background: idx % 2 === 0 ? SURFACE : '#fff',
              borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}`,
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            <div style={{ padding: '14px 16px', color: NAVY, direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <CalendarDays size={18} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
              {periodRange(p, lang)}
            </div>
            <div style={{ padding: '14px 16px' }}>{clean(p.price_label)}</div>
            <div style={{ padding: '14px 16px', color: NAVY, fontSize: 22, fontWeight: 900 }}>{formatPrice(p.price, p.currency)}</div>
            <div style={{ padding: '14px 16px', color: MUTED, fontWeight: 600 }}>{clean(p.notes)}</div>
          </div>
        ))}
      </section>

      {features.length > 0 && (
        <section style={{ marginTop: 22, borderRadius: 20, border: `1px solid ${BORDER}`, background: '#fff', padding: 24 }}>
          <h2 style={{ margin: '0 0 14px', color: NAVY, fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gift size={24} color={GOLD_DARK} />
            {t.features}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: features.length > 4 ? '1fr 1fr' : '1fr', gap: '10px 18px' }}>
            {features.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: INK, fontSize: 18, fontWeight: 700, lineHeight: 1.65 }}>
                <span style={{ marginTop: 8, width: 8, height: 8, borderRadius: 999, background: GOLD, flex: '0 0 auto' }} />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer style={{ margin: '34px -46px 0', background: NAVY, color: '#fff', padding: '22px 46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ fontSize: 15, color: '#DCE5F5', fontWeight: 700 }}>
          <strong style={{ display: 'block', color: '#fff', fontSize: 17 }}>ELBAKRI OVERSEAS FOR TRAVEL</strong>
          {t.issued}: {formatDate(new Date().toISOString())}
        </div>
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
          <div style={{ display: 'inline-flex', direction: 'ltr', alignItems: 'center', gap: 9, color: GOLD, fontSize: 22, fontWeight: 900 }}>
            <Phone size={22} />
            {PHONE}
          </div>
          <div style={{ marginTop: 5, maxWidth: 540, color: '#DCE5F5', fontSize: 15, fontWeight: 700 }}>{t.terms}</div>
        </div>
      </footer>
    </div>
  )
}
