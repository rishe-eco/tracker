import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateField } from "~/components/ui/date-field";
import { Label } from "~/components/ui/label";
import { useApi } from "~/api/useApi";
import {
  GET_NOT_DONE_ACTIONS_FOR_DATE,
  GET_TODAY_ACTIONS,
  POSTPONE_ACTION,
  OUTSOURCE_ACTION,
  SET_ACTION_NOT_IMPORTANT,
  SET_ACTION_IGNORE,
  SET_ACTION_PASSED_ARCHIVED,
  COMPLETE_AFTER_DAY,
  RUN_ACTION_GATHERING,
  DELETE_ACTION,
} from "~/api/queries";
import { toLocalDateString, addDaysToDateKey } from "~/utils/dateUtils";
// Gregorian `format` stays for the `min` attribute on date inputs; anything
// read by a person goes through `fmt`.
import { format } from "date-fns";
import { useAppDate } from "~/i18n/useAppDate";
import { Moon, Pencil, Sun, ChevronRight, CheckCircle2 } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import { LoadingBlock } from "~/components/ui/spinner";
import { useKeyedSubmitGuard } from "~/utils/useSubmitGuard";

type ActionItem = {
  id: string;
  title: string;
  sourceType?: string;
  sourceId?: string;
  tbd?: string;
  estimatedTimeMinutes?: number;
  project?: { id: string; title: string } | null;
};

type NotDoneData = {
  nonLinkedGathered: ActionItem[];
  linkedGathered: ActionItem[];
  linkedManual: ActionItem[];
  standalone: ActionItem[];
};

const EMPTY_NOT_DONE: NotDoneData = {
  nonLinkedGathered: [],
  linkedGathered: [],
  linkedManual: [],
  standalone: [],
};

/**
 * Step 0 handles everything the user linked to the hierarchy: actions they
 * attached to a project by hand, and gathered actions from a scoped interval.
 * The hand-made ones come first — they're the deliberate commitments.
 */
function getLinkedList(data: NotDoneData | null): ActionItem[] {
  return [...(data?.linkedManual ?? []), ...(data?.linkedGathered ?? [])];
}

function countLinked(data: NotDoneData | null): number {
  return getLinkedList(data).length;
}

type StepIndex = 0 | 1 | 2 | 3;

type AfterDayWizardProps = {
  /** The day we're closing (yesterday when from Pre-day, today when from Today module). */
  dateKeyToClose: string;
  onClose: () => void;
  /** When provided (e.g. embedded in Pre-day), called after finishing instead of onClose. */
  onComplete?: () => void;
};

export default function AfterDayWizard({ dateKeyToClose, onClose, onComplete }: AfterDayWizardProps) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const afterDaySteps = [
    { title: t("onboarding.modules.after-day.step1Title"), body: t("onboarding.modules.after-day.step1Body") },
    { title: t("onboarding.modules.after-day.step2Title"), body: t("onboarding.modules.after-day.step2Body") },
    { title: t("onboarding.modules.after-day.step3Title"), body: t("onboarding.modules.after-day.step3Body") },
  ];
  const STEPS = [
    t("wizard.stepReviewLinked"),
    t("wizard.stepReviewStandalone"),
    t("wizard.stepDayThatPassed"),
    t("wizard.stepTomorrowReview"),
  ] as const;
  const todayKeyForGathering = toLocalDateString(new Date());
  const dayBeforeKey = addDaysToDateKey(dateKeyToClose, -1);
  const tomorrowKey = addDaysToDateKey(dateKeyToClose, 1);

  const [step, setStep] = useState<StepIndex>(0);
  const [loading, setLoading] = useState(true);
  const [notDoneData, setNotDoneData] = useState<NotDoneData | null>(null);
  const [dayBeforeStandalone, setDayBeforeStandalone] = useState<ActionItem[]>([]);
  const [doneActions, setDoneActions] = useState<ActionItem[]>([]);
  const [tomorrowActions, setTomorrowActions] = useState<ActionItem[]>([]);
  const [linkedResponses, setLinkedResponses] = useState<Record<string, "postpone" | "outsource" | "not_important" | "pass">>({});
  const [postponeDate, setPostponeDate] = useState<Record<string, string>>({});
  const [outsourceOpen, setOutsourceOpen] = useState<string | null>(null);
  const [outsourceForm, setOutsourceForm] = useState<{
    doTitle: string;
    doDate: string;
    ensureTitle: string;
    ensureDate: string;
  }>({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
  const [finishing, setFinishing] = useState(false);
  const { call } = useApi();
  const minDate = format(new Date(), "yyyy-MM-dd");

  const fetchNotDone = useCallback(
    (dateKey: string) =>
      call({ query: GET_NOT_DONE_ACTIONS_FOR_DATE, variables: { date: dateKey } }).then(
        (res: any) => res?.notDoneActionsForDate ?? EMPTY_NOT_DONE
      ),
    [call]
  );

  const fetchTodayActions = useCallback(
    (dateKey: string) =>
      call({ query: GET_TODAY_ACTIONS, variables: { date: dateKey } }).then(
        (res: any) => res?.todayActions ?? []
      ),
    [call]
  );

  // Initial load: only re-run when date we're closing changes (avoid loop from unstable call/fetchNotDone)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    call({ query: GET_NOT_DONE_ACTIONS_FOR_DATE, variables: { date: dateKeyToClose } })
      .then((res: any) => {
        const data: NotDoneData = res?.notDoneActionsForDate ?? EMPTY_NOT_DONE;
        return data;
      })
      .then(async (data) => {
        if (cancelled) return;
        const nonLinked = data.nonLinkedGathered ?? [];
        for (const a of nonLinked) {
          try {
            await call({ query: SET_ACTION_PASSED_ARCHIVED, variables: { id: a.id } });
          } catch (e) {
            console.error("Auto-archive non-linked", e);
          }
        }
        if (nonLinked.length > 0 && !cancelled) {
          const res2 = await call({ query: GET_NOT_DONE_ACTIONS_FOR_DATE, variables: { date: dateKeyToClose } });
          const updated = res2?.notDoneActionsForDate ?? data;
          if (!cancelled) {
            setNotDoneData(updated);
            if (countLinked(updated) === 0) setStep(1);
          }
        } else if (!cancelled) {
          setNotDoneData(data);
          if (countLinked(data) === 0) setStep(1);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateKeyToClose]);

  // Load day-before standalone when we have notDoneData (so step 1 tab visibility is correct)
  useEffect(() => {
    if (!notDoneData) return;
    let cancelled = false;
    call({ query: GET_NOT_DONE_ACTIONS_FOR_DATE, variables: { date: dayBeforeKey } })
      .then((res: any) => res?.notDoneActionsForDate?.standalone ?? [])
      .then((list: ActionItem[]) => {
        if (!cancelled) {
          setDayBeforeStandalone(list);
          const standaloneCount = notDoneData?.standalone?.length ?? 0;
          if (standaloneCount === 0 && list.length === 0) {
            setStep((s) => (s === 1 ? 2 : s));
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [notDoneData, dayBeforeKey]);

  // Step 2: load done actions for the day we're closing. Only re-run when step or dateKeyToClose changes
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    call({ query: GET_TODAY_ACTIONS, variables: { date: dateKeyToClose } })
      .then((res: any) => (res?.todayActions ?? []).filter((a: any) => a.done))
      .then((list: any[]) => {
        if (!cancelled) setDoneActions(list);
      });
    return () => {
      cancelled = true;
    };
  }, [step, dateKeyToClose]);

  // Step 3: load tomorrow actions. Only re-run when step or tomorrowKey changes
  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;
    call({ query: GET_TODAY_ACTIONS, variables: { date: tomorrowKey } })
      .then((res: any) => res?.todayActions ?? [])
      .then((list: any[]) => {
        if (!cancelled) setTomorrowActions(list);
      });
    return () => {
      cancelled = true;
    };
  }, [step, tomorrowKey]);

  const linkedList = getLinkedList(notDoneData);
  const standaloneList = notDoneData?.standalone ?? [];
  const canAdvanceFromStep0 = linkedList.length === 0;
  const hasStep0Content = linkedList.length > 0;
  const hasStep1Content = standaloneList.length > 0 || dayBeforeStandalone.length > 0;
  const showStep0 = hasStep0Content || step > 0;
  const showStep1 = hasStep1Content || step > 1;
  const embeddedInPreDay = !!onComplete;

  const applyLinkedChoice = async (
    actionId: string,
    choice: "postpone" | "outsource" | "not_important" | "pass",
    extra?: { newDate?: string; doTitle?: string; doDate?: string; ensureTitle?: string; ensureDate?: string }
  ) => {
    try {
      if (choice === "postpone" && extra?.newDate) {
        await call({ query: POSTPONE_ACTION, variables: { id: actionId, newDate: extra.newDate } });
      } else if (choice === "outsource" && extra?.doDate && extra?.ensureDate) {
        await call({
          query: OUTSOURCE_ACTION,
          variables: {
            id: actionId,
            doOutsourcingTitle: extra.doTitle || t("wizard.doOutsourcingDefault"),
            doOutsourcingDate: extra.doDate,
            ensureDoneTitle: extra.ensureTitle || t("wizard.ensureDoneDefault"),
            ensureDoneDate: extra.ensureDate,
          },
        });
      } else if (choice === "not_important") {
        await call({ query: SET_ACTION_NOT_IMPORTANT, variables: { id: actionId } });
      } else if (choice === "pass") {
        await call({ query: SET_ACTION_PASSED_ARCHIVED, variables: { id: actionId } });
      }
      setLinkedResponses((prev) => ({ ...prev, [actionId]: choice }));
      setPostponeDate((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
      setOutsourceOpen(null);
      setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
      const updated = await fetchNotDone(dateKeyToClose);
      setNotDoneData(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // One row at a time — these all refetch the whole day, so overlapping
  // mutations would race each other's results.
  const { isSubmitting: isRowBusy, run: runStandalone } = useKeyedSubmitGuard();

  const applyStandaloneChoice = async (
    actionId: string,
    choice: "postpone" | "outsource" | "ignore" | "delete",
    extra?: { newDate?: string; doTitle?: string; doDate?: string; ensureTitle?: string; ensureDate?: string }
  ) => {
    await runStandalone(actionId, async () => {
    try {
      if (choice === "postpone" && extra?.newDate) {
        await call({ query: POSTPONE_ACTION, variables: { id: actionId, newDate: extra.newDate } });
      } else if (choice === "outsource" && extra?.doDate && extra?.ensureDate) {
        await call({
          query: OUTSOURCE_ACTION,
          variables: {
            id: actionId,
            doOutsourcingTitle: extra.doTitle || t("wizard.doOutsourcingDefault"),
            doOutsourcingDate: extra.doDate,
            ensureDoneTitle: extra.ensureTitle || t("wizard.ensureDoneDefault"),
            ensureDoneDate: extra.ensureDate,
          },
        });
      } else if (choice === "ignore") {
        await call({ query: SET_ACTION_IGNORE, variables: { id: actionId } });
      } else if (choice === "delete") {
        await call({ query: DELETE_ACTION, variables: { id: actionId } });
      }
      const updated = await fetchNotDone(dateKeyToClose);
      setNotDoneData(updated);
      const dayBefore = await fetchNotDone(dayBeforeKey);
      setDayBeforeStandalone(dayBefore.standalone ?? []);
    } catch (e) {
      console.error(e);
    }
    });
  };

  const finishFlow = async () => {
    setFinishing(true);
    try {
      await call({ query: COMPLETE_AFTER_DAY, variables: { date: dateKeyToClose } });
      await call({ query: RUN_ACTION_GATHERING, variables: { todayDate: todayKeyForGathering } });
      if (onComplete) onComplete();
      else onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setFinishing(false);
    }
  };

  if (loading && step === 0) {
    return (
      <main className="p-6">
        <LoadingBlock label={t("wizard.loadingAfterDay")} />
      </main>
    );
  }

  return (
    <>
    <ModuleIntroOverlay moduleKey="after-day" steps={afterDaySteps} />
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("wizard.afterDayTitle")}</h1>
        <div className="flex items-center gap-3">
          {onComplete && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground underline hover:no-underline"
            >
              {t("wizard.back")}
            </button>
          )}
          <span className="text-muted-foreground">
            {t("wizard.closing", { date: fmt(new Date(dateKeyToClose + "T12:00:00"), "weekdayDayMonth") })}
          </span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("wizard.wizardStepsAria")}>
        {STEPS.map((label, i) => {
          if (i === 0 && !showStep0) return null;
          if (i === 1 && !showStep1) return null;
          if (i === 3 && embeddedInPreDay) return null;
          return (
            <span
              key={label}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium cursor-default ${
                step === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </span>
          );
        })}
      </div>

      {/* Step 0: Review mandatory linked actions */}
      {step === 0 && (
        <section className="space-y-6">
          <p className="text-muted-foreground flex items-start gap-2">
            <span>{t("wizard.linkedIntro")}</span>
            <HintPopover textKey="hints.afterDayFate" conceptsAnchor="action-fates" />
          </p>
          {linkedList.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noLinkedToReview")}
            </p>
          ) : (
          <ul className="space-y-4">
              {linkedList.map((action) => (
                <li key={action.id} className="rounded-lg border bg-card p-4">
                  <div className="mb-3">
                    <div className="font-medium">{action.title}</div>
                    <p className="text-xs text-muted-foreground">
                      {action.project
                        ? action.project.title
                        : t(`wizard.source.${action.sourceType === "routine" ? "routine" : "interval"}`)}
                    </p>
                  </div>
                  {linkedResponses[action.id] ? (
                    <span className="text-sm text-muted-foreground">
                      {t("wizard.chosen", {
                        value: linkedResponses[action.id] === "not_important"
                          ? t("wizard.notImportant")
                          : t(`wizard.${linkedResponses[action.id]}`),
                      })}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLinkedResponses((p) => ({ ...p, [action.id]: "postpone" }))}
                      >
                        {t("wizard.postpone")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLinkedResponses((p) => ({ ...p, [action.id]: "outsource" }));
                          setOutsourceOpen(action.id);
                        }}
                      >
                        {t("wizard.outsource")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyLinkedChoice(action.id, "not_important")}
                      >
                        {t("wizard.notImportant")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyLinkedChoice(action.id, "pass")}
                      >
                        {t("wizard.pass")}
                      </Button>
                    </div>
                  )}
                  {linkedResponses[action.id] === "postpone" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Label htmlFor={`after-postpone-${action.id}`} className="sr-only flex items-center gap-2">
                        {t("wizard.newDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </Label>
                      <DateField
                        id={`after-postpone-${action.id}`}
                        min={minDate}
                        value={postponeDate[action.id] ?? ""}
                        onChange={(e) =>
                          setPostponeDate((p) => ({ ...p, [action.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          postponeDate[action.id] &&
                          applyLinkedChoice(action.id, "postpone", { newDate: postponeDate[action.id] })
                        }
                        disabled={!postponeDate[action.id]}
                      >
                        {t("wizard.setDate")}
                      </Button>
                    </div>
                  )}
                  {outsourceOpen === action.id && (
                    <div className="mt-3 space-y-2 rounded border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`after-outsource-do-title-${action.id}`} className="flex items-center gap-2">
                            {t("wizard.doOutsourcingTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`after-outsource-do-title-${action.id}`}
                            placeholder={t("wizard.delegatePlaceholder")}
                            value={outsourceForm.doTitle}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, doTitle: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`after-outsource-do-date-${action.id}`} className="flex items-center gap-2">
                            {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <DateField
                            id={`after-outsource-do-date-${action.id}`}
                            min={minDate}
                            value={outsourceForm.doDate}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, doDate: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`after-outsource-ensure-title-${action.id}`} className="flex items-center gap-2">
                            {t("wizard.ensureDoneTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <Input
                            id={`after-outsource-ensure-title-${action.id}`}
                            placeholder={t("wizard.confirmPlaceholder")}
                            value={outsourceForm.ensureTitle}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, ensureTitle: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`after-outsource-ensure-date-${action.id}`} className="flex items-center gap-2">
                            {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </Label>
                          <DateField
                            id={`after-outsource-ensure-date-${action.id}`}
                            min={minDate}
                            value={outsourceForm.ensureDate}
                            onChange={(e) =>
                              setOutsourceForm((p) => ({ ...p, ensureDate: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            applyLinkedChoice(action.id, "outsource", {
                              doTitle: outsourceForm.doTitle,
                              doDate: outsourceForm.doDate,
                              ensureTitle: outsourceForm.ensureTitle,
                              ensureDate: outsourceForm.ensureDate,
                            })
                          }
                          disabled={!outsourceForm.doDate || !outsourceForm.ensureDate}
                        >
                          {t("wizard.confirmOutsource")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOutsourceOpen(null);
                            setLinkedResponses((p) => {
                              const next = { ...p };
                              delete next[action.id];
                              return next;
                            });
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!canAdvanceFromStep0}>
              {t("wizard.nextReviewStandalone")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 1: Review standalone actions (sections hidden when no actions) */}
      {step === 1 && (
        <section className="space-y-8">
          <p className="text-muted-foreground">
            {t("wizard.standaloneIntro")}
          </p>
          {standaloneList.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">
                {fmt(new Date(dateKeyToClose + "T12:00:00"), "weekdayDayMonth")} {t("wizard.standalone")}
              </h2>
              <ul className="space-y-3">
                {standaloneList.map((action) => (
                  <StandaloneRow
                    key={action.id}
                    action={action}
                    minDate={minDate}
                    onPostpone={(newDate) => applyStandaloneChoice(action.id, "postpone", { newDate })}
                    onOutsource={(extra) => applyStandaloneChoice(action.id, "outsource", extra)}
                    onIgnore={() => applyStandaloneChoice(action.id, "ignore")}
                    onDelete={() => applyStandaloneChoice(action.id, "delete")}
                    busy={isRowBusy(action.id)}
                  />
                ))}
              </ul>
            </div>
          )}
          {dayBeforeStandalone.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">
                {fmt(new Date(dayBeforeKey + "T12:00:00"), "weekdayDayMonth")} {t("wizard.standaloneIfAny")}
              </h2>
              <ul className="space-y-3">
                {dayBeforeStandalone.map((action) => (
                  <StandaloneRow
                    key={action.id}
                    action={action}
                    minDate={minDate}
                    onPostpone={(newDate) => applyStandaloneChoice(action.id, "postpone", { newDate })}
                    onOutsource={(extra) => applyStandaloneChoice(action.id, "outsource", extra)}
                    onIgnore={() => applyStandaloneChoice(action.id, "ignore")}
                    onDelete={() => applyStandaloneChoice(action.id, "delete")}
                    busy={isRowBusy(action.id)}
                  />
                ))}
              </ul>
            </div>
          )}
          {standaloneList.length === 0 && dayBeforeStandalone.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noStandaloneToReview")}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>
              {t("wizard.nextDayThatPassed")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Step 2: Day That Passed */}
      {step === 2 && (
        <section className="space-y-6">
          <p className="text-muted-foreground">{t("wizard.dayPassedIntro")}</p>
          {doneActions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noCompletedRecorded")}
            </p>
          ) : (
            <ul className="space-y-2">
              {doneActions.map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <span>{a.title}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            {embeddedInPreDay ? (
              <Button onClick={finishFlow} loading={finishing} className="gap-2">
                {t("wizard.continueToDayReview")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button onClick={finishFlow} loading={finishing} className="gap-2">
                  <Moon className="h-4 w-4" />
                  {t("wizard.goodNight")}
                </Button>
                <Button variant="outline" onClick={() => setStep(3)}>
                  {t("wizard.nextTomorrowReview")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Step 3: Tomorrow review — intentionally hidden when embedded in Pre-day because
          Pre-day shows tomorrow's actions in its own "Day overview" step immediately after. */}
      {step === 3 && !embeddedInPreDay && (
        <section className="space-y-6">
          <p className="text-muted-foreground">
            {t("wizard.tomorrowIntro")}
          </p>
          {tomorrowActions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-muted-foreground">
              {t("wizard.noTasksTomorrow")}
            </p>
          ) : (
            <ul className="space-y-2">
              {tomorrowActions.map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-muted-foreground"
                >
                  {a.isGathered && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("wizard.gathered")}</span>
                  )}
                  <span>{a.title}</span>
                  {a.startTimeOfDay && (
                    <span className="ml-auto text-xs">{a.startTimeOfDay}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={finishFlow} loading={finishing} className="gap-2">
              <Sun className="h-4 w-4" />
              {t("wizard.done")}
            </Button>
          </div>
        </section>
      )}
    </main>
    </>
  );
}

function StandaloneRow({
  action,
  minDate,
  onPostpone,
  onOutsource,
  onIgnore,
  onDelete,
  busy = false,
}: {
  action: ActionItem;
  minDate: string;
  onPostpone: (newDate: string) => void;
  onOutsource: (extra: {
    doTitle?: string;
    doDate?: string;
    ensureTitle?: string;
    ensureDate?: string;
  }) => void;
  onIgnore: () => void;
  onDelete: () => void;
  /** True while this row's mutation is in flight. */
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [showPostpone, setShowPostpone] = useState(false);
  const [showOutsource, setShowOutsource] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [outsourceForm, setOutsourceForm] = useState({
    doTitle: "",
    doDate: "",
    ensureTitle: "",
    ensureDate: "",
  });
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="mb-2 font-medium">{action.title}</div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPostpone((p) => !p)}
        >
          {t("wizard.postpone")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowOutsource((p) => !p)}>
          {t("wizard.outsource")}
        </Button>
        <Button variant="outline" size="sm" onClick={onIgnore} loading={busy}>
          {t("wizard.ignore")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} loading={busy}>
          {t("wizard.delete")}
        </Button>
      </div>
      {showPostpone && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Label htmlFor="after-wizard-postpone-date" className="flex items-center gap-2 shrink-0">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </Label>
          <DateField
            id="after-wizard-postpone-date"
            min={minDate}
            value={postponeDate}
            onChange={(e) => setPostponeDate(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              if (postponeDate) {
                onPostpone(postponeDate);
                setShowPostpone(false);
                setPostponeDate("");
              }
            }}
            disabled={!postponeDate}
            loading={busy}
          >
            {t("wizard.setDate")}
          </Button>
        </div>
      )}
      {showOutsource && (
        <div className="mt-2 space-y-2 rounded border p-2">
          <div>
            <Label htmlFor="after-wizard-do-title" className="text-xs flex items-center gap-2">
              {t("wizard.doOutsourcingTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Label>
            <Input
              id="after-wizard-do-title"
              placeholder={t("wizard.doOutsourcingPlaceholder")}
              value={outsourceForm.doTitle}
              onChange={(e) => setOutsourceForm((p) => ({ ...p, doTitle: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="after-wizard-do-date" className="text-xs flex items-center gap-2">
              {t("wizard.doDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Label>
            <DateField
              id="after-wizard-do-date"
              min={minDate}
              placeholder={t("wizard.doDatePlaceholder")}
              value={outsourceForm.doDate}
              onChange={(e) => setOutsourceForm((p) => ({ ...p, doDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="after-wizard-ensure-title" className="text-xs flex items-center gap-2">
              {t("wizard.ensureDoneTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Label>
            <Input
              id="after-wizard-ensure-title"
              placeholder={t("wizard.ensureDonePlaceholder")}
              value={outsourceForm.ensureTitle}
              onChange={(e) => setOutsourceForm((p) => ({ ...p, ensureTitle: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="after-wizard-ensure-date" className="text-xs flex items-center gap-2">
              {t("wizard.ensureDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Label>
            <DateField
              id="after-wizard-ensure-date"
              min={minDate}
              placeholder={t("wizard.ensureDatePlaceholder")}
              value={outsourceForm.ensureDate}
              onChange={(e) => setOutsourceForm((p) => ({ ...p, ensureDate: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            disabled={!outsourceForm.doDate || !outsourceForm.ensureDate}
            loading={busy}
            onClick={() => {
              onOutsource(outsourceForm);
              setShowOutsource(false);
              setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
            }}
          >
            {t("wizard.confirmOutsource")}
          </Button>
        </div>
      )}
    </li>
  );
}
