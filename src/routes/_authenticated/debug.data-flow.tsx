import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveQuote, useQuoteItems, useAddRateToQuote, createDraftQuoteIfNeeded,
} from "@/lib/quoteService";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/debug/data-flow")({
  head: () => ({ meta: [{ title: "Debug · Data flow — ELBAKRI" }] }),
  component: DataFlowDebug,
});

function DataFlowDebug() {
  const { user, profile } = useAuth();
  const { data: activeQuote, refetch } = useActiveQuote();
  const { data: items = [] } = useQuoteItems(activeQuote?.id);
  const addRate = useAddRateToQuote();

  const [testRateId, setTestRateId] = useState("");
  const [lastResult, setLastResult] = useState<string>("—");
  const [lastError, setLastError] = useState<string>("—");

  const tryAdd = async () => {
    if (!testRateId) return;
    try {
      const r = await addRate.mutateAsync(testRateId);
      setLastResult(JSON.stringify(r, null, 2));
      setLastError("—");
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  };

  const fetchSomeRate = async () => {
    const { data, error } = await supabase.from("hotel_rates").select("id").limit(1).maybeSingle();
    if (error) setLastError(error.message);
    else if (data) setTestRateId(data.id);
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl" dir="ltr">
      <h1 className="text-2xl font-bold">Quote data-flow debug</h1>

      <Card><CardContent className="p-4 space-y-2 text-sm font-mono">
        <Row k="user.id" v={user?.id ?? "—"} />
        <Row k="profile.role" v={profile?.role ?? "—"} />
        <Row k="profile.is_active" v={String(profile?.is_active ?? "—")} />
        <Row k="active quote id" v={activeQuote?.id ?? "(none)"} />
        <Row k="active quote status" v={activeQuote?.status ?? "—"} />
        <Row k="quote_items count" v={String(items.length)} />
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="hotel_rate_id" value={testRateId} onChange={(e) => setTestRateId(e.target.value)} />
          <Button variant="outline" onClick={fetchSomeRate}>Fill from DB</Button>
          <Button onClick={tryAdd} disabled={!testRateId || addRate.isPending}>Add to quote</Button>
        </div>
        <Button variant="outline" size="sm" onClick={async () => { await createDraftQuoteIfNeeded(); refetch(); }}>
          Create draft if needed
        </Button>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2 text-xs">
        <div className="font-semibold">Last add-to-quote result</div>
        <pre className="bg-muted/40 p-2 rounded overflow-auto max-h-48">{lastResult}</pre>
        <div className="font-semibold text-destructive">Last error</div>
        <pre className="bg-destructive/10 p-2 rounded overflow-auto max-h-32">{lastError}</pre>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="font-semibold mb-2 text-sm">Items in active quote</div>
        <pre className="text-xs bg-muted/40 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(items.map((i) => ({
            id: i.id, rate_id: i.hotel_rate_id, hotel: i.hotel_rates?.hotel_name,
          })), null, 2)}
        </pre>
      </CardContent></Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-40 text-muted-foreground">{k}</div>
      <div className="break-all">{v}</div>
    </div>
  );
}