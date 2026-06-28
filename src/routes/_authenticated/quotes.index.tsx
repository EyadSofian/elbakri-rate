import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ExternalLink, User, Hash, Layers, Calendar, Search } from "lucide-react";
import { fmtDate } from "@/lib/rates";
import { useQuotesList } from "@/lib/quoteService";

export const Route = createFileRoute("/_authenticated/quotes/")({
  head: () => ({ meta: [{ title: "عروض الأسعار — ELBAKRI" }] }),
  component: QuotesList,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", ready: "جاهز", sent: "مُرسل", archived: "مؤرشف",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  archived: "bg-muted text-muted-foreground",
};

function QuotesList() {
  const router = useRouter();
  const { data: quotes = [], isLoading } = useQuotesList();

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">عروض الأسعار</h1>
          <p className="text-sm text-muted-foreground">إدارة عروض الأسعار المحفوظة للعملاء</p>
        </div>
        <Button onClick={() => router.navigate({ to: "/quotes/new" })}>
          <Plus className="size-4 me-2" />عرض جديد
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">جاري التحميل…</CardContent></Card>
      ) : quotes.length === 0 ? (
        <Card><CardContent className="p-10 sm:p-12 text-center flex flex-col items-center gap-3">
          <FileText className="size-10 text-muted-foreground/50" />
          <div className="font-semibold">لا توجد عروض أسعار محفوظة بعد</div>
          <p className="text-sm text-muted-foreground max-w-sm">
            ابدأ من <span className="font-medium">عروض المبيعات</span> أو من صفحة الباكدج،
            اختر الفنادق المطلوبة، ثم اضغط <span className="font-medium">«أضف لعرض السعر»</span>.
          </p>
          <div className="flex gap-2 pt-1">
            <Link to="/sales"><Button variant="default"><Search className="size-4 me-2" />عروض المبيعات</Button></Link>
            <Link to="/packages"><Button variant="outline">الباكدجات</Button></Link>
          </div>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {quotes.map((q) => {
            const itemCount = q.quote_items?.[0]?.count ?? 0;
            return (
              <Card key={q.id} className="hover:shadow-md transition flex flex-col">
                <CardContent className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-base font-semibold truncate">
                        <User className="size-4 text-primary shrink-0" />
                        {q.client_name || <span className="text-muted-foreground font-normal">بدون اسم عميل</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                        <Hash className="size-3" />{q.quote_number}
                      </div>
                    </div>
                    <Badge variant="outline" className={STATUS_TONE[q.status] ?? ""}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-secondary/50 rounded-md p-2">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Layers className="size-3" />العروض المختارة</div>
                      <div className="font-bold text-base">{itemCount}</div>
                    </div>
                    <div className="bg-secondary/50 rounded-md p-2">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="size-3" />التاريخ</div>
                      <div className="font-medium text-xs">{fmtDate(q.created_at)}</div>
                    </div>
                  </div>

                  {q.client_phone && (
                    <div className="text-xs text-muted-foreground" dir="ltr">{q.client_phone}</div>
                  )}

                  <Link to="/quotes/$id" params={{ id: q.id }} className="mt-auto">
                    <Button className="w-full" variant="default">
                      <ExternalLink className="size-4 me-2" />فتح العرض
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}