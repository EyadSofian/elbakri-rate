import type { Rate } from '@/types'

/**
 * Shared rate-grouping logic used by the client export, the on-screen quote /
 * package / hotel detail views, and (mirrored) the WhatsApp template.
 *
 * Grouping order — by design (see product spec):
 *   1. hotel   (keyed by hotel_id, NEVER by hotel_name — the name is a
 *              denormalized snapshot and may differ between rows)
 *   2. period  (date_from + date_to + meal_plan — a period is one date range
 *              at one meal plan; the meal label is shown on the period bar)
 *   3. room    (Single / Double / Triple / Custom … ordered sensibly)
 *
 * A hotel therefore appears exactly once, with every period nested inside it,
 * and every room price nested inside each period — no repetition.
 */

const ROOM_ORDER = ['Single', 'Double', 'Triple', 'Quad', 'Family']

export interface PeriodGroup {
  key: string
  from: string | null
  to: string | null
  meal: Rate['meal_plan']
  basis: Rate['pricing_basis']
  transfer: Rate['transfer_included']
  /** Period-specific child policy (only rendered under the period when it
   *  varies across the hotel's periods — see HotelGroup.sharedChildPolicy). */
  childPolicy: string | null
  transferDetails: string | null
  bookingNotes: string | null
  rates: Rate[]
}

export interface HotelGroup {
  hotelId: number | null
  name: string
  region: string | null
  subRegion: string | null
  /** Set only when EVERY rate of this hotel belongs to the same package. */
  packageId: number | null
  packageName: string | null
  periods: PeriodGroup[]
  /** When all periods share one identical child policy, it is hoisted here and
   *  shown once under the hotel instead of repeated under every period. */
  sharedChildPolicy: string | null
}

function roomRank(room: string): number {
  const i = ROOM_ORDER.indexOf(room)
  return i === -1 ? ROOM_ORDER.length + 1 : i
}

function clean(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

/** Group a flat list of rates into hotels → periods → rooms. */
export function groupRates(items: Rate[]): HotelGroup[] {
  const hotels = new Map<string, HotelGroup & { _periods: Map<string, PeriodGroup> }>()

  for (const r of items) {
    const hotelKey = r.hotel_id != null ? `id:${r.hotel_id}` : `name:${r.hotel_name ?? ''}`
    let h = hotels.get(hotelKey)
    if (!h) {
      h = {
        hotelId: r.hotel_id ?? null,
        name: r.hotel_name ?? '',
        region: clean(r.region),
        subRegion: clean(r.sub_region),
        packageId: r.package_id ?? null,
        packageName: clean(r.package_name),
        periods: [],
        sharedChildPolicy: null,
        _periods: new Map(),
      }
      hotels.set(hotelKey, h)
    } else if (h.packageId !== (r.package_id ?? null)) {
      // Mixed package membership within one hotel → treat as standalone hotel
      // (no single package label applies).
      h.packageId = null
      h.packageName = null
    }

    const periodKey = `${r.date_from ?? ''}|${r.date_to ?? ''}|${r.meal_plan}`
    let p = h._periods.get(periodKey)
    if (!p) {
      p = {
        key: periodKey,
        from: r.date_from,
        to: r.date_to,
        meal: r.meal_plan,
        basis: r.pricing_basis,
        transfer: r.transfer_included,
        childPolicy: clean(r.child_policy),
        transferDetails: clean(r.transfer_details),
        bookingNotes: clean(r.booking_notes),
        rates: [],
      }
      h._periods.set(periodKey, p)
    }
    p.rates.push(r)
  }

  return Array.from(hotels.values()).map((h) => {
    const periods = Array.from(h._periods.values())
    for (const p of periods) {
      p.rates.sort((a, b) => roomRank(a.room_type) - roomRank(b.room_type))
    }
    periods.sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))

    // Hoist a shared child policy when every period carries the same one.
    const policies = Array.from(new Set(periods.map((p) => p.childPolicy).filter(Boolean))) as string[]
    let sharedChildPolicy: string | null = null
    if (policies.length === 1 && periods.every((p) => p.childPolicy === policies[0])) {
      sharedChildPolicy = policies[0]
      for (const p of periods) p.childPolicy = null
    }

    return {
      hotelId: h.hotelId,
      name: h.name,
      region: h.region,
      subRegion: h.subRegion,
      packageId: h.packageId,
      packageName: h.packageName,
      periods,
      sharedChildPolicy,
    }
  })
}

export interface OfferShape {
  groups: HotelGroup[]
  /** Single standalone hotel (no package) → focus the offer on the hotel. */
  singleHotel: HotelGroup | null
  /** Every rate belongs to one and the same package → package offer. */
  packageId: number | null
  packageName: string | null
  isPackageOffer: boolean
}

/** Derive the high-level shape of an offer from its rates. */
export function describeOffer(items: Rate[]): OfferShape {
  const groups = groupRates(items)
  const packageIds = Array.from(new Set(items.map((i) => i.package_id ?? null)))
  const isPackageOffer = packageIds.length === 1 && packageIds[0] != null
  const packageId = isPackageOffer ? (packageIds[0] as number) : null
  const packageName = isPackageOffer ? (clean(items.find((i) => i.package_name)?.package_name) ?? null) : null
  const singleHotel = !isPackageOffer && groups.length === 1 ? groups[0] : null
  return { groups, singleHotel, packageId, packageName, isPackageOffer }
}
