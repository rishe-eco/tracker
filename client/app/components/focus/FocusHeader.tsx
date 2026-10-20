import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { useAppDate } from "~/i18n/useAppDate";
import { parseDateOnly } from "~/utils/dateUtils";
import { daysBetween, daysLeft, toKey, type FocusPeriod } from "./focusLogic";

type Props = {
  period: FocusPeriod;
  todayKey: string;
  onEdit: () => void;
};

/**
 * The period's name, dates and days left — and nothing else (spec §4.2).
 * Deliberately the same size and colour on every day of the period: no
 * tally, no percent, no urgency styling as the end nears (AC-29, AC-30;
 * wireframes W1).
 */
export default function FocusHeader({ period, todayKey, onEdit }: Props) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const start = toKey(period.startDate);
  const end = toKey(period.endDate);

  const range = t("focus.dateRange", {
    start: fmt(parseDateOnly(start), "dayMonth"),
    end: fmt(parseDateOnly(end), "dayMonth"),
  });

  let when: string;
  if (start > todayKey) {
    const until = daysBetween(todayKey, start);
    when = until === 1 ? t("focus.startsTomorrow") : t("focus.startsIn", { count: until });
  } else {
    const left = daysLeft(end, todayKey);
    when = left <= 1 ? t("focus.lastDay") : t("focus.daysLeft", { count: left });
  }

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">{period.title}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span data-testid="focus-when">
          {range} · {when}
        </span>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t("focus.edit")}
        </Button>
      </div>
    </div>
  );
}
