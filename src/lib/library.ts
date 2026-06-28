import type { Database } from "@/integrations/supabase/types";

export type HotelGroup = Database["public"]["Tables"]["hotel_groups"]["Row"];
export type Hotel = Database["public"]["Tables"]["hotels"]["Row"];
export type HotelInsert = Database["public"]["Tables"]["hotels"]["Insert"];
export type Package = Database["public"]["Tables"]["packages"]["Row"];
export type PackageInsert = Database["public"]["Tables"]["packages"]["Insert"];
export type PackageHotel = Database["public"]["Tables"]["package_hotels"]["Row"];
export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];
export type AccessRule = Database["public"]["Tables"]["user_access_rules"]["Row"];

export const HOTEL_STATUSES = ["Active", "Inactive"] as const;
export const SCOPE_TYPES = ["all", "region", "hotel_group", "hotel", "package"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export function scopeTypeLabel(s: ScopeType): string {
  return {
    all: "كل البيانات",
    region: "منطقة",
    hotel_group: "مجموعة فندقية",
    hotel: "فندق",
    package: "باكدج",
  }[s];
}