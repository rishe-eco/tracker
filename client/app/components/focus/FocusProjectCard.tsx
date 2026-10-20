import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Progress } from "~/components/ui/progress";
import { useAppDate } from "~/i18n/useAppDate";
import { parseDateOnly } from "~/utils/dateUtils";
import {
  NEXT_ACTIONS_SHOWN,
  openActions,
  projectContext,
  projectProgress,
  type FocusAction,
  type FocusProject,
} from "./focusLogic";

type Props = {
  project: FocusProject;
  /** Completes an action (B3). Without it the checkbox renders disabled. */
  onComplete?: (action: FocusAction) => void;
  /** Opens the reschedule popover for an action (B3). Without it the day is plain text. */
  onDayClick?: (action: FocusAction) => void;
  /** Rendered directly under a row — the reschedule popover's slot (B3). */
  renderBelowRow?: (action: FocusAction) => ReactNode;
  /** Opens the inline add form (B3). Without it "+ Action" isn't offered. */
  onAddAction?: () => void;
  /** The inline add form itself, shown in place of "+ Action" while open (B3). */
  addForm?: ReactNode;
  /** The card's ⋯ menu (B3). */
  menu?: ReactNode;
};

/**
 * One project in a focus period (spec §4.3; wireframes plate 1).
 *
 * Each row has three controls, each with exactly one effect — the checkbox
 * completes, the day button reschedules, the title opens the action — and
 * none is nested inside another (AC-16). No status badge: Tracker's
 * "Ignored" badge would read as a nag here (spec decision 12).
 */
export default function FocusProjectCard({
  project,
  onComplete,
  onDayClick,
  renderBelowRow,
  onAddAction,
  addForm,
  menu,
}: Props) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { done, total, isDone } = projectProgress(project);
  const open = isDone ? [] : openActions(project.actions);
  const shown = open.slice(0, NEXT_ACTIONS_SHOWN);
  const hidden = open.length - shown.length;
  const ctx = projectContext(project);
  const projectHref = `/activities/project/${project.id}`;

  const contextLine = ctx.goal
    ? ctx.milestone
      ? `${ctx.goal} › ${ctx.milestone}`
      : ctx.goal
    : ctx.milestone ?? t("focus.noGoal");

  const addControl =
    addForm ??
    (onAddAction && !isDone ? (
      <button type="button" className="text-sm text-primary hover:underline" onClick={onAddAction}>
        {t("focus.addAction")}
      </button>
    ) : null);

  return (
    <article className="rounded-md border p-4 shadow-sm space-y-2" data-testid={`focus-card-${project.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link to={projectHref} className="font-semibold text-sm hover:underline line-clamp-1">
            {project.title}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{contextLine}</p>
        </div>
        {menu}
      </div>

      {isDone ? (
        <Badge className="bg-green-100 text-green-800">{t("focus.done")}</Badge>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("focus.noActionsYet")}</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm">{t("focus.actionsDone", { done, total })}</p>
          <Progress value={(done / total) * 100} className="h-2" />
        </div>
      )}

      {!isDone && total > 0 && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("focus.noNextActions")}</p>
      )}

      {shown.length > 0 && (
        <ul className="divide-y divide-dashed">
          {shown.map((a) => (
            <li key={a.id}>
              <div className="flex items-center gap-2 py-1.5 text-sm">
                <Checkbox
                  checked={false}
                  disabled={!onComplete}
                  onCheckedChange={() => onComplete?.(a)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={a.title}
                />
                <Link to={`/activities/action/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {a.title}
                </Link>
                {onDayClick ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(a);
                    }}
                  >
                    {a.tbd ? fmt(parseDateOnly(a.tbd), "weekdayShortDayMonth") : t("focus.noDay")}
                  </button>
                ) : (
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                    {a.tbd ? fmt(parseDateOnly(a.tbd), "weekdayShortDayMonth") : t("focus.noDay")}
                  </span>
                )}
              </div>
              {renderBelowRow?.(a)}
            </li>
          ))}
        </ul>
      )}

      {(addControl || hidden > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div>{addControl}</div>
          {hidden > 0 && (
            <Link to={projectHref} className="text-sm text-primary hover:underline">
              {t("focus.more", { count: hidden })}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
