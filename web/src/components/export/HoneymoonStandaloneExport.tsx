import { exportHoneymoonPdf as exportSharedHoneymoonPdf, exportHoneymoonPng as exportSharedHoneymoonPng } from '@/lib/exporter'
import type { Lang } from '@/lib/i18n'
import { formatDate, formatPrice } from '@/lib/utils'
import type { OfferExportData } from './ClientOfferExport'
import type { HoneymoonOffer, HoneymoonPeriod, Rate } from '@/types'

const PHONE = '+20 12 25279820'

const TX = {
  ar: {
    badge: 'عرض هاني مون',
    hotel: 'الفندق',
    region: 'المنطقة',
    period: 'الفترة',
    features: 'المميزات / التفاصيل',
    contact: 'للتواصل',
    allPeriods: 'كل الفترات',
    defaultPriceType: 'سعر الليلة',
  },
  en: {
    badge: 'Honeymoon Offer',
    hotel: 'Hotel',
    region: 'Region',
    period: 'Period',
    features: 'Features / details',
    contact: 'Contact',
    allPeriods: 'All periods',
    defaultPriceType: 'Nightly rate',
  },
} as const

function clean(v: string | null | undefined, fallback = '') {
  return v?.trim() || fallback
}

function periodRange(p: HoneymoonPeriod, lang: Lang) {
  if (!p.date_from && !p.date_to) return TX[lang].allPeriods
  return `${formatDate(p.date_from)} — ${formatDate(p.date_to)}`
}

function toRate(offer: HoneymoonOffer, period: HoneymoonPeriod, idx: number, lang: Lang): Rate {
  return {
    id: period.id ?? idx + 1,
    hotel_id: offer.id || 1,
    hotel_group_id: null,
    package_id: null,
    package_name: null,
    hotel_name: offer.hotel_name,
    hotel_group: null,
    region: offer.region,
    sub_region: null,
    category: 'Honeymoon',
    offer_name: offer.offer_name,
    season_name: null,
    date_from: period.date_from,
    date_to: period.date_to,
    room_type: clean(period.price_label, TX[lang].defaultPriceType),
    meal_plan: 'AI',
    pricing_basis: 'per_person_package',
    currency: period.currency,
    adult_price: period.price,
    child_price: null,
    child_age_from: null,
    child_age_to: null,
    nights: null,
    days: null,
    transfer_included: 'Optional',
    transfer_details: null,
    child_policy: null,
    cancellation_policy: null,
    booking_notes: period.notes,
    status: offer.status,
    source_type: 'honeymoon',
  }
}

function offerToExportData(offer: HoneymoonOffer, lang: Lang): OfferExportData {
  const periods = offer.periods?.length
    ? offer.periods
    : [{
        date_from: offer.first_date ?? null,
        date_to: offer.last_date ?? null,
        price_label: null,
        price: null,
        currency: 'EGP' as const,
        notes: null,
      }]

  return {
    title: offer.offer_name,
    subtitle: offer.region,
    features: offer.features,
    phone: PHONE,
    lang,
    mode: 'hotel',
    items: periods.map((period, idx) => toRate(offer, period, idx, lang)),
  }
}

export async function exportHoneymoonPng(offer: HoneymoonOffer, lang: Lang, filename: string): Promise<void> {
  await exportSharedHoneymoonPng(offerToExportData(offer, lang), filename)
}

export async function exportHoneymoonPdf(offer: HoneymoonOffer, lang: Lang, filename: string): Promise<void> {
  await exportSharedHoneymoonPdf(offerToExportData(offer, lang), filename)
}

export function honeymoonWhatsAppText(offer: HoneymoonOffer, lang: Lang): string {
  const t = TX[lang]
  const lines = [
    '*ELBAKRI OVERSEAS*',
    `${t.badge}: ${offer.offer_name}`,
    `${t.hotel}: ${offer.hotel_name}`,
  ]

  if (offer.region) lines.push(`${t.region}: ${offer.region}`)
  if (offer.periods?.length) {
    lines.push('', `${t.period}:`)
    offer.periods.forEach((p) => {
      lines.push(`- ${periodRange(p, lang)} | ${clean(p.price_label, t.defaultPriceType)}: ${formatPrice(p.price, p.currency)}`)
      if (p.notes) lines.push(`  ${p.notes}`)
    })
  }
  if (offer.features) lines.push('', `${t.features}:`, offer.features)
  lines.push('', `${t.contact}: ${PHONE}`)
  return lines.join('\n')
}
