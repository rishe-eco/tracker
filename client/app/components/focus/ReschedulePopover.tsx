import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { UPDATE_ACTION } from "~/api/queries";
import { Button } from "~/components/ui/button";
import { DatePickerGrid } from "~/components/ui/date-picker-grid";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import { MAX_MINUTES, parseMinutes, toKey, type FocusAction } from "./focusLogic";

type Props = {
  action: FocusAction;
  todayKey: string;
  /** Called after a successful save or clear, so the page can refetch. */
  onSaved: () => void;
  onClose: () => void;
};

/**
 * The reschedule popover (spec §4.4, AC-18; wireframes plate 2, frame 2).
 *
 * Opens directly under the row. `updateAction` only checks the estimate when
 * one is sent, so a day on an action with no estimate would *succeed* on the
 * server and leave a scheduled action with no minutes. The popover is where
 * AC-18 is enforced: no estimate on the action means Minutes is asked here,
 * Save stays off until it's valid, and `tbd` always travels with
 * `estimatedTimeMinutes`.
 */
export default function ReschedulePopover({ action, todayKey, onSaved, onClose }: Props) {
  const { t } = useTranslation();
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const currentKey = action.tbd ? toKey(action.tbd) : null;
  const [dayKey, setDayKey] = useState<string | null>(currentKey);
  const [minutesText, setMinutesText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsMinutes = action.estimatedTimeMinutes == null;
  const minutes = needsMinutes ? parseMinutes(minutesText) : action.estimatedTimeMinutes ?? null;
  const changed = dayKey !== null && dayKey !== currentKey;
  const canSave = changed && minutes !== null && !submitting;

  const send = (variables: Record<string, unknown>) =>
    run(async () => {
      setError(null);
      const res = await call({ query: UPDATE_ACTION, variables: { id: action.id, ...variables } });
      if (!res) {
        setError(t("focus.saveError"));
        return;
      }
      onSaved();
      onClose();
    });

  const save = () => {
    if (!canSave || dayKey === null) return;
    return send({ tbd: dayKey, estimatedTimeMinutes: minutes });
  };

  const clearDay = () => send({ tbd: null });

  return (
    <div
      className="my-1 w-full max-w-xs space-y-2 rounded-md border bg-card p-2 shadow-md"
      data-testid={`focus-reschedule-${action.id}`}
    >
      <p className="px-1 text-xs text-muted-foreground">{t("focus.day")}</p>
      <DatePickerGrid
        selected={dayKey ? parseDateOnly(dayKey) : null}
        min={parseDateOnly(todayKey)}
        onSelect={(d) => setDayKey(toLocalDateString(d))}
        className="p-1"
      />

      {needsMinutes && dayKey && (
        <div className="space-y-1 px-1">
          <Label htmlFor={`focus-minutes-${action.id}`} className="text-xs text-muted-foreground">
            {t("focus.minutesNeeded")}
          </Label>
          <Input
            id={`focus-minutes-${action.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_MINUTES}
            value={minutesText}
            placeholder={t("focus.minutesPlaceholder")}
            onChange={(e) => setMinutesText(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="px-1 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 px-1">
        {currentKey && (
          <Button type="button" variant="ghost" size="sm" onClick={clearDay} disabled={submitting}>
            {t("focus.clearDay")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("focus.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {t("focus.save")}
        </Button>
      </div>
    </div>
  );
}
