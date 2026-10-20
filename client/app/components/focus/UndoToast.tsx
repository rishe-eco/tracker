import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const UNDO_MS = 5000;

type Props = {
  /** The completed action's title. */
  title: string;
  onUndo: () => void;
  /** Called when the time runs out; the completion is then final. */
  onExpire: () => void;
  durationMs?: number;
};

/**
 * "Done: <action>  Undo" — one at a time, local to the Focus page (build plan
 * PD-7). The parent keys it by action id, so a second completion remounts it:
 * the first toast is gone, its action stays done, and the timer restarts.
 */
export default function UndoToast({ title, onUndo, onExpire, durationMs = UNDO_MS }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const id = setTimeout(onExpire, durationMs);
    return () => clearTimeout(id);
    // The timer belongs to this mount; a new completion remounts the toast.
  }, []);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm shadow-lg md:bottom-6"
      data-testid="focus-undo-toast"
    >
      <span className="min-w-0 truncate">{t("focus.completed", { title })}</span>
      <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={onUndo}>
        {t("focus.undo")}
      </button>
    </div>
  );
}
