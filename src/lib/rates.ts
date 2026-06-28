import type { Database } from "@/integrations/supabase/types";
import type { RateStatus } from "./constants";
import { REQUIRED_FOR_READY } from "./constants";

export type HotelRate = Database["public"]["Tables"]["hotel_rates"]["Row"];
export type HotelRateInsert = Database["public"]["Tables"]["hotel_rates"]["Insert"];

export function statusBadgeClass(s: RateStatus) {
  switch (s) {
    case "Ready":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "Draft":
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
    case "Archived":
      return "bg-muted text-muted-foreground border border-border";
  }
}

export function statusLabel(s: RateStatus) {
  return s === "Ready" ? "جاهز" : s === "Draft" ? "مسودة" : "مؤرشف";
}

export function validateForReady(r: Partial<HotelRateInsert>): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_FOR_READY) {
    const v = (r as Record<string, unknown>)[f];
    if (v === undefined || v === null || v === "") missing.push(f);
  }
  return missing;
}

export function fmtMoney(n: number | null | undefined, ccy: string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n) + " " + (ccy || "");
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function fmtRange(a: string | null, b: string | null) {
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}