import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Star,
  Layers,
  Grid3x3,
  ArrowRight,
} from "lucide-react";
import { HotelFormDialog } from "@/components/HotelFormDialog";
import { REGIONS } from "@/lib/constants";
import { HOTEL_STATUSES, type Hotel, type HotelGroup } from "@/lib/library";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hotels/")({
  head: () => ({ meta: [{ title: "مكتبة الفنادق — ELBAKRI" }] }),
  component: HotelsPage,
});

function HotelsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");

  const { data: hotels = [] } = useQuery({
    queryKey: ["hotels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotels").select("*").order("hotel_name");
      if (error) throw error;
      return data as Hotel[];
    },
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["hotel_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotel_groups").select("*").order("name");
      if (error) throw error;
      return data as HotelGroup[];
    },
  });

  const filtered = useMemo(
    () =>
      hotels.filter((h) => {
        if (region !== "all" && h.region !== region) return false;
        if (group !== "all" && h.hotel_group_id !== group) return false;
        if (status !== "all" && h.status !== status) return false;
        if (q && !`${h.hotel_name} ${h.address ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [hotels, region, group, status, q],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hotels"] });
    qc.invalidateQueries({ queryKey: ["hotels_for_form"] });
    qc.invalidateQueries({ queryKey: ["hotels_matrix"] });
    qc.invalidateQueries({ queryKey: ["sales_rates"] });
    qc.invalidateQueries({ queryKey: ["package_rate_counts"] });
  };

  const onDelete = async (h: Hotel) => {
    if (!confirm(`حذف ${h.hotel_name}؟`)) return;
    const { error } = await supabase.from("hotels").delete().eq("id", h.id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      refresh();
    }
  };

  const addGroup = async () => {
    if (!newGroup.trim()) return;
    const { error } = await supabase.from("hotel_groups").insert({ name: newGroup.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success("تمت إضافة المجموعة");
      setNewGroup("");
      setGroupOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel_groups"] });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px]">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">مكتبة الفنادق</h1>
          <p className="text-sm text-muted-foreground">
            {hotels.length} فندق • {groups.length} مجموعة فندقية
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/hotel-groups">
              <Layers className="size-4 me-2" />
              المجموعات الفندقية
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setGroupOpen((v) => !v)}>
            <Plus className="size-4 me-2" />
            مجموعة سريعة
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4 me-2" />
            إضافة فندق
          </Button>
        </div>
      </div>

      {groupOpen && (
        <Card>
          <CardContent className="p-4 flex gap-2">
            <Input
              placeholder="اسم المجموعة الفندقية"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
            />
            <Button onClick={addGroup}>حفظ</Button>
            <Button variant="ghost" onClick={() => setGroupOpen(false)}>
              إلغاء
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="بحث (اسم / عنوان)" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger>
              <SelectValue placeholder="المنطقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المناطق</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger>
              <SelectValue placeholder="المجموعة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المجموعات</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {HOTEL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Building2 className="size-8 opacity-50" />
            لا توجد فنادق مطابقة. أضف أول فندق.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((h) => {
            const g = groups.find((x) => x.id === h.hotel_group_id);
            return (
              <Card key={h.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-base flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        {h.hotel_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{g?.name ?? "—"}</div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-1 rounded ${h.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {h.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {h.region}
                      {h.sub_region ? ` — ${h.sub_region}` : ""}
                    </span>
                    {h.star_rating && (
                      <span className="flex items-center gap-1">
                        <Star className="size-3 text-amber-500" />
                        {h.star_rating}
                      </span>
                    )}
                  </div>
                  {h.facilities && (
                    <div className="text-xs text-foreground/70 line-clamp-2">{h.facilities}</div>
                  )}
                  <div className="flex justify-end gap-1 pt-2 border-t">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/hotels/$id" params={{ id: h.id }}>
                        <ArrowRight className="size-3.5 me-1" />
                        تفاصيل
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({ to: "/rates/matrix/new", search: { hotelId: h.id } })
                      }
                    >
                      <Grid3x3 className="size-3.5 me-1" />
                      أسعار
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(h);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(h)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <HotelFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        groups={groups}
        onSaved={refresh}
      />
    </div>
  );
}
