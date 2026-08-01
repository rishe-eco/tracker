import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: false) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** May be async — the dialog stays open and shows a spinner until it settles. */
  onConfirm: () => void | Promise<void>;
  /** Called when user cancels (Cancel button or overlay click). If not set, only onOpenChange(false) is called. */
  onCancel?: () => void;
  /** Force the confirm button into its loading state from the parent. */
  confirmLoading?: boolean;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmLoading = false,
  variant = "default",
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const { submitting, run } = useSubmitGuard();
  const busy = submitting || confirmLoading;
  if (!open) return null;
  const resolvedConfirm = confirmLabel ?? t("common.confirm");
  const resolvedCancel = cancelLabel ?? t("common.cancel");

  const handleConfirm = async () => {
    // Hold the dialog open while an async confirm runs, so the destructive
    // action cannot be fired twice.
    await run(async () => {
      await onConfirm();
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (busy) return;
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => handleCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? "confirm-dialog-description" : undefined}
    >
      <div
        className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="font-medium mb-1">
          {title}
        </h3>
        {description && (
          <p id="confirm-dialog-description" className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={busy}>
            {resolvedCancel}
          </Button>
          <Button
            size="sm"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            loading={busy}
          >
            {resolvedConfirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
