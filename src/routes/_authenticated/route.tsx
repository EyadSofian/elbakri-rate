import { createFileRoute } from "@tanstack/react-router";

import { CleanRateHub } from "@/components/CleanRateHub";

export const Route = createFileRoute("/_authenticated")({
  component: CleanRateHub,
});
