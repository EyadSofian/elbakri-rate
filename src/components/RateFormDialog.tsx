import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CURRENCIES, MEAL_PLANS, PRICING_BASIS, REGIONS, ROOM_TYPES, STATUSES, TRANSFER_OPTIONS } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateForReady, type HotelRate, type HotelRateInsert } from "@/lib/rates";
import { Copy } from "lucide-react";
import { triggerSheetSync } from "@/lib/syncSheets";
import { useQuery } from "@tanstack/react-query";
import type { Hotel, HotelGroup, Package, PackageHotel } from "@/lib/library";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: HotelRate | null;
  onSaved?: () => void;
}

const blank: Partial<HotelRateInsert> = {
  category: "Beach Resort",
  region: "",
  hotel_name: "",
  hotel_group: "",
  package_name: null,
  date_from: "",
  date_to: "",
  room_type: "Double",
  meal_plan: "HB",
  pricing_basis: "Per person per night",
  currency: "EGP",
  adult_price: 0,
  status: "Draft",
  transfer_included: "Optional",
};

export function RateFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [form, setForm] = useState<Partial<HotelRateInsert>>(blank);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"hotel" | "package">("hotel");
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const locked = !!initial && initial.status === "Archived" && !isAdmin;

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { ...blank });
      setMode(initial?.package_id ? "package" : "hotel");
    }
  }, [open, initial]);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages_for_form"],
    enabled: open,
    queryFn: async () => (await supabase.from("packages").select("*").order("package_name")).data as Package[],
  });
  const { data: links = [] } = useQuery({
    queryKey: ["package_hotels_for_form"],
    enabled: open,
    queryFn: async () => (await supabase.from("package_hotels").select("*")).data as PackageHotel[],
  });
  const { data: allHotels = [] } = useQuery({
    queryKey: ["hotels_for_form"],
    enabled: open,
    queryFn: async () => (await supabase.from("hotels").select("*").order("hotel_name")).data as Hotel[],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups_for_form"],
    enabled: open,
    queryFn: async () => (await supabase.from("hotel_groups").select("*").order("name")).data as HotelGroup[],
  });

  const availableHotels = useMemo(() => {
    if (mode !== "package" || !form.package_id) return allHotels;
    const hids = links.filter((l) => l.package_id === form.package_id).map((l) => l.hotel_id);
    const filtered = allHotels.filter((h) => hids.includes(h.id));
    return filtered.length ? filtered : allHotels;
  }, [mode, form.package_id, links, allHotels]);

  const set = <K extends keyof HotelRateInsert>(k: K, v: HotelRateInsert[K] | string | number) =>
    setForm((f) => ({ ...f, [k]: v as HotelRateInsert[K] }));

  const onPackagePick = (pkgId: string) => {
    if (pkgId === "__none__") {
      setForm((f) => ({ ...f, package_id: null, package_name: null }));
      return;
    }
    const p = packages.find((x) => x.id === pkgId);
    setForm((f) => ({
      ...f,
      package_id: pkgId,
      package_name: p?.package_name ?? f.package_name,
      region: p?.region ?? f.region,
      hotel_group_id_fk: p?.hotel_group_id ?? f.hotel_group_id_fk ?? null,
      meal_plan: f.meal_plan || (p?.default_meal_plan ?? f.meal_plan),
      pricing_basis: f.pricing_basis || (p?.default_pricing_basis ?? f.pricing_basis),
    }));
  };

  const onHotelPick = (hid: string) => {
    const h = allHotels.find((x) => x.id === hid);
    if (!h) return;
    const g = groups.find((x) => x.id === h.hotel_group_id);
    setForm((f) => ({
      ...f,
      hotel_id: hid,
      hotel_name: h.hotel_name,
      hotel_group: g?.name ?? f.hotel_group,
      hotel_group_id_fk: h.hotel_group_id ?? f.hotel_group_id_fk,
      region: f.region || h.region,
      sub_region: f.sub_region || h.sub_region || null,
      child_policy: f.child_policy || h.child_policy_default || "",
      transfer_details: f.transfer_details || h.transfer_notes_default || "",
    }));
  };

  const save = async (asDuplicate = false) => {
    if (locked && !asDuplicate) {
      toast.error("السجل المؤرشف لا يمكن تعديله — يتطلب صلاحية المدير");
      return;
    }
    if (!form.hotel_id) {
      toast.error("يرجى اختيار الفندق");
      return;
    }
    if (mode === "package" && !form.package_id) {
      toast.error("اختر الباكدج أو غيّر النوع إلى \"فندق فقط\"");
      return;
    }
    if (form.status === "Ready") {
      const miss = validateForReady(form);
      if (miss.length) {
        toast.error("لا يمكن نشر سجل ناقص. الحقول المطلوبة: " + miss.join(", "));
        return;
      }
    }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const payload: HotelRateInsert = {
      ...(form as HotelRateInsert),
      package_id: mode === "package" ? form.package_id ?? null : null,
      package_name: mode === "package" ? form.package_name ?? null : null,
      adult_price: Number(form.adult_price ?? 0),
      child_price:
        form.child_price !== undefined && form.child_price !== null && String(form.child_price) !== ""
          ? Number(form.child_price)
          : null,
      child_age_from: form.child_age_from ? Number(form.child_age_from) : null,
      child_age_to: form.child_age_to ? Number(form.child_age_to) : null,
      days: form.days ? Number(form.days) : null,
      nights: form.nights ? Number(form.nights) : null,
    };
    let error;
    if (initial && !asDuplicate) {
      payload.updated_by = userId ?? null;
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = payload as HotelRate;
      void _id; void _c; void _u;
      const r = await supabase.from("hotel_rates").update(rest).eq("id", initial.id);
      error = r.error;
    } else {
      payload.created_by = userId ?? null;
      payload.updated_by = userId ?? null;
      const { id: _id, created_at: _c, updated_at: _u, record_id, ...rest } = payload as HotelRate;
      void _id; void _c; void _u;
      const insertable = asDuplicate
        ? { ...rest, record_id: record_id ? `${record_id}-COPY-${Date.now().toString(36)}` : null }
        : { ...rest, record_id };
      const r = await supabase.from("hotel_rates").insert(insertable);
      error = r.error;
    }
    setBusy(false);
    if (error) toast.error("خطأ في الحفظ: " + error.message);
    else {
      toast.success(asDuplicate ? "تم إنشاء نسخة" : initial ? "تم تحديث السجل" : "تم إضافة السجل");
      onOpenChange(false);
      onSaved?.();
      void triggerSheetSync({ silent: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "تعديل سعر فندق" : "إضافة سعر فندق"}</DialogTitle>
          <DialogDescription>
            اختر الفندق أولاً. ربط الباكدج اختياري — استخدمه فقط إذا كان السعر جزءاً من باقة.
            {locked && (
              <span className="block mt-1 text-destructive font-medium">عرض فقط — السجل في حالة "مؤرشف". المدير فقط يمكنه التعديل.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 p-1 bg-secondary/60 rounded-md w-fit">
          <button
            type="button"
            onClick={() => { setMode("hotel"); setForm((f) => ({ ...f, package_id: null, package_name: null })); }}
            className={`px-3 py-1.5 text-sm rounded-md transition ${mode === "hotel" ? "bg-background shadow font-semibold" : "text-muted-foreground"}`}
          >فندق فقط</button>
          <button
            type="button"
            onClick={() => setMode("package")}
            className={`px-3 py-1.5 text-sm rounded-md transition ${mode === "package" ? "bg-background shadow font-semibold" : "text-muted-foreground"}`}
          >سعر داخل باكدج</button>
        </div>

        <fieldset disabled={locked} className="grid grid-cols-1 md:grid-cols-3 gap-4 disabled:opacity-70">
          <Field label="الفندق *">
            <Select value={form.hotel_id ?? ""} onValueChange={onHotelPick}>
              <SelectTrigger><SelectValue placeholder="اختر الفندق…" /></SelectTrigger>
              <SelectContent>
                {availableHotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.hotel_name} — {h.region}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={mode === "package" ? "الباكدج *" : "الباكدج (اختياري)"}>
            <Select value={form.package_id ?? "__none__"} onValueChange={onPackagePick}>
              <SelectTrigger><SelectValue placeholder="اختر باكدج…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون باكدج —</SelectItem>
                {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.package_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="اسم العرض (اختياري)">
            <Input value={form.offer_name ?? ""} onChange={(e) => set("offer_name", e.target.value)} />
          </Field>

          <Field label="رمز السجل (اختياري)">
            <Input value={form.record_id ?? ""} onChange={(e) => set("record_id", e.target.value)} />
          </Field>
          <Field label="التصنيف">
            <Sel value={form.category ?? ""} onChange={(v) => set("category", v)} options={CATEGORIES as readonly string[]} />
          </Field>
          <Field label="المنطقة *">
            <Sel value={form.region ?? ""} onChange={(v) => set("region", v)} options={REGIONS as readonly string[]} />
          </Field>

          <Field label="اسم الفندق *">
            <Input value={form.hotel_name ?? ""} onChange={(e) => set("hotel_name", e.target.value)} />
          </Field>
          <Field label="المجموعة الفندقية">
            <Input value={form.hotel_group ?? ""} onChange={(e) => set("hotel_group", e.target.value)} />
          </Field>
          <Field label="المنطقة الفرعية">
            <Input value={form.sub_region ?? ""} onChange={(e) => set("sub_region", e.target.value)} />
          </Field>

          <Field label="اسم الموسم">
            <Input value={form.season_name ?? ""} onChange={(e) => set("season_name", e.target.value)} />
          </Field>

          <Field label="تاريخ البداية *">
            <Input type="date" value={form.date_from ?? ""} onChange={(e) => set("date_from", e.target.value)} dir="ltr" />
          </Field>
          <Field label="تاريخ النهاية *">
            <Input type="date" value={form.date_to ?? ""} onChange={(e) => set("date_to", e.target.value)} dir="ltr" />
          </Field>
          <Field label="ليالي / أيام">
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="ليالي" value={form.nights ?? ""} onChange={(e) => set("nights", e.target.value)} />
              <Input type="number" placeholder="أيام" value={form.days ?? ""} onChange={(e) => set("days", e.target.value)} />
            </div>
          </Field>

          <Field label="نوع الغرفة *">
            <Sel value={form.room_type ?? ""} onChange={(v) => set("room_type", v)} options={ROOM_TYPES as readonly string[]} />
          </Field>
          <Field label="الإشغال">
            <Input value={form.occupancy ?? ""} onChange={(e) => set("occupancy", e.target.value)} />
          </Field>
          <Field label="نظام الإقامة *">
            <Sel value={form.meal_plan ?? ""} onChange={(v) => set("meal_plan", v)} options={MEAL_PLANS as readonly string[]} />
          </Field>

          <Field label="أساس التسعير *">
            <Sel value={form.pricing_basis ?? ""} onChange={(v) => set("pricing_basis", v)} options={PRICING_BASIS as readonly string[]} />
          </Field>
          <Field label="العملة *">
            <Sel value={form.currency ?? ""} onChange={(v) => set("currency", v)} options={CURRENCIES as readonly string[]} />
          </Field>
          <Field label="سعر الفرد *">
            <Input type="number" step="0.01" value={form.adult_price ?? 0} onChange={(e) => set("adult_price", e.target.value)} />
          </Field>

          <Field label="سعر الطفل">
            <Input type="number" step="0.01" value={form.child_price ?? ""} onChange={(e) => set("child_price", e.target.value)} />
          </Field>
          <Field label="عمر الطفل من">
            <Input type="number" step="0.01" value={form.child_age_from ?? ""} onChange={(e) => set("child_age_from", e.target.value)} />
          </Field>
          <Field label="عمر الطفل إلى">
            <Input type="number" step="0.01" value={form.child_age_to ?? ""} onChange={(e) => set("child_age_to", e.target.value)} />
          </Field>

          <Field label="الانتقالات">
            <Sel value={form.transfer_included ?? ""} onChange={(v) => set("transfer_included", v)} options={TRANSFER_OPTIONS as readonly string[]} />
          </Field>
          <Field label="الحالة *">
            <Sel value={form.status ?? "Draft"} onChange={(v) => set("status", v)} options={STATUSES as readonly string[]} />
          </Field>
          <div />

          <Field label="سياسة الأطفال" wide>
            <Textarea rows={2} value={form.child_policy ?? ""} onChange={(e) => set("child_policy", e.target.value)} />
          </Field>
          <Field label="تفاصيل الانتقالات" wide>
            <Textarea rows={2} value={form.transfer_details ?? ""} onChange={(e) => set("transfer_details", e.target.value)} />
          </Field>
          <Field label="سياسة الإلغاء" wide>
            <Textarea rows={2} value={form.cancellation_policy ?? ""} onChange={(e) => set("cancellation_policy", e.target.value)} />
          </Field>
          <Field label="ملاحظات الحجز" wide>
            <Textarea rows={2} value={form.booking_notes ?? ""} onChange={(e) => set("booking_notes", e.target.value)} />
          </Field>
        </fieldset>

        <DialogFooter className="gap-2">
          {initial && (
            <Button variant="outline" onClick={() => save(true)} disabled={busy}>
              <Copy className="size-4 me-2" />
              حفظ كنسخة
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={() => save(false)} disabled={busy || locked}>{busy ? "جاري الحفظ…" : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-3" : ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}