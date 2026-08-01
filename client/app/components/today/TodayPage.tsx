import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import ActionPreview from "~/components/actions/ActionPreview";
import AfterDayWizard from "./AfterDayWizard";
import PreDayWizard from "./PreDayWizard";
import { useState, useEffect, useCallback } from "react";
import { useApi } from "~/api/useApi";
import {
  GET_TODAY_ACTIONS,
  GET_PRE_DAY_STATUS,
  ADD_ACTION,
  RUN_ACTION_GATHERING,
} from "~/api/queries";
import { toLocalDateString } from "~/utils/dateUtils";
import { Moon, Pencil, Sun, Plus } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import { useTranslation } from "react-i18next";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import JournalQuickAdd from "~/components/journals/JournalQuickAdd";

export default function TodayPage() {
  const { t } = useTranslation();
  const todaySteps = [
    { title: t("onboarding.modules.today.step1Title"), body: t("onboarding.modules.today.step1Body") },
    { title: t("onboarding.modules.today.step2Title"), body: t("onboarding.modules.today.step2Body") },
    { title: t("onboarding.modules.today.step3Title"), body: t("onboarding.modules.today.step3Body") },
  ];
  const todayKey = toLocalDateString(new Date());
  const [preDayStatus, setPreDayStatus] = useState<{ afterDayRequired?: boolean } | null>(null);
  const [showAfterDay, setShowAfterDay] = useState(false);
  const [showPreDay, setShowPreDay] = useState(false);
  const [todayActions, setTodayActions] = useState<any[] | null>(null);
  const [gatherRunning, setGatherRunning] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addDate, setAddDate] = useState(todayKey);
  const [addEstimatedMin, setAddEstimatedMin] = useState<string>("");
  const [addTimeOfDay, setAddTimeOfDay] = useState<string>("");
  const { call } = useApi();
  const showAddFields = addInput.trim().length > 0;
  const addDateIsToday = addDate === todayKey;
  const addEstimatedNum = addEstimatedMin.trim() ? parseInt(addEstimatedMin, 10) : NaN;
  const canSubmitAdd =
    addInput.trim().length > 0 &&
    addDate.length > 0 &&
    !Number.isNaN(addEstimatedNum) &&
    addEstimatedNum >= 0 &&
    (!addDateIsToday || addTimeOfDay.length > 0);

  const refetchTodayActions = useCallback(() => {
    call({ query: GET_TODAY_ACTIONS, variables: { date: todayKey } }).then((res: any) =>
      setTodayActions(res?.todayActions ?? [])
    );
  }, [call, todayKey]);

  // Initial load: fetch actions + preDayStatus + run gather in background
  useEffect(() => {
    let cancelled = false;

    call({ query: GET_TODAY_ACTIONS, variables: { date: todayKey } }).then((res: any) => {
      if (!cancelled) setTodayActions(res?.todayActions ?? []);
    });

    call({ query: GET_PRE_DAY_STATUS, variables: { date: todayKey } }).then((res: any) => {
      if (!cancelled) setPreDayStatus(res?.preDayStatus ?? null);
    });

    // Run gather silently; if actions were empty (gap scenario), refetch will populate them
    setGatherRunning(true);
    call({ query: RUN_ACTION_GATHERING, variables: { todayDate: todayKey } })
      .then(() => call({ query: GET_TODAY_ACTIONS, variables: { date: todayKey } }))
      .then((res: any) => {
        if (!cancelled) setTodayActions(res?.todayActions ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGatherRunning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  const afterDayRequired = preDayStatus?.afterDayRequired === true;

  if (showAfterDay) {
    return (
      <AfterDayWizard
        dateKeyToClose={todayKey}
        onClose={() => {
          setShowAfterDay(false);
          refetchTodayActions();
        }}
      />
    );
  }

  if (showPreDay) {
    return (
      <PreDayWizard
        todayKey={todayKey}
        afterDayRequired={afterDayRequired}
        onClose={() => setShowPreDay(false)}
        onComplete={() => {
          setShowPreDay(false);
          refetchTodayActions();
        }}
      />
    );
  }

  const linkedActions = (todayActions ?? []).filter(
    (a: any) => a.project || a.isGathered
  );
  const standaloneActions = (todayActions ?? []).filter(
    (a: any) => !a.project && !a.isGathered
  );

  const handleAddStandalone = () => {
    if (!canSubmitAdd) return;
    const title = addInput.trim();
    call({
      query: ADD_ACTION,
      variables: {
        title,
        tbd: addDate,
        estimatedTimeMinutes: addEstimatedNum,
        startTimeOfDay: addDateIsToday ? addTimeOfDay : undefined,
      },
    }).then(() => {
      setAddInput("");
      setAddDate(todayKey);
      setAddEstimatedMin("");
      setAddTimeOfDay("");
      refetchTodayActions();
    });
  };

  // Gap scenario: actions loaded but empty while gather is still running
  const showGatheringState = todayActions !== null && todayActions.length === 0 && gatherRunning;

  return (
    <>
    <ModuleIntroOverlay moduleKey="today" steps={todaySteps} />
    <main className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("today.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreDay(true)} className="gap-2">
            <Sun className="h-4 w-4" />
            {t("today.organize")}
          </Button>
          <Button variant="outline" onClick={() => setShowAfterDay(true)} className="gap-2">
            <Moon className="h-4 w-4" />
            {t("today.review")}
          </Button>
        </div>
      </div>

      {showGatheringState ? (
        <p className="text-muted-foreground">{t("today.gatheringActions")}</p>
      ) : (
        <>
          {/* Section 1: Linked Actions */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
              {t("today.linkedActions")}
              <HintPopover textKey="hints.todayLinkedStandalone" conceptsAnchor="daily-flow" />
            </h2>
            {todayActions === null ? (
              <>
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </>
            ) : !linkedActions.length ? (
              <p className="text-muted-foreground">{t("today.noLinkedActions")}</p>
            ) : (
              <ul className="space-y-2">
                {linkedActions.map((action: any) => (
                  <ActionPreview
                    key={action.id}
                    action={action}
                    showTodayOptions
                    onRefetch={refetchTodayActions}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Section 2: Standalone Actions */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">{t("today.standaloneActions")}</h2>
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <label htmlFor="today-add-action-title" className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  <Pencil className="h-4 w-4" aria-hidden />
                </label>
                <Input
                  id="today-add-action-title"
                  placeholder={t("today.addActionPlaceholder")}
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (showAddFields ? canSubmitAdd && handleAddStandalone() : false)}
                />
                <Button onClick={handleAddStandalone} size="icon" variant="default" disabled={showAddFields && !canSubmitAdd}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {showAddFields && (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="today-add-date" className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </label>
                    <Input
                      id="today-add-date"
                      type="date"
                      min={todayKey}
                      value={addDate}
                      onChange={(e) => setAddDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="today-add-estimated" className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      {t("today.estimatedTimeMin")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </label>
                    <Input
                      id="today-add-estimated"
                      type="number"
                      min={0}
                      placeholder={t("intervals.estimatedPlaceholder")}
                      value={addEstimatedMin}
                      onChange={(e) => setAddEstimatedMin(e.target.value)}
                      required
                    />
                  </div>
                  {addDateIsToday && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="today-add-time" className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        {t("today.timeToDo")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </label>
                      <Input
                        id="today-add-time"
                        type="time"
                        value={addTimeOfDay}
                        onChange={(e) => setAddTimeOfDay(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            {todayActions === null ? (
              <Skeleton className="h-16 w-full rounded-md" />
            ) : !standaloneActions.length ? (
              <p className="text-muted-foreground">{t("today.noStandaloneActions")}</p>
            ) : (
              <ul className="space-y-2">
                {standaloneActions.map((action: any) => (
                  <ActionPreview
                    key={action.id}
                    action={action}
                    showTodayOptions
                    onRefetch={refetchTodayActions}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <JournalQuickAdd />
    </main>
    </>
  );
}
