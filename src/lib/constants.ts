export const REGIONS = [
  "شرم الشيخ",
  "الغردقة",
  "مرسى علم",
  "مرسى مطروح",
  "دهب",
  "طابا",
  "الجونة",
  "سهل حشيش",
  "مكادي",
  "العين السخنة",
  "الساحل الشمالي",
] as const;

export const CATEGORIES = [
  "Beach Resort",
  "City Hotel",
  "Honeymoon",
  "Family",
  "All-Inclusive",
  "Boutique",
] as const;

export const ROOM_TYPES = [
  "Single",
  "Double",
  "Triple",
  "Quad",
  "Family Room",
  "Suite",
  "Junior Suite",
] as const;

export const MEAL_PLANS = ["RO", "BB", "HB", "FB", "AI", "UAI"] as const;

export const PRICING_BASIS = [
  "Per person per night",
  "Per room per night",
  "Per person per package",
  "Per room per package",
] as const;

export const CURRENCIES = ["EGP", "USD", "EUR", "SAR"] as const;

export const TRANSFER_OPTIONS = ["Included", "Optional", "Not Included"] as const;

export const STATUSES = ["Draft", "Ready", "Archived"] as const;

export type RateStatus = (typeof STATUSES)[number];

export const REQUIRED_FOR_READY = [
  "region",
  "hotel_name",
  "hotel_id",
  "date_from",
  "date_to",
  "room_type",
  "meal_plan",
  "pricing_basis",
  "currency",
  "adult_price",
] as const;