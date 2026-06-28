import { createFileRoute } from "@tanstack/react-router";

import { CleanRateHub } from "@/components/CleanRateHub";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "ELBAKRI Rate Hub" }] }),
  component: CleanRateHub,
});
