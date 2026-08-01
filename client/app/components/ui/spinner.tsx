import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

export type SpinnerProps = {
  className?: string;
  /** Accessible label. Defaults to the translated "Loading..." string. */
  label?: string;
};

/**
 * Bare spinning icon. Announces itself to screen readers via `label`,
 * so callers can drop the visible "Loading..." text.
 */
export function Spinner({ className, label }: SpinnerProps) {
  const { t } = useTranslation();
  const resolved = label ?? t("common.loading");
  return (
    <>
      <Loader2
        className={cn("h-4 w-4 animate-spin shrink-0", className)}
        aria-hidden
      />
      <span className="sr-only" role="status">
        {resolved}
      </span>
    </>
  );
}

/**
 * Block-level loading state — replaces a full "Loading..." paragraph while a
 * page or panel fetches. Centred so it reads as a placeholder, not content.
 */
export function LoadingBlock({
  className,
  label,
}: SpinnerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center py-8 text-muted-foreground",
        className
      )}
      data-slot="loading-block"
    >
      <Spinner className="h-5 w-5" label={label} />
    </div>
  );
}
