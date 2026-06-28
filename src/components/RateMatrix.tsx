import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCIES,
  MEAL_PLANS,
  PRICING_BASIS,
  ROOM_TYPES,
  TRANSFER_OPTIONS,
} from "@/lib/constants";
import type { Hotel, HotelGroup, Package, PackageHotel } from "@/lib/library";
import { toast } from "sonner";
import { triggerSheetSync } from "@/lib/syncSheets";
import { Plus, Trash2, Calendar, Bed } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  defaultPackageId?: string;
  defaultHotelIds?: string[];
  lockPackage?: boolean;
  onDone?: () => void;
}

interface Period {
  id: string;
  date_from: string;
  date_to: string;
  season_name: string;
  prices: Record<string, string>; // roomType -> price (string for inputs)
}

const DEFAULT_ROOMS = ["Double", "Triple", "Single"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function makePeriod(rooms: string[]): Period {
  return {
    id: uid(),
    date_from: "",
    date_to: "",
    season_name: "",
    prices: Object.fromEntries(rooms.map((r) => [r, ""])),
  };
}

export function RateMatrix({ defaultPackageId, defaultHotelIds, lockPackage, onDone }: Props) {
  const navigate = useNavigate();
  const [packageId, setPackageId] = useState<string>(defaultPackageId ?? "none");
  const [hotelIds, setHotelIds] = useState<string[]>(defaultHotelIds ?? []);
  const [rooms, setRooms] = useState<string[]>(DEFAULT_ROOMS);
  const [customRoom, setCustomRoom] = useState("");
  const [periods, setPeriods] = useState<Period[]>([makePeriod(DEFAULT_ROOMS)]);
  const [meal, setMeal] = useState<string>("HB");
  const [basis, setBasis] = useState<string>("Per person per night");
  const [currency, setCurrency] = useState<string>("EGP");
  const [transfer, setTransfer] = useState<string>("Optional");
  const [childPolicy, setChildPolicy] = useState("");
  const [transferDetails, setTransferDetails] = useState("");
  const [status, setStatus] = useState<"Draft" | "Ready">("Ready");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages_matrix"],
    queryFn: async () =>
      (await supabase.from("packages").select("*").order("package_name")).data as Package[],
  });
  const { data: links = [] } = useQuery({
    queryKey: ["package_hotels_matrix"],
    queryFn: async () => (await supabase.from("package_hotels").select("*")).data as PackageHotel[],
  });
  const { data: allHotels = [] } = useQuery({
    queryKey: ["hotels_matrix"],
    queryFn: async () =>
      (await supabase.from("hotels").select("*").order("hotel_name")).data as Hotel[],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups_matrix"],
    queryFn: async () => (await supabase.from("hotel_groups").select("*")).data as HotelGroup[],
  });

  const hasPackage = packageId !== "none";
  const pkg = hasPackage ? packages.find((p) => p.id === packageId) : null;
  const availableHotels = useMemo(() => {
    if (!hasPackage) return allHotels;
    const hids = links.filter((l) => l.package_id === packageId).map((l) => l.hotel_id);
    return allHotels.filter((h) => hids.includes(h.id));
  }, [hasPackage, packageId, links, allHotels]);

  const addRoom = () => {
    const v = customRoom.trim();
    if (!v || rooms.includes(v)) return;
    setRooms((r) => [...r, v]);
    setPeriods((ps) => ps.map((p) => ({ ...p, prices: { ...p.prices, [v]: "" } })));
    setCustomRoom("");
  };
  const removeRoom = (r: string) => {
    setRooms((rs) => rs.filter((x) => x !== r));
    setPeriods((ps) =>
      ps.map((p) => {
        const { [r]: _, ...rest } = p.prices;
        void _;
        return { ...p, prices: rest };
      }),
    );
  };
  const addPeriod = () => setPeriods((ps) => [...ps, makePeriod(rooms)]);
  const dupPeriod = (id: string) =>
    setPeriods((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      if (i < 0) return ps;
      const copy = { ...ps[i], id: uid() };
      return [...ps.slice(0, i + 1), copy, ...ps.slice(i + 1)];
    });
  const removePeriod = (id: string) => setPeriods((ps) => ps.filter((p) => p.id !== id));
  const updPeriod = (id: string, patch: Partial<Period>) =>
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const updPrice = (id: string, room: string, v: string) =>
    setPeriods((ps) =>
      ps.map((p) => (p.id === id ? { ...p, prices: { ...p.prices, [room]: v } } : p)),
    );

  // Build rows preview
  const rows = useMemo(() => {
    const out: Array<{
      hotel_id: string;
      date_from: string;
      date_to: string;
      room_type: string;
      price: number;
      season_name: string;
    }> = [];
    for (const h of hotelIds) {
      for (const p of periods) {
        if (!p.date_from || !p.date_to) continue;
        for (const r of rooms) {
          const raw = p.prices[r];
          const n = Number(raw);
          if (!raw || Number.isNaN(n) || n <= 0) continue;
          out.push({
            hotel_id: h,
            date_from: p.date_from,
            date_to: p.date_to,
            room_type: r,
            price: n,
            season_name: p.season_name,
          });
        }
      }
    }
    return out;
  }, [hotelIds, periods, rooms]);

  const validate = (): string | null => {
    if (hasPackage && !pkg) return "اختر باكدج صحيح أو استخدم فندق فقط";
    if (!hotelIds.length) return "اختر فندق واحد على الأقل";
    for (const p of periods) {
      if (!p.date_from || !p.date_to) return "تواريخ الفترة مطلوبة";
      if (new Date(p.date_to) < new Date(p.date_from))
        return "تاريخ النهاية يجب أن يكون بعد البداية";
    }
    if (!rows.length) return "أدخل سعر واحد على الأقل";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);

    // Check duplicates
    const checks = rows.map((r) => ({
      hotel_id: r.hotel_id,
      date_from: r.date_from,
      date_to: r.date_to,
      room_type: r.room_type,
    }));
    let existingQuery = supabase
      .from("hotel_rates")
      .select("id, hotel_id, date_from, date_to, room_type")
      .in("hotel_id", hotelIds);
    existingQuery = hasPackage
      ? existingQuery.eq("package_id", packageId)
      : existingQuery.is("package_id", null);
    const { data: existing } = await existingQuery;
    const conflicts = (existing ?? []).filter((e) =>
      checks.some(
        (c) =>
          c.hotel_id === e.hotel_id &&
          c.date_from === e.date_from &&
          c.date_to === e.date_to &&
          c.room_type === e.room_type,
      ),
    );
    if (conflicts.length && !overwrite) {
      setBusy(false);
      toast.error(`${conflicts.length} سجل مكرر موجود مسبقاً. فعّل "استبدال الموجود" للمتابعة.`);
      return;
    }
    if (conflicts.length && overwrite) {
      await supabase
        .from("hotel_rates")
        .delete()
        .in(
          "id",
          conflicts.map((c) => c.id),
        );
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const inserts = rows.map((r) => {
      const h = allHotels.find((x) => x.id === r.hotel_id);
      const g = groups.find((x) => x.id === (h?.hotel_group_id ?? pkg?.hotel_group_id ?? ""));
      return {
        package_id: hasPackage ? packageId : null,
        hotel_id: r.hotel_id,
        hotel_group_id_fk: h?.hotel_group_id ?? pkg?.hotel_group_id ?? null,
        hotel_name: h?.hotel_name ?? "",
        hotel_group: g?.name ?? "",
        package_name: pkg?.package_name ?? null,
        region: h?.region ?? pkg?.region ?? "",
        sub_region: h?.sub_region ?? null,
        date_from: r.date_from,
        date_to: r.date_to,
        season_name: r.season_name || null,
        room_type: r.room_type,
        meal_plan: meal,
        pricing_basis: basis,
        currency,
        adult_price: r.price,
        transfer_included: transfer,
        child_policy: childPolicy || h?.child_policy_default || "",
        transfer_details: transferDetails || h?.transfer_notes_default || "",
        status,
        category: "Beach Resort",
        record_id: `RM-${Date.now().toString(36)}-${uid()}`,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      };
    });

    const { error } = await supabase.from("hotel_rates").insert(inserts);
    setBusy(false);
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
      return;
    }
    toast.success(`تم إنشاء ${inserts.length} سجل سعر`);
    void triggerSheetSync({ silent: true });
    if (onDone) onDone();
    else if (hasPackage) navigate({ to: "/packages/$id", params: { id: packageId } });
    else if (hotelIds.length === 1) navigate({ to: "/hotels/$id", params: { id: hotelIds[0] } });
    else navigate({ to: "/dashboard" });
  };

  const toggleHotel = (id: string) =>
    setHotelIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <div className="space-y-4">
      {/* Section 1: Package + Hotels */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{lockPackage ? "الباكدج *" : "الباكدج (اختياري)"}</Label>
              <Select value={packageId} onValueChange={setPackageId} disabled={lockPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الباكدج…" />
                </SelectTrigger>
                <SelectContent>
                  {!lockPackage && <SelectItem value="none">فندق فقط — بدون باكدج</SelectItem>}
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.package_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!lockPackage && (
                <p className="text-xs text-muted-foreground">
                  اتركها "فندق فقط" لو السعر مستقل. اختَر باكدج فقط لو السعر جزء من باقة.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>الحالة عند الحفظ</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "Draft" | "Ready")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">مسودة</SelectItem>
                  <SelectItem value="Ready">جاهز</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>الفنادق * ({hotelIds.length} محدد)</Label>
            {availableHotels.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {hasPackage
                  ? "لا توجد فنادق مرتبطة بهذا الباكدج. اربط فنادق من صفحة الباكدج أولاً."
                  : "لا توجد فنادق بعد. أضف الفنادق من مكتبة الفنادق أولاً."}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-secondary/20">
                {availableHotels.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={hotelIds.includes(h.id)}
                      onCheckedChange={() => toggleHotel(h.id)}
                    />
                    <span className="truncate">{h.hotel_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Shared fields */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="نظام الإقامة">
            <Sel value={meal} onChange={setMeal} options={MEAL_PLANS as readonly string[]} />
          </Field>
          <Field label="أساس التسعير">
            <Sel value={basis} onChange={setBasis} options={PRICING_BASIS as readonly string[]} />
          </Field>
          <Field label="العملة">
            <Sel
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES as readonly string[]}
            />
          </Field>
          <Field label="الانتقالات">
            <Sel
              value={transfer}
              onChange={setTransfer}
              options={TRANSFER_OPTIONS as readonly string[]}
            />
          </Field>
          <div className="col-span-2 space-y-1.5">
            <Label>سياسة الأطفال</Label>
            <Textarea
              rows={2}
              value={childPolicy}
              onChange={(e) => setChildPolicy(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>تفاصيل الانتقالات</Label>
            <Textarea
              rows={2}
              value={transferDetails}
              onChange={(e) => setTransferDetails(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Room types */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="flex items-center gap-2">
              <Bed className="size-4" /> أنواع الغرف
            </Label>
            <div className="flex gap-2 items-center">
              <Select
                value=""
                onValueChange={(v) => {
                  if (v && !rooms.includes(v)) {
                    setRooms((r) => [...r, v]);
                    setPeriods((ps) => ps.map((p) => ({ ...p, prices: { ...p.prices, [v]: "" } })));
                  }
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="+ من القائمة" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.filter((r) => !rooms.includes(r)).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-40"
                placeholder="نوع مخصص…"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={addRoom}>
                <Plus className="size-3.5 me-1" />
                إضافة
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {rooms.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs"
              >
                {r}
                <button
                  type="button"
                  onClick={() => removeRoom(r)}
                  className="text-destructive hover:opacity-70"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Periods matrix */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Calendar className="size-4" /> الفترات والأسعار
            </Label>
            <Button type="button" size="sm" variant="outline" onClick={addPeriod}>
              <Plus className="size-3.5 me-1" />
              فترة جديدة
            </Button>
          </div>
          <div className="space-y-3">
            {periods.map((p, i) => (
              <div key={p.id} className="border rounded-md p-3 space-y-3 bg-secondary/10">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="font-semibold text-sm text-muted-foreground">فترة {i + 1}</div>
                  <div className="space-y-1">
                    <Label className="text-xs">من *</Label>
                    <Input
                      type="date"
                      dir="ltr"
                      value={p.date_from}
                      onChange={(e) => updPeriod(p.id, { date_from: e.target.value })}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">إلى *</Label>
                    <Input
                      type="date"
                      dir="ltr"
                      value={p.date_to}
                      onChange={(e) => updPeriod(p.id, { date_to: e.target.value })}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-32">
                    <Label className="text-xs">اسم الموسم</Label>
                    <Input
                      value={p.season_name}
                      onChange={(e) => updPeriod(p.id, { season_name: e.target.value })}
                      placeholder="مثال: ذروة الصيف"
                    />
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => dupPeriod(p.id)}>
                    نسخ
                  </Button>
                  {periods.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removePeriod(p.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {rooms.map((r) => (
                    <div key={r} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Bed className="size-3" />
                        {r}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        dir="ltr"
                        placeholder="السعر"
                        value={p.prices[r] ?? ""}
                        onChange={(e) => updPrice(p.id, r, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Preview & Save */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="text-sm">
            سيتم إنشاء <span className="font-bold text-primary">{rows.length}</span> سجل سعر
            {hotelIds.length > 1 &&
              ` (${hotelIds.length} فنادق × ${periods.length} فترات × ${rooms.length} أنواع غرف، بعد تخطي الفارغ)`}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
              استبدال المكرر الموجود
            </label>
            <Button onClick={save} disabled={busy || !rows.length}>
              {busy ? "جاري الحفظ…" : `حفظ ${rows.length} سجل`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Sel({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
