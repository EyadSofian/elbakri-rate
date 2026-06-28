import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileText,
  Filter,
  Hotel,
  ImageDown,
  Layers,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/elbakri-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Role = "admin" | "operations" | "sales" | "viewer";
type RoomKey = "single" | "double" | "triple";
type HubTab = "operations" | "sales" | "settings";
type RateMode = "standalone" | "package";

interface HotelGroup {
  id: string;
  name: string;
  region: string;
  tone: string;
}

interface HotelItem {
  id: string;
  name: string;
  groupId: string;
  region: string;
  city: string;
  mealPlan: string;
  childPolicy: string;
  transferNotes: string;
  status: "active" | "draft";
}

interface PackageItem {
  id: string;
  name: string;
  type: string;
  region: string;
  hotelIds: string[];
  description: string;
  status: "active" | "draft";
}

interface RatePeriod {
  id: string;
  hotelId: string;
  packageId?: string;
  mode: RateMode;
  from: string;
  to: string;
  mealPlan: string;
  nights: number;
  prices: Record<RoomKey, number>;
  notes: string;
  updatedBy: string;
  status: "ready" | "draft";
}

interface AppUser {
  id: string;
  name: string;
  role: Role;
  scope: string;
  canExport: boolean;
  active: boolean;
}

interface RateHubData {
  groups: HotelGroup[];
  hotels: HotelItem[];
  packages: PackageItem[];
  rates: RatePeriod[];
  users: AppUser[];
}

interface HotelDraft {
  name: string;
  groupId: string;
  region: string;
  city: string;
  mealPlan: string;
  childPolicy: string;
  transferNotes: string;
}

interface PackageDraft {
  name: string;
  type: string;
  region: string;
  description: string;
  hotelIds: string[];
}

interface PeriodDraft {
  from: string;
  to: string;
  mealPlan: string;
  nights: number;
  single: string;
  double: string;
  triple: string;
  notes: string;
}

interface RateDraft {
  hotelId: string;
  packageId: string;
  mode: RateMode;
  period: PeriodDraft;
}

const STORAGE_KEY = "elbakri-clean-rate-hub-v1";

const seedData: RateHubData = {
  groups: [
    {
      id: "g-albatros-sharm",
      name: "مجموعة الباتروس شرم الشيخ",
      region: "شرم الشيخ",
      tone: "bg-sky-100 text-sky-900",
    },
    {
      id: "g-neverland",
      name: "نيفرلاند",
      region: "الغردقة",
      tone: "bg-emerald-100 text-emerald-900",
    },
    {
      id: "g-honeymoon-dahab",
      name: "هاني مون دهب",
      region: "دهب",
      tone: "bg-amber-100 text-amber-900",
    },
    {
      id: "g-honeymoon-sharm",
      name: "هاني مون شرم",
      region: "شرم الشيخ",
      tone: "bg-rose-100 text-rose-900",
    },
    {
      id: "g-select",
      name: "باقات سيليكت",
      region: "متعدد",
      tone: "bg-violet-100 text-violet-900",
    },
  ],
  hotels: [
    {
      id: "h-royal-grand",
      name: "الباتروس رويال جراند",
      groupId: "g-albatros-sharm",
      region: "شرم الشيخ",
      city: "الهضبة",
      mealPlan: "إقامة كاملة",
      childPolicy: "الطفل الأول حتى 11.99 سنة مجانا، الطفل الثاني 50%",
      transferNotes: "انتقالات ذهاب وعودة 600 ج للفرد",
      status: "active",
    },
    {
      id: "h-aqua-park",
      name: "الباتروس أكوا بارك",
      groupId: "g-albatros-sharm",
      region: "شرم الشيخ",
      city: "نبق",
      mealPlan: "إقامة كاملة",
      childPolicy: "الحد الأقصى طفلين في الغرفة",
      transferNotes: "ليموزين متاح حسب الطلب",
      status: "active",
    },
    {
      id: "h-laguna-vista",
      name: "الباتروس لاجونا فيستا",
      groupId: "g-albatros-sharm",
      region: "شرم الشيخ",
      city: "نبق",
      mealPlan: "إقامة كاملة",
      childPolicy: "سياسة الأطفال حسب العرض",
      transferNotes: "انتقالات جماعية وفردية متاحة",
      status: "active",
    },
    {
      id: "h-dahab-moon",
      name: "دهب مون ريزورت",
      groupId: "g-honeymoon-dahab",
      region: "دهب",
      city: "الممشى",
      mealPlan: "فطار وعشاء",
      childPolicy: "الأطفال حسب السن وسياسة الفندق",
      transferNotes: "انتقالات خاصة متاحة",
      status: "active",
    },
  ],
  packages: [
    {
      id: "p-select-sharm",
      name: "باقة سيليكت شرم",
      type: "سيليكت",
      region: "شرم الشيخ",
      hotelIds: ["h-royal-grand", "h-aqua-park", "h-laguna-vista"],
      description: "مجموعة اختيارات جاهزة للمبيعات في شرم الشيخ",
      status: "active",
    },
    {
      id: "p-albatros-sharm",
      name: "الباتروس شرم",
      type: "مجموعة فنادق",
      region: "شرم الشيخ",
      hotelIds: ["h-royal-grand", "h-aqua-park", "h-laguna-vista"],
      description: "أسعار مجموعة الباتروس مرتبة حسب الفندق والفترة",
      status: "active",
    },
    {
      id: "p-honeymoon-dahab",
      name: "هاني مون دهب",
      type: "هاني مون",
      region: "دهب",
      hotelIds: ["h-dahab-moon"],
      description: "عرض هاني مون دهب جاهز للتصدير",
      status: "active",
    },
  ],
  rates: [
    {
      id: "r-royal-1",
      hotelId: "h-royal-grand",
      packageId: "p-albatros-sharm",
      mode: "package",
      from: "2026-06-25",
      to: "2026-06-30",
      mealPlan: "إقامة كاملة",
      nights: 1,
      prices: { single: 0, double: 4500, triple: 4220 },
      notes: "السعر للفرد في الليلة",
      updatedBy: "Operations",
      status: "ready",
    },
    {
      id: "r-royal-2",
      hotelId: "h-royal-grand",
      packageId: "p-albatros-sharm",
      mode: "package",
      from: "2026-07-01",
      to: "2026-07-20",
      mealPlan: "إقامة كاملة",
      nights: 1,
      prices: { single: 0, double: 4715, triple: 4415 },
      notes: "السعر للفرد في الليلة",
      updatedBy: "Operations",
      status: "ready",
    },
    {
      id: "r-aqua-1",
      hotelId: "h-aqua-park",
      packageId: "p-select-sharm",
      mode: "package",
      from: "2026-07-11",
      to: "2026-08-31",
      mealPlan: "إقامة كاملة",
      nights: 1,
      prices: { single: 0, double: 6625, triple: 6200 },
      notes: "مناسب للعائلات",
      updatedBy: "Operations",
      status: "ready",
    },
    {
      id: "r-dahab-1",
      hotelId: "h-dahab-moon",
      mode: "standalone",
      from: "2026-07-01",
      to: "2026-09-30",
      mealPlan: "فطار وعشاء",
      nights: 3,
      prices: { single: 7200, double: 5600, triple: 5100 },
      notes: "عرض مستقل للفندق",
      updatedBy: "Operations",
      status: "ready",
    },
  ],
  users: [
    {
      id: "u-ops",
      name: "تيم العمليات",
      role: "operations",
      scope: "كل الفنادق والباقات",
      canExport: true,
      active: true,
    },
    {
      id: "u-sales",
      name: "تيم المبيعات",
      role: "sales",
      scope: "العروض الجاهزة فقط",
      canExport: true,
      active: true,
    },
    {
      id: "u-view",
      name: "Viewer شرم",
      role: "viewer",
      scope: "شرم الشيخ",
      canExport: false,
      active: true,
    },
  ],
};

const emptyPeriod = (): PeriodDraft => ({
  from: "",
  to: "",
  mealPlan: "إقامة كاملة",
  nights: 1,
  single: "",
  double: "",
  triple: "",
  notes: "",
});

const roleLabels: Record<Role, string> = {
  admin: "مدير",
  operations: "عمليات",
  sales: "مبيعات",
  viewer: "عرض فقط",
};

function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function parsePrice(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("ar-EG").format(value);
}

function shortDate(value: string) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function CleanRateHub() {
  const [data, setData] = useState<RateHubData>(seedData);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<HubTab>("operations");
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("الكل");
  const [selectedOfferId, setSelectedOfferId] = useState("p-select-sharm");
  const [selectedHotelId, setSelectedHotelId] = useState("h-royal-grand");
  const [hotelDraft, setHotelDraft] = useState<HotelDraft>({
    name: "",
    groupId: seedData.groups[0]?.id ?? "",
    region: "شرم الشيخ",
    city: "",
    mealPlan: "إقامة كاملة",
    childPolicy: "",
    transferNotes: "",
  });
  const [hotelPeriods, setHotelPeriods] = useState<PeriodDraft[]>([emptyPeriod()]);
  const [packageDraft, setPackageDraft] = useState<PackageDraft>({
    name: "",
    type: "سيليكت",
    region: "شرم الشيخ",
    description: "",
    hotelIds: [] as string[],
  });
  const [rateDraft, setRateDraft] = useState<RateDraft>({
    hotelId: seedData.hotels[0]?.id ?? "",
    packageId: "",
    mode: "standalone" as RateMode,
    period: emptyPeriod(),
  });
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setData(JSON.parse(raw) as RateHubData);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, mounted]);

  const hotelsById = useMemo(
    () => new Map(data.hotels.map((hotel) => [hotel.id, hotel])),
    [data.hotels],
  );
  const packagesById = useMemo(
    () => new Map(data.packages.map((pkg) => [pkg.id, pkg])),
    [data.packages],
  );
  const groupsById = useMemo(
    () => new Map(data.groups.map((group) => [group.id, group])),
    [data.groups],
  );
  const regions = useMemo(
    () => [
      "الكل",
      ...Array.from(
        new Set([
          ...data.hotels.map((hotel) => hotel.region),
          ...data.packages.map((pkg) => pkg.region),
        ]),
      ),
    ],
    [data.hotels, data.packages],
  );

  const selectedPackage = packagesById.get(selectedOfferId);
  const selectedHotel = hotelsById.get(selectedHotelId);

  const filteredHotels = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.hotels.filter((hotel) => {
      const inRegion = regionFilter === "الكل" || hotel.region === regionFilter;
      const inQuery =
        !text || `${hotel.name} ${hotel.region} ${hotel.city}`.toLowerCase().includes(text);
      return inRegion && inQuery;
    });
  }, [data.hotels, query, regionFilter]);

  const filteredPackages = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.packages.filter((pkg) => {
      const inRegion =
        regionFilter === "الكل" || pkg.region === regionFilter || pkg.region === "متعدد";
      const inQuery = !text || `${pkg.name} ${pkg.type} ${pkg.region}`.toLowerCase().includes(text);
      return inRegion && inQuery;
    });
  }, [data.packages, query, regionFilter]);

  const packageRates = useMemo(() => {
    if (!selectedPackage) return [];
    const hotelSet = new Set(selectedPackage.hotelIds);
    return data.rates.filter(
      (rate) =>
        rate.packageId === selectedPackage.id ||
        (rate.mode === "package" && hotelSet.has(rate.hotelId)),
    );
  }, [data.rates, selectedPackage]);

  const standaloneRates = useMemo(() => {
    if (!selectedHotel) return [];
    return data.rates.filter(
      (rate) => rate.hotelId === selectedHotel.id && rate.mode === "standalone",
    );
  }, [data.rates, selectedHotel]);

  const readyRates = data.rates.filter((rate) => rate.status === "ready").length;
  const standaloneCount = data.rates.filter((rate) => rate.mode === "standalone").length;
  const packageCount = data.rates.filter((rate) => rate.mode === "package").length;

  function updateHotelPeriod(index: number, patch: Partial<PeriodDraft>) {
    setHotelPeriods((periods) =>
      periods.map((period, i) => (i === index ? { ...period, ...patch } : period)),
    );
  }

  function addHotelWithRates() {
    if (!hotelDraft.name.trim()) {
      toast.error("اكتب اسم الفندق");
      return;
    }
    const hotelId = makeId("h");
    const nextHotel: HotelItem = {
      id: hotelId,
      name: hotelDraft.name.trim(),
      groupId: hotelDraft.groupId,
      region: hotelDraft.region.trim() || "غير محدد",
      city: hotelDraft.city.trim(),
      mealPlan: hotelDraft.mealPlan.trim() || "إقامة",
      childPolicy: hotelDraft.childPolicy.trim() || "حسب سياسة الفندق",
      transferNotes: hotelDraft.transferNotes.trim() || "حسب الطلب",
      status: "active",
    };
    const nextRates = hotelPeriods
      .filter((period) => period.from && period.to)
      .map<RatePeriod>((period) => ({
        id: makeId("r"),
        hotelId,
        mode: "standalone",
        from: period.from,
        to: period.to,
        mealPlan: period.mealPlan,
        nights: Number(period.nights) || 1,
        prices: {
          single: parsePrice(period.single),
          double: parsePrice(period.double),
          triple: parsePrice(period.triple),
        },
        notes: period.notes,
        updatedBy: "Operations",
        status: "ready",
      }));

    setData((current) => ({
      ...current,
      hotels: [nextHotel, ...current.hotels],
      rates: [...nextRates, ...current.rates],
    }));
    setSelectedHotelId(hotelId);
    setHotelDraft({
      name: "",
      groupId: data.groups[0]?.id ?? "",
      region: "شرم الشيخ",
      city: "",
      mealPlan: "إقامة كاملة",
      childPolicy: "",
      transferNotes: "",
    });
    setHotelPeriods([emptyPeriod()]);
    toast.success("تمت إضافة الفندق والأسعار");
  }

  function addPackage() {
    if (!packageDraft.name.trim()) {
      toast.error("اكتب اسم الباكدج");
      return;
    }
    const pkg: PackageItem = {
      id: makeId("p"),
      name: packageDraft.name.trim(),
      type: packageDraft.type.trim() || "باكدج",
      region: packageDraft.region.trim() || "متعدد",
      hotelIds: packageDraft.hotelIds,
      description: packageDraft.description.trim(),
      status: "active",
    };
    setData((current) => ({ ...current, packages: [pkg, ...current.packages] }));
    setSelectedOfferId(pkg.id);
    setPackageDraft({
      name: "",
      type: "سيليكت",
      region: "شرم الشيخ",
      description: "",
      hotelIds: [],
    });
    toast.success("تمت إضافة الباكدج");
  }

  function addRate() {
    if (!rateDraft.hotelId || !rateDraft.period.from || !rateDraft.period.to) {
      toast.error("اختار الفندق والفترة");
      return;
    }
    const nextRate: RatePeriod = {
      id: makeId("r"),
      hotelId: rateDraft.hotelId,
      packageId: rateDraft.mode === "package" ? rateDraft.packageId || undefined : undefined,
      mode: rateDraft.mode,
      from: rateDraft.period.from,
      to: rateDraft.period.to,
      mealPlan: rateDraft.period.mealPlan,
      nights: Number(rateDraft.period.nights) || 1,
      prices: {
        single: parsePrice(rateDraft.period.single),
        double: parsePrice(rateDraft.period.double),
        triple: parsePrice(rateDraft.period.triple),
      },
      notes: rateDraft.period.notes,
      updatedBy: "Operations",
      status: "ready",
    };
    setData((current) => ({ ...current, rates: [nextRate, ...current.rates] }));
    setRateDraft((current) => ({ ...current, period: emptyPeriod() }));
    toast.success("تم حفظ السعر");
  }

  function removeRate(rateId: string) {
    setData((current) => ({
      ...current,
      rates: current.rates.filter((rate) => rate.id !== rateId),
    }));
  }

  async function exportQuote(type: "png" | "pdf") {
    if (!quoteRef.current) return;
    const dataUrl = await toPng(quoteRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    if (type === "png") {
      downloadDataUrl(dataUrl, "elbakri-offer.png");
      toast.success("تم تنزيل PNG");
      return;
    }

    const width = quoteRef.current.offsetWidth;
    const height = quoteRef.current.offsetHeight;
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [width, height] });
    pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
    pdf.save("elbakri-offer.pdf");
    toast.success("تم تنزيل PDF");
  }

  async function copySalesText() {
    const title = selectedPackage?.name ?? selectedHotel?.name ?? "عرض أسعار";
    const rates = selectedPackage ? packageRates : standaloneRates;
    const lines = rates.slice(0, 8).map((rate) => {
      const hotel = hotelsById.get(rate.hotelId);
      return `${hotel?.name ?? "فندق"} | ${shortDate(rate.from)} - ${shortDate(rate.to)} | دبل ${money(rate.prices.double)} | تربل ${money(rate.prices.triple)}`;
    });
    await navigator.clipboard.writeText([`ELBAKRI OVERSEAS - ${title}`, ...lines].join("\n"));
    toast.success("تم نسخ نص العرض");
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <img src={logoAsset.url} alt="ELBAKRI OVERSEAS" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-normal text-[#071743]">
                ELBAKRI OVERSEAS
              </div>
              <div className="text-xs font-semibold text-slate-500">Rate Hub</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Metric label="فنادق" value={data.hotels.length} />
            <Metric label="باكدجات" value={data.packages.length} />
            <Metric label="أسعار جاهزة" value={readyRates} />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <TopTab
              icon={Building2}
              label="عمليات"
              active={tab === "operations"}
              onClick={() => setTab("operations")}
            />
            <TopTab
              icon={Users}
              label="مبيعات"
              active={tab === "sales"}
              onClick={() => setTab("sales")}
            />
            <TopTab
              icon={Settings}
              label="صلاحيات"
              active={tab === "settings"}
              onClick={() => setTab("settings")}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-auto">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter className="size-4 text-[#0b2a6f]" />
              الفلاتر
            </div>
            <div className="space-y-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="بحث باسم الفندق أو الباكدج"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm outline-none ring-[#0b2a6f]/20 focus:ring-4"
                />
              </label>
              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-[#0b2a6f]/20 focus:ring-4"
              >
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-[#071743] p-3 text-white shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <BadgeDollarSign className="size-4 text-amber-300" />
              ملخص التشغيل
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="فندق فقط" value={standaloneCount} />
              <MiniStat label="باكدج" value={packageCount} />
              <MiniStat label="مستخدمين" value={data.users.length} />
              <MiniStat label="مناطق" value={regions.length - 1} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Layers className="size-4 text-[#0b2a6f]" />
              المجموعات
            </div>
            <div className="space-y-2">
              {data.groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2"
                >
                  <span className="text-xs font-bold text-slate-800">{group.name}</span>
                  <span className={cn("rounded-md px-2 py-1 text-[11px] font-bold", group.tone)}>
                    {group.region}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="min-w-0">
          {tab === "operations" && (
            <OperationsView
              data={data}
              groupsById={groupsById}
              hotelsById={hotelsById}
              packagesById={packagesById}
              filteredHotels={filteredHotels}
              filteredPackages={filteredPackages}
              hotelDraft={hotelDraft}
              setHotelDraft={setHotelDraft}
              hotelPeriods={hotelPeriods}
              setHotelPeriods={setHotelPeriods}
              updateHotelPeriod={updateHotelPeriod}
              addHotelWithRates={addHotelWithRates}
              packageDraft={packageDraft}
              setPackageDraft={setPackageDraft}
              addPackage={addPackage}
              rateDraft={rateDraft}
              setRateDraft={setRateDraft}
              addRate={addRate}
              removeRate={removeRate}
            />
          )}

          {tab === "sales" && (
            <SalesView
              data={data}
              hotelsById={hotelsById}
              groupsById={groupsById}
              selectedOfferId={selectedOfferId}
              setSelectedOfferId={setSelectedOfferId}
              selectedHotelId={selectedHotelId}
              setSelectedHotelId={setSelectedHotelId}
              filteredPackages={filteredPackages}
              filteredHotels={filteredHotels}
              selectedPackage={selectedPackage}
              selectedHotel={selectedHotel}
              packageRates={packageRates}
              standaloneRates={standaloneRates}
              quoteRef={quoteRef}
              exportQuote={exportQuote}
              copySalesText={copySalesText}
            />
          )}

          {tab === "settings" && <SettingsView data={data} setData={setData} />}
        </div>
      </main>
    </div>
  );
}

function TopTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md px-3 text-xs font-extrabold transition",
        active ? "bg-[#071743] text-white shadow-sm" : "text-slate-600 hover:bg-white",
      )}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <div className="text-sm font-extrabold text-[#071743]">{value}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/10 p-2">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] font-semibold text-white/70">{label}</div>
    </div>
  );
}

function OperationsView(props: {
  data: RateHubData;
  groupsById: Map<string, HotelGroup>;
  hotelsById: Map<string, HotelItem>;
  packagesById: Map<string, PackageItem>;
  filteredHotels: HotelItem[];
  filteredPackages: PackageItem[];
  hotelDraft: {
    name: string;
    groupId: string;
    region: string;
    city: string;
    mealPlan: string;
    childPolicy: string;
    transferNotes: string;
  };
  setHotelDraft: Dispatch<SetStateAction<HotelDraft>>;
  hotelPeriods: PeriodDraft[];
  setHotelPeriods: Dispatch<SetStateAction<PeriodDraft[]>>;
  updateHotelPeriod: (index: number, patch: Partial<PeriodDraft>) => void;
  addHotelWithRates: () => void;
  packageDraft: {
    name: string;
    type: string;
    region: string;
    description: string;
    hotelIds: string[];
  };
  setPackageDraft: Dispatch<SetStateAction<PackageDraft>>;
  addPackage: () => void;
  rateDraft: {
    hotelId: string;
    packageId: string;
    mode: RateMode;
    period: PeriodDraft;
  };
  setRateDraft: Dispatch<SetStateAction<RateDraft>>;
  addRate: () => void;
  removeRate: (rateId: string) => void;
}) {
  const {
    data,
    groupsById,
    hotelsById,
    packagesById,
    filteredHotels,
    filteredPackages,
    hotelDraft,
    setHotelDraft,
    hotelPeriods,
    setHotelPeriods,
    updateHotelPeriod,
    addHotelWithRates,
    packageDraft,
    setPackageDraft,
    addPackage,
    rateDraft,
    setRateDraft,
    addRate,
    removeRate,
  } = props;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#071743]">لوحة العمليات</h1>
            <p className="text-sm font-semibold text-slate-500">
              فنادق، باكدجات، وأسعار بفترات متعددة
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge icon={Hotel} label={`${filteredHotels.length} فندق`} />
            <Badge icon={Package} label={`${filteredPackages.length} باكدج`} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <PanelTitle icon={Plus} title="إضافة فندق بأسعاره" />
            <div className="grid gap-2 md:grid-cols-2">
              <Field
                label="اسم الفندق"
                value={hotelDraft.name}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, name: value }))}
              />
              <SelectField
                label="المجموعة"
                value={hotelDraft.groupId}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, groupId: value }))}
                options={data.groups.map((group) => ({ value: group.id, label: group.name }))}
              />
              <Field
                label="المنطقة"
                value={hotelDraft.region}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, region: value }))}
              />
              <Field
                label="المدينة"
                value={hotelDraft.city}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, city: value }))}
              />
              <Field
                label="نوع الإقامة"
                value={hotelDraft.mealPlan}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, mealPlan: value }))}
              />
              <Field
                label="الانتقالات"
                value={hotelDraft.transferNotes}
                onChange={(value) => setHotelDraft((draft) => ({ ...draft, transferNotes: value }))}
              />
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-extrabold text-slate-600">
                  سياسة الأطفال
                </span>
                <textarea
                  value={hotelDraft.childPolicy}
                  onChange={(event) =>
                    setHotelDraft((draft) => ({ ...draft, childPolicy: event.target.value }))
                  }
                  className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#0b2a6f]/20 focus:ring-4"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <PanelTitle icon={CalendarDays} title="فترات السعر" />
                <button
                  type="button"
                  onClick={() => setHotelPeriods((periods) => [...periods, emptyPeriod()])}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-extrabold text-[#071743]"
                >
                  <Plus className="size-4" />
                  فترة
                </button>
              </div>
              {hotelPeriods.map((period, index) => (
                <PeriodEditor
                  key={index}
                  period={period}
                  onChange={(patch) => updateHotelPeriod(index, patch)}
                  onRemove={
                    hotelPeriods.length > 1
                      ? () => setHotelPeriods((periods) => periods.filter((_, i) => i !== index))
                      : undefined
                  }
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addHotelWithRates}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#071743] px-4 text-sm font-extrabold text-white shadow-sm md:w-auto"
            >
              <Save className="size-4" />
              حفظ الفندق والأسعار
            </button>
          </div>

          <div className="space-y-3">
            <PanelTitle icon={Package} title="إضافة باكدج" />
            <Field
              label="اسم الباكدج"
              value={packageDraft.name}
              onChange={(value) => setPackageDraft((draft) => ({ ...draft, name: value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="النوع"
                value={packageDraft.type}
                onChange={(value) => setPackageDraft((draft) => ({ ...draft, type: value }))}
              />
              <Field
                label="المنطقة"
                value={packageDraft.region}
                onChange={(value) => setPackageDraft((draft) => ({ ...draft, region: value }))}
              />
            </div>
            <Field
              label="وصف مختصر"
              value={packageDraft.description}
              onChange={(value) => setPackageDraft((draft) => ({ ...draft, description: value }))}
            />
            <div>
              <span className="mb-2 block text-xs font-extrabold text-slate-600">
                فنادق الباكدج
              </span>
              <div className="grid max-h-56 gap-2 overflow-auto rounded-lg border border-slate-200 p-2">
                {data.hotels.map((hotel) => (
                  <label
                    key={hotel.id}
                    className="flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm font-bold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={packageDraft.hotelIds.includes(hotel.id)}
                      onChange={(event) =>
                        setPackageDraft((draft) => ({
                          ...draft,
                          hotelIds: event.target.checked
                            ? [...draft.hotelIds, hotel.id]
                            : draft.hotelIds.filter((id: string) => id !== hotel.id),
                        }))
                      }
                    />
                    {hotel.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={addPackage}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white"
            >
              <Check className="size-4" />
              حفظ الباكدج
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <PanelTitle icon={BadgeDollarSign} title="إضافة سعر سريع" />
          <div className="flex rounded-lg bg-slate-100 p-1">
            <ModeButton
              active={rateDraft.mode === "standalone"}
              label="فندق فقط"
              onClick={() =>
                setRateDraft((draft) => ({ ...draft, mode: "standalone", packageId: "" }))
              }
            />
            <ModeButton
              active={rateDraft.mode === "package"}
              label="باكدج"
              onClick={() => setRateDraft((draft) => ({ ...draft, mode: "package" }))}
            />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[240px_240px_minmax(0,1fr)_auto]">
          <SelectField
            label="الفندق"
            value={rateDraft.hotelId}
            onChange={(value) => setRateDraft((draft) => ({ ...draft, hotelId: value }))}
            options={data.hotels.map((hotel) => ({ value: hotel.id, label: hotel.name }))}
          />
          <SelectField
            label="الباكدج"
            value={rateDraft.packageId}
            onChange={(value) =>
              setRateDraft((draft) => ({
                ...draft,
                packageId: value,
                mode: value ? "package" : draft.mode,
              }))
            }
            disabled={rateDraft.mode === "standalone"}
            options={[
              { value: "", label: "بدون باكدج" },
              ...data.packages.map((pkg) => ({ value: pkg.id, label: pkg.name })),
            ]}
          />
          <PeriodEditor
            compact
            period={rateDraft.period}
            onChange={(patch) =>
              setRateDraft((draft) => ({ ...draft, period: { ...draft.period, ...patch } }))
            }
          />
          <button
            type="button"
            onClick={addRate}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-[#071743] px-4 text-sm font-extrabold text-white"
          >
            <Save className="size-4" />
            حفظ
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <LibraryColumn
          title="أسعار الفندق فقط"
          icon={Hotel}
          items={filteredHotels.map((hotel) => ({
            id: hotel.id,
            title: hotel.name,
            subtitle: `${groupsById.get(hotel.groupId)?.name ?? "مجموعة"} · ${hotel.region}`,
            count: data.rates.filter(
              (rate) => rate.hotelId === hotel.id && rate.mode === "standalone",
            ).length,
          }))}
        />
        <LibraryColumn
          title="أسعار الباكدجات"
          icon={Package}
          items={filteredPackages.map((pkg) => ({
            id: pkg.id,
            title: pkg.name,
            subtitle: `${pkg.type} · ${pkg.region}`,
            count: data.rates.filter((rate) => rate.packageId === pkg.id).length,
          }))}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <PanelTitle icon={FileText} title="آخر الأسعار" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2">الفندق</th>
                <th className="py-2">النوع</th>
                <th className="py-2">الفترة</th>
                <th className="py-2">دبل</th>
                <th className="py-2">تربل</th>
                <th className="py-2">باكدج</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.rates.slice(0, 12).map((rate) => (
                <tr key={rate.id} className="border-b border-slate-100">
                  <td className="py-3 font-bold text-slate-800">
                    {hotelsById.get(rate.hotelId)?.name ?? "فندق"}
                  </td>
                  <td className="py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                      {rate.mode === "package" ? "باكدج" : "فندق فقط"}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600">
                    {shortDate(rate.from)} - {shortDate(rate.to)}
                  </td>
                  <td className="py-3 font-bold">{money(rate.prices.double)}</td>
                  <td className="py-3 font-bold">{money(rate.prices.triple)}</td>
                  <td className="py-3 text-slate-600">
                    {rate.packageId ? packagesById.get(rate.packageId)?.name : "—"}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => removeRate(rate.id)}
                      className="grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                      aria-label="حذف السعر"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SalesView(props: {
  data: RateHubData;
  hotelsById: Map<string, HotelItem>;
  groupsById: Map<string, HotelGroup>;
  selectedOfferId: string;
  setSelectedOfferId: (id: string) => void;
  selectedHotelId: string;
  setSelectedHotelId: (id: string) => void;
  filteredPackages: PackageItem[];
  filteredHotels: HotelItem[];
  selectedPackage?: PackageItem;
  selectedHotel?: HotelItem;
  packageRates: RatePeriod[];
  standaloneRates: RatePeriod[];
  quoteRef: RefObject<HTMLDivElement | null>;
  exportQuote: (type: "png" | "pdf") => Promise<void>;
  copySalesText: () => Promise<void>;
}) {
  const [salesMode, setSalesMode] = useState<RateMode>("package");
  const activeRates = salesMode === "package" ? props.packageRates : props.standaloneRates;
  const title = salesMode === "package" ? props.selectedPackage?.name : props.selectedHotel?.name;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-[#071743]">عروض المبيعات</h1>
              <p className="text-sm font-semibold text-slate-500">اختيار العرض وتصديره للعميل</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <ModeButton
                active={salesMode === "package"}
                label="باكدج"
                onClick={() => setSalesMode("package")}
              />
              <ModeButton
                active={salesMode === "standalone"}
                label="فندق فقط"
                onClick={() => setSalesMode("standalone")}
              />
            </div>
          </div>

          {salesMode === "package" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {props.filteredPackages.map((pkg) => (
                <OfferCard
                  key={pkg.id}
                  active={props.selectedOfferId === pkg.id}
                  title={pkg.name}
                  subtitle={`${pkg.type} · ${pkg.region}`}
                  meta={`${pkg.hotelIds.length} فندق`}
                  onClick={() => props.setSelectedOfferId(pkg.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {props.filteredHotels.map((hotel) => (
                <OfferCard
                  key={hotel.id}
                  active={props.selectedHotelId === hotel.id}
                  title={hotel.name}
                  subtitle={`${props.groupsById.get(hotel.groupId)?.name ?? "مجموعة"} · ${hotel.region}`}
                  meta={hotel.mealPlan}
                  onClick={() => props.setSelectedHotelId(hotel.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <PanelTitle icon={CalendarDays} title="الأسعار داخل العرض" />
          <div className="mt-3 grid gap-2">
            {activeRates.length === 0 && (
              <div className="rounded-lg bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
                لا توجد أسعار جاهزة لهذا الاختيار
              </div>
            )}
            {activeRates.map((rate) => (
              <div
                key={rate.id}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="font-extrabold text-slate-900">
                    {props.hotelsById.get(rate.hotelId)?.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    {shortDate(rate.from)} - {shortDate(rate.to)} · {rate.mealPlan}
                  </div>
                </div>
                <div className="flex gap-2 text-sm font-extrabold">
                  <span className="rounded-md bg-slate-100 px-2 py-1">
                    سنجل {money(rate.prices.single)}
                  </span>
                  <span className="rounded-md bg-sky-100 px-2 py-1 text-sky-900">
                    دبل {money(rate.prices.double)}
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-900">
                    تربل {money(rate.prices.triple)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-3 xl:sticky xl:top-20 xl:h-[calc(100vh-6rem)] xl:overflow-auto">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.exportQuote("png")}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#071743] px-3 text-sm font-extrabold text-white"
          >
            <ImageDown className="size-4" />
            PNG
          </button>
          <button
            type="button"
            onClick={() => props.exportQuote("pdf")}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-extrabold text-[#071743]"
          >
            <Download className="size-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={props.copySalesText}
            className="grid size-11 place-items-center rounded-lg border border-slate-200 bg-white text-[#071743]"
            aria-label="نسخ نص العرض"
          >
            <Copy className="size-4" />
          </button>
        </div>

        <QuoteCard
          quoteRef={props.quoteRef}
          title={title ?? "عرض أسعار"}
          rates={activeRates}
          hotelsById={props.hotelsById}
          selectedPackage={salesMode === "package" ? props.selectedPackage : undefined}
          selectedHotel={salesMode === "standalone" ? props.selectedHotel : undefined}
        />
      </aside>
    </div>
  );
}

const QuoteCard = (
  props: {
    title: string;
    rates: RatePeriod[];
    hotelsById: Map<string, HotelItem>;
    selectedPackage?: PackageItem;
    selectedHotel?: HotelItem;
  } & { quoteRef: RefObject<HTMLDivElement | null> },
) => {
  const hotels =
    props.selectedPackage?.hotelIds.map((id) => props.hotelsById.get(id)).filter(Boolean) ?? [];

  return (
    <div
      ref={props.quoteRef}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="bg-[#071743] p-5 text-white">
        <div className="mb-5 flex items-center justify-between gap-3">
          <img
            src={logoAsset.url}
            alt="ELBAKRI OVERSEAS"
            className="h-12 w-12 rounded-lg bg-white object-contain p-1"
          />
          <div className="text-left text-xs font-semibold text-white/70">ELBAKRI OVERSEAS</div>
        </div>
        <h2 className="text-2xl font-extrabold">{props.title}</h2>
        <p className="mt-1 text-sm font-semibold text-white/75">عرض أسعار فنادق</p>
      </div>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">المنطقة</div>
            <div className="mt-1 text-slate-900">
              {props.selectedPackage?.region ?? props.selectedHotel?.region ?? "—"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">عدد الاختيارات</div>
            <div className="mt-1 text-slate-900">{props.rates.length}</div>
          </div>
        </div>

        {hotels.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {hotels.map((hotel) => (
              <span
                key={hotel?.id}
                className="rounded-md bg-sky-50 px-2 py-1 text-xs font-extrabold text-sky-900"
              >
                {hotel?.name}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {props.rates.map((rate) => {
            const hotel = props.hotelsById.get(rate.hotelId);
            return (
              <div key={rate.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900">{hotel?.name}</div>
                    <div className="text-xs font-semibold text-slate-500">
                      {shortDate(rate.from)} - {shortDate(rate.to)} · {rate.mealPlan}
                    </div>
                  </div>
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-extrabold text-amber-900">
                    {rate.nights} ليلة
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <PriceBox label="سنجل" value={rate.prices.single} />
                  <PriceBox label="دبل" value={rate.prices.double} />
                  <PriceBox label="تربل" value={rate.prices.triple} />
                </div>
                {hotel?.childPolicy && (
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">
                    {hotel.childPolicy}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-600">
          الأسعار قابلة للتغيير حسب الإتاحة وسياسة الفندق وقت الحجز.
        </div>
      </div>
    </div>
  );
};

function SettingsView({
  data,
  setData,
}: {
  data: RateHubData;
  setData: Dispatch<SetStateAction<RateHubData>>;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#071743]">الصلاحيات</h1>
            <p className="text-sm font-semibold text-slate-500">
              تقسيم الرؤية بين العمليات والمبيعات
            </p>
          </div>
          <Badge icon={UserCog} label={`${data.users.length} مستخدم`} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.users.map((user) => (
            <div key={user.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-900">{user.name}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {roleLabels[user.role]}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      users: current.users.map((item) =>
                        item.id === user.id ? { ...item, active: !item.active } : item,
                      ),
                    }))
                  }
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-extrabold",
                    user.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {user.active ? "مفعل" : "موقوف"}
                </button>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600">
                {user.scope}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={user.canExport}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      users: current.users.map((item) =>
                        item.id === user.id ? { ...item, canExport: event.target.checked } : item,
                      ),
                    }))
                  }
                />
                تصدير عروض
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Plus; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-[#071743]">
      <Icon className="size-4" />
      {title}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-extrabold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none ring-[#0b2a6f]/20 focus:ring-4"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-extrabold text-slate-600">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-[#0b2a6f]/20 focus:ring-4 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PeriodEditor({
  period,
  onChange,
  onRemove,
  compact,
}: {
  period: PeriodDraft;
  onChange: (patch: Partial<PeriodDraft>) => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2",
        compact ? "md:grid-cols-7" : "md:grid-cols-8",
      )}
    >
      <SmallInput
        label="من"
        type="date"
        value={period.from}
        onChange={(value) => onChange({ from: value })}
      />
      <SmallInput
        label="إلى"
        type="date"
        value={period.to}
        onChange={(value) => onChange({ to: value })}
      />
      <SmallInput
        label="إقامة"
        value={period.mealPlan}
        onChange={(value) => onChange({ mealPlan: value })}
      />
      <SmallInput
        label="ليالي"
        type="number"
        value={String(period.nights)}
        onChange={(value) => onChange({ nights: Number(value) || 1 })}
      />
      <SmallInput
        label="سنجل"
        type="number"
        value={period.single}
        onChange={(value) => onChange({ single: value })}
      />
      <SmallInput
        label="دبل"
        type="number"
        value={period.double}
        onChange={(value) => onChange({ double: value })}
      />
      <SmallInput
        label="تربل"
        type="number"
        value={period.triple}
        onChange={(value) => onChange({ triple: value })}
      />
      {!compact && (
        <div className="flex gap-2">
          <SmallInput
            label="ملاحظات"
            value={period.notes}
            onChange={(value) => onChange({ notes: value })}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-5 grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-extrabold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-bold outline-none ring-[#0b2a6f]/20 focus:ring-4"
      />
    </label>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md px-3 text-xs font-extrabold transition",
        active ? "bg-white text-[#071743] shadow-sm" : "text-slate-500",
      )}
    >
      {label}
    </button>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof Hotel; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">
      <Icon className="size-4 text-[#0b2a6f]" />
      {label}
    </span>
  );
}

function LibraryColumn({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Hotel;
  items: { id: string; title: string; subtitle: string; count: number }[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <PanelTitle icon={Icon} title={title} />
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
          >
            <div>
              <div className="font-extrabold text-slate-900">{item.title}</div>
              <div className="text-xs font-semibold text-slate-500">{item.subtitle}</div>
            </div>
            <span className="rounded-md bg-[#071743] px-2 py-1 text-xs font-extrabold text-white">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfferCard({
  active,
  title,
  subtitle,
  meta,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-28 rounded-lg border p-4 text-right transition",
        active
          ? "border-[#071743] bg-[#071743] text-white shadow-sm"
          : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-extrabold",
            active ? "bg-white/15" : "bg-slate-100 text-slate-600",
          )}
        >
          {meta}
        </span>
        {active && <Check className="size-4 text-amber-300" />}
      </div>
      <div className="font-extrabold">{title}</div>
      <div
        className={cn("mt-1 text-xs font-semibold", active ? "text-white/70" : "text-slate-500")}
      >
        {subtitle}
      </div>
    </button>
  );
}

function PriceBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[11px] font-bold text-slate-400">{label}</div>
      <div className="text-sm font-extrabold text-slate-900">{money(value)}</div>
    </div>
  );
}
