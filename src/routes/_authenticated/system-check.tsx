import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCcw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { triggerSheetSync } from "@/lib/syncSheets";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/system-check")({
  head: () => ({ meta: [{ title: "فحص النظام — ELBAKRI" }] }),
  component: SystemCheckPage,
});

type Status = "pending" | "ok" | "warn" | "fail";
interface CheckResult {
  key: string;
  label: string;
  status: Status;
  detail?: string;
  count?: number;
}

function SystemCheckPage() {
  const { profile, user } = useAuth();
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const set = (key: string, patch: Partial<CheckResult>) =>
    setChecks((prev) => {
      const next = [...prev];
      const i = next.findIndex((c) => c.key === key);
      if (i >= 0) next[i] = { ...next[i], ...patch };
      return next;
    });

  const runAll = async () => {
    setRunning(true);
    const initial: CheckResult[] = [
      { key: "auth", label: "تسجيل الدخول والجلسة", status: "pending" },
      { key: "profile", label: "الملف الشخصي والصلاحيات", status: "pending" },
      { key: "hotels", label: "قاعدة بيانات الفنادق", status: "pending" },
      { key: "groups", label: "المجموعات الفندقية", status: "pending" },
      { key: "packages", label: "الباكدجات", status: "pending" },
      { key: "rates_all", label: "كل الأسعار", status: "pending" },
      { key: "rates_ready", label: "الأسعار الجاهزة (Ready)", status: "pending" },
      { key: "quotes", label: "عروض الأسعار", status: "pending" },
      { key: "quote_items", label: "بنود عروض الأسعار", status: "pending" },
      { key: "write", label: "اختبار الكتابة (مسودة عرض)", status: "pending" },
      { key: "sheets", label: "مزامنة Google Sheets", status: "pending" },
    ];
    setChecks(initial);

    // auth
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("لا توجد جلسة");
      set("auth", { status: "ok", detail: data.user.email ?? data.user.id });
    } catch (e) {
      set("auth", { status: "fail", detail: (e as Error).message });
    }

    // profile
    if (profile) set("profile", { status: "ok", detail: `${profile.full_name ?? "—"} • ${profile.role}` });
    else set("profile", { status: "fail", detail: "لم يتم تحميل الملف الشخصي" });

    // table reads
    const tableCheck = async (key: string, table: "hotels" | "hotel_groups" | "packages" | "hotel_rates" | "quotes" | "quote_items", extra?: (q: ReturnType<typeof supabase.from>) => unknown) => {
      try {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (extra) q = extra(q) as typeof q;
        const { count, error } = await q;
        if (error) throw error;
        set(key, { status: "ok", count: count ?? 0, detail: `${count ?? 0} صف` });
      } catch (e) {
        set(key, { status: "fail", detail: (e as Error).message });
      }
    };
    await Promise.all([
      tableCheck("hotels", "hotels"),
      tableCheck("groups", "hotel_groups"),
      tableCheck("packages", "packages"),
      tableCheck("rates_all", "hotel_rates"),
      tableCheck("quotes", "quotes"),
      tableCheck("quote_items", "quote_items"),
    ]);
    // ready rates
    try {
      const { count, error } = await supabase.from("hotel_rates").select("*", { count: "exact", head: true }).eq("status", "Ready");
      if (error) throw error;
      set("rates_ready", { status: (count ?? 0) > 0 ? "ok" : "warn", count: count ?? 0, detail: (count ?? 0) > 0 ? `${count} عرض جاهز` : "لا توجد أسعار بحالة Ready — لن تظهر للمبيعات" });
    } catch (e) {
      set("rates_ready", { status: "fail", detail: (e as Error).message });
    }

    // write test: create a throwaway draft, then delete it
    if (user) {
      try {
        const { data: ins, error: insErr } = await supabase.from("quotes").insert({ created_by: user.id, status: "draft", client_notes: "__system_check__" }).select("id").single();
        if (insErr) throw insErr;
        await supabase.from("quotes").delete().eq("id", ins.id);
        set("write", { status: "ok", detail: "تم الإنشاء والحذف بنجاح" });
      } catch (e) {
        set("write", { status: "fail", detail: (e as Error).message });
      }
    } else {
      set("write", { status: "warn", detail: "لا يوجد مستخدم" });
    }

    setRunning(false);
  };

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testSheets = async () => {
    set("sheets", { status: "pending", detail: "جاري الاختبار…" });
    try {
      await triggerSheetSync({ silent: true });
      set("sheets", { status: "ok", detail: "تمت المزامنة بنجاح" });
      toast.success("Google Sheets تعمل");
    } catch (e) {
      set("sheets", { status: "fail", detail: (e as Error).message });
    }
  };

  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const ok = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">فحص النظام</h1>
          <p className="text-sm text-muted-foreground">يفحص الاتصال بقاعدة البيانات، الصلاحيات، الجداول، الكتابة، والمزامنة.</p>
        </div>
        <Button onClick={runAll} disabled={running}>
          <RefreshCcw className={`size-4 me-2 ${running ? "animate-spin" : ""}`} />إعادة الفحص
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{ok}</div><div className="text-xs text-muted-foreground">سليم</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-amber-600">{warned}</div><div className="text-xs text-muted-foreground">تحذير</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-destructive">{failed}</div><div className="text-xs text-muted-foreground">فشل</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {checks.map((c) => (
            <div key={c.key} className="flex items-start gap-3 p-3">
              <StatusIcon status={c.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.label}</div>
                {c.detail && <div className="text-xs text-muted-foreground break-words">{c.detail}</div>}
              </div>
              {c.key === "sheets" && (
                <Button size="sm" variant="outline" onClick={testSheets} disabled={running}>اختبار</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Link to="/dashboard"><Button variant="outline" size="sm">لوحة العمليات</Button></Link>
        <Link to="/packages"><Button variant="outline" size="sm">الباكدجات</Button></Link>
        <Link to="/quotes"><Button variant="outline" size="sm">عروض الأسعار</Button></Link>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />;
  if (status === "fail") return <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />;
  if (status === "warn") return <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />;
  return <Loader2 className="size-5 text-muted-foreground shrink-0 mt-0.5 animate-spin" />;
}