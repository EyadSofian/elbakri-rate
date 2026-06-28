import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEAL_PLANS, CURRENCIES, PRICING_BASIS } from "@/lib/constants";
import type { Hotel, HotelGroup, Package } from "@/lib/library";
import type { HotelRateInsert } from "@/lib/rates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerSheetSync } from "@/lib/syncSheets";
import { Plus, Trash2 } from "lucide-react";

type PeriodRow = {
  id: string;
  date_from: string;
  date_to: string;
  double?: string;
  triple?: string;
  single?: string;
  custom_room?: string;
  custom_price?: string;
  meal_plan: string;
  currency: string;
  pricing_basis: string;
};

const emptyPeriod = (): PeriodRow => ({
  id: Math.random().toString(36).slice(2, 9),
  date_from: "", date_to: "",
  meal_plan: "HB", currency: "EGP", pricing_basis: "Per person per night",
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hotel: Hotel;
  group?: HotelGroup | null;
  packages?: Package[];
  onSaved?: () => void;
}

export function HotelRatePeriodsDialog({ open, onOpenChange, hotel, group, packages = [], onSaved }: Props) {
  const [periods, setPeriods] = useState<PeriodRow[]>([emptyPeriod()]);
  const [packageId, setPackageId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPeriods([emptyPeriod()]);
      setPackageId("none");
    }
  }, [open]);

  const updatePeriod = (id: string, patch: Partial<PeriodRow>) =>
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const totalRows = periods.reduce((acc, p) => {
    let n = 0;
    if (p.double && Number(p.double) > 0) n++;
    if (p.triple && Number(p.triple) > 0) n++;
    if (p.single && Number(p.single) > 0) n++;
    if (p.custom_room && p.custom_price && Number(p.custom_price) > 0) n++;
    return acc + n;
  }, 0);

  const save = async () => {
    for (const p of periods) {
      if (!p.date_from || !p.date_to) { toast.error("كل فترة تحتاج تاريخ بداية ونهاية"); return; }
      if (p.date_to < p.date_from) { toast.error("تاريخ النهاية يجب أن يكون بعد البداية"); return; }
      const any = [p.double, p.triple, p.single, p.custom_price].some((v) => v && Number(v) > 0);
      if (!any) { toast.error("أدخل سعر واحد على الأقل لكل فترة"); return; }
    }
    if (totalRows === 0) { toast.error("لا توجد أسعار للحفظ"); return; }
    setBusy(true);

    const pkg = packageId !== "none" ? packages.find((x) => x.id === packageId) : null;
    const newRecordId = () => `H-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const rows: HotelRateInsert[] = [];
    for (const p of periods) {
      const base = {
        record_id: newRecordId(),
        region: hotel.region,
        sub_region: hotel.sub_region ?? null,
        hotel_name: hotel.hotel_name,
        hotel_id: hotel.id,
        hotel_group: group?.name ?? null,
        hotel_group_id_fk: hotel.hotel_group_id ?? null,
        package_id: pkg?.id ?? null,
        package_name: pkg?.package_name ?? null,
        date_from: p.date_from,
        date_to: p.date_to,
        meal_plan: p.meal_plan,
        pricing_basis: p.pricing_basis,
        currency: p.currency,
        status: "Draft" as const,
        child_policy: hotel.child_policy_default ?? null,
        transfer_details: hotel.transfer_notes_default ?? null,
      };
      const push = (room: string, price: string | undefined) => {
        if (!price || !(Number(price) > 0)) return;
        rows.push({ ...base, record_id: newRecordId(), room_type: room, adult_price: Number(price) });
      };
      push("Double", p.double);
      push("Triple", p.triple);
      push("Single", p.single);
      if (p.custom_room && p.custom_price) push(p.custom_room, p.custom_price);
    }

    const r = await supabase.from("hotel_rates").insert(rows);
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    void triggerSheetSync({ silent: true });
    toast.success(`تم إنشاء ${rows.length} سعر`);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة فترات متعددة — {hotel.hotel_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الباكدج (اختياري)</Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون باكدج (سعر مستقل) —</SelectItem>
                  {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.package_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => setPeriods((ps) => [...ps, emptyPeriod()])}>
                <Plus className="size-4 me-1" />فترة جديدة
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {periods.map((p, idx) => (
              <div key={p.id} className="border rounded-md p-3 space-y-2 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">فترة #{idx + 1}</span>
                  {periods.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPeriods((ps) => ps.filter((x) => x.id !== p.id))}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="col-span-1 md:col-span-2">
                    <Label className="text-[11px]">من</Label>
                    <Input type="date" dir="ltr" value={p.date_from} onChange={(e) => updatePeriod(p.id, { date_from: e.target.value })} />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <Label className="text-[11px]">إلى</Label>
                    <Input type="date" dir="ltr" value={p.date_to} onChange={(e) => updatePeriod(p.id, { date_to: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[11px]">الإقامة</Label>
                    <Select value={p.meal_plan} onValueChange={(v) => updatePeriod(p.id, { meal_plan: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MEAL_PLANS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">العملة</Label>
                    <Select value={p.currency} onValueChange={(v) => updatePeriod(p.id, { currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">أساس التسعير</Label>
                  <Select value={p.pricing_basis} onValueChange={(v) => updatePeriod(p.id, { pricing_basis: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICING_BASIS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><Label className="text-[11px]">Double</Label><Input type="number" value={p.double ?? ""} onChange={(e) => updatePeriod(p.id, { double: e.target.value })} /></div>
                  <div><Label className="text-[11px]">Triple</Label><Input type="number" value={p.triple ?? ""} onChange={(e) => updatePeriod(p.id, { triple: e.target.value })} /></div>
                  <div><Label className="text-[11px]">Single</Label><Input type="number" value={p.single ?? ""} onChange={(e) => updatePeriod(p.id, { single: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-1">
                    <div><Label className="text-[11px]">نوع آخر</Label><Input placeholder="Suite…" value={p.custom_room ?? ""} onChange={(e) => updatePeriod(p.id, { custom_room: e.target.value })} /></div>
                    <div><Label className="text-[11px]">السعر</Label><Input type="number" value={p.custom_price ?? ""} onChange={(e) => updatePeriod(p.id, { custom_price: e.target.value })} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2 text-center">
            سيتم إنشاء <span className="font-bold text-foreground">{totalRows}</span> سعر في {periods.length} فترة
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={save} disabled={busy || totalRows === 0}>{busy ? "جاري الحفظ…" : `حفظ ${totalRows} سعر`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}