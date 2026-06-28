import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Logo, LogoLarge } from "@/components/Logo";
import { useI18n } from "@/hooks/useI18n";
import { Languages } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — ELBAKRI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, profile, loading } = useAuth();
  const { t, lang, toggle } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session) {
      if (profile?.role === "sales") router.navigate({ to: "/sales" });
      else if (profile?.role === "viewer") router.navigate({ to: "/packages" });
      else router.navigate({ to: "/dashboard" });
    }
  }, [session, profile, loading, router]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(t("auth.fail.signin") + ": " + error.message);
    else toast.success(t("auth.ok.signin"));
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) toast.error(t("auth.fail.signup") + ": " + error.message);
    else toast.success(t("auth.ok.signup"));
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="flex items-center justify-between relative">
          <Logo variant="white" withText />
          <button onClick={toggle} className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20 transition-colors">
            <Languages className="size-3" /> {lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-snug">{t("auth.hero.title")}</h1>
          <p className="opacity-80 text-sm leading-relaxed max-w-md">{t("auth.hero.desc")}</p>
        </div>
        <div className="text-xs opacity-70 tracking-wider">{t("brand.company")}</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between lg:hidden">
              <LogoLarge />
              <button onClick={toggle} className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-accent transition-colors">
                <Languages className="size-3" /> {lang === "ar" ? "EN" : "ع"}
              </button>
            </div>
            <CardTitle>{t("auth.welcome")}</CardTitle>
            <CardDescription>{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("auth.email")}</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.password")}</Label>
                    <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? t("auth.entering") : t("auth.enter")}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("auth.fullname")}</Label>
                    <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.email")}</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.password")}</Label>
                    <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? t("auth.creating") : t("auth.create")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("auth.note")}</p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}