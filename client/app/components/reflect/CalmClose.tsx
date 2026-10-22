import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";

/**
 * The calm close (spec §4.9, plate 9), shown after Not now and after Stop here.
 * It is page state, not a step: the entry is already closed.
 *
 * Every string is a `reflect.calmClose.*` key in both locales (G6, AC-63). The
 * values are DRAFT: the founder approves the copy at build (R6) and B7 replaces
 * the values, never the keys. The `_draft` entry beside them says so.
 *
 * `holdsText` is read from the entry `stopReflectEntry` returned (AC-56). With
 * nothing written, neither "Delete what I wrote" nor the "what you wrote is
 * kept" line is shown (G5): a delete control for nothing reads as a mistake.
 */
export function CalmClose({
  holdsText,
  onBack,
  onDelete,
}: {
  holdsText: boolean;
  onBack: () => void;
  /** Resolves true when the entry is gone. */
  onDelete: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-card p-5 text-sm leading-relaxed">
        <p className="text-base font-medium">{t("reflect.calmClose.title")}</p>
        <p>{t("reflect.calmClose.fine")}</p>
        {holdsText && <p>{t("reflect.calmClose.kept")}</p>}
        <p>{t("reflect.calmClose.support")}</p>
      </div>

      <Button className="w-full" onClick={onBack}>
        {t("reflect.calmClose.back")}
      </Button>

      {holdsText && (
        <div className="text-center">
          <Button variant="link" onClick={() => setConfirming(true)}>
            {t("reflect.calmClose.delete")}
          </Button>
        </div>
      )}

      {failed && (
        <p role="alert" className="text-center text-sm text-destructive">
          {t("reflect.errors.delete")}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={() => setConfirming(false)}
        title={t("reflect.calmClose.confirmTitle")}
        description={t("reflect.calmClose.confirmBody")}
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={async () => {
          setFailed(false);
          const gone = await onDelete();
          if (!gone) setFailed(true);
        }}
      />
    </div>
  );
}
