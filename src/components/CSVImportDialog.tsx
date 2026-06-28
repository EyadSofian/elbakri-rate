import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { csvToRecords } from "@/lib/csv";
import type { HotelRateInsert } from "@/lib/rates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { triggerSheetSync } from "@/lib/syncSheets";

const REQUIRED: (keyof HotelRateInsert)[] = [
  "region","hotel_name","package_name","date_from","date_to","room_type","meal_plan","pricing_basis","currency","adult_price",
];

export function CSVImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; onImported?: () => void }) {
  const [records, setRecords] = useState<Partial<HotelRateInsert>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    const text = await f.text();
    const { headers, records } = csvToRecords(text);
    setHeaders(headers);
    setRecords(records);
  };

  const valid = records.filter((r) => REQUIRED.every((k) => r[k] !== undefined && r[k] !== null && String(r[k]) !== ""));
  const skipped = records.length - valid.length;

  const doImport = async () => {
    setBusy(true);
    let imported = 0, failed = 0, overwritten = 0;
    for (const r of valid) {
      let res;
      if (r.record_id) {
        if (overwrite) {
          res = await supabase.from("hotel_rates").upsert(r as HotelRateInsert, { onConflict: "record_id" });
          if (!res.error) overwritten++;
        } else {
          const exists = await supabase.from("hotel_rates").select("id").eq("record_id", r.record_id).maybeSingle();
          if (exists.data) { failed++; continue; }
          res = await supabase.from("hotel_rates").insert(r as HotelRateInsert);
        }
      } else {
        res = await supabase.from("hotel_rates").insert(r as HotelRateInsert);
      }
      if (res?.error) failed++;
      else imported++;
    }
    setBusy(false);
    toast.success(`تم: ${imported} • تم تجاوز: ${skipped + failed} • تم استبدال: ${overwritten}`);
    setRecords([]); setHeaders([]);
    onOpenChange(false);
    onImported?.();
    if (imported > 0 || overwritten > 0) void triggerSheetSync({ silent: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استيراد أسعار من CSV</DialogTitle>
          <DialogDescription>
            ارفع ملف CSV مُصدَّر من Excel Master_Long. سيتم مطابقة الأعمدة تلقائياً حسب أسمائها.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ملف CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>

          {records.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
                <span>السجلات المقروءة: <b className="text-foreground">{records.length}</b></span>
                <span>صالحة للاستيراد: <b className="text-emerald-600">{valid.length}</b></span>
                <span>سيتم تجاوزها (حقول ناقصة): <b className="text-destructive">{skipped}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ow" checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
                <Label htmlFor="ow" className="text-sm font-normal">استبدال السجلات الموجودة بنفس record_id</Label>
              </div>
              <div className="border rounded-md max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.slice(0, 8).map((h) => <TableHead key={h}>{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.slice(0, 30).map((r, i) => (
                      <TableRow key={i}>
                        {headers.slice(0, 8).map((h) => <TableCell key={h} className="text-xs">{String((r as Record<string, unknown>)[h] ?? "")}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={doImport} disabled={busy || valid.length === 0}>
            <Upload className="size-4 me-2" />
            {busy ? "جاري…" : `استيراد ${valid.length} سجل`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}