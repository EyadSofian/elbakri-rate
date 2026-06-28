import type { HotelRate, HotelRateInsert } from "./rates";

const EXPORT_COLS: (keyof HotelRate)[] = [
  "record_id","category","region","sub_region","hotel_name","hotel_group","package_name","offer_name","season_name",
  "date_from","date_to","days","nights","room_type","occupancy","meal_plan","pricing_basis","currency",
  "adult_price","child_price","child_age_from","child_age_to","child_policy",
  "transfer_included","transfer_details","cancellation_policy","booking_notes",
  "source_sheet","source_cell","status","last_updated",
];

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCSV(rows: HotelRate[]): string {
  const header = EXPORT_COLS.join(",");
  const body = rows.map((r) => EXPORT_COLS.map((c) => escapeCell(r[c])).join(",")).join("\n");
  return "\uFEFF" + header + "\n" + body;
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Simple CSV parser handling quoted fields and commas.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ParsedCSV {
  headers: string[];
  records: Partial<HotelRateInsert>[];
}

const NUMERIC: (keyof HotelRateInsert)[] = ["adult_price","child_price","child_age_from","child_age_to","days","nights"];

export function csvToRecords(text: string): ParsedCSV {
  const grid = parseCSV(text);
  if (grid.length === 0) return { headers: [], records: [] };
  const headers = grid[0].map((h) => h.trim());
  const records: Partial<HotelRateInsert>[] = [];
  for (let i = 1; i < grid.length; i++) {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const v = grid[i][j];
      if (v === undefined || v === "") return;
      if ((NUMERIC as string[]).includes(h)) {
        const n = Number(v);
        if (!isNaN(n)) obj[h] = n;
      } else obj[h] = v;
    });
    records.push(obj as Partial<HotelRateInsert>);
  }
  return { headers, records };
}