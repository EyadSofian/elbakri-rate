import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Package as PackageIcon,
  MapPin,
  Pencil,
  Trash2,
  ArrowLeft,
  Send,
} from "lucide-react";
import { PackageFormDialog } from "@/components/PackageFormDialog";
import { useAuth } from "@/hooks/useAuth";
import type { Hotel, HotelGroup, Package, PackageHotel } from "@/lib/library";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/packages/")({
  head: () => ({ meta: [{ title: "الباكدجات — ELBAKRI" }] }),
  component: PackagesPage,
});

function PackagesPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "admin" || profile?.role === "operations";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("package_name");
      if (error) throw error;
      return data as Package[];
    },
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["hotel_groups"],
    queryFn: async () => (await supabase.from("hotel_groups").select("*")).data as HotelGroup[],
  });
  const { data: hotels = [] } = useQuery({
    queryKey: ["hotels"],
    queryFn: async () => (await supabase.from("hotels").select("*")).data as Hotel[],
  });
  const { data: links = [] } = useQuery({
    queryKey: ["package_hotels"],
    queryFn: async () => (await supabase.from("package_hotels").select("*")).data as PackageHotel[],
  });
  const { data: rateCounts = {} } = useQuery({
    queryKey: ["package_rate_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("hotel_rates").select("package_id, status");
      const m: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        if (r.package_id && r.status === "Ready") m[r.package_id] = (m[r.package_id] ?? 0) + 1;
      });
      return m;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["packages"] });
    qc.invalidateQueries({ queryKey: ["package_hotels"] });
    qc.invalidateQueries({ queryKey: ["package_rate_counts"] });
    qc.invalidateQueries({ queryKey: ["sales_rates"] });
    qc.invalidateQueries({ queryKey: ["packages_for_form"] });
    qc.invalidateQueries({ queryKey: ["package_hotels_for_form"] });
    qc.invalidateQueries({ queryKey: ["packages_matrix"] });
    qc.invalidateQueries({ queryKey: ["package_hotels_matrix"] });
  };

  const onDelete = async (p: Package) => {
    if (!confirm(`حذف ${p.package_name}؟`)) return;
    const { error } = await supabase.from("packages").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      refresh();
    }
  };

  const editingHotelIds = editing
    ? links.filter((l) => l.package_id === editing.id).map((l) => l.hotel_id)
    : [];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px]">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">الباكدجات</h1>
          <p className="text-sm text-muted-foreground">{packages.length} باكدج</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4 me-2" />
            باكدج جديد
          </Button>
        )}
      </div>

      {packages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <PackageIcon className="size-8 opacity-50" />
            لا توجد باكدجات بعد.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((p) => {
            const group = groups.find((g) => g.id === p.hotel_group_id);
            const hotelCount = links.filter((l) => l.package_id === p.id).length;
            const ready = rateCounts[p.id] ?? 0;
            return (
              <Card key={p.id} className="hover:shadow-md transition">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/packages/$id"
                      params={{ id: p.id }}
                      className="font-semibold text-base flex items-center gap-2 hover:text-primary min-w-0"
                    >
                      <PackageIcon className="size-4 text-primary shrink-0" />
                      <span className="truncate">{p.package_name}</span>
                    </Link>
                    <span
                      className={`text-[10px] px-2 py-1 rounded shrink-0 ${p.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="فنادق" value={hotelCount} />
                    <Stat label="عروض جاهزة" value={ready} accent="text-emerald-600" />
                    <Stat label="المنطقة" value={p.region ?? "—"} small />
                  </div>
                  {group && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3" />
                      {group.name}
                    </div>
                  )}
                  <div className="flex gap-1 justify-end pt-2 border-t">
                    <Link to="/packages/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="outline">
                        <ArrowLeft className="size-3.5 me-1" />
                        فتح
                      </Button>
                    </Link>
                    <Link to="/sales/packages/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="default">
                        <Send className="size-3.5 me-1" />
                        إرسال للعميل
                      </Button>
                    </Link>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(p)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PackageFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        groups={groups}
        hotels={hotels}
        selectedHotelIds={editingHotelIds}
        onSaved={refresh}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string | number;
  accent?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-secondary/50 rounded-md p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-lg"} ${accent ?? ""} truncate`}>
        {value}
      </div>
    </div>
  );
}
