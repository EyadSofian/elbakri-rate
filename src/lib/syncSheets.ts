import { syncHotelRatesToSheet } from "./sheetsSync.functions";
import { toast } from "sonner";

let pending: Promise<unknown> | null = null;

/** Fire-and-forget sync. Coalesces concurrent calls. Shows a toast only on error. */
export function triggerSheetSync(opts?: { silent?: boolean }): Promise<void> {
  if (pending) return pending as Promise<void>;
  const p = (async () => {
    try {
      await syncHotelRatesToSheet();
      if (!opts?.silent) toast.success("تم التحديث على Google Sheets");
    } catch (e) {
      console.error("Sheet sync failed:", e);
      toast.error("فشل التحديث على Google Sheets: " + (e instanceof Error ? e.message : "خطأ"));
    } finally {
      pending = null;
    }
  })();
  pending = p;
  return p;
}
