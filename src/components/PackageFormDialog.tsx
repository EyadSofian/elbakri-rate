import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { REGIONS, MEAL_PLANS, PRICING_BASIS } from "@/lib/constants";
import type { Hotel, HotelGroup, Package, PackageInsert } from "@/lib/library";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Package | null;
  groups: HotelGroup[];
  hotels: Hotel[];
  selectedHotelIds?: string[];
  onSaved?: () => void;
}

const blank: Partial<PackageInsert> = { package_name: "", status: "Active" };

export function PackageFormDialog({
  open,
  onOpenChange,
  initial,
  groups,
  hotels,
  selectedHotelIds,
  onSaved,
}: Props) {
  const [form, setForm] = useState<Partial<PackageInsert>>(blank);
  const [hotelIds, setHotelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { ...blank });
      setHotelIds(selectedHotelIds ?? []);
    }
  }, [open, initial, selectedHotelIds]);

  const set = <K extends keyof PackageInsert>(k: K, v: PackageInsert[K] | string | null) =>
    setForm((f) => ({ ...f, [k]: v as PackageInsert[K] }));

  const filteredHotels = form.region ? hotels.filter((h) => h.region === form.region) : hotels;

  const save = async () => {
    if (!form.package_name) {
      toast.error("اسم الباكدج مطلوب");
      return;
    }
    setBusy(true);
    let pkgId: string | undefined = initial?.id;
    if (initial) {
      const r = await supabase.from("packages").update(form).eq("id", initial.id);
      if (r.error) {
        setBusy(false);
        toast.error(r.error.message);
        return;
      }
    } else {
      const r = await supabase
        .from("packages")
        .insert(form as PackageInsert)
        .select("id")
        .single();
      if (r.error || !r.data) {
        setBusy(false);
        toast.error(r.error?.message ?? "خطأ");
        return;
      }
      pkgId = r.data.id;
    }
    if (pkgId) {
      const deleted = await supabase.from("package_hotels").delete().eq("package_id", pkgId);
      if (deleted.error) {
        setBusy(false);
        toast.error(deleted.error.message);
        return;
      }
      if (hotelIds.length) {
        const linked = await supabase
          .from("package_hotels")
          .insert(hotelIds.map((hid) => ({ package_id: pkgId!, hotel_id: hid })));
        if (linked.error) {
          setBusy(false);
          toast.error(linked.error.message);
          return;
        }
      }
    }
    setBusy(false);
    toast.success(initial ? "تم تحديث الباكدج" : "تم إنشاء الباكدج");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "تعديل باكدج" : "إضافة باكدج جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="اسم الباكدج *">
            <Input
              value={form.package_name ?? ""}
              onChange={(e) => set("package_name", e.target.value)}
            />
          </F>
          <F label="النوع">
            <Input
              value={form.package_type ?? ""}
              onChange={(e) => set("package_type", e.target.value)}
              placeholder="عائلي / شهر عسل / VIP…"
            />
          </F>
          <F label="المنطقة">
            <Select
              value={form.region ?? "none"}
              onValueChange={(v) => set("region", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— غير محدد —</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="المجموعة الفندقية">
            <Select
              value={form.hotel_group_id ?? "none"}
              onValueChange={(v) => set("hotel_group_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— لا شيء —</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="نظام الإقامة الافتراضي">
            <Select
              value={form.default_meal_plan ?? "none"}
              onValueChange={(v) => set("default_meal_plan", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— لا شيء —</SelectItem>
                {MEAL_PLANS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="أساس التسعير الافتراضي">
            <Select
              value={form.default_pricing_basis ?? "none"}
              onValueChange={(v) => set("default_pricing_basis", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— لا شيء —</SelectItem>
                {PRICING_BASIS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="الوصف" wide>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </F>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs text-muted-foreground">
              الفنادق المضمنة ({hotelIds.length})
            </Label>
            <div className="max-h-60 overflow-y-auto border rounded-md p-3 space-y-1.5 bg-secondary/30">
              {filteredHotels.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  لا توجد فنادق. أضف فنادق أولاً من مكتبة الفنادق.
                </div>
              ) : (
                filteredHotels.map((h) => (
                  <label
                    key={h.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-background cursor-pointer"
                  >
                    <Checkbox
                      checked={hotelIds.includes(h.id)}
                      onCheckedChange={(v) =>
                        setHotelIds((ids) => (v ? [...ids, h.id] : ids.filter((x) => x !== h.id)))
                      }
                    />
                    <span className="text-sm">{h.hotel_name}</span>
                    <span className="text-xs text-muted-foreground">— {h.region}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
