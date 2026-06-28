import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney, fmtRange } from "@/lib/rates";
import { Trash2, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  useActiveQuote,
  useQuoteItems,
  useRemoveQuoteItem,
  useUpdateQuote,
  useEnsureDraftQuote,
} from "@/lib/quoteService";

export const Route = createFileRoute("/_authenticated/quotes/new")({
  head: () => ({ meta: [{ title: "عرض سعر جديد — ELBAKRI" }] }),
  component: NewQuote,
});

function NewQuote() {
  const router = useRouter();
  const { data: activeQuote, isLoading } = useActiveQuote();
  const { data: items = [] } = useQuoteItems(activeQuote?.id);
  const removeItem = useRemoveQuoteItem(activeQuote?.id);
  const updateQuote = useUpdateQuote();
  const ensureDraft = useEnsureDraftQuote();
  const requestedDraft = useRef(false);

  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (activeQuote) {
      setClient(activeQuote.client_name ?? "");
      setPhone(activeQuote.client_phone ?? "");
      setNotes(activeQuote.client_notes ?? "");
    }
  }, [activeQuote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading && !activeQuote && !requestedDraft.current) {
      requestedDraft.current = true;
      ensureDraft.mutate();
    }
  }, [isLoading, activeQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!activeQuote) {
      toast.error("لا يوجد عروض محددة بعد");
      return;
    }
    if (!client.trim()) {
      toast.error("اسم العميل مطلوب");
      return;
    }
    if (items.length === 0) {
      toast.error("اختر عرضًا واحدًا على الأقل");
      return;
    }
    try {
      await updateQuote.mutateAsync({
        id: activeQuote.id,
        patch: {
          client_name: client.trim(),
          client_phone: phone.trim() || null,
          client_notes: notes.trim() || null,
          status: "ready",
        },
      });
      toast.success("تم حفظ عرض السعر");
      router.navigate({ to: "/quotes/$id", params: { id: activeQuote.id } });
    } catch (e) {
      toast.error("فشل الحفظ: " + (e instanceof Error ? e.message : ""));
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold">إنشاء عرض سعر جديد</h1>
        <p className="text-sm text-muted-foreground">
          أدخل بيانات العميل، راجع الباقات المختارة، ثم احفظ لتوليد رابط العرض.
        </p>
        {activeQuote && (
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {activeQuote.quote_number}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                جاري التحميل…
              </CardContent>
            </Card>
          ) : ensureDraft.isPending ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                جاري تجهيز مسودة عرض السعر…
              </CardContent>
            </Card>
          ) : !activeQuote || items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <FileText className="size-8 opacity-50" />
                لم يتم اختيار عروض بعد. اذهب إلى{" "}
                <a href="/sales" className="text-primary underline">
                  عروض المبيعات
                </a>{" "}
                أو صفحة الباكدج وأضف الأسعار.
              </CardContent>
            </Card>
          ) : (
            items.map((it) => {
              const r = it.hotel_rates;
              if (!r) return null;
              return (
                <Card key={it.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">
                        {r.hotel_name}{" "}
                        <span className="text-xs text-muted-foreground">— {r.hotel_group}</span>
                      </div>
                      <div className="text-sm mt-0.5">{r.package_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.region} • {fmtRange(r.date_from, r.date_to)} • {r.room_type} •{" "}
                        {r.meal_plan}
                      </div>
                    </div>
                    <div className="text-end shrink-0 flex flex-col items-end gap-1">
                      <div className="text-lg font-bold text-primary">
                        {fmtMoney(r.adult_price, r.currency)}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={removeItem.isPending}
                        onClick={() => removeItem.mutate(it.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="h-fit sticky top-6">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>اسم العميل *</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+20…"
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات للعميل</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={save}
              disabled={updateQuote.isPending || !activeQuote || items.length === 0}
            >
              <Save className="size-4 me-2" />
              {updateQuote.isPending ? "جاري الحفظ…" : "حفظ عرض السعر"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
