import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveQuote, useQuoteItems, useAddRateToQuote, createDraftQuoteIfNeeded,
} from "@/lib/quoteService";

export const Route = createFileRoute("/_authenticated/debug/flow-check")({
  head: () => ({ meta: [{ title: "Debug · Flow Check — ELBAKRI" }] }),
  component: FlowCheck,
});

function FlowCheck() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { data: activeQuote, refetch: refetchQuote } = useActiveQuote();
  const { data: items = [] } = useQuoteItems(activeQuote?.id);
  const addRate = useAddRateToQuote();
  const [lastError, setLastError] = useState<string>("—");

  const { data: counts } = useQuery({
    queryKey: ["flow_check_counts"],
    queryFn: async () => {
      const [hotels, packages, ready] = await Promise.all([
        supabase.from("hotels").select("id", { count: "exact", head: true }),
        supabase.from("packages").select("id", { count: "exact", head: true }),
        supabase.from("hotel_rates").select("id", { count: "exact", head: true }).eq("status", "Ready"),
      ]);
      return {
        hotels: hotels.count ?? 0,
        packages: packages.count ?? 0,
        readyRates: ready.count ?? 0,
      };
    },
  });

  const testCreateDraft = async () => {
    try { await createDraftQuoteIfNeeded(); await refetchQuote(); setLastError("—"); }
    catch (e) { setLastError(e instanceof Error ? e.message : String(e)); }
  };

  const testAddFirstReady = async () => {
    try {
      const { data, error } = await supabase.from("hotel_rates").select("id").eq("status", "Ready").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) { setLastError("No Ready rates exist"); return; }
      await addRate.mutateAsync(data.id);
      setLastError("—");
    } catch (e) { setLastError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">فحص تدفق البيانات</h1>
      <p className="text-sm text-muted-foreground">
        صفحة تشخيصية للتأكد من ترابط الفنادق ← الأسعار ← عروض المبيعات ← عروض الأسعار.
      </p>

      <Card><CardContent className="p-4 space-y-2 text-sm font-mono">
        <Row k="user.id" v={user?.id ?? "—"} />
        <Row k="profile.role" v={profile?.role ?? "—"} />
        <Row k="profile.is_active" v={String(profile?.is_active ?? "—")} />
        <Row k="hotels" v={String(counts?.hotels ?? "…")} />
        <Row k="packages" v={String(counts?.packages ?? "…")} />
        <Row k="ready rates" v={String(counts?.readyRates ?? "…")} />
        <Row k="active draft quote" v={activeQuote?.id ?? "(none)"} />
        <Row k="active quote status" v={activeQuote?.status ?? "—"} />
        <Row k="quote_items count" v={String(items.length)} />
      </CardContent></Card>

      <Card><CardContent className="p-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={testCreateDraft}>Create draft quote</Button>
        <Button size="sm" variant="outline" onClick={testAddFirstReady} disabled={addRate.isPending}>
          Add first Ready rate
        </Button>
        {activeQuote && (
          <Button size="sm" onClick={() => router.navigate({ to: "/quotes/$id", params: { id: activeQuote.id } })}>
            Open quote detail
          </Button>
        )}
        <Link to="/sales"><Button size="sm" variant="ghost">→ Sales Offers</Button></Link>
        <Link to="/quotes"><Button size="sm" variant="ghost">→ Quotes list</Button></Link>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-1 text-xs">
        <div className="font-semibold text-destructive">Last mutation error</div>
        <pre className="bg-destructive/10 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">{lastError}</pre>
      </CardContent></Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-44 text-muted-foreground">{k}</div>
      <div className="break-all">{v}</div>
    </div>
  );
}