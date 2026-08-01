import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useApi } from "~/api/useApi";
import {
  GET_PRE_DAY_STATUS,
  SET_ACTION_START_TIME,
  POSTPONE_ACTION,
  OUTSOURCE_ACTION,
  SET_ACTION_IGNORE,
  SET_ACTION_PASSED_ARCHIVED,
  COMPLETE_PRE_DAY,
} from "~/api/queries";
import { toLocalDateString, addDaysToDateKey } from "~/utils/dateUtils";
import { format } from "date-fns";
import { ChevronRight, Pencil, Sun, AlertTriangle } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import AfterDayWizard from "./AfterDayWizard";
import { LoadingBlock } from "~/components/ui/spinner";
import { useKeyedSubmitGuard } from "~/utils/useSubmitGuard";

type ActionWithOverlap = {
  action: {
    id: string;
    title: string;
    startTimeOfDay: string | null;
    estimatedTimeMinutes: number | null;
    project?: { id: string; title: string } | null;
    isGathered?: boolean;
  };
  overlapIds: string[];
};

type ActionItem = {
  id: string;
  title: string;
  estimatedTimeMinutes?: number | null;
  startTimeOfDay?: string | null;
  project?: { id: string; title: string } | null;
  isGathered?: boolean;
  sourceType?: string | null;
  sourceId?: string | null;
};

type StepIndex = 0 | 1 | 2 | 3;

function timeToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function overlaps(
  startMinA: number,
  estMinA: number,
  startMinB: number,
  estMinB: number
): boolean {
  const endA = startMinA + estMinA;
  const endB = startMinB + estMinB;
  return startMinA < endB && startMinB < endA;
}

/** Sort actions: with time first (by time), then without time. */
function sortActionsWithTimeFirst(
  items: ActionWithOverlap[]
): ActionWithOverlap[] {
  return [...items].sort((a, b) => {
    const ta = a.action.startTimeOfDay;
    const tb = b.action.startTimeOfDay;
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return timeToMinutes(ta) - timeToMinutes(tb);
  });
}

export default function PreDayWizard({
  todayKey,
  onComplete,
  onClose,
  afterDayRequired = false,
}: {
  todayKey: string;
  onComplete: () => void;
  onClose?: () => void;
  afterDayRequired?: boolean;
}) {
  const { t } = useTranslation();
  const preDaySteps = [
    { title: t("onboarding.modules.pre-day.step1Title"), body: t("onboarding.modules.pre-day.step1Body") },
    { title: t("onboarding.modules.pre-day.step2Title"), body: t("onboarding.modules.pre-day.step2Body") },
    { title: t("onboarding.modules.pre-day.step3Title"), body: t("onboarding.modules.pre-day.step3Body") },
  ];
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const STEPS_PRE_ONLY = [t("wizard.stepDayOverview"), t("wizard.stepSetTimes"), t("wizard.stepDayOverviewBegin")] as const;
  const STEPS_WITH_AFTER = [t("wizard.stepAfterDay"), t("wizard.stepDayOverview"), t("wizard.stepSetTimes"), t("wizard.stepDayOverviewBegin")] as const;
  const [step, setStep] = useState<StepIndex>(afterDayRequired ? 0 : 1);
  const [loading, setLoading] = useState(true);
  const [preDay, setPreDay] = useState<{
    afterDayRequired: boolean;
    canAccessToday: boolean;
    actionsWithoutTime: ActionItem[];
    todayActionsWithOverlap: ActionWithOverlap[];
  } | null>(null);
  const [untimedTimes, setUntimedTimes] = useState<Record<string, string>>({});
  const [untimedDisposition, setUntimedDisposition] = useState<
    Record<string, "postpone" | "ignore" | "pass" | "outsource">
  >({});
  const [postponeDate, setPostponeDate] = useState<Record<string, string>>({});
  const [outsourceOpen, setOutsourceOpen] = useState<string | null>(null);
  const [outsourceForm, setOutsourceForm] = useState<{
    doTitle: string;
    doDate: string;
    ensureTitle: string;
    ensureDate: string;
  }>({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
  const [overlapConfirmOpen, setOverlapConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { call } = useApi();
  const minDate = format(new Date(), "yyyy-MM-dd");

  const fetchPreDay = useCallback(
    () =>
      call({ query: GET_PRE_DAY_STATUS, variables: { date: todayKey } }).then(
        (res: any) => res?.preDayStatus ?? null
      ),
    [call, todayKey]
  );

  // Initial load: only re-run when todayKey changes (avoid loop from unstable call/fetchPreDay)
  useEffect(() => {
    let cancelled = false;
    call({ query: GET_PRE_DAY_STATUS, variables: { date: todayKey } })
      .then((res: any) => res?.preDayStatus ?? null)
      .then((data) => {
        if (!cancelled) {
          setPreDay(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  const untimedList = preDay?.actionsWithoutTime ?? [];
  const withOverlap = preDay?.todayActionsWithOverlap ?? [];
  const orderedOverview = sortActionsWithTimeFirst(withOverlap);
  // First list: only actions that have a time (so no task appears in both lists)
  const overviewWithTimeOnly = orderedOverview.filter(({ action }) => !!action.startTimeOfDay);
  const showStep1 = overviewWithTimeOnly.length > 0 || untimedList.length > 0;
  const showStep2 = untimedList.length > 0;
  const showStep1Tab = showStep1 || step > 1;
  const showStep2Tab = showStep2 || step > 2;

  // Auto-advance past empty steps on initial load (except final step 3); don't hide steps once passed
  useEffect(() => {
    if (loading || !preDay) return;
    if (step === 1 && !showStep1) setStep(2);
    else if (step === 2 && !showStep2) setStep(3);
  }, [loading, preDay, step, showStep1, showStep2]);

  const canShowIgnore = (a: ActionItem) =>
    !a.project && (a.isGathered ? a.sourceType === "routine" : true);
  const canShowPass = (a: ActionItem) =>
    a.isGathered && a.sourceType === "interval";

  const alreadySetTimes = useCallback(() => {
    const map: Record<string, { start: number; est: number }> = {};
    for (const { action } of withOverlap) {
      if (action.startTimeOfDay && /^\d{2}:\d{2}$/.test(action.startTimeOfDay)) {
        map[action.id] = {
          start: timeToMinutes(action.startTimeOfDay),
          est: action.estimatedTimeMinutes ?? 0,
        };
      }
    }
    return map;
  }, [withOverlap]);

  const reactiveOverlapWarning = (actionId: string, timeStr: string) => {
    if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
    const start = timeToMinutes(timeStr);
    const est = untimedList.find((a) => a.id === actionId)?.estimatedTimeMinutes ?? 0;
    const existing = alreadySetTimes();
    for (const [id, { start: s, est: e }] of Object.entries(existing)) {
      if (id === actionId) continue;
      if (overlaps(start, est, s, e)) return id;
    }
    return null;
  };

  const allTimesForOverlapCheck = (): { id: string; start: number; est: number }[] => {
    const existing = alreadySetTimes();
    const list: { id: string; start: number; est: number }[] = [];
    for (const [id, v] of Object.entries(existing)) {
      list.push({ id, ...v });
    }
    for (const a of untimedList) {
      if (untimedDisposition[a.id]) continue;
      const t = untimedTimes[a.id];
      if (t && /^\d{2}:\d{2}$/.test(t)) {
        list.push({
          id: a.id,
          start: timeToMinutes(t),
          est: a.estimatedTimeMinutes ?? 0,
        });
      }
    }
    return list;
  };

  const findOverlapsAfterSubmit = (): [string, string][] => {
    const list = allTimesForOverlapCheck();
    const pairs: [string, string][] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (overlaps(a.start, a.est, b.start, b.est)) pairs.push([a.id, b.id]);
      }
    }
    return pairs;
  };

  const isStep2Complete = () => {
    if (outsourceOpen) return false;
    return untimedList.every((a) => {
      if (untimedDisposition[a.id] === "postpone") return !!postponeDate[a.id];
      if (untimedDisposition[a.id] === "outsource") return false;
      if (untimedDisposition[a.id] === "ignore" || untimedDisposition[a.id] === "pass")
        return true;
      return !!(untimedTimes[a.id] && /^\d{2}:\d{2}$/.test(untimedTimes[a.id]));
    });
  };

  // Per-action guard: only the row being acted on locks, not the whole list.
  const { isSubmitting: isActionBusy, busy: anyActionBusy, run: runAction } =
    useKeyedSubmitGuard();

  const handleSetTime = async (actionId: string, timeStr: string) => {
    await runAction(actionId, async () => {
    try {
      await call({
        query: SET_ACTION_START_TIME,
        variables: { id: actionId, startTimeOfDay: timeStr },
      });
      const updated = await fetchPreDay();
      setPreDay(updated);
      setUntimedTimes((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handlePostpone = async (actionId: string, newDate: string) => {
    await runAction(actionId, async () => {
    try {
      await call({ query: POSTPONE_ACTION, variables: { id: actionId, newDate } });
      const updated = await fetchPreDay();
      setPreDay(updated);
      setUntimedDisposition((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
      setPostponeDate((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handleIgnore = async (actionId: string) => {
    await runAction(actionId, async () => {
    try {
      await call({ query: SET_ACTION_IGNORE, variables: { id: actionId } });
      const updated = await fetchPreDay();
      setPreDay(updated);
      setUntimedDisposition((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handlePass = async (actionId: string) => {
    await runAction(actionId, async () => {
    try {
      await call({ query: SET_ACTION_PASSED_ARCHIVED, variables: { id: actionId } });
      const updated = await fetchPreDay();
      setPreDay(updated);
      setUntimedDisposition((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handleOutsource = async (
    actionId: string,
    doTitle: string,
    doDate: string,
    ensureTitle: string,
    ensureDate: string
  ) => {
    await runAction(actionId, async () => {
    try {
      await call({
        query: OUTSOURCE_ACTION,
        variables: {
          id: actionId,
          doOutsourcingTitle: doTitle || t("wizard.doOutsourcingDefault"),
          doOutsourcingDate: doDate,
          ensureDoneTitle: ensureTitle || t("wizard.ensureDoneDefault"),
          ensureDoneDate: ensureDate,
        },
      });
      setOutsourceOpen(null);
      setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
      const updated = await fetchPreDay();
      setPreDay(updated);
      setUntimedDisposition((p) => {
        const next = { ...p };
        delete next[actionId];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handleStep2Submit = () => {
    const overlapPairs = findOverlapsAfterSubmit();
    if (overlapPairs.length > 0) {
      setOverlapConfirmOpen(true);
      return;
    }
    applyStep2Times();
  };

  const applyStep2Times = async () => {
    setOverlapConfirmOpen(false);
    for (const a of untimedList) {
      if (untimedDisposition[a.id] === "postpone" && postponeDate[a.id]) {
        await handlePostpone(a.id, postponeDate[a.id]);
      }
    }
    for (const a of untimedList) {
      if (untimedDisposition[a.id]) continue;
      const t = untimedTimes[a.id];
      if (t && /^\d{2}:\d{2}$/.test(t)) {
        await handleSetTime(a.id, t);
      }
    }
    const updated = await fetchPreDay();
    setPreDay(updated);
    setUntimedTimes({});
    setUntimedDisposition({});
    setPostponeDate({});
    setStep(3);
  };

  const handleBegin = async () => {
    setFinishing(true);
    try {
      await call({ query: COMPLETE_PRE_DAY, variables: { date: todayKey } });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <main className="p-6">
        <LoadingBlock label={t("wizard.loading")} />
      </main>
    );
  }

  // Step 0: After-day for yesterday (when required)
  if (afterDayRequired && step === 0) {
    return (
      <AfterDayWizard
        dateKeyToClose={yesterdayKey}
        onClose={onClose ?? (() => setStep(1))}
        onComplete={() => setStep(1)}
      />
    );
  }

  const steps = afterDayRequired ? STEPS_WITH_AFTER : STEPS_PRE_ONLY;

  return (
    <>
    <ModuleIntroOverlay moduleKey="pre-day" steps={preDaySteps} />
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("wizard.organizeTitle")}</h1>

      <div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("wizard.wizardStepsAria")}>
        {steps.map((label, i) => {
          const stepIndex = (afterDayRequired ? i : i + 1) as StepIndex;
          if (stepIndex === 1 && !showStep1Tab) return null;
          if (stepIndex === 2 && !showStep2Tab) return null;
          return (
            <span
              key={label}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium cursor-default ${
                step === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </span>
          );
        })}
      </div>

      {/* Step 1: Day overview (has time) + Tasks without time — mutually exclusive lists */}
      {step === 1 && (
        <section className="space-y-8">
          {overviewWithTimeOnly.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">{t("wizard.dayOverviewOrdered")}</h2>
              <ul className="space-y-2">
                {overviewWithTimeOnly.map(({ action, overlapIds }) => (
                  <li
                    key={action.id}
                    className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                      overlapIds.length > 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""
                    }`}
                  >
                    <span>{action.title}</span>
                    <span className="text-muted-foreground">
                      {action.startTimeOfDay ?? "—"}
                      {action.estimatedTimeMinutes != null && ` (${action.estimatedTimeMinutes} min)`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {untimedList.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">{t("wizard.tasksWithoutTime")}</h2>
              <ul className="space-y-2">
                {untimedList.map((a) => (
                  <li key={a.id} className="rounded-md border bg-card px-3 py-2">
                    {a.title}
                    {a.estimatedTimeMinutes != null && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {t("wizard.minutesParen", { min: a.estimatedTimeMinutes })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overviewWithTimeOnly.length === 0 && untimedList.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noActionsToday")}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>
              {t("wizard.nextSetTimes")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 2: Set times for untimed */}
      {step === 2 && (
        <section className="space-y-6">
          <p className="text-muted-foreground">
            {t("wizard.setTimesIntro")}
          </p>
          {untimedList.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noUntimedTasks")}
            </p>
          ) : (
            <ul className="space-y-4">
              {untimedList.map((a) => {
                const disp = untimedDisposition[a.id];
                const timeVal = untimedTimes[a.id] ?? "";
                const reactiveWarn = reactiveOverlapWarning(a.id, timeVal);
                return (
                  <li key={a.id} className="rounded-lg border bg-card p-4">
                    <div className="mb-2 font-medium">{a.title}</div>
                    {disp === "postpone" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={`preday-postpone-${a.id}`} className="flex items-center gap-2 shrink-0">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        </Label>
                        <Input
                          id={`preday-postpone-${a.id}`}
                          type="date"
                          min={minDate}
                          value={postponeDate[a.id] ?? ""}
                          onChange={(e) =>
                            setPostponeDate((p) => ({ ...p, [a.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          disabled={!postponeDate[a.id]}
                          loading={isActionBusy(a.id)}
                          onClick={() =>
                            postponeDate[a.id] && handlePostpone(a.id, postponeDate[a.id])
                          }
                        >
                          {t("wizard.setDate")}
                        </Button>
                      </div>
                    ) : disp === "outsource" || outsourceOpen === a.id ? (
                      <div className="mt-2 space-y-2 rounded border p-3">
                        <div>
                          <Label htmlFor={`preday-outsource-do-title-${a.id}`} className="text-xs flex items-center gap-2">
                            {t("wizard.doOutsourcingTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`preday-outsource-do-title-${a.id}`}
                            placeholder={t("wizard.doOutsourcingPlaceholder")}
                            value={outsourceForm.doTitle}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, doTitle: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`preday-outsource-do-date-${a.id}`} className="text-xs flex items-center gap-2">
                            {t("wizard.doDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`preday-outsource-do-date-${a.id}`}
                            type="date"
                            min={minDate}
                            placeholder={t("wizard.doDatePlaceholder")}
                            value={outsourceForm.doDate}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, doDate: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`preday-outsource-ensure-title-${a.id}`} className="text-xs flex items-center gap-2">
                            {t("wizard.ensureDoneTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`preday-outsource-ensure-title-${a.id}`}
                            placeholder={t("wizard.ensureDonePlaceholder")}
                            value={outsourceForm.ensureTitle}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, ensureTitle: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`preday-outsource-ensure-date-${a.id}`} className="text-xs flex items-center gap-2">
                            {t("wizard.ensureDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`preday-outsource-ensure-date-${a.id}`}
                            type="date"
                            min={minDate}
                            placeholder={t("wizard.ensureDatePlaceholder")}
                            value={outsourceForm.ensureDate}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, ensureDate: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={!outsourceForm.doDate || !outsourceForm.ensureDate}
                          loading={isActionBusy(a.id)}
                          onClick={() =>
                            handleOutsource(
                              a.id,
                              outsourceForm.doTitle,
                              outsourceForm.doDate,
                              outsourceForm.ensureTitle,
                              outsourceForm.ensureDate
                            )
                          }
                        >
                          {t("wizard.confirmOutsource")}
                        </Button>
                      </div>
                    ) : disp ? (
                      <span className="text-sm text-muted-foreground">{t("wizard.chosen", { value: t(`wizard.${disp}`) })}</span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label htmlFor={`preday-start-time-${a.id}`} className="sr-only flex items-center gap-2">
                            {t("wizard.startTime")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`preday-start-time-${a.id}`}
                            type="time"
                            value={timeVal}
                            onChange={(e) =>
                              setUntimedTimes((p) => ({ ...p, [a.id]: e.target.value }))
                            }
                            className="w-28"
                          />
                          {reactiveWarn && (
                            <span className="flex items-center gap-1 text-sm text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              {t("wizard.overlapsWithTask")}
                              <HintPopover textKey="hints.preDayOverlap" conceptsAnchor="daily-flow" />
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setUntimedDisposition((p) => ({ ...p, [a.id]: "postpone" }))
                            }
                          >
                            {t("wizard.postpone")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUntimedDisposition((p) => ({ ...p, [a.id]: "outsource" }));
                              setOutsourceOpen(a.id);
                            }}
                          >
                            {t("wizard.outsource")}
                          </Button>
                          {canShowIgnore(a) && (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={isActionBusy(a.id)}
                              onClick={() => handleIgnore(a.id)}
                            >
                              {t("wizard.ignore")}
                            </Button>
                          )}
                          {canShowPass(a) && (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={isActionBusy(a.id)}
                              onClick={() => handlePass(a.id)}
                            >
                              {t("wizard.pass")}
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            {overlapConfirmOpen && (
              <div className="flex flex-1 flex-wrap items-center gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/30">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm">
                  {t("wizard.overlapConfirm")}
                </span>
                <Button size="sm" variant="outline" onClick={() => setOverlapConfirmOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={applyStep2Times}>
                  {t("wizard.confirmAndContinue")}
                </Button>
              </div>
            )}
            <Button onClick={handleStep2Submit} disabled={!isStep2Complete()} loading={anyActionBusy}>
              {t("wizard.submitTimes")}
            </Button>
          </div>
        </section>
      )}

      {/* Step 3: Day overview and begin */}
      {step === 3 && (
        <section className="space-y-6">
          <p className="text-muted-foreground">{t("wizard.finalOverview")}</p>
          {orderedOverview.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noActionsTodayShort")}
            </p>
          ) : (
            <ul className="space-y-2">
              {sortActionsWithTimeFirst(preDay?.todayActionsWithOverlap ?? []).map(
                ({ action }) => (
                  <li
                    key={action.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span>{action.title}</span>
                    <span className="text-muted-foreground">
                      {action.startTimeOfDay ?? "—"}
                      {action.estimatedTimeMinutes != null && ` (${action.estimatedTimeMinutes} min)`}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={handleBegin} loading={finishing} className="gap-2">
              <Sun className="h-4 w-4" />
              {t("wizard.begin")}
            </Button>
          </div>
        </section>
      )}
    </main>
    </>
  );
}
