import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEAL_PLANS, REGIONS, ROOM_TYPES, TRANSFER_OPTIONS } from "@/lib/constants";
import { fmtMoney, fmtRange, type HotelRate } from "@/lib/rates";
import {
  Building2,
  CalendarRange,
  Bed,
  Utensils,
  Car,
  MapPin,
  Plus,
  Check,
  Package as PackageIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActiveQuote,
  useQuoteItems,
  useAddRateToQuote,
  useAddRatesToQuote,
  useRemoveRateFromQuote,
} from "@/lib/quoteService";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({ meta: [{ title: "عروض المبيعات — ELBAKRI" }] }),
  component: Sales,
});

function Sales() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [room, setRoom] = useState("all");
  const [meal, setMeal] = useState("all");
  const [transfer, setTransfer] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: activeQuote } = useActiveQuote();
  const { data: quoteItems = [] } = useQuoteItems(activeQuote?.id);
  const addRate = useAddRateToQuote();
  const addRates = useAddRatesToQuote();
  const removeRate = useRemoveRateFromQuote(activeQuote?.id);
  const ids = useMemo(() => quoteItems.map((qi) => qi.hotel_rate_id), [quoteItems]);
  const selectedIds = useMemo(() => new Set(ids), [ids]);

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["sales_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_rates")
        .select("*")
        .eq("status", "Ready")
        .order("adult_price", { ascending: true });
      if (error) throw error;
      return data as HotelRate[];
    },
  });

  const filtered = useMemo(
    () =>
      rates.filter((r) => {
        if (region !== "all" && r.region !== region) return false;
        if (room !== "all" && r.room_type !== room) return false;
        if (meal !== "all" && r.meal_plan !== meal) return false;
        if (transfer !== "all" && r.transfer_included !== transfer) return false;
        if (maxPrice && r.adult_price > Number(maxPrice)) return false;
        if (from && r.date_to < from) return false;
        if (to && r.date_from > to) return false;
        if (q) {
          const hay = `${r.hotel_name} ${r.hotel_group ?? ""} ${r.package_name}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rates, region, room, meal, transfer, maxPrice, from, to, q],
  );

  const hotelOnly = useMemo(() => filtered.filter((r) => !r.package_id), [filtered]);
  const packageRates = useMemo(() => filtered.filter((r) => r.package_id), [filtered]);
  const byPackage = useMemo(() => {
    const m = new Map<string, HotelRate[]>();
    packageRates.forEach((r) => {
      const k = r.package_id!;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    });
    return m;
  }, [packageRates]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px]">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">العروض</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} عرض جاهز</p>
        </div>
        {ids.length > 0 && (
          <Button onClick={() => router.navigate({ to: "/quotes/new" })}>
            <Check className="size-4 me-2" />
            متابعة عرض السعر ({ids.length})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <Input placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
          <FSel
            value={region}
            setValue={setRegion}
            opts={REGIONS as readonly string[]}
            label="المنطقة"
          />
          <FSel
            value={room}
            setValue={setRoom}
            opts={ROOM_TYPES as readonly string[]}
            label="الغرفة"
          />
          <FSel
            value={meal}
            setValue={setMeal}
            opts={MEAL_PLANS as readonly string[]}
            label="الإقامة"
          />
          <FSel
            value={transfer}
            setValue={setTransfer}
            opts={TRANSFER_OPTIONS as readonly string[]}
            label="الانتقالات"
          />
          <Input
            type="number"
            placeholder="أقصى سعر"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>
      ) : (
        <Tabs defaultValue="hotels">
          <TabsList>
            <TabsTrigger value="hotels">
              <Building2 className="size-4 me-1.5" />
              عروض الفنادق ({hotelOnly.length})
            </TabsTrigger>
            <TabsTrigger value="packages">
              <PackageIcon className="size-4 me-1.5" />
              عروض الباكدجات ({packageRates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hotels" className="mt-4">
            {hotelOnly.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد عروض فندقية مستقلة مطابقة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {hotelOnly.map((r) => (
                  <RateCard
                    key={r.id}
                    r={r}
                    selected={ids.includes(r.id)}
                    busy={addRate.isPending || removeRate.isPending}
                    onToggle={() =>
                      ids.includes(r.id) ? removeRate.mutate(r.id) : addRate.mutate(r.id)
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="packages" className="mt-4 space-y-4">
            {byPackage.size === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد عروض باكدجات مطابقة
              </div>
            ) : (
              Array.from(byPackage.entries()).map(([pid, rs]) => (
                <Card key={pid}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 font-semibold">
                        <PackageIcon className="size-4 text-primary" />
                        {rs[0].package_name}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.navigate({ to: "/sales/packages/$id", params: { id: pid } })
                          }
                        >
                          عرض العميل
                        </Button>
                        <Button
                          size="sm"
                          disabled={addRates.isPending}
                          onClick={() =>
                            addRates.mutate(
                              rs.filter((r) => !selectedIds.has(r.id)).map((r) => r.id),
                            )
                          }
                        >
                          <Plus className="size-3.5 me-1" />
                          أضف الباكدج
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {rs.map((r) => (
                        <RateCard
                          key={r.id}
                          r={r}
                          selected={ids.includes(r.id)}
                          busy={addRate.isPending || removeRate.isPending}
                          onToggle={() =>
                            ids.includes(r.id) ? removeRate.mutate(r.id) : addRate.mutate(r.id)
                          }
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function RateCard({
  r,
  selected,
  busy,
  onToggle,
}: {
  r: HotelRate;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={selected ? "ring-2 ring-primary" : ""}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              {r.hotel_name}
            </div>
            <div className="text-xs text-muted-foreground">{r.hotel_group}</div>
          </div>
          <div className="text-end shrink-0">
            <div className="text-2xl font-bold text-primary">
              {fmtMoney(r.adult_price, r.currency)}
            </div>
            <div className="text-[10px] text-muted-foreground">{r.pricing_basis}</div>
          </div>
        </div>
        {r.package_name && (
          <div className="text-sm font-medium text-foreground/80">{r.package_name}</div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <Info icon={MapPin}>{r.region}</Info>
          <Info icon={CalendarRange}>{fmtRange(r.date_from, r.date_to)}</Info>
          <Info icon={Bed}>{r.room_type}</Info>
          <Info icon={Utensils}>{r.meal_plan}</Info>
          <Info icon={Car}>{r.transfer_included || "—"}</Info>
        </div>
        {r.child_policy && (
          <div className="text-xs bg-secondary/60 rounded-md p-2 line-clamp-2">
            {r.child_policy}
          </div>
        )}
        <Button
          variant={selected ? "secondary" : "default"}
          className="w-full"
          disabled={busy}
          onClick={onToggle}
        >
          {selected ? (
            <>
              <Check className="size-4 me-2" />
              تمت الإضافة
            </>
          ) : (
            <>
              <Plus className="size-4 me-2" />
              أضف لعرض السعر
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function FSel({
  value,
  setValue,
  opts,
  label,
}: {
  value: string;
  setValue: (s: string) => void;
  opts: readonly string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: الكل</SelectItem>
        {opts.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Info({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}
