import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "ELBAKRI Hotel Rates" }],
  }),
  component: Index,
});

function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) router.navigate({ to: "/auth" });
    else if (profile?.role === "sales") router.navigate({ to: "/sales" });
    else router.navigate({ to: "/dashboard" });
  }, [loading, session, profile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      جاري التحميل…
    </div>
  );
}
