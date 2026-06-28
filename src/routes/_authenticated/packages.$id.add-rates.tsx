import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RateMatrix } from "@/components/RateMatrix";
import type { Package, PackageHotel } from "@/lib/library";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/packages/$id/add-rates")({
  head: () => ({ meta: [{ title: "إضافة أسعار للباكدج — ELBAKRI" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { data: pkg } = useQuery({
    queryKey: ["pkg_add_rates", id],
    queryFn: async () => (await supabase.from("packages").select("*").eq("id", id).maybeSingle()).data as Package | null,
  });
  const { data: links = [] } = useQuery({
    queryKey: ["pkg_add_rates_links", id],
    queryFn: async () => (await supabase.from("package_hotels").select("*").eq("package_id", id)).data as PackageHotel[],
  });
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px]">
      <div>
        <Link to="/packages/$id" params={{ id }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight className="size-3" />العودة للباكدج
        </Link>
        <h1 className="text-2xl font-bold mt-1">إضافة أسعار — {pkg?.package_name ?? ""}</h1>
      </div>
      <RateMatrix defaultPackageId={id} defaultHotelIds={links.map((l) => l.hotel_id)} lockPackage />
    </div>
  );
}