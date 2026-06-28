import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { RateMatrix } from "@/components/RateMatrix";
import { ArrowRight } from "lucide-react";

const search = z.object({
  packageId: z.string().optional(),
  hotelId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/rates/matrix/new")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "إضافة أسعار (مصفوفة) — ELBAKRI" }] }),
  component: Page,
});

function Page() {
  const { packageId, hotelId } = Route.useSearch();
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px]">
      <div>
        <Link to="/packages" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight className="size-3" />العودة
        </Link>
        <h1 className="text-2xl font-bold mt-1">إضافة أسعار — مصفوفة</h1>
        <p className="text-sm text-muted-foreground">أدخل فنادق متعددة وفترات متعددة وأنواع غرف في خطوة واحدة.</p>
      </div>
      <RateMatrix
        defaultPackageId={packageId}
        defaultHotelIds={hotelId ? [hotelId] : undefined}
      />
    </div>
  );
}