import logoAsset from "@/assets/elbakri-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  className?: string;
  variant?: "default" | "white";
  withText?: boolean;
}

/**
 * ELBAKRI OVERSEAS official logo.
 * The PNG asset already includes the wordmark; `withText` adds a tagline below it.
 */
export function Logo({ className, variant = "default", withText = false }: Props) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "rounded-md grid place-items-center overflow-hidden",
          variant === "white" ? "bg-white" : "bg-white/95",
          "size-10 shrink-0 shadow-sm",
        )}
      >
        <img src={logoAsset.url} alt="ELBAKRI OVERSEAS" className="w-full h-full object-contain p-1" />
      </div>
      {withText && (
        <div className="leading-tight">
          <div className={cn("font-bold text-sm", variant === "white" ? "text-white" : "text-foreground")}>
            ELBAKRI OVERSEAS
          </div>
          <div className={cn("text-[10px]", variant === "white" ? "text-white/75" : "text-muted-foreground")}>
            {t("brand.tagline")}
          </div>
        </div>
      )}
    </div>
  );
}

export function LogoLarge({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="ELBAKRI OVERSEAS"
      className={cn("h-16 w-auto object-contain", className)}
    />
  );
}