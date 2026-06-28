import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useRef, useState, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarRange,
  Bed,
  Utensils,
  MapPin,
  ArrowRight,
  Download,
  Image as ImageIcon,
  MessageCircle,
  Eye,
  EyeOff,
  FileText,
  Filter,
  X,
  Car,
  Baby,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, fmtMoney, fmtRange, type HotelRate } from "@/lib/rates";
import type { Hotel, HotelGroup, Package, PackageHotel } from "@/lib/library";
import {
  useActiveQuote,
  useQuoteItems,
  useAddRateToQuote,
  useAddRatesToQuote,
  useRemoveRateFromQuote,
} from "@/lib/quoteService";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import logoAsset from "@/assets/elbakri-logo.png.asset.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales/packages/$id")({
  head: () => ({ meta: [{ title: "عرض الباقة للعميل — ELBAKRI" }] }),
  component: SalesPackageView,
});

interface Filters {
  hotelId: string; // "all" or hotel id/name key
  dateFrom: string; // yyyy-mm-dd
  dateTo: string;
  roomType: string; // "all" or value
  mealPlan: string;
  maxPrice: string; // numeric string
  transferOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  hotelId: "all",
  dateFrom: "",
  dateTo: "",
  roomType: "all",
  mealPlan: "all",
  maxPrice: "",
  transferOnly: false,
};

function SalesPackageView() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { data: activeQuote } = useActiveQuote();
  const { data: quoteItems = [] } = useQuoteItems(activeQuote?.id);
  const addRate = useAddRateToQuote();
  const addRates = useAddRatesToQuote();
  const removeRate = useRemoveRateFromQuote(activeQuote?.id);
  const exportRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [previewMode, setPreviewMode] = useState(false);
  const [clientName, setClientName] = useState("");

  const { data: pkg } = useQuery({
    queryKey: ["sales_pkg", id],
    queryFn: async () =>
      (await supabase.from("packages").select("*").eq("id", id).maybeSingle())
        .data as Package | null,
  });
  const { data: group } = useQuery({
    queryKey: ["sales_pkg_group", pkg?.hotel_group_id],
    enabled: !!pkg?.hotel_group_id,
    queryFn: async () =>
      (await supabase.from("hotel_groups").select("*").eq("id", pkg!.hotel_group_id!).single())
        .data as HotelGroup,
  });
  const { data: linkedHotels = [] } = useQuery({
    queryKey: ["sales_pkg_hotels", id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("package_hotels")
        .select("hotel_id")
        .eq("package_id", id);
      const hids = (links as PackageHotel[] | null)?.map((l) => l.hotel_id) ?? [];
      if (!hids.length) return [] as Hotel[];
      const { data } = await supabase.from("hotels").select("*").in("id", hids);
      return (data ?? []) as Hotel[];
    },
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["sales_pkg_rates", id],
    queryFn: async () => {
      // Sales-style view: always limit to Ready, regardless of viewer role
      const { data, error } = await supabase
        .from("hotel_rates")
        .select("*")
        .eq("package_id", id)
        .eq("status", "Ready")
        .order("adult_price", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HotelRate[];
    },
  });

  const hotelMap = useMemo(() => {
    const m = new Map<string, Hotel>();
    linkedHotels.forEach((h) => m.set(h.id, h));
    return m;
  }, [linkedHotels]);

  // Selected = the rate ids in the user's active draft quote
  const selected = useMemo(() => new Set(quoteItems.map((qi) => qi.hotel_rate_id)), [quoteItems]);

  // Distinct values for filter selects
  const roomTypes = useMemo(
    () => Array.from(new Set(rates.map((r) => r.room_type).filter(Boolean))) as string[],
    [rates],
  );
  const mealPlans = useMemo(
    () => Array.from(new Set(rates.map((r) => r.meal_plan).filter(Boolean))) as string[],
    [rates],
  );
  const hotelOptions = useMemo(() => {
    const m = new Map<string, string>();
    rates.forEach((r) => {
      const key = r.hotel_id ?? r.hotel_name;
      if (key && !m.has(key)) m.set(key, r.hotel_name);
    });
    return Array.from(m.entries()).map(([key, name]) => ({ key, name }));
  }, [rates]);

  const filtered = useMemo(() => {
    const max = filters.maxPrice ? Number(filters.maxPrice) : Infinity;
    return rates.filter((r) => {
      const key = r.hotel_id ?? r.hotel_name;
      if (filters.hotelId !== "all" && key !== filters.hotelId) return false;
      if (filters.roomType !== "all" && r.room_type !== filters.roomType) return false;
      if (filters.mealPlan !== "all" && r.meal_plan !== filters.mealPlan) return false;
      if (filters.dateFrom && r.date_to && r.date_to < filters.dateFrom) return false;
      if (filters.dateTo && r.date_from && r.date_from > filters.dateTo) return false;
      if (r.adult_price != null && r.adult_price > max) return false;
      if (filters.transferOnly) {
        const t = (r.transfer_included || "").toLowerCase();
        if (!t || ["no", "لا", "غير"].some((x) => t.includes(x))) return false;
      }
      return true;
    });
  }, [rates, filters]);

  const grouped = useMemo(() => {
    const m = new Map<string, HotelRate[]>();
    filtered.forEach((r) => {
      const k = r.hotel_id ?? r.hotel_name;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    });
    return m;
  }, [filtered]);

  const selectedRates = useMemo(() => rates.filter((r) => selected.has(r.id)), [rates, selected]);
  const selectedGrouped = useMemo(() => {
    const m = new Map<string, HotelRate[]>();
    selectedRates.forEach((r) => {
      const k = r.hotel_id ?? r.hotel_name;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    });
    return m;
  }, [selectedRates]);

  const toggle = (rid: string) => {
    if (selected.has(rid)) removeRate.mutate(rid);
    else addRate.mutate(rid);
  };

  const createQuote = () => {
    if (!selectedRates.length) return toast.error("اختر عرضًا أو أكثر أولًا");
    router.navigate({ to: "/quotes/new" });
  };

  const waMessage = () => {
    const lines = [
      `*ELBAKRI OVER SEAS FOR TRAVEL*`,
      `*${pkg?.package_name ?? "باقة"}*`,
      pkg?.region ? `📍 ${pkg.region}` : "",
      clientName ? `العميل: ${clientName}` : "",
      ``,
      ...Array.from(selectedGrouped.entries()).flatMap(([, rs]) => [
        `🏨 *${rs[0].hotel_name}*`,
        ...rs.map(
          (r) =>
            `   • ${fmtRange(r.date_from, r.date_to)} — ${r.room_type} / ${r.meal_plan} — *${fmtMoney(r.adult_price, r.currency)}*`,
        ),
        ``,
      ]),
      `📅 ${fmtDate(new Date().toISOString())}`,
    ]
      .filter(Boolean)
      .join("\n");
    return lines;
  };

  const copyWA = async () => {
    if (!selectedRates.length) return toast.error("اختر عرضًا أو أكثر أولًا");
    await navigator.clipboard.writeText(waMessage());
    toast.success("تم نسخ رسالة الواتساب");
  };

  const renderExport = async () => {
    if (!exportRef.current) return null;
    return await toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
  };

  const exportPNG = async () => {
    if (!selectedRates.length) return toast.error("اختر عرضًا أو أكثر أولًا");
    try {
      const dataUrl = await renderExport();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.download = `${pkg?.package_name ?? "offer"}.png`;
      a.href = dataUrl;
      a.click();
      toast.success("تم تنزيل الصورة");
    } catch (e) {
      toast.error("فشل التصدير: " + (e instanceof Error ? e.message : ""));
    }
  };

  const exportPDF = async () => {
    if (!selectedRates.length) return toast.error("اختر عرضًا أو أكثر أولًا");
    try {
      const dataUrl = await renderExport();
      if (!dataUrl) return;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((r) => {
        img.onload = r;
      });
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${pkg?.package_name ?? "offer"}.pdf`);
      toast.success("تم تنزيل PDF");
    } catch (e) {
      toast.error("فشل التصدير: " + (e instanceof Error ? e.message : ""));
    }
  };

  if (!pkg) return <div className="p-12 text-center text-muted-foreground">جاري التحميل…</div>;

  // ===== CLIENT PREVIEW (full-screen) =====
  if (previewMode) {
    return (
      <div className="min-h-screen bg-[hsl(210_28%_96%)] p-4 md:p-8" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex gap-2 flex-wrap print:hidden">
            <Button variant="outline" onClick={() => setPreviewMode(false)}>
              <EyeOff className="size-4 me-2" />
              العودة لوضع العمل
            </Button>
            <Button variant="outline" onClick={exportPNG}>
              <ImageIcon className="size-4 me-2" />
              PNG
            </Button>
            <Button variant="outline" onClick={exportPDF}>
              <Download className="size-4 me-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={copyWA}>
              <MessageCircle className="size-4 me-2" />
              نسخ واتساب
            </Button>
          </div>
          <ClientExport
            ref={exportRef}
            pkg={pkg}
            group={group ?? null}
            grouped={selectedGrouped.size ? selectedGrouped : grouped}
            clientName={clientName}
            salesName={profile?.full_name ?? ""}
            hotelMap={hotelMap}
          />
        </div>
      </div>
    );
  }

  // ===== SALES WORK MODE =====
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1500px] mx-auto" dir="rtl">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border bg-sidebar text-sidebar-foreground shadow-sm">
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-lg bg-white p-1.5 grid place-items-center shadow">
              <img src={logoAsset.url} alt="ELBAKRI" className="size-full object-contain" />
            </div>
            <div>
              <div className="text-xs opacity-80">ELBAKRI OVER SEAS FOR TRAVEL</div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{pkg.package_name}</h1>
              <div className="text-sm opacity-90 flex items-center gap-3 flex-wrap mt-1">
                {pkg.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {pkg.region}
                  </span>
                )}
                {group && <span>· {group.name}</span>}
                <span>· {fmtDate(new Date().toISOString())}</span>
                {profile?.full_name && <span>· {profile.full_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/packages/$id"
              params={{ id }}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              <ArrowRight className="size-3 inline" /> عرض الباقة الإداري
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 pb-24 lg:pb-0">
        {/* MAIN */}
        <div className="space-y-4 min-w-0">
          {/* Filters */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm inline-flex items-center gap-2">
                  <Filter className="size-4 text-primary" /> الفلاتر
                </div>
                {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
                  <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                    <X className="size-3 me-1" /> مسح
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <FilterField label="الفندق">
                  <Select
                    value={filters.hotelId}
                    onValueChange={(v) => setFilters((f) => ({ ...f, hotelId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {hotelOptions.map((h) => (
                        <SelectItem key={h.key} value={h.key}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="من تاريخ">
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </FilterField>
                <FilterField label="إلى تاريخ">
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </FilterField>
                <FilterField label="نوع الغرفة">
                  <Select
                    value={filters.roomType}
                    onValueChange={(v) => setFilters((f) => ({ ...f, roomType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {roomTypes.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="الإقامة">
                  <Select
                    value={filters.mealPlan}
                    onValueChange={(v) => setFilters((f) => ({ ...f, mealPlan: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {mealPlans.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="أقصى سعر">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                  />
                </FilterField>
              </div>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={filters.transferOnly}
                  onCheckedChange={(v) => setFilters((f) => ({ ...f, transferOnly: !!v }))}
                />
                <Car className="size-3.5" /> الانتقالات مشمولة فقط
              </label>
            </CardContent>
          </Card>

          {/* Hotel cards */}
          {grouped.size === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                لا توجد عروض مطابقة
              </CardContent>
            </Card>
          ) : (
            Array.from(grouped.entries()).map(([key, rs]) => {
              const hotel = rs[0].hotel_id ? hotelMap.get(rs[0].hotel_id) : undefined;
              const allSelected = rs.every((r) => selected.has(r.id));
              return (
                <Card key={key} className="overflow-hidden border-2">
                  <div className="bg-gradient-to-l from-sidebar/5 via-transparent to-transparent p-4 border-b">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-bold text-lg flex items-center gap-2">
                          <Building2 className="size-5 text-primary" />
                          {rs[0].hotel_name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                          {rs[0].hotel_group && <span>{rs[0].hotel_group}</span>}
                          {rs[0].region && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {rs[0].region}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]"
                          >
                            <Star className="size-2.5 me-1" /> جاهز
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={allSelected ? "default" : "outline"}
                        disabled={addRate.isPending || addRates.isPending || removeRate.isPending}
                        onClick={() => {
                          if (allSelected) rs.forEach((r) => removeRate.mutate(r.id));
                          else
                            addRates.mutate(rs.filter((r) => !selected.has(r.id)).map((r) => r.id));
                        }}
                      >
                        {allSelected ? "إلغاء تحديد الكل" : "تحديد كل الأسعار"}
                      </Button>
                    </div>
                    {(hotel?.facilities ||
                      hotel?.child_policy_default ||
                      hotel?.transfer_notes_default) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                        {hotel?.facilities && (
                          <InfoChip icon={Star} label="المرافق">
                            {hotel.facilities}
                          </InfoChip>
                        )}
                        {hotel?.child_policy_default && (
                          <InfoChip icon={Baby} label="سياسة الأطفال">
                            {hotel.child_policy_default}
                          </InfoChip>
                        )}
                        {hotel?.transfer_notes_default && (
                          <InfoChip icon={Car} label="الانتقالات">
                            {hotel.transfer_notes_default}
                          </InfoChip>
                        )}
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {rs.map((r) => {
                        const isSel = selected.has(r.id);
                        return (
                          <label
                            key={r.id}
                            className={cn(
                              "p-3 rounded-lg border-2 cursor-pointer transition flex items-start gap-3",
                              isSel
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40 bg-card",
                            )}
                          >
                            <Checkbox
                              checked={isSel}
                              disabled={addRate.isPending || removeRate.isPending}
                              onCheckedChange={() => toggle(r.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold inline-flex items-center gap-1">
                                  <CalendarRange className="size-3.5 text-muted-foreground" />
                                  {fmtRange(r.date_from, r.date_to)}
                                </div>
                                <div className="text-end">
                                  <div className="text-lg font-bold text-[hsl(38_92%_45%)] leading-none">
                                    {fmtMoney(r.adult_price, r.currency)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {r.pricing_basis || "للشخص"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Bed className="size-3" />
                                  {r.room_type}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Utensils className="size-3" />
                                  {r.meal_plan}
                                </span>
                                {r.transfer_included && (
                                  <span className="inline-flex items-center gap-1">
                                    <Car className="size-3" />
                                    {r.transfer_included}
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* SIDE PANEL (desktop only) */}
        <aside className="hidden lg:block lg:sticky lg:top-4 self-start space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold inline-flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> العروض المحددة
                </div>
                <Badge className="bg-primary text-primary-foreground">{selectedRates.length}</Badge>
              </div>

              <div>
                <Label className="text-xs">اسم العميل (اختياري)</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="ضع اسم العميل"
                />
              </div>

              {selectedRates.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-4 text-center">
                  اختر عرضًا أو أكثر لإنشاء عرض للعميل
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pe-1">
                  {selectedRates.map((r) => (
                    <div
                      key={r.id}
                      className="text-xs p-2 rounded-md border bg-card flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.hotel_name}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {r.room_type} · {r.meal_plan} · {fmtMoney(r.adult_price, r.currency)}
                        </div>
                      </div>
                      <button
                        onClick={() => toggle(r.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Button className="w-full" onClick={() => setPreviewMode(true)} variant="secondary">
                  <Eye className="size-4 me-2" /> معاينة قبل التصدير
                </Button>
                <Button className="w-full" onClick={createQuote} disabled={!selectedRates.length}>
                  <FileText className="size-4 me-2" /> إنشاء عرض سعر
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={exportPNG} disabled={!selectedRates.length}>
                    <ImageIcon className="size-4 me-1" /> PNG
                  </Button>
                  <Button variant="outline" onClick={exportPDF} disabled={!selectedRates.length}>
                    <Download className="size-4 me-1" /> PDF
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={copyWA}
                  disabled={!selectedRates.length}
                >
                  <MessageCircle className="size-4 me-2" /> نسخ رسالة واتساب
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile sticky bottom action bar */}
      <div className="lg:hidden fixed bottom-14 inset-x-0 z-30 bg-card border-t shadow-lg safe-bottom print:hidden">
        <div className="p-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-foreground">العروض المحددة</div>
            <div className="font-bold text-base">{selectedRates.length}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(true)}
            disabled={!selectedRates.length}
          >
            <Eye className="size-4 me-1" /> معاينة
          </Button>
          <Button size="sm" onClick={createQuote} disabled={!selectedRates.length}>
            <FileText className="size-4 me-1" /> إنشاء عرض
          </Button>
        </div>
      </div>

      {/* Off-screen export node (used when exporting from work mode) */}
      <div className="fixed -left-[10000px] top-0 w-[820px] pointer-events-none" aria-hidden>
        <ClientExport
          ref={exportRef}
          pkg={pkg}
          group={group ?? null}
          grouped={selectedGrouped}
          clientName={clientName}
          salesName={profile?.full_name ?? ""}
          hotelMap={hotelMap}
        />
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Car;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-[11px] bg-secondary/60 rounded-md p-2 border">
      <div className="font-semibold text-foreground/80 inline-flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </div>
      <div className="text-muted-foreground line-clamp-2">{children}</div>
    </div>
  );
}

/* =================== CLIENT EXPORT TEMPLATE =================== */

interface ExportProps {
  pkg: Package;
  group: HotelGroup | null;
  grouped: Map<string, HotelRate[]>;
  clientName: string;
  salesName: string;
  hotelMap: Map<string, Hotel>;
}

const ClientExport = forwardRef<HTMLDivElement, ExportProps>(function ClientExport(
  { pkg, group, grouped, clientName, salesName, hotelMap },
  ref,
) {
  return (
    <div
      ref={ref}
      dir="rtl"
      className="bg-white text-[hsl(220_40%_15%)] font-[Cairo,'Cairo',sans-serif] w-[820px] mx-auto shadow-xl rounded-xl overflow-hidden border"
    >
      {/* Header */}
      <div className="bg-sidebar text-sidebar-foreground p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-16 bg-white rounded-lg p-1.5 grid place-items-center">
            <img src={logoAsset.url} alt="ELBAKRI" className="size-full object-contain" />
          </div>
          <div>
            <div className="text-xs opacity-80">ELBAKRI OVER SEAS FOR TRAVEL</div>
            <div className="text-xl font-bold">الباكري لخدمات السفر والسياحة</div>
          </div>
        </div>
        <div className="text-end text-xs opacity-90">
          <div>{fmtDate(new Date().toISOString())}</div>
          {salesName && <div className="mt-1">المسؤول: {salesName}</div>}
        </div>
      </div>

      {/* Title block */}
      <div className="bg-[hsl(210_28%_96%)] px-6 py-5 border-b">
        <div className="text-xs text-muted-foreground">عرض باقة</div>
        <h2 className="text-3xl font-extrabold text-[hsl(220_60%_25%)] leading-tight">
          {pkg.package_name}
        </h2>
        <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
          {pkg.region && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {pkg.region}
            </span>
          )}
          {group && <span>· {group.name}</span>}
        </div>
        {clientName && (
          <div className="mt-3 text-sm">
            <span className="text-muted-foreground">عرض مقدم إلى: </span>
            <span className="font-bold">{clientName}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6 space-y-5 bg-white">
        {grouped.size === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            اختر عرضًا أو أكثر لإنشاء عرض للعميل
          </div>
        ) : (
          Array.from(grouped.entries()).map(([key, rs]) => {
            const hotel = rs[0].hotel_id ? hotelMap.get(rs[0].hotel_id) : undefined;
            return (
              <div
                key={key}
                className="rounded-lg border-2 border-[hsl(220_30%_88%)] overflow-hidden"
              >
                <div className="bg-[hsl(220_50%_22%)] text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <Building2 className="size-4" /> {rs[0].hotel_name}
                  </div>
                  <div className="text-xs opacity-90">
                    {rs[0].hotel_group}
                    {rs[0].region ? ` · ${rs[0].region}` : ""}
                  </div>
                </div>
                <div className="p-3 space-y-2 bg-white">
                  {rs.map((r) => (
                    <div key={r.id} className="rounded-md border bg-[hsl(210_28%_98%)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm space-y-1">
                          <div className="font-semibold inline-flex items-center gap-1">
                            <CalendarRange className="size-3.5" />{" "}
                            {fmtRange(r.date_from, r.date_to)}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Bed className="size-3" />
                              {r.room_type}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Utensils className="size-3" />
                              {r.meal_plan}
                            </span>
                            {r.transfer_included && (
                              <span className="inline-flex items-center gap-1">
                                <Car className="size-3" />
                                {r.transfer_included}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <div className="text-2xl font-extrabold text-[hsl(38_92%_42%)] leading-none">
                            {fmtMoney(r.adult_price, r.currency)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {r.pricing_basis || "للشخص"}
                          </div>
                        </div>
                      </div>
                      {(r.child_policy || r.transfer_details) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t text-[11px]">
                          {r.child_policy && (
                            <div>
                              <span className="font-semibold">سياسة الأطفال: </span>
                              <span className="text-muted-foreground">{r.child_policy}</span>
                            </div>
                          )}
                          {r.transfer_details && (
                            <div>
                              <span className="font-semibold">الانتقالات: </span>
                              <span className="text-muted-foreground">{r.transfer_details}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(hotel?.child_policy_default || hotel?.transfer_notes_default) && (
                    <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded p-2 mt-1">
                      {hotel?.child_policy_default && <div>• {hotel.child_policy_default}</div>}
                      {hotel?.transfer_notes_default && <div>• {hotel.transfer_notes_default}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-sidebar text-sidebar-foreground px-6 py-4 text-center text-xs">
        <div className="font-bold text-sm">ELBAKRI OVER SEAS FOR TRAVEL</div>
        <div className="opacity-80 mt-1">
          الأسعار قابلة للتغيير حسب التوافر · برجاء التأكيد قبل الحجز
        </div>
      </div>
    </div>
  );
});
