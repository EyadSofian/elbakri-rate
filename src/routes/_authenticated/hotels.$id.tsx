import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  Building2,
  MapPin,
  Star,
  Plus,
  Grid3x3,
  Package as PackageIcon,
  Bed,
  Utensils,
  CalendarRange,
  CalendarPlus,
} from "lucide-react";
import type { Hotel, HotelGroup, Package } from "@/lib/library";
import { fmtMoney, fmtRange, statusBadgeClass, statusLabel, type HotelRate } from "@/lib/rates";
import type { RateStatus } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { HotelRatePeriodsDialog } from "@/components/HotelRatePeriodsDialog";

export const Route = createFileRoute("/_authenticated/hotels/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الفندق — ELBAKRI" }] }),
  component: HotelDetail,
});

function HotelDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canEdit = profile?.role === "admin" || profile?.role === "operations";
  const qc = useQueryClient();
  const [periodsOpen, setPeriodsOpen] = useState(false);

  const { data: hotel } = useQuery({
    queryKey: ["hotel", id],
    queryFn: async () =>
      (await supabase.from("hotels").select("*").eq("id", id).maybeSingle()).data as Hotel | null,
  });
  const { data: group } = useQuery({
    queryKey: ["hotel_group_of", hotel?.hotel_group_id],
    enabled: !!hotel?.hotel_group_id,
    queryFn: async () =>
      (await supabase.from("hotel_groups").select("*").eq("id", hotel!.hotel_group_id!).single())
        .data as HotelGroup,
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["hotel_rates_of", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("hotel_rates")
        .select("*")
        .eq("hotel_id", id)
        .order("date_from");
      return (data ?? []) as HotelRate[];
    },
  });
  const { data: pkgLinks = [] } = useQuery({
    queryKey: ["hotel_package_links", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("package_hotels")
        .select("package_id")
        .eq("hotel_id", id);
      return (data ?? []).map((r) => (r as { package_id: string }).package_id);
    },
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["hotel_packages", pkgLinks],
    enabled: pkgLinks.length > 0,
    queryFn: async () =>
      (await supabase.from("packages").select("*").in("id", pkgLinks)).data as Package[],
  });

  const standalone = useMemo(() => rates.filter((r) => !r.package_id), [rates]);
  const packageRates = useMemo(() => rates.filter((r) => r.package_id), [rates]);

  if (!hotel) return <div className="p-12 text-center text-muted-foreground">جاري التحميل…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">
      <div>
        <Link
          to="/hotels"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowRight className="size-3" />
          العودة لمكتبة الفنادق
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-1">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {hotel.hotel_name}
            </h1>
            <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
              {group && <span>{group.name}</span>}
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {hotel.region}
                {hotel.sub_region ? ` — ${hotel.sub_region}` : ""}
              </span>
              {hotel.star_rating && (
                <span className="flex items-center gap-1">
                  <Star className="size-3 text-amber-500" />
                  {hotel.star_rating}
                </span>
              )}
              <span className="text-emerald-600">
                {rates.filter((r) => r.status === "Ready").length} عرض جاهز
              </span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="rates">الأسعار ({rates.length})</TabsTrigger>
          <TabsTrigger value="packages">الباكدجات ({packages.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-3 text-sm">
              {hotel.address && (
                <div>
                  <span className="text-muted-foreground">العنوان: </span>
                  {hotel.address}
                </div>
              )}
              {hotel.description && <div>{hotel.description}</div>}
              {hotel.facilities && (
                <div>
                  <span className="text-muted-foreground">المرافق: </span>
                  {hotel.facilities}
                </div>
              )}
              {hotel.child_policy_default && (
                <div>
                  <span className="text-muted-foreground">سياسة الأطفال: </span>
                  {hotel.child_policy_default}
                </div>
              )}
              {hotel.transfer_notes_default && (
                <div>
                  <span className="text-muted-foreground">الانتقالات: </span>
                  {hotel.transfer_notes_default}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="mt-4 space-y-3">
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPeriodsOpen(true)}>
                <CalendarPlus className="size-4 me-1.5" />
                إضافة فترات متعددة
              </Button>
              <Button
                size="sm"
                onClick={() => navigate({ to: "/rates/matrix/new", search: { hotelId: id } })}
              >
                <Grid3x3 className="size-4 me-1.5" />
                فترات متعددة (مصفوفة)
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                <Plus className="size-4 me-1.5" />
                إضافة سعر فردي
              </Button>
            </div>
          )}
          {rates.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                لا توجد أسعار لهذا الفندق بعد.
              </CardContent>
            </Card>
          ) : (
            <>
              <RateGroup title="أسعار مستقلة" rates={standalone} />
              <RateGroup title="أسعار داخل باكدجات" rates={packageRates} />
            </>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-4 space-y-3">
          {packages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                هذا الفندق غير مرتبط بأي باكدج.
              </CardContent>
            </Card>
          ) : (
            packages.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="size-4 text-primary" />
                    <span className="font-medium">{p.package_name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/packages/$id", params: { id: p.id } })}
                  >
                    عرض
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {hotel && (
        <HotelRatePeriodsDialog
          open={periodsOpen}
          onOpenChange={setPeriodsOpen}
          hotel={hotel}
          group={group ?? null}
          packages={packages}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["hotel_rates_of", id] });
            qc.invalidateQueries({ queryKey: ["sales_rates"] });
            qc.invalidateQueries({ queryKey: ["package_rate_counts"] });
            qc.invalidateQueries({ queryKey: ["package_rates"] });
          }}
        />
      )}
    </div>
  );
}

function RateGroup({ title, rates }: { title: string; rates: HotelRate[] }) {
  if (!rates.length) return null;
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <h3 className="font-semibold text-sm">
          {title} ({rates.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {rates.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-md border bg-secondary/30 flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <CalendarRange className="size-3" />
                  {fmtRange(r.date_from, r.date_to)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Bed className="size-3" />
                  {r.room_type}
                  <Utensils className="size-3" />
                  {r.meal_plan}
                </div>
                {r.package_name && (
                  <div className="text-[11px] text-primary truncate">📦 {r.package_name}</div>
                )}
              </div>
              <div className="text-end shrink-0">
                <div className="font-bold text-primary">{fmtMoney(r.adult_price, r.currency)}</div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadgeClass(r.status as RateStatus)}`}
                >
                  {statusLabel(r.status as RateStatus)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
