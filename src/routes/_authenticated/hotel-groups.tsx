import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import type { HotelGroup } from "@/lib/library";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hotel-groups")({
  head: () => ({ meta: [{ title: "المجموعات الفندقية — ELBAKRI" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HotelGroup | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ["hotel_groups"],
    queryFn: async () => (await supabase.from("hotel_groups").select("*").order("name")).data as HotelGroup[],
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["hotel_groups_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("hotels").select("hotel_group_id");
      const m: Record<string, number> = {};
      (data ?? []).forEach((h: { hotel_group_id: string | null }) => {
        if (h.hotel_group_id) m[h.hotel_group_id] = (m[h.hotel_group_id] ?? 0) + 1;
      });
      return m;
    },
  });

  const reset = () => { setEditing(null); setName(""); setNotes(""); };
  const startEdit = (g: HotelGroup) => { setEditing(g); setName(g.name); setNotes(g.notes ?? ""); };

  const save = async () => {
    if (!name.trim()) { toast.error("اسم المجموعة مطلوب"); return; }
    setBusy(true);
    const payload = { name: name.trim(), notes: notes.trim() || null };
    const r = editing
      ? await supabase.from("hotel_groups").update(payload).eq("id", editing.id)
      : await supabase.from("hotel_groups").insert(payload);
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(editing ? "تم التحديث" : "تمت الإضافة");
    reset();
    qc.invalidateQueries({ queryKey: ["hotel_groups"] });
  };

  const del = async (g: HotelGroup) => {
    if (!confirm(`حذف مجموعة "${g.name}"؟`)) return;
    const { error } = await supabase.from("hotel_groups").delete().eq("id", g.id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["hotel_groups"] }); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold">المجموعات الفندقية</h1>
        <p className="text-sm text-muted-foreground">{groups.length} مجموعة — مثل: مجموعة الباتروس، نيفرلاند، نوفوتيل.</p>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">{editing ? "تعديل مجموعة" : "إضافة مجموعة جديدة"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>اسم المجموعة *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مجموعة الباتروس" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          {editing && <Button variant="ghost" onClick={reset} disabled={busy}>إلغاء</Button>}
          <Button onClick={save} disabled={busy}><Plus className="size-4 me-1" />{editing ? "حفظ التعديلات" : "إضافة"}</Button>
        </div>
      </CardContent></Card>

      {groups.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">لا توجد مجموعات بعد.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2"><Building2 className="size-4 text-primary" />{g.name}</div>
                    <div className="text-xs text-muted-foreground">{counts[g.id] ?? 0} فندق</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(g)}><Pencil className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(g)}><Trash2 className="size-3.5 text-destructive" /></Button>
                  </div>
                </div>
                {g.notes && <div className="text-xs text-foreground/70">{g.notes}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}