import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SHEET_HEADERS = [
  "record_id","category","region","sub_region","hotel_name","hotel_group",
  "package_name","offer_name","season_name","date_from","date_to","days","nights",
  "room_type","occupancy","meal_plan","pricing_basis","currency",
  "adult_price","child_price","child_age_from","child_age_to","child_policy",
  "transfer_included","transfer_details","cancellation_policy","booking_notes",
  "status","last_updated",
] as const;

const NUMERIC_FIELDS = new Set([
  "days","nights","adult_price","child_price","child_age_from","child_age_to",
]);

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth credentials missing");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token returned from Google");
  return json.access_token;
}

async function getFirstSheetTitle(sheetId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheet metadata fetch failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  const title = json.sheets?.[0]?.properties?.title;
  if (!title) throw new Error("No sheets found in spreadsheet");
  return title;
}

export const syncHotelRatesToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not configured");

    const { data: roleOk } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    const { data: opsOk } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "operations",
    });
    if (!roleOk && !opsOk) throw new Error("Forbidden");

    const { data: rates, error } = await context.supabase
      .from("hotel_rates")
      .select("*")
      .order("hotel_name", { ascending: true });
    if (error) throw new Error(`Supabase read failed: ${error.message}`);

    const token = await getAccessToken();
    const sheetTitle = await getFirstSheetTitle(sheetId, token);
    const range = `${sheetTitle}!A1`;

    const rows: (string | number)[][] = [];
    rows.push([...SHEET_HEADERS]);
    for (const r of rates ?? []) {
      const row: (string | number)[] = [];
      for (const h of SHEET_HEADERS) {
        const key = h === "last_updated" ? "updated_at" : h;
        const v = (r as Record<string, unknown>)[key];
        if (v === null || v === undefined || v === "") {
          row.push("");
        } else if (NUMERIC_FIELDS.has(h)) {
          const n = typeof v === "number" ? v : Number(v);
          row.push(Number.isFinite(n) ? n : "");
        } else {
          row.push(String(v));
        }
      }
      rows.push(row);
    }

    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTitle)}:clear`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!clearRes.ok) {
      const text = await clearRes.text();
      throw new Error(`Sheet clear failed (${clearRes.status}): ${text}`);
    }

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ range, majorDimension: "ROWS", values: rows }),
      },
    );
    if (!writeRes.ok) {
      const text = await writeRes.text();
      throw new Error(`Sheet write failed (${writeRes.status}): ${text}`);
    }

    return { ok: true, rowsWritten: rows.length - 1, sheet: sheetTitle };
  });
