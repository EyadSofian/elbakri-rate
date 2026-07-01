export type Role = 'admin' | 'operations' | 'sales' | 'viewer'
export type RateStatus = 'Draft' | 'Ready' | 'Archived'
export type ActiveStatus = 'Active' | 'Inactive'
export type QuoteStatus = 'draft' | 'ready' | 'sent' | 'archived'
export type TransferOpt = 'Included' | 'Optional' | 'Not Included'
export type Currency = 'EGP' | 'USD' | 'EUR' | 'SAR'
export type MealPlan = 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'SAI' | 'UAI'
export type PricingBasis =
  | 'per_person_per_night'
  | 'per_room_per_night'
  | 'per_person_package'
  | 'per_room_package'

export interface AccessRule {
  id?: number
  scope_type: 'all' | 'region' | 'hotel_group' | 'hotel' | 'package'
  scope_id: number | null
  scope_value: string | null
  can_view: number | boolean
  can_edit: number | boolean
  can_export: number | boolean
}

export interface CurrentUser {
  id: number
  email: string
  full_name: string
  role: Role
  can_edit: boolean
  can_export: boolean
  nav_tabs: string[] | null
  rules: AccessRule[]
}

export interface HotelGroup {
  id: number
  name: string
  brand_name: string | null
  region: string | null
  notes: string | null
  hotels_count?: number
  packages_count?: number
}

export interface Hotel {
  id: number
  hotel_group_id: number | null
  group_name?: string | null
  hotel_name: string
  region: string | null
  sub_region: string | null
  star_rating: number | null
  address: string | null
  description: string | null
  facilities: string | null
  child_policy_default: string | null
  transfer_notes_default: string | null
  status: ActiveStatus
  rates_count?: number
  ready_count?: number
  independent_rates?: Rate[]
  package_rates?: Rate[]
  packages?: { id: number; package_name: string; package_type: string | null }[]
}

export interface Package {
  id: number
  package_name: string
  package_type: string | null
  region: string | null
  hotel_group_id: number | null
  group_name?: string | null
  description: string | null
  default_meal_plan: MealPlan | null
  default_pricing_basis: PricingBasis | null
  status: ActiveStatus
  hotels_count?: number
  rates_count?: number
  ready_rates_count?: number
  hotels?: Pick<Hotel, 'id' | 'hotel_name' | 'region' | 'sub_region' | 'star_rating' | 'status' | 'description' | 'facilities' | 'child_policy_default' | 'transfer_notes_default'>[]
  rates?: Rate[]
}

export interface Rate {
  id: number
  hotel_id: number
  hotel_group_id: number | null
  package_id: number | null
  package_name: string | null
  hotel_name: string | null
  hotel_group: string | null
  region: string | null
  sub_region: string | null
  category: string | null
  offer_name: string | null
  season_name: string | null
  date_from: string | null
  date_to: string | null
  room_type: string
  meal_plan: MealPlan
  pricing_basis: PricingBasis
  currency: Currency
  adult_price: string | number | null
  child_price: string | number | null
  child_age_from: string | number | null
  child_age_to: string | number | null
  nights: number | null
  days: number | null
  transfer_included: TransferOpt
  transfer_details: string | null
  child_policy: string | null
  cancellation_policy: string | null
  booking_notes: string | null
  status: RateStatus
  source_type: string
  updated_at?: string
  hotel_description?: string | null
  hotel_facilities?: string | null
  hotel_child_policy_default?: string | null
  hotel_transfer_notes_default?: string | null
}

export interface QuoteItem extends Rate {
  item_id: number
  custom_note: string | null
  sort_order: number
  hotel_rate_id: number
}

export interface Quote {
  id: number
  quote_number: string
  client_name: string | null
  client_phone: string | null
  client_notes: string | null
  status: QuoteStatus
  created_by: number | null
  creator_name?: string | null
  items_count?: number
  items?: QuoteItem[]
  updated_at?: string
  created_at?: string
}

export interface Lists {
  room_types: string[]
  meal_plans: MealPlan[]
  pricing_basis: PricingBasis[]
  currencies: Currency[]
  rate_statuses: RateStatus[]
  transfer_opts: TransferOpt[]
  categories: string[]
  quote_statuses: QuoteStatus[]
  roles: Role[]
}

export interface SystemCheckItem {
  key: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail?: string
  value?: string | number
}
