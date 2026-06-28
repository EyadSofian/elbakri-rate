import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  CalendarRange,
  Bed,
  Utensils,
  Plus,
  MapPin,
  ArrowRight,
  Eye,
  Download,
  MessageCircle,
  CheckSquare,
  Send,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PackageBulkActions } from "@/components/PackageBulkActions";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney, fmtRange, type HotelRate } from "@/lib/rates";
import type { Hotel, HotelGroup, Package, PackageHotel } from "@/lib/library";
import {
  useActiveQuote,
  useQuoteItems,
  useAddRateToQuote,
  useAddRatesToQuote,
  useRemoveRateFromQuote,
} from "@/lib/quoteService";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/packages/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الباكدج — ELBAKRI" }] }),
  component: PackageDetail,
});

function PackageDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const canEdit = profile?.role === "admin" || profile?.role === "operations";
  const { data: activeQuote } = useActiveQuote();
  const { data: quoteItems = [] } = useQuoteItems(activeQuote?.id);
  const addRate = useAddRateToQuote();
  const addRates = useAddRatesToQuote();
  const removeRate = useRemoveRateFromQuote(activeQuote?.id);
  const ids = useMemo(() => quoteItems.map((qi) => qi.hotel_rate_id), [quoteItems]);
  const selectedQuoteIds = useMemo(() => new Set(ids), [ids]);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const toggleSel = (rid: string) =>
    setSelectedSet((p) => {
      const n = new Set(p);
      if (n.has(rid)) n.delete(rid);
      else n.add(rid);
      return n;
    });
  const toggleHotelSel = (rs: HotelRate[]) =>
    setSelectedSet((p) => {
      const n = new Set(p);
      const allIn = rs.every((r) => n.has(r.id));
      rs.forEach((r) => (allIn ? n.delete(r.id) : n.add(r.id)));
      return n;
    });

  const { data: pkg } = useQuery({
    queryKey: ["package", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Package | null;
    },
  });
  const { data: group } = useQuery({
    queryKey: ["package_group", pkg?.hotel_group_id],
    enabled: !!pkg?.hotel_group_id,
    queryFn: async () =>
      (await supabase.from("hotel_groups").select("*").eq("id", pkg!.hotel_group_id!).single())
        .data as HotelGroup,
  });
  const { data: hotels = [] } = useQuery({
    queryKey: ["package_hotels", id],
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
    queryKey: ["package_rates", id, profile?.role],
    queryFn: async () => {
      let qb = supabase.from("hotel_rates").select("*").eq("package_id", id);
      if (profile?.role === "sales" || profile?.role === "viewer") qb = qb.eq("status", "Ready");
      const { data, error } = await qb.order("adult_price", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HotelRate[];
    },
  });

  const byHotel = useMemo(() => {
    const m = new Map<string, HotelRate[]>();
    rates.forEach((r) => {
      const key = r.hotel_id ?? r.hotel_name;
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    });
    return m;
  }, [rates]);

  const dateRange = useMemo(() => {
    if (!rates.length) return null;
    const from = rates.map((r) => r.date_from).sort()[0];
    const to = rates
      .map((r) => r.date_to)
      .sort()
      .reverse()[0];
    return { from, to };
  }, [rates]);

  const readyCount = rates.filter((r) => r.status === "Ready").length;

  const addAll = (rs: HotelRate[]) => {
    const missing = rs.filter((r) => !selectedQuoteIds.has(r.id)).map((r) => r.id);
    addRates.mutate(missing);
  };

  const copyWA = async () => {
    const lines = [
      `*${pkg?.package_name ?? "باقة"}*`,
      `ELBAKRI OVERSEAS`,
      ``,
      ...Array.from(byHotel.entries()).flatMap(([, rs]) => [
        `🏨 ${rs[0].hotel_name}`,
        ...rs.map(
          (r) => `   ${r.room_type} ${r.meal_plan} — ${fmtMoney(r.adult_price, r.currency)}`,
        ),
        ``,
      ]),
    ].join("\n");
    await navigator.clipboard.writeText(lines);
    toast.success("تم نسخ نص واتساب");
  };

  if (!pkg) return <div className="p-12 text-center text-muted-foreground">جاري التحميل…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            to="/packages"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowRight className="size-3" />
            العودة للباكدجات
          </Link>
          <h1 className="text-2xl font-bold mt-1">{pkg.package_name}</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
            {group && <span>{group.name}</span>}
            {pkg.region && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {pkg.region}
              </span>
            )}
            {dateRange && (
              <span className="flex items-center gap-1">
                <CalendarRange className="size-3" />
                {fmtRange(dateRange.from, dateRange.to)}
              </span>
            )}
            <span className="text-emerald-600">{readyCount} عرض جاهز</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="lg"
            onClick={() => router.navigate({ to: "/sales/packages/$id", params: { id } })}
          >
            <Send className="size-4 me-2" />
            تجهيز عرض للعميل (PDF / واتساب)
          </Button>
          <Button variant="outline" onClick={copyWA}>
            <MessageCircle className="size-4 me-2" />
            نسخ واتساب
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="size-4 me-2" />
            طباعة / PDF
          </Button>
          {canEdit && (
            <Button
              onClick={() => router.navigate({ to: "/packages/$id/add-rates", params: { id } })}
            >
              <Plus className="size-4 me-2" />
              إضافة أسعار (مصفوفة)
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-sm">الفنادق المضمنة ({hotels.length})</h2>
            {hotels.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                لم يتم ربط فنادق بهذا الباكدج بعد.
              </div>
            ) : (
              hotels.map((h) => (
                <div key={h.id} className="text-sm flex items-center gap-2">
                  <Building2 className="size-3.5 text-primary" />
                  <span>{h.hotel_name}</span>
                  <span className="text-xs text-muted-foreground ms-auto">{h.region}</span>
                </div>
              ))
            )}
            {pkg.description && (
              <div className="text-xs text-muted-foreground pt-3 border-t">{pkg.description}</div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {rates.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                لا توجد أسعار لهذا الباكدج بعد.
              </CardContent>
            </Card>
          ) : (
            Array.from(byHotel.entries()).map(([key, rs]) => (
              <Card key={key}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold flex items-center gap-2">
                      {canEdit && (
                        <Checkbox
                          checked={rs.every((r) => selectedSet.has(r.id))}
                          onCheckedChange={() => toggleHotelSel(rs)}
                        />
                      )}
                      <Building2 className="size-4 text-primary" />
                      {rs[0].hotel_name}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addRates.isPending}
                        onClick={() => addAll(rs)}
                      >
                        <Plus className="size-3.5 me-1" />
                        أضف الكل لعرض السعر
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rs.map((r) => {
                      const selected = selectedQuoteIds.has(r.id);
                      return (
                        <div
                          key={r.id}
                          className={`p-3 rounded-md border transition flex items-start gap-2 ${selected ? "bg-primary/10 border-primary" : "bg-secondary/30 hover:bg-secondary/60"}`}
                        >
                          {canEdit && (
                            <Checkbox
                              className="mt-1"
                              checked={selectedSet.has(r.id)}
                              onCheckedChange={() => toggleSel(r.id)}
                            />
                          )}
                          <button
                            onClick={() => {
                              if (selected) removeRate.mutate(r.id);
                              else addRate.mutate(r.id);
                            }}
                            disabled={addRate.isPending || removeRate.isPending}
                            className="flex-1 text-start"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs flex items-center gap-2">
                                <Bed className="size-3" />
                                {r.room_type}
                                <Utensils className="size-3" />
                                {r.meal_plan}
                              </div>
                              <div className="font-bold text-primary">
                                {fmtMoney(r.adult_price, r.currency)}
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {fmtRange(r.date_from, r.date_to)}
                            </div>
                            <div className="text-[11px] font-medium mt-2 text-primary">
                              {selected
                                ? "مضاف لعرض السعر - اضغط للإزالة"
                                : "اضغط للإضافة لعرض السعر"}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {canEdit && selectedSet.size > 0 && (
        <PackageBulkActions
          packageId={id}
          selected={rates.filter((r) => selectedSet.has(r.id))}
          hotels={hotels}
          onClear={() => setSelectedSet(new Set())}
        />
      )}

      {ids.length > 0 && selectedSet.size === 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center print:hidden z-50">
          <Button
            size="lg"
            className="shadow-lg"
            onClick={() => router.navigate({ to: "/quotes/new" })}
          >
            <Eye className="size-4 me-2" />
            متابعة عرض السعر ({ids.length})
          </Button>
        </div>
      )}
    </div>
  );
}
