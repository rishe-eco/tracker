import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { GET_FOCUS_OVERVIEW } from "~/api/queries";
import { LoadingBlock } from "~/components/ui/spinner";
import { toLocalDateString } from "~/utils/dateUtils";
import FocusHeader from "./FocusHeader";
import FocusPeriodForm from "./FocusPeriodForm";
import FocusProjectCard from "./FocusProjectCard";
import { deriveState, type FocusOverview } from "./focusLogic";

/**
 * The Focus tab (spec §4; wireframes plates 1, 3, 4).
 *
 * One query fills the page. The client sends its own date: the server never
 * decides what "today" is (build plan PD-2). B3 adds the look-back and the
 * row actions into the slots `FocusProjectCard` exposes.
 */
export default function FocusPage() {
  const { t } = useTranslation();
  const { call } = useApi();
  const todayKey = toLocalDateString(new Date());

  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);

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

  if (!loaded) return <LoadingBlock className="p-6" label={t("focus.loading")} />;
  if (loadFailed) return <p className="p-6 text-destructive">{t("focus.loadError")}</p>;

  const state = deriveState(overview);
  // B2 has no look-back screen yet; B3 renders it when `state === "lookback"`.
  const period = overview?.active ?? overview?.upcoming ?? null;

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
            <FocusProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
