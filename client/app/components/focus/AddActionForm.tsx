import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { ADD_PROJECT_ACTION } from "~/api/queries";
import { Button } from "~/components/ui/button";
import { DateField } from "~/components/ui/date-field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import { MAX_MINUTES, parseMinutes } from "./focusLogic";

type Props = {
  projectId: string;
  todayKey: string;
  /** Called after a successful add, so the page can refetch. */
  onAdded: () => void;
  onCancel: () => void;
};

/**
 * The inline "+ Action" form inside a card (spec §4.4, AC-19; wireframes
 * plate 2, frame 3). No project field: the action goes to this card's
 * project. Minutes appears only once a day is picked (W5) — the server
 * refuses a scheduled action without an estimate, and this form enforces it
 * first.
 */
export default function AddActionForm({ projectId, todayKey, onAdded, onCancel }: Props) {
  const { t } = useTranslation();
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const [title, setTitle] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = title.trim();
  const minutes = dayKey ? parseMinutes(minutesText) : null;
  const canAdd = trimmed.length > 0 && (!dayKey || minutes !== null) && !submitting;

  const add = () =>
    run(async () => {
      if (!canAdd) return;
      setError(null);
      const variables: Record<string, unknown> = { title: trimmed, projectId };
      if (dayKey) {
        variables.tbd = dayKey;
        variables.estimatedTimeMinutes = minutes;
      }
      const res = await call({ query: ADD_PROJECT_ACTION, variables });
      if (!res) {
        setError(t("focus.saveError"));
        return;
      }
      onAdded();
      onCancel();
    });

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid={`focus-add-${projectId}`}>
      <div className="space-y-1">
        <Label htmlFor={`focus-add-title-${projectId}`} className="text-xs">
          {t("focus.newAction")}
        </Label>
        <Input
          id={`focus-add-title-${projectId}`}
          value={title}
          autoFocus
          placeholder={t("focus.newActionPlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`focus-add-day-${projectId}`} className="text-xs">
            {t("focus.dayOptional")}
          </Label>
          <DateField
            id={`focus-add-day-${projectId}`}
            value={dayKey}
            min={todayKey}
            onChange={(e) => setDayKey(e.target.value)}
          />
        </div>
        {dayKey && (
          <div className="space-y-1">
            <Label htmlFor={`focus-add-minutes-${projectId}`} className="text-xs">
              {t("focus.minutes")}
            </Label>
            <Input
              id={`focus-add-minutes-${projectId}`}
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
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("focus.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={add} disabled={!canAdd}>
          {t("focus.add")}
        </Button>
      </div>
    </div>
  );
}
