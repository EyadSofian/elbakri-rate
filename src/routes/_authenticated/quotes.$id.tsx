import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Share2, Download, MessageCircle, Image as ImageIcon } from "lucide-react";
import { fmtDate, fmtMoney, fmtRange, type HotelRate } from "@/lib/rates";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import logoAsset from "@/assets/elbakri-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/quotes/$id")({
  head: () => ({ meta: [{ title: "عرض السعر — ELBAKRI" }] }),
  component: QuoteView,
});

function QuoteView() {
  const { id } = Route.useParams();
  const exportRef = useRef<HTMLDivElement>(null);

  const { data: quote } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: rates = [] } = useQuery({
    queryKey: ["quote_rates", id],
    enabled: !!quote,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select("hotel_rates(*)")
        .eq("quote_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.hotel_rates as HotelRate | null)
        .filter((r): r is HotelRate => !!r);
    },
  });

  const buildWhatsApp = () => {
    if (!quote) return "";
    const lines = [
      `*ELBAKRI OVER SEAS FOR TRAVEL*`,
      `عرض سعر — ${quote.quote_number}`,
      `العميل: ${quote.client_name}`,
      ``,
      ...rates.map((r, i) => [
        `${i + 1}. ${r.hotel_name} — ${r.package_name}`,
        `   📅 ${fmtRange(r.date_from, r.date_to)}`,
        `   🛏 ${r.room_type} | 🍽 ${r.meal_plan}`,
        `   💰 ${fmtMoney(r.adult_price, r.currency)} — ${r.pricing_basis}`,
        r.transfer_details ? `   🚗 ${r.transfer_details}` : "",
      ].filter(Boolean).join("\n")),
      ``,
      quote.client_notes ? `📝 ${quote.client_notes}` : "",
    ].filter(Boolean).join("\n");
    return lines;
  };

  const copyWA = async () => {
    await navigator.clipboard.writeText(buildWhatsApp());
    toast.success("تم نسخ رسالة الواتساب");
  };

  const shareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ url, title: `عرض سعر ${quote?.quote_number}` });
      else { await navigator.clipboard.writeText(url); toast.success("تم نسخ رابط العرض"); }
    } catch { /* user cancelled */ }
  };

  const exportPNG = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${quote?.quote_number ?? "quote"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("تم تنزيل الصورة");
    } catch (e) {
      toast.error("فشل التصدير: " + (e instanceof Error ? e.message : ""));
    }
  };

  const exportPDF = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => { img.onload = res; });
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${quote?.quote_number ?? "quote"}.pdf`);
    } catch (e) {
      toast.error("فشل التصدير: " + (e instanceof Error ? e.message : ""));
    }
  };

  if (!quote) return <div className="p-12 text-center text-muted-foreground">جاري التحميل…</div>;

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28 lg:pb-6 space-y-4 print:p-0 print:max-w-none print:pb-0">
        {/* Desktop actions */}
        <div className="hidden sm:flex gap-2 print:hidden flex-wrap">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 me-2" />طباعة</Button>
          <Button variant="outline" onClick={exportPDF}><Download className="size-4 me-2" />PDF</Button>
          <Button variant="outline" onClick={exportPNG}><ImageIcon className="size-4 me-2" />PNG</Button>
          <Button variant="outline" onClick={copyWA}><MessageCircle className="size-4 me-2" />نسخ رسالة واتساب</Button>
          <Button variant="outline" onClick={shareLink}><Share2 className="size-4 me-2" />مشاركة</Button>
        </div>

        <div ref={exportRef} className="bg-white rounded-lg border shadow-sm print:shadow-none print:border-0 overflow-hidden">
          <div className="bg-sidebar text-sidebar-foreground p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-md bg-white p-1.5 grid place-items-center">
                <img src={logoAsset.url} alt="ELBAKRI OVERSEAS" className="size-full object-contain" />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">ELBAKRI OVER SEAS FOR TRAVEL</div>
                <div className="text-xs opacity-80">الباكري لخدمات السفر والسياحة</div>
              </div>
            </div>
            <div className="text-end text-xs">
              <div className="font-mono opacity-90">{quote.quote_number}</div>
              <div className="opacity-75">{fmtDate(quote.created_at)}</div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="text-xs text-muted-foreground">عرض سعر مقدم إلى</div>
                <div className="font-bold text-lg">{quote.client_name}</div>
              </div>
              {quote.client_phone && <div className="text-sm text-muted-foreground" dir="ltr">{quote.client_phone}</div>}
            </div>

            <div className="space-y-3">
              {rates.map((r, i) => (
                <Card key={r.id} className="border-2">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px]">{i + 1}</span>
                          {r.region} • {r.hotel_group}
                        </div>
                        <div className="font-bold text-lg mt-1">{r.hotel_name}</div>
                        <div className="text-sm text-foreground/80">{r.package_name}</div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-2xl font-bold text-primary">{fmtMoney(r.adult_price, r.currency)}</div>
                        <div className="text-[10px] text-muted-foreground">{r.pricing_basis}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2 border-t">
                      <Cell label="الفترة">{fmtRange(r.date_from, r.date_to)}</Cell>
                      <Cell label="نوع الغرفة">{r.room_type}</Cell>
                      <Cell label="نظام الإقامة">{r.meal_plan}</Cell>
                      <Cell label="الانتقالات">{r.transfer_included || "—"}</Cell>
                    </div>
                    {r.child_policy && <Note label="سياسة الأطفال">{r.child_policy}</Note>}
                    {r.transfer_details && <Note label="تفاصيل الانتقالات">{r.transfer_details}</Note>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {quote.client_notes && (
              <div className="bg-secondary/50 rounded-md p-3 border">
                <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                <div className="text-sm whitespace-pre-wrap">{quote.client_notes}</div>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground text-center pt-4 border-t">
              الأسعار قابلة للتغيير حسب التوافر • برجاء التأكيد قبل الحجز • ELBAKRI OVER SEAS FOR TRAVEL
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom action bar */}
      <div className="sm:hidden fixed bottom-14 inset-x-0 z-30 bg-card border-t shadow-lg safe-bottom print:hidden">
        <div className="p-2 grid grid-cols-4 gap-1">
          <Button variant="ghost" size="sm" onClick={exportPDF} className="flex-col h-12 gap-0.5 text-[10px]"><Download className="size-4" />PDF</Button>
          <Button variant="ghost" size="sm" onClick={exportPNG} className="flex-col h-12 gap-0.5 text-[10px]"><ImageIcon className="size-4" />PNG</Button>
          <Button variant="ghost" size="sm" onClick={copyWA} className="flex-col h-12 gap-0.5 text-[10px]"><MessageCircle className="size-4" />واتساب</Button>
          <Button variant="ghost" size="sm" onClick={shareLink} className="flex-col h-12 gap-0.5 text-[10px]"><Share2 className="size-4" />مشاركة</Button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{children}</div>
    </div>
  );
}
function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs bg-muted/40 rounded p-2 mt-1">
      <span className="font-semibold text-foreground/80">{label}: </span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}