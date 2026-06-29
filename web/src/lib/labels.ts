import { translate, type Lang } from '@/lib/i18n'
import type { MealPlan, PricingBasis, RateStatus, QuoteStatus, Role, TransferOpt } from '@/types'

const MEAL_KEYS = ['RO', 'BB', 'HB', 'FB', 'AI', 'SAI', 'UAI'] as const
const ROOM_KEYS = ['Single', 'Double', 'Triple', 'Quad', 'Family', 'Custom'] as const
const PRICING_KEYS: PricingBasis[] = ['per_person_per_night', 'per_room_per_night', 'per_person_package', 'per_room_package']
const RATE_STATUS_KEYS: RateStatus[] = ['Draft', 'Ready', 'Archived']
const QUOTE_STATUS_KEYS: QuoteStatus[] = ['draft', 'ready', 'sent', 'archived']
const TRANSFER_KEYS: TransferOpt[] = ['Included', 'Optional', 'Not Included']
const ROLE_KEYS: Role[] = ['admin', 'operations', 'sales', 'viewer']
const CATEGORY_KEYS = ['Hotel', 'Package', 'Select', 'Premium', 'Elite', 'Honeymoon', 'Trip', 'Transfer']

function arRecord<K extends string>(keys: readonly K[], ns: string): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, translate('ar', `${ns}.${key}`)])) as Record<K, string>
}

export const mealPlanLabel: Record<string, string> = arRecord(MEAL_KEYS, 'meal')
export const roomTypeLabel: Record<string, string> = arRecord(ROOM_KEYS, 'room')
export const pricingBasisLabel: Record<PricingBasis, string> = arRecord(PRICING_KEYS, 'pricing')
export const rateStatusLabel: Record<RateStatus, string> = arRecord(RATE_STATUS_KEYS, 'status')
export const quoteStatusLabel: Record<QuoteStatus, string> = arRecord(QUOTE_STATUS_KEYS, 'quoteStatus')
export const transferLabel: Record<TransferOpt, string> = arRecord(TRANSFER_KEYS, 'transfer')
export const roleLabel: Record<Role, string> = arRecord(ROLE_KEYS, 'role')

export const categoryLabel: Record<string, string> = {
  Hotel: 'فندق',
  Package: 'باقة',
  Select: 'سيليكت',
  Premium: 'بريميوم',
  Elite: 'إيليت',
  Honeymoon: 'شهر عسل',
  Trip: 'رحلة',
  Transfer: 'انتقالات',
}

export function mealLabel(m: MealPlan | string | null, lang: Lang = 'ar') {
  return m ? translate(lang, `meal.${m}`) : '—'
}
export function roomLabel(r: string | null, lang: Lang = 'ar') {
  return r ? translate(lang, `room.${r}`) : '—'
}
export function transferText(t: TransferOpt, lang: Lang = 'ar') {
  return translate(lang, `transfer.${t}`)
}
export function pricingText(b: PricingBasis, lang: Lang = 'ar') {
  return translate(lang, `pricing.${b}`)
}
export function categoryText(c: string | null | undefined, lang: Lang = 'ar') {
  if (!c) return translate(lang, 'category.default.package')
  return CATEGORY_KEYS.includes(c) ? translate(lang, `category.${c}`) : c
}

/** Egyptian regions seen in the source workbook. */
export const REGIONS = [
  'شرم الشيخ',
  'الغردقة',
  'مرسى علم',
  'مرسى مطروح',
  'دهب وطابا',
  'الجونة',
  'سهل حشيش',
  'مكادى',
  'العين السخنة',
  'الساحل الشمالي',
]
