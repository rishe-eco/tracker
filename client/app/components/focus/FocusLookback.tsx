import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { RECORD_FOCUS_LOOKBACK } from "~/api/queries";
import { Button } from "~/components/ui/button";
import { useAppDate } from "~/i18n/useAppDate";
import { parseDateOnly } from "~/utils/dateUtils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import { projectProgress, toKey, type FocusPeriod } from "./focusLogic";

export type LookbackAnswer = "oriented" | "behind";

type Props = {
  period: FocusPeriod;
  todayKey: string;
  /** The look-back was recorded; the page refetches and falls through. */
  onDone: () => void;
  /** Open the start form with the unfinished projects. The page records the look-back once that period is saved. */
  onStartNew: (unfinishedIds: string[], answer: LookbackAnswer | null) => void;
};

/**
 * The look-back for an ended period (spec §4.5; wireframes plate 5).
 *
 * Two lists and one optional question, and nothing that grades: no score, no
 * percent, no "you finished 2 of 5" (AC-22). Which list a project is in comes
 * from Tracker's own project rule, read live (spec decision 7). Neither answer
 * starts selected, and Done works without one (AC-23).
 */
export default function FocusLookback({ period, todayKey, onDone, onStartNew }: Props) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();
  const [answer, setAnswer] = useState<LookbackAnswer | null>(null);
  const [error, setError] = useState(false);

  const rows = period.projects.map((p) => ({ project: p, progress: projectProgress(p) }));
  const finished = rows.filter((r) => r.progress.isDone);
  const unfinished = rows.filter((r) => !r.progress.isDone);

  const range = t("focus.dateRange", {
    start: fmt(parseDateOnly(toKey(period.startDate)), "dayMonth"),
    end: fmt(parseDateOnly(toKey(period.endDate)), "dayMonth"),
  });

  const done = () =>
    run(async () => {
      setError(false);
      const res = await call({
        query: RECORD_FOCUS_LOOKBACK,
        variables: { id: period.id, answer, dateKey: todayKey },
      });
      if (!res) {
        setError(true);
        return;
      }
      onDone();
    });

  const choice = (value: LookbackAnswer, label: string) => (
    <Button
      type="button"
      variant={answer === value ? "default" : "outline"}
      size="sm"
      aria-pressed={answer === value}
      onClick={() => setAnswer((cur) => (cur === value ? null : value))}
    >
      {label}
    </Button>
  );

  const progressLine = (done: number, total: number) =>
    total === 0 ? t("focus.noActionsYet") : t("focus.actionsDone", { done, total });

  return (
    <main className="max-w-2xl space-y-6 p-6" data-testid="focus-lookback">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("focus.lookbackEnded", { title: period.title })}</h1>
        <p className="text-sm text-muted-foreground">{range}</p>
      </div>

      {finished.length > 0 && (
        <section className="space-y-1" data-testid="focus-lookback-finished">
          <h2 className="text-sm font-semibold">{t("focus.lookbackFinished")}</h2>
          <ul className="divide-y">
            {finished.map(({ project }) => (
              <li key={project.id} className="py-2 text-sm">
                {project.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {unfinished.length > 0 && (
        <section className="space-y-1" data-testid="focus-lookback-unfinished">
          <h2 className="text-sm font-semibold">{t("focus.lookbackNotFinished")}</h2>
          <ul className="divide-y">
            {unfinished.map(({ project, progress }) => (
              <li key={project.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{project.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {progressLine(progress.done, progress.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-sm">{t("focus.lookbackQuestion")}</p>
        <div className="flex flex-wrap gap-2">
          {choice("oriented", t("focus.lookbackOriented"))}
          {choice("behind", t("focus.lookbackBehind"))}
        </div>
        <p className="text-xs text-muted-foreground">{t("focus.lookbackOptional")}</p>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("focus.saveError")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {unfinished.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onStartNew(unfinished.map((r) => r.project.id), answer)}
            disabled={submitting}
          >
            {t("focus.startNewWithThese")}
          </Button>
        )}
        <Button type="button" onClick={done} disabled={submitting}>
          {t("focus.lookbackDone")}
        </Button>
      </div>
    </main>
  );
}
