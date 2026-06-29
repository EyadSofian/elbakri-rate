import type { MealPlan, PricingBasis, RateStatus, QuoteStatus, Role, TransferOpt } from '@/types'

export const mealPlanLabel: Record<string, string> = {
  RO: 'بدون وجبات',
  BB: 'إفطار',
  HB: 'نصف إقامة',
  FB: 'إقامة كاملة',
  AI: 'شامل',
  UAI: 'شامل فاخر',
}

export const roomTypeLabel: Record<string, string> = {
  Single: 'فردية',
  Double: 'مزدوجة',
  Triple: 'ثلاثية',
  Quad: 'رباعية',
  Family: 'عائلية',
  Custom: 'مخصصة',
}

export const pricingBasisLabel: Record<PricingBasis, string> = {
  per_person_per_night: 'للفرد / الليلة',
  per_room_per_night: 'للغرفة / الليلة',
  per_person_package: 'للفرد / الباقة',
  per_room_package: 'للغرفة / الباقة',
}

export const rateStatusLabel: Record<RateStatus, string> = {
  Draft: 'مسودة',
  Ready: 'جاهز',
  Archived: 'مؤرشف',
}

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  draft: 'مسودة',
  ready: 'جاهز',
  sent: 'مُرسل',
  archived: 'مؤرشف',
}

export const transferLabel: Record<TransferOpt, string> = {
  Included: 'مشمولة',
  Optional: 'اختيارية',
  'Not Included': 'غير مشمولة',
}

export const roleLabel: Record<Role, string> = {
  admin: 'مدير',
  operations: 'عمليات',
  sales: 'مبيعات',
  viewer: 'قارئ',
}

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

export function mealLabel(m: MealPlan | string | null) {
  return m ? mealPlanLabel[m] ?? m : '—'
}
export function roomLabel(r: string | null) {
  return r ? roomTypeLabel[r] ?? r : '—'
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
