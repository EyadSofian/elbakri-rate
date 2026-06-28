import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel, type AppRole } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fmtDate } from "@/lib/rates";
import { REGIONS } from "@/lib/constants";
import { SCOPE_TYPES, scopeTypeLabel, type AccessRule, type HotelGroup, type Hotel, type Package, type ScopeType } from "@/lib/library";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProfileRow { id: string; full_name: string | null; email: string | null; role: AppRole; is_active: boolean; created_at: string }

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "المستخدمون — ELBAKRI" }] }),
  component: Users,
});

function Users() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [scopeUser, setScopeUser] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") router.navigate({ to: "/dashboard" });
  }, [profile, loading, router]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, role, is_active, created_at").order("created_at");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const setRole = async (id: string, role: AppRole) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الصلاحية"); qc.invalidateQueries({ queryKey: ["profiles"] }); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(active ? "تم التفعيل" : "تم الإيقاف"); qc.invalidateQueries({ queryKey: ["profiles"] }); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <p className="text-sm text-muted-foreground">تعديل صلاحيات الموظفين ونطاق الوصول للبيانات. المستخدمون الجدد يبدؤون بصلاحية "مبيعات".</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الصلاحية</TableHead>
                  <TableHead>مفعّل</TableHead>
                  <TableHead>نطاق الوصول</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-xs" dir="ltr">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => setRole(u.id, v as AppRole)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["admin","operations","sales","viewer"] as AppRole[]).map((r) => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.is_active} onCheckedChange={(v) => toggleActive(u.id, v)} />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setScopeUser(u)}>
                        <Shield className="size-3.5 me-1" />تحديد النطاق
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccessRulesDialog user={scopeUser} onClose={() => setScopeUser(null)} />
    </div>
  );
}

function AccessRulesDialog({ user, onClose }: { user: ProfileRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!user;
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [scopeId, setScopeId] = useState<string>("");
  const [perms, setPerms] = useState({ view: true, edit: false, export: false });

  const { data: rules = [] } = useQuery({
    queryKey: ["access_rules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_access_rules").select("*").eq("user_id", user!.id);
      return (data ?? []) as AccessRule[];
    },
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["hotel_groups"],
    queryFn: async () => (await supabase.from("hotel_groups").select("*").order("name")).data as HotelGroup[],
  });
  const { data: hotels = [] } = useQuery({
    queryKey: ["hotels"],
    queryFn: async () => (await supabase.from("hotels").select("*").order("hotel_name")).data as Hotel[],
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => (await supabase.from("packages").select("*").order("package_name")).data as Package[],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["access_rules", user?.id] });

  const addRule = async () => {
    if (!user) return;
    if (scopeType !== "all" && !scopeId) { toast.error("اختر القيمة"); return; }
    const { error } = await supabase.from("user_access_rules").insert({
      user_id: user.id,
      scope_type: scopeType,
      scope_id: scopeType === "all" ? null : scopeId,
      can_view: perms.view, can_edit: perms.edit, can_export: perms.export,
    });
    if (error) toast.error(error.message);
    else { toast.success("تمت الإضافة"); setScopeId(""); refresh(); }
  };

  const removeRule = async (id: string) => {
    const { error } = await supabase.from("user_access_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const valueLabel = (r: AccessRule) => {
    if (r.scope_type === "all") return "الكل";
    if (!r.scope_id) return "—";
    if (r.scope_type === "region") return r.scope_id;
    if (r.scope_type === "hotel_group") return groups.find((g) => g.id === r.scope_id)?.name ?? r.scope_id;
    if (r.scope_type === "hotel") return hotels.find((h) => h.id === r.scope_id)?.hotel_name ?? r.scope_id;
    if (r.scope_type === "package") return packages.find((p) => p.id === r.scope_id)?.package_name ?? r.scope_id;
    return r.scope_id;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>نطاق الوصول — {user?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">نوع النطاق</Label>
                <Select value={scopeType} onValueChange={(v) => { setScopeType(v as ScopeType); setScopeId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPE_TYPES.map((s) => <SelectItem key={s} value={s}>{scopeTypeLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">القيمة</Label>
                {scopeType === "all" ? (
                  <Input value="—" disabled />
                ) : scopeType === "region" ? (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : scopeType === "hotel_group" ? (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : scopeType === "hotel" ? (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
                    <SelectContent>
                      {hotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.hotel_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
                    <SelectContent>
                      {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.package_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="flex gap-4 items-center text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={perms.view} onCheckedChange={(v) => setPerms((p) => ({ ...p, view: !!v }))} />عرض</label>
              <label className="flex items-center gap-2"><Checkbox checked={perms.edit} onCheckedChange={(v) => setPerms((p) => ({ ...p, edit: !!v }))} />تعديل</label>
              <label className="flex items-center gap-2"><Checkbox checked={perms.export} onCheckedChange={(v) => setPerms((p) => ({ ...p, export: !!v }))} />تصدير</label>
              <Button size="sm" className="ms-auto" onClick={addRule}>إضافة قاعدة</Button>
            </div>
          </CardContent></Card>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {rules.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">لا توجد قواعد. هذا المستخدم لن يرى أي بيانات (إلا لو كان admin/operations).</div>
            ) : rules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-md text-sm">
                <div className="flex-1">
                  <div className="font-medium">{scopeTypeLabel(r.scope_type as ScopeType)}: {valueLabel(r)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.can_view && "عرض "}
                    {r.can_edit && "• تعديل "}
                    {r.can_export && "• تصدير"}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeRule(r.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}