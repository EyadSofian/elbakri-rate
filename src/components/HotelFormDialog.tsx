import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIONS, MEAL_PLANS, CURRENCIES, PRICING_BASIS } from "@/lib/constants";
import { HOTEL_STATUSES, type Hotel, type HotelGroup, type HotelInsert } from "@/lib/library";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HotelRateInsert } from "@/lib/rates";
import { Plus, Trash2 } from "lucide-react";
import { triggerSheetSync } from "@/lib/syncSheets";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Hotel | null;
  groups: HotelGroup[];
  onSaved?: () => void;
}

const blank: Partial<HotelInsert> = {
  hotel_name: "",
  region: "",
  status: "Active",
};

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

export function HotelFormDialog({ open, onOpenChange, initial, groups, onSaved }: Props) {
  const [form, setForm] = useState<Partial<HotelInsert>>(blank);
  const [busy, setBusy] = useState(false);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { ...blank });
      setPeriods([]);
    }
  }, [open, initial]);

  const set = <K extends keyof HotelInsert>(k: K, v: HotelInsert[K] | string | number | null) =>
    setForm((f) => ({ ...f, [k]: v as HotelInsert[K] }));

  const updatePeriod = (id: string, patch: Partial<PeriodRow>) =>
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!form.hotel_name || !form.region) {
      toast.error("اسم الفندق والمنطقة مطلوبان");
      return;
    }
    // Validate periods
    for (const p of periods) {
      if (!p.date_from || !p.date_to) {
        toast.error("كل فترة سعرية تحتاج تاريخ بداية ونهاية");
        return;
      }
      if (p.date_to < p.date_from) {
        toast.error("تاريخ النهاية يجب أن يكون بعد البداية");
        return;
      }
      const any = [p.double, p.triple, p.single, p.custom_price].some((v) => v && Number(v) > 0);
      if (!any) { toast.error("أدخل سعر واحد على الأقل لكل فترة"); return; }
    }
    setBusy(true);
    const payload: HotelInsert = {
      ...(form as HotelInsert),
      star_rating: form.star_rating ? Number(form.star_rating) : null,
    };
    const r = initial
      ? await supabase.from("hotels").update(payload).eq("id", initial.id)
      : await supabase.from("hotels").insert(payload).select().single();
    if (r.error) { setBusy(false); toast.error(r.error.message); return; }

    const hotelId = initial?.id ?? (r as { data?: Hotel }).data?.id;
    const g = groups.find((x) => x.id === form.hotel_group_id);

    // Build rate rows
    const newRecordId = () => `H-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const rateRows: HotelRateInsert[] = [];
    for (const p of periods) {
      const base = {
        record_id: newRecordId(),
        region: form.region!,
        sub_region: form.sub_region ?? null,
        hotel_name: form.hotel_name!,
        hotel_id: hotelId ?? null,
        hotel_group: g?.name ?? null,
        hotel_group_id_fk: form.hotel_group_id ?? null,
        package_id: null,
        package_name: null,
        date_from: p.date_from,
        date_to: p.date_to,
        meal_plan: p.meal_plan,
        pricing_basis: p.pricing_basis,
        currency: p.currency,
        status: "Draft" as const,
        child_policy: form.child_policy_default ?? null,
        transfer_details: form.transfer_notes_default ?? null,
      };
      const pushRow = (room: string, price: string | undefined) => {
        if (!price || !(Number(price) > 0)) return;
        rateRows.push({ ...base, record_id: newRecordId(), room_type: room, adult_price: Number(price) });
      };
      pushRow("Double", p.double);
      pushRow("Triple", p.triple);
      pushRow("Single", p.single);
      if (p.custom_room && p.custom_price) pushRow(p.custom_room, p.custom_price);
    }
    if (rateRows.length) {
      const ri = await supabase.from("hotel_rates").insert(rateRows);
      if (ri.error) { setBusy(false); toast.error("الفندق محفوظ، لكن فشلت الأسعار: " + ri.error.message); return; }
      void triggerSheetSync({ silent: true });
    }
    setBusy(false);
    toast.success(
      (initial ? "تم تحديث الفندق" : "تم إضافة الفندق")
        + (rateRows.length ? ` و ${rateRows.length} سعر` : "")
    );
      onOpenChange(false);
      onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "تعديل بيانات فندق" : "إضافة فندق جديد"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="اسم الفندق *">
            <Input value={form.hotel_name ?? ""} onChange={(e) => set("hotel_name", e.target.value)} />
          </F>
          <F label="المجموعة الفندقية">
            <Select value={form.hotel_group_id ?? "none"} onValueChange={(v) => set("hotel_group_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— لا شيء —</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="المنطقة *">
            <Select value={form.region ?? ""} onValueChange={(v) => set("region", v)}>
              <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="منطقة فرعية">
            <Input value={form.sub_region ?? ""} onChange={(e) => set("sub_region", e.target.value)} />
          </F>
          <F label="تصنيف النجوم">
            <Input type="number" min={1} max={7} value={form.star_rating ?? ""} onChange={(e) => set("star_rating", e.target.value)} />
          </F>
          <F label="الحالة">
            <Select value={form.status ?? "Active"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOTEL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="العنوان" wide>
            <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </F>
          <F label="وصف الفندق" wide>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </F>
          <F label="المرافق" wide>
            <Textarea rows={2} value={form.facilities ?? ""} onChange={(e) => set("facilities", e.target.value)} placeholder="مسبح، شاطئ خاص، سبا…" />
          </F>
          <F label="سياسة الأطفال الافتراضية" wide>
            <Textarea rows={2} value={form.child_policy_default ?? ""} onChange={(e) => set("child_policy_default", e.target.value)} />
          </F>
          <F label="ملاحظات الانتقالات الافتراضية" wide>
            <Textarea rows={2} value={form.transfer_notes_default ?? ""} onChange={(e) => set("transfer_notes_default", e.target.value)} />
          </F>
        </div>

        <div className="border-t pt-4 mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">أسعار الفندق</h3>
              <p className="text-xs text-muted-foreground">أضف فترات أسعار سيتم حفظها كأسعار مستقلة لهذا الفندق (بدون باكدج).</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setPeriods((ps) => [...ps, emptyPeriod()])}>
              <Plus className="size-4 me-1" />فترة جديدة
            </Button>
          </div>
          {periods.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-secondary/40 rounded p-3 text-center">
              لا توجد فترات أسعار. اضغط "فترة جديدة" لإضافة أسعار الآن، أو احفظ الفندق فقط.
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map((p) => (
                <div key={p.id} className="border rounded-md p-3 space-y-2 bg-secondary/20">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <div className="col-span-2 md:col-span-2">
                      <Label className="text-[11px]">من</Label>
                      <Input type="date" dir="ltr" value={p.date_from} onChange={(e) => updatePeriod(p.id, { date_from: e.target.value })} />
                    </div>
                    <div className="col-span-2 md:col-span-2">
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
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPeriods((ps) => ps.filter((x) => x.id !== p.id))}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={save} disabled={busy}>{busy ? "جاري الحفظ…" : (periods.length ? `حفظ + ${periods.length} فترة` : "حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}