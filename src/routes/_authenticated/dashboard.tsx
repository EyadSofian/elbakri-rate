import { createFileRoute, useRouter } from "@tanstack/react-router";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Upload,
  Download,
  Pencil,
  Copy,
  Trash2,
  FileSpreadsheet,
  Grid3x3,
  Image as ImageIcon,
  FileText,
  Package as PackageIcon,
  Building2,
  CalendarRange,
  Bed,
  Utensils,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { RateFormDialog } from "@/components/RateFormDialog";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import { MEAL_PLANS, REGIONS, ROOM_TYPES, STATUSES } from "@/lib/constants";
import { fmtMoney, fmtRange, statusBadgeClass, statusLabel, type HotelRate } from "@/lib/rates";
import { toast } from "sonner";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import { triggerSheetSync } from "@/lib/syncSheets";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import logoAsset from "@/assets/elbakri-logo.png.asset.json";

type OfferGroupKind = "hotel" | "package";
type OfferGroup = {
  id: string;
  title: string;
  subtitle: string;
  kind: OfferGroupKind;
  rates: HotelRate[];
};

function buildOfferGroups(rates: HotelRate[], kind: OfferGroupKind): OfferGroup[] {
  const groups = new Map<string, OfferGroup>();
  rates.forEach((rate) => {
    const id =
      kind === "hotel"
        ? `hotel:${rate.hotel_id ?? rate.hotel_name}`
        : `package:${rate.package_id ?? rate.package_name ?? "unlinked"}`;
    const title = kind === "hotel" ? rate.hotel_name : rate.package_name || "باكدج بدون اسم";
    const subtitle =
      kind === "hotel"
        ? [rate.hotel_group, rate.region].filter(Boolean).join(" · ")
        : [rate.hotel_group, rate.region].filter(Boolean).join(" · ");

    const current = groups.get(id);
    if (current) {
      current.rates.push(rate);
    } else {
      groups.set(id, { id, title, subtitle, kind, rates: [rate] });
    }
  });

  return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title, "ar"));
}

function safeFilename(name: string) {
  return name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function getRangeLabel(rates: HotelRate[]) {
  if (!rates.length) return "—";
  const from = rates.map((r) => r.date_from).sort()[0];
  const to = rates
    .map((r) => r.date_to)
    .sort()
    .reverse()[0];
  return fmtRange(from, to);
}

function getMinPrice(rates: HotelRate[]) {
  const prices = rates.map((r) => r.adult_price).filter((n): n is number => typeof n === "number");
  if (!prices.length) return null;
  return Math.min(...prices);
}

function hasPackage(rate: HotelRate) {
  return Boolean(rate.package_id || rate.package_name);
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة العمليات — ELBAKRI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HotelRate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportGroup, setExportGroup] = useState<OfferGroup | null>(null);
  const [exportBusyKey, setExportBusyKey] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [room, setRoom] = useState("all");
  const [meal, setMeal] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role === "sales") router.navigate({ to: "/sales" });
      else if (profile.role === "viewer") router.navigate({ to: "/packages" });
    }
  }, [profile, loading, router]);

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["hotel_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_rates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as HotelRate[];
    },
  });

  const filtered = useMemo(() => {
    return rates.filter((r) => {
      if (region !== "all" && r.region !== region) return false;
      if (room !== "all" && r.room_type !== room) return false;
      if (meal !== "all" && r.meal_plan !== meal) return false;
      if (status !== "all" && r.status !== status) return false;
      if (from && r.date_to < from) return false;
      if (to && r.date_from > to) return false;
      if (q) {
        const hay =
          `${r.hotel_name} ${r.hotel_group ?? ""} ${r.package_name} ${r.region}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rates, region, room, meal, status, from, to, q]);

  const stats = useMemo(
    () => ({
      total: rates.length,
      ready: rates.filter((r) => r.status === "Ready").length,
      draft: rates.filter((r) => r.status === "Draft").length,
      archived: rates.filter((r) => r.status === "Archived").length,
    }),
    [rates],
  );

  const readyFiltered = useMemo(() => filtered.filter((r) => r.status === "Ready"), [filtered]);
  const standaloneOfferGroups = useMemo(
    () =>
      buildOfferGroups(
        readyFiltered.filter((r) => !hasPackage(r)),
        "hotel",
      ),
    [readyFiltered],
  );
  const packageOfferGroups = useMemo(
    () =>
      buildOfferGroups(
        readyFiltered.filter((r) => hasPackage(r)),
        "package",
      ),
    [readyFiltered],
  );

  const exportOfferGroup = async (group: OfferGroup, format: "png" | "pdf") => {
    const busyKey = `${format}:${group.id}`;
    setExportBusyKey(busyKey);
    setExportGroup(group);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!exportRef.current) throw new Error("Export template not ready");
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const filename = `ELBAKRI-${safeFilename(group.title)}`;
      if (format === "png") {
        const a = document.createElement("a");
        a.download = `${filename}.png`;
        a.href = dataUrl;
        a.click();
      } else {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: [img.width, img.height],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
        pdf.save(`${filename}.pdf`);
      }
      toast.success(format === "png" ? "تم تنزيل PNG" : "تم تنزيل PDF");
    } catch (error) {
      toast.error("تعذر التصدير: " + (error instanceof Error ? error.message : ""));
    } finally {
      setExportBusyKey(null);
      setExportGroup(null);
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hotel_rates"] });
    qc.invalidateQueries({ queryKey: ["sales_rates"] });
    qc.invalidateQueries({ queryKey: ["package_rate_counts"] });
    qc.invalidateQueries({ queryKey: ["package_rates"] });
    qc.invalidateQueries({ queryKey: ["hotel_rates_of"] });
  };

  const isAdmin = profile?.role === "admin";
  const canMutateRate = (r: HotelRate) => isAdmin || r.status !== "Archived";

  const onDelete = async (r: HotelRate) => {
    if (!canMutateRate(r)) {
      toast.error("لا يمكن حذف سجل مؤرشف — يتطلب صلاحية المدير");
      return;
    }
    if (!confirm(`حذف ${r.hotel_name} - ${r.room_type}؟`)) return;
    const { error } = await supabase.from("hotel_rates").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      refresh();
      void triggerSheetSync({ silent: true });
    }
  };

  const onDuplicate = async (r: HotelRate) => {
    if (!canMutateRate(r)) {
      toast.error("لا يمكن نسخ سجل مؤرشف — يتطلب صلاحية المدير");
      return;
    }
    const { id, created_at, updated_at, record_id, ...rest } = r;
    void id;
    void created_at;
    void updated_at;
    const { error } = await supabase.from("hotel_rates").insert({
      ...rest,
      record_id: record_id ? `${record_id}-COPY-${Date.now().toString(36)}` : null,
      status: "Draft",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم إنشاء نسخة كمسودة");
      refresh();
      void triggerSheetSync({ silent: true });
    }
  };

  const onExport = () => {
    const csv = rowsToCSV(filtered);
    downloadCSV(csv, `elbakri-rates-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">لوحة العمليات</h1>
          <p className="text-sm text-muted-foreground">إدارة أسعار الفنادق والباكدجات</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="size-4 me-2" />
            تصدير CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 me-2" />
            استيراد CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerSheetSync()}
            className="col-span-2 sm:col-span-1"
          >
            <RefreshCw className="size-4 me-2" />
            مزامنة Google Sheets
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.navigate({ to: "/rates/matrix/new" })}
            className="col-span-2 sm:col-span-1"
          >
            <Grid3x3 className="size-4 me-2" />
            مصفوفة أسعار
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="col-span-2 sm:col-span-1"
          >
            <Plus className="size-4 me-2" />
            إضافة سعر
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="إجمالي الأسعار" value={stats.total} accent="text-foreground" />
        <Kpi label="عروض جاهزة" value={stats.ready} accent="text-emerald-600" />
        <Kpi label="مسودات" value={stats.draft} accent="text-zinc-600" />
        <Kpi label="مؤرشف" value={stats.archived} accent="text-muted-foreground" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <Input
              placeholder="بحث (فندق / مجموعة / باكدج)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FilterSel
              value={region}
              onChange={setRegion}
              options={REGIONS as readonly string[]}
              placeholder="المنطقة"
            />
            <FilterSel
              value={room}
              onChange={setRoom}
              options={ROOM_TYPES as readonly string[]}
              placeholder="نوع الغرفة"
            />
            <FilterSel
              value={meal}
              onChange={setMeal}
              options={MEAL_PLANS as readonly string[]}
              placeholder="الإقامة"
            />
            <FilterSel
              value={status}
              onChange={setStatus}
              options={STATUSES as readonly string[]}
              placeholder="الحالة"
            />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <OffersLibrary
        standalone={standaloneOfferGroups}
        packages={packageOfferGroups}
        busyKey={exportBusyKey}
        onExport={exportOfferGroup}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <FileSpreadsheet className="size-8 opacity-50" />
              لا توجد بيانات. أضف أول سعر أو استورد من CSV.
            </div>
          ) : (
            <>
              {/* Mobile / tablet: cards */}
              <div className="lg:hidden divide-y">
                {filtered.map((r) => (
                  <div key={r.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.hotel_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.hotel_group}
                          {r.package_name ? ` · ${r.package_name}` : ""}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-1 rounded-md ${statusBadgeClass(r.status)}`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{fmtRange(r.date_from, r.date_to)}</span>
                      <span>· {r.room_type}</span>
                      <span>· {r.meal_plan}</span>
                      {r.region && <span>· {r.region}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-base font-bold text-[var(--gold)]">
                        {fmtMoney(r.adult_price, r.currency)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canMutateRate(r)}
                          onClick={() => {
                            setEditing(r);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canMutateRate(r)}
                          onClick={() => onDuplicate(r)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!canMutateRate(r)}
                          onClick={() => onDelete(r)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الفندق</TableHead>
                      <TableHead>المنطقة</TableHead>
                      <TableHead>الباكدج</TableHead>
                      <TableHead>الفترة</TableHead>
                      <TableHead>الغرفة</TableHead>
                      <TableHead>الإقامة</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.hotel_name}</div>
                          <div className="text-xs text-muted-foreground">{r.hotel_group}</div>
                        </TableCell>
                        <TableCell>{r.region}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.package_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {fmtRange(r.date_from, r.date_to)}
                        </TableCell>
                        <TableCell>{r.room_type}</TableCell>
                        <TableCell>{r.meal_plan}</TableCell>
                        <TableCell className="font-semibold">
                          {fmtMoney(r.adult_price, r.currency)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded-md ${statusBadgeClass(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!canMutateRate(r)}
                              title={!canMutateRate(r) ? "مؤرشف — المدير فقط" : undefined}
                              onClick={() => {
                                setEditing(r);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!canMutateRate(r)}
                              onClick={() => onDuplicate(r)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!canMutateRate(r)}
                              onClick={() => onDelete(r)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <RateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={refresh}
      />
      <CSVImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />
      <div className="fixed -left-[10000px] top-0 w-[900px] pointer-events-none" aria-hidden>
        {exportGroup && <OfferExportCard ref={exportRef} group={exportGroup} />}
      </div>
    </div>
  );
}

function OffersLibrary({
  standalone,
  packages,
  busyKey,
  onExport,
}: {
  standalone: OfferGroup[];
  packages: OfferGroup[];
  busyKey: string | null;
  onExport: (group: OfferGroup, format: "png" | "pdf") => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-lg">مكتبة العروض الجاهزة</h2>
            <div className="text-xs text-muted-foreground mt-1">
              {standalone.length} فندق مستقل · {packages.length} باكدج
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Ready فقط
          </Badge>
        </div>

        <OfferSection
          title="أسعار فنادق مستقلة"
          icon={Building2}
          groups={standalone}
          emptyText="لا توجد أسعار فنادق مستقلة جاهزة حسب الفلاتر الحالية."
          busyKey={busyKey}
          onExport={onExport}
        />

        <OfferSection
          title="باكدجات جاهزة"
          icon={PackageIcon}
          groups={packages}
          emptyText="لا توجد باكدجات جاهزة حسب الفلاتر الحالية."
          busyKey={busyKey}
          onExport={onExport}
        />
      </CardContent>
    </Card>
  );
}

function OfferSection({
  title,
  icon: Icon,
  groups,
  emptyText,
  busyKey,
  onExport,
}: {
  title: string;
  icon: typeof Building2;
  groups: OfferGroup[];
  emptyText: string;
  busyKey: string | null;
  onExport: (group: OfferGroup, format: "png" | "pdf") => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">({groups.length})</span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border bg-secondary/30 p-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {groups.map((group) => (
            <OfferGroupCard key={group.id} group={group} busyKey={busyKey} onExport={onExport} />
          ))}
        </div>
      )}
    </section>
  );
}

function OfferGroupCard({
  group,
  busyKey,
  onExport,
}: {
  group: OfferGroup;
  busyKey: string | null;
  onExport: (group: OfferGroup, format: "png" | "pdf") => void;
}) {
  const hotelCount = new Set(group.rates.map((r) => r.hotel_id ?? r.hotel_name)).size;
  const minPrice = getMinPrice(group.rates);
  const currency = group.rates.find((r) => r.currency)?.currency ?? "EGP";
  const Icon = group.kind === "hotel" ? Building2 : PackageIcon;

  return (
    <div className="rounded-md border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2 min-w-0">
            <Icon className="size-4 text-primary shrink-0" />
            <span className="truncate">{group.title}</span>
          </div>
          {group.subtitle && (
            <div className="text-xs text-muted-foreground truncate mt-1">{group.subtitle}</div>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0">
          {group.rates.length} سعر
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="فنادق" value={hotelCount} />
        <MiniStat label="الفترة" value={getRangeLabel(group.rates)} tight />
        <MiniStat
          label="من"
          value={minPrice === null ? "—" : fmtMoney(minPrice, currency)}
          accent="text-[var(--gold)]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={busyKey === `png:${group.id}` || busyKey === `pdf:${group.id}`}
          onClick={() => onExport(group, "png")}
        >
          <ImageIcon className="size-4 me-1.5" />
          PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={busyKey === `png:${group.id}` || busyKey === `pdf:${group.id}`}
          onClick={() => onExport(group, "pdf")}
        >
          <FileText className="size-4 me-1.5" />
          PDF
        </Button>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
  tight,
}: {
  label: string;
  value: string | number;
  accent?: string;
  tight?: boolean;
}) {
  return (
    <div className="rounded-md bg-secondary/40 p-2 min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`font-semibold truncate ${tight ? "text-[11px]" : "text-sm"} ${accent ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

const OfferExportCard = forwardRef<HTMLDivElement, { group: OfferGroup }>(function OfferExportCard(
  { group },
  ref,
) {
  const groupedByHotel = useMemo(() => {
    const map = new Map<string, HotelRate[]>();
    group.rates.forEach((rate) => {
      const key = rate.hotel_id ?? rate.hotel_name;
      const rows = map.get(key) ?? [];
      rows.push(rate);
      map.set(key, rows);
    });
    return Array.from(map.values()).sort((a, b) =>
      a[0].hotel_name.localeCompare(b[0].hotel_name, "ar"),
    );
  }, [group.rates]);

  return (
    <div
      ref={ref}
      dir="rtl"
      className="w-[900px] overflow-hidden rounded-xl border bg-white text-[hsl(220_40%_14%)] shadow-xl"
    >
      <div className="bg-sidebar text-sidebar-foreground px-7 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-lg bg-white p-2 grid place-items-center">
            <img src={logoAsset.url} alt="ELBAKRI" className="size-full object-contain" />
          </div>
          <div>
            <div className="text-xs opacity-80">ELBAKRI OVERSEAS</div>
            <div className="text-xl font-extrabold">الباكري للسفر والسياحة</div>
          </div>
        </div>
        <div className="text-end text-xs opacity-90">
          <div>{new Date().toLocaleDateString("ar-EG")}</div>
          <div className="mt-1">{group.kind === "hotel" ? "عرض فندق" : "عرض باكدج"}</div>
        </div>
      </div>

      <div className="px-7 py-5 bg-[hsl(210_28%_96%)] border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">عرض أسعار</div>
            <h2 className="text-3xl font-extrabold leading-tight text-[hsl(220_60%_24%)]">
              {group.title}
            </h2>
            {group.subtitle && (
              <div className="text-sm text-muted-foreground mt-1">{group.subtitle}</div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[330px]">
            <ExportStat label="عدد الأسعار" value={group.rates.length} />
            <ExportStat label="الفنادق" value={groupedByHotel.length} />
            <ExportStat label="الفترة" value={getRangeLabel(group.rates)} />
          </div>
        </div>
      </div>

      <div className="p-7 space-y-4">
        {groupedByHotel.map((rows) => (
          <div
            key={rows[0].hotel_id ?? rows[0].hotel_name}
            className="rounded-lg border overflow-hidden"
          >
            <div className="bg-[hsl(220_50%_22%)] text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="font-bold flex items-center gap-2">
                <Building2 className="size-4" />
                {rows[0].hotel_name}
              </div>
              <div className="text-xs opacity-90 flex items-center gap-1">
                <MapPin className="size-3" />
                {rows[0].region}
              </div>
            </div>

            <div className="divide-y bg-white">
              {rows.map((rate) => (
                <div
                  key={rate.id}
                  className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 px-4 py-3 items-center"
                >
                  <div className="text-sm font-semibold flex items-center gap-1">
                    <CalendarRange className="size-3.5 text-muted-foreground" />
                    {fmtRange(rate.date_from, rate.date_to)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bed className="size-3.5" />
                    {rate.room_type}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Utensils className="size-3.5" />
                    {rate.meal_plan}
                  </div>
                  <div className="text-end">
                    <div className="text-xl font-extrabold text-[hsl(38_92%_42%)] leading-none">
                      {fmtMoney(rate.adult_price, rate.currency)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {rate.pricing_basis || "للشخص"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-sidebar text-sidebar-foreground px-7 py-4 text-center text-xs">
        <div className="font-bold">ELBAKRI OVERSEAS FOR TRAVEL</div>
        <div className="opacity-80 mt-1">
          الأسعار قابلة للتغيير حسب التوافر، برجاء التأكيد قبل الحجز
        </div>
      </div>
    </div>
  );
});

function ExportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/80 border px-3 py-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-bold truncate">{value}</div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSel({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: الكل</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
