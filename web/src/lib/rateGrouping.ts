import type { Rate } from '@/types'

export interface RatePeriodGroup {
  key: string
  rates: Rate[]
}

function value(v: unknown) {
  return v === null || v === undefined || v === '' ? '-' : String(v)
}

export function ratePeriodKey(rate: Rate) {
  return [
    value(rate.date_from),
    value(rate.date_to),
    value(rate.meal_plan),
    value(rate.pricing_basis),
    value(rate.currency),
    value(rate.season_name),
    value(rate.transfer_included),
  ].join('|')
}

export function groupRatesByPeriod(rates: Rate[]): RatePeriodGroup[] {
  const map = new Map<string, Rate[]>()
  for (const rate of rates) {
    const key = ratePeriodKey(rate)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(rate)
  }

  return Array.from(map.entries()).map(([key, rows]) => ({
    key,
    rates: [...rows].sort((a, b) => roomOrder(a.room_type) - roomOrder(b.room_type)),
  }))
}

export function groupRatesByHotel(rates: Rate[]): Array<[string, Rate[]]> {
  const map = new Map<string, Rate[]>()
  for (const rate of rates) {
    const key = rate.hotel_name ?? `#${rate.hotel_id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(rate)
  }
  return Array.from(map.entries())
}

function roomOrder(roomType: string) {
  const order: Record<string, number> = {
    Single: 1,
    Double: 2,
    Triple: 3,
    Quad: 4,
    Family: 5,
    Custom: 99,
  }
  return order[roomType] ?? 50
}
