import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { GET_FOCUS_OVERVIEW, RECORD_FOCUS_LOOKBACK, TOGGLE_ACTION } from "~/api/queries";
import { LoadingBlock } from "~/components/ui/spinner";
import { addDaysToDateKey, toLocalDateString } from "~/utils/dateUtils";
import FocusCard from "./FocusCard";
import FocusHeader from "./FocusHeader";
import FocusLookback, { type LookbackAnswer } from "./FocusLookback";
import FocusPeriodForm from "./FocusPeriodForm";
import UndoToast from "./UndoToast";
import { deriveState, toKey, type FocusAction, type FocusOverview } from "./focusLogic";

/** A new period being started from the look-back, with what to record once it's saved. */
type CarryOver = {
  lookbackId: string;
  answer: LookbackAnswer | null;
  initial: { startDate: string; projectIds: string[] };
};

/**
 * The Focus tab (spec §4; wireframes plates 1–5).
 *
 * One query fills the page. The client sends its own date: the server never
 * decides what "today" is (build plan PD-2). After any change — complete,
 * reschedule, add, remove, Done — the page refetches rather than patching
 * its own copy, so the counts always match the server.
 */
export default function FocusPage() {
  const { t } = useTranslation();
  const { call } = useApi();
  const todayKey = toLocalDateString(new Date());

  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [carry, setCarry] = useState<CarryOver | null>(null);
  const [toast, setToast] = useState<FocusAction | null>(null);

  const refetch = useCallback(async () => {
    const res = await call({ query: GET_FOCUS_OVERVIEW, variables: { dateKey: todayKey } });
    if (res?.focusOverview) {
      setOverview(res.focusOverview);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
    setLoaded(true);
  }, [call, todayKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Undo is `toggleAction` on the same id. It only exists while the toast
  // does: a second completion replaces the toast and finalises the first.
  const undo = async () => {
    if (!toast) return;
    const id = toast.id;
    setToast(null);
    await call({ query: TOGGLE_ACTION, variables: { id } });
    refetch();
  };

  // A period started from the look-back also closes the look-back, with the
  // answer given so far; otherwise the page would bounce straight back to it.
  const carriedSaved = async () => {
    if (carry) {
      await call({
        query: RECORD_FOCUS_LOOKBACK,
        variables: { id: carry.lookbackId, answer: carry.answer, dateKey: todayKey },
      });
    }
    setCarry(null);
    refetch();
  };

  if (!loaded) return <LoadingBlock className="p-6" label={t("focus.loading")} />;
  if (loadFailed) return <p className="p-6 text-destructive">{t("focus.loadError")}</p>;

  const state = deriveState(overview);
  const period = overview?.active ?? overview?.upcoming ?? null;

  if (state === "lookback" && overview?.lookback) {
    const lookback = overview.lookback;
    if (carry) {
      return (
        <main className="space-y-6 p-6 max-w-2xl">
          <FocusPeriodForm
            mode="create"
            initial={carry.initial}
            todayKey={todayKey}
            onSaved={carriedSaved}
            onCancel={() => setCarry(null)}
          />
        </main>
      );
    }
    return (
      <FocusLookback
        period={lookback}
        todayKey={todayKey}
        onDone={refetch}
        onStartNew={(projectIds, answer) => {
          // The day after the old period ended, or today if that has passed.
          const next = addDaysToDateKey(toKey(lookback.endDate), 1);
          setCarry({
            lookbackId: lookback.id,
            answer,
            initial: { startDate: next > todayKey ? next : todayKey, projectIds },
          });
        }}
      />
    );
  }

  if (state === "empty" || !period) {
    return (
      <main className="space-y-6 p-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t("focus.title")}</h1>
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          {t("focus.emptyIntro")}
        </p>
        <FocusPeriodForm mode="create" todayKey={todayKey} onSaved={refetch} />
      </main>
    );
  }

  if (editing) {
    return (
      <main className="space-y-6 p-6 max-w-2xl">
        <FocusPeriodForm
          mode="edit"
          period={period}
          todayKey={todayKey}
          onSaved={() => {
            setEditing(false);
            refetch();
          }}
          onCancel={() => setEditing(false)}
          onDeleted={() => {
            setEditing(false);
            refetch();
          }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <FocusHeader period={period} todayKey={todayKey} onEdit={() => setEditing(true)} />
      {period.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("focus.noProjectsInPeriod")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {period.projects.map((p) => (
            <FocusCard
              key={p.id}
              project={p}
              period={period}
              todayKey={todayKey}
              onChanged={refetch}
              onCompleted={setToast}
            />
          ))}
        </div>
      )}
      {toast && <UndoToast key={toast.id} title={toast.title} onUndo={undo} onExpire={() => setToast(null)} />}
    </main>
  );
}
