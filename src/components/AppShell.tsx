import { type ReactNode, useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Search,
  FileText,
  Users,
  LogOut,
  Building2,
  Package as PackageIcon,
  Layers,
  Languages,
  Menu,
  MoreHorizontal,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useI18n, type TKey } from "@/hooks/useI18n";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  labelKey: TKey;
  icon: LucideIcon;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ["admin", "operations"] },
  { to: "/hotel-groups", labelKey: "nav.groups", icon: Layers, roles: ["admin", "operations"] },
  { to: "/hotels", labelKey: "nav.hotels", icon: Building2, roles: ["admin", "operations"] },
  { to: "/packages", labelKey: "nav.packages", icon: PackageIcon, roles: ["admin", "operations", "sales", "viewer"] },
  { to: "/sales", labelKey: "nav.sales", icon: Search, roles: ["admin", "sales"] },
  { to: "/quotes", labelKey: "nav.quotes", icon: FileText, roles: ["admin", "sales", "operations"] },
  { to: "/users", labelKey: "nav.users", icon: Users, roles: ["admin"] },
  { to: "/system-check", labelKey: "nav.systemCheck", icon: ShieldCheck, roles: ["admin", "operations", "sales", "viewer"] },
];

// Up to 4 primary items shown in the mobile bottom bar (+ "More" drawer toggle).
const MOBILE_PRIMARY: { to: string; labelKey: TKey; icon: LucideIcon; roles: AppRole[] }[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ["admin", "operations"] },
  { to: "/hotels", labelKey: "nav.hotels", icon: Building2, roles: ["admin", "operations"] },
  { to: "/packages", labelKey: "nav.packages", icon: PackageIcon, roles: ["admin", "operations", "sales", "viewer"] },
  { to: "/sales", labelKey: "nav.sales", icon: Search, roles: ["admin", "sales"] },
  { to: "/quotes", labelKey: "nav.quotes", icon: FileText, roles: ["admin", "sales", "operations"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { t, lang, toggle, dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => profile && n.roles.includes(profile.role));
  const mobileItems = MOBILE_PRIMARY.filter((n) => profile && n.roles.includes(profile.role)).slice(0, 4);
  const roleKey = (`role.${profile?.role ?? "viewer"}`) as TKey;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const sidebarBody = (
    <>
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between gap-2">
        <Logo variant="white" withText />
        <button
          onClick={toggle}
          title={lang === "ar" ? "English" : "العربية"}
          className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/60 bg-sidebar-accent/40 px-2 py-1 text-[11px] font-semibold text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
        >
          <Languages className="size-3" />
          {lang === "ar" ? "EN" : "ع"}
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((n) => {
          const active = pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                  : "hover:bg-sidebar-accent/60 text-sidebar-foreground/85",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t(n.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="px-2 min-w-0">
          <div className="text-sm font-medium truncate">{profile?.full_name || "—"}</div>
          <div className="text-[11px] opacity-75">{profile ? t(roleKey) : ""}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="size-4 me-2" />
          {t("auth.signout")}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background" dir={dir}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-sidebar text-sidebar-foreground flex-col print:hidden border-e border-sidebar-border">
        {sidebarBody}
      </aside>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={dir === "rtl" ? "right" : "left"}
          className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
        >
          {sidebarBody}
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 h-14 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground shrink-0"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 flex justify-center">
            <Logo variant="white" withText />
          </div>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/60 bg-sidebar-accent/40 px-2 py-1 text-[11px] font-semibold text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <Languages className="size-3" />
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </header>
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom navigation */}
        {profile && (
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border safe-bottom print:hidden"
            aria-label="Bottom navigation"
          >
            <ul className="grid grid-cols-5">
              {mobileItems.map((n) => {
                const active = pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <li key={n.to}>
                    <Link
                      to={n.to}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 h-14 px-1 text-[10px] leading-tight text-center transition-colors",
                        active
                          ? "text-[var(--gold)] font-semibold"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="line-clamp-2 break-words">{t(n.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  onClick={() => setMobileOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 h-14 w-full px-1 text-[10px] leading-tight text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-5" />
                  <span>{t("nav.more")}</span>
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}