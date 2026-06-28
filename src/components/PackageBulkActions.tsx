import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Archive, Copy, CalendarPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggerSheetSync } from "@/lib/syncSheets";
import type { HotelRate, HotelRateInsert } from "@/lib/rates";
import type { Hotel } from "@/lib/library";

type Props = {
  packageId: string;
  selected: HotelRate[];
  hotels: Hotel[];
  onClear: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const newRecordId = () => `RM-${Date.now().toString(36)}-${uid()}`;

function shiftDate(d: string | null, days: number): string | null {
  if (!d) return d;
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function PackageBulkActions({ packageId, selected, hotels, onClear }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [hotelDlg, setHotelDlg] = useState(false);
  const [dateDlg, setDateDlg] = useState(false);
  const [targetHotels, setTargetHotels] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<"shift" | "explicit">("shift");
  const [shiftDays, setShiftDays] = useState(7);
  const [explicitFrom, setExplicitFrom] = useState("");
  const [explicitTo, setExplicitTo] = useState("");

  const ids = selected.map((r) => r.id);

  const finish = async (msg: string) => {
    await qc.invalidateQueries({ queryKey: ["package_rates", packageId] });
    qc.invalidateQueries({ queryKey: ["rates"] });
    toast.success(msg);
    triggerSheetSync({ silent: true });
    onClear();
  };

  const markReady = async () => {
    setBusy(true);
    const { error } = await supabase.from("hotel_rates").update({ status: "Ready" }).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    await finish(`تم تعليم ${ids.length} كـ "جاهز"`);
  };

  const archive = async () => {
    setBusy(true);
    const { error } = await supabase.from("hotel_rates").update({ status: "Archived" }).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    await finish(`تم أرشفة ${ids.length} عرض`);
  };

  const duplicateToHotels = async () => {
    if (!targetHotels.length) return toast.error("اختر فندقًا واحدًا على الأقل");
    setBusy(true);
    const rows: HotelRateInsert[] = [];
    for (const hid of targetHotels) {
      const h = hotels.find((x) => x.id === hid);
      if (!h) continue;
      for (const r of selected) {
        const { id: _id, created_at: _ca, updated_at: _ua, last_updated: _lu, updated_by: _ub, ...rest } = r as HotelRate & Record<string, unknown>;
        void _id; void _ca; void _ua; void _lu; void _ub;
        rows.push({
          ...(rest as HotelRateInsert),
          record_id: newRecordId(),
          hotel_id: h.id,
          hotel_name: h.hotel_name,
          hotel_group_id_fk: h.hotel_group_id ?? r.hotel_group_id_fk ?? null,
          region: h.region ?? r.region,
          package_id: packageId,
        });
      }
    }
    const { error } = await supabase.from("hotel_rates").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    setHotelDlg(false);
    setTargetHotels([]);
    await finish(`تم نسخ ${rows.length} سعر إلى ${targetHotels.length} فندق`);
  };

  const duplicateDates = async () => {
    setBusy(true);
    const rows: HotelRateInsert[] = selected.map((r) => {
      const { id: _id, created_at: _ca, updated_at: _ua, last_updated: _lu, updated_by: _ub, ...rest } = r as HotelRate & Record<string, unknown>;
      void _id; void _ca; void _ua; void _lu; void _ub;
      const from = (dateMode === "shift" ? shiftDate(r.date_from, shiftDays) : (explicitFrom || r.date_from)) ?? r.date_from!;
      const to = (dateMode === "shift" ? shiftDate(r.date_to, shiftDays) : (explicitTo || r.date_to)) ?? r.date_to!;
      return {
        ...(rest as HotelRateInsert),
        record_id: newRecordId(),
        date_from: from!,
        date_to: to!,
      };
    });
    const { error } = await supabase.from("hotel_rates").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    setDateDlg(false);
    await finish(`تم نسخ ${rows.length} سعر بفترة جديدة`);
  };

  return (
    <>
      <div className="fixed bottom-6 inset-x-0 flex justify-center print:hidden z-40 px-4">
        <div className="bg-card border shadow-lg rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <span className="text-sm font-medium">{selected.length} عرض محدد</span>
          <span className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="outline" disabled={busy} onClick={markReady}>
            <CheckCircle2 className="size-4 me-1.5 text-emerald-600" />جاهز
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setHotelDlg(true)}>
            <Copy className="size-4 me-1.5" />نسخ لفنادق
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setDateDlg(true)}>
            <CalendarPlus className="size-4 me-1.5" />نسخ بفترة جديدة
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={archive}>
            <Archive className="size-4 me-1.5" />أرشفة
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
            <X className="size-4" />
          </Button>
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <Dialog open={hotelDlg} onOpenChange={setHotelDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>نسخ الأسعار المحددة إلى فنادق أخرى</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {hotels.map((h) => (
              <label key={h.id} className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer">
                <Checkbox
                  checked={targetHotels.includes(h.id)}
                  onCheckedChange={(c) => setTargetHotels((p) => c ? [...p, h.id] : p.filter((x) => x !== h.id))}
                />
                <span className="text-sm">{h.hotel_name}</span>
                <span className="text-xs text-muted-foreground ms-auto">{h.region}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelDlg(false)}>إلغاء</Button>
            <Button onClick={duplicateToHotels} disabled={busy || !targetHotels.length}>
              نسخ ({selected.length} × {targetHotels.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dateDlg} onOpenChange={setDateDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>نسخ بفترة تواريخ جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={dateMode === "shift" ? "default" : "outline"} onClick={() => setDateMode("shift")}>إزاحة بالأيام</Button>
              <Button size="sm" variant={dateMode === "explicit" ? "default" : "outline"} onClick={() => setDateMode("explicit")}>تواريخ محددة</Button>
            </div>
            {dateMode === "shift" ? (
              <div>
                <Label>عدد الأيام للإزاحة (موجب = للأمام)</Label>
                <Input type="number" value={shiftDays} onChange={(e) => setShiftDays(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">سيتم نسخ كل سعر بتواريخ مزاحة {shiftDays} يومًا.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من</Label><Input type="date" value={explicitFrom} onChange={(e) => setExplicitFrom(e.target.value)} /></div>
                <div><Label>إلى</Label><Input type="date" value={explicitTo} onChange={(e) => setExplicitTo(e.target.value)} /></div>
                <p className="col-span-2 text-xs text-muted-foreground">سيتم تطبيق نفس التواريخ على كل النسخ.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateDlg(false)}>إلغاء</Button>
            <Button onClick={duplicateDates} disabled={busy}>نسخ ({selected.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}