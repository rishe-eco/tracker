import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateField } from "~/components/ui/date-field";
import { useApi } from "~/api/useApi";
import {
  CLEAR_SKILL_SCHEDULE,
  GET_SKILL_PLAN,
  PLAN_SKILL_SCHEDULE,
} from "~/api/queries";

type PlannedSession = {
  actionId: string;
  moduleKey: string;
  title: string;
  tbd: string;
  done: boolean;
};

const todayKey = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Writes module sittings into the calendar as ordinary scheduled actions.
 *
 * Opt-in, and off by default: a tool that fills someone's calendar without being
 * asked is a tool they uninstall. Once on, due reviews are added as they fall
 * due — which is the point, since the review queue is the part most easily
 * ignored when it lives only inside the tool.
 */
export default function SkillPlanPanel({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { call } = useApi();

  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlannedSession[] | null>(null);
  const [startDate, setStartDate] = useState(todayKey());
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadPlan = useCallback(async () => {
    const data = await call({ query: GET_SKILL_PLAN, variables: { skillKey: "evidence" } });
    if (data?.skillPlan) setPlan(data.skillPlan);
  }, [call]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const schedule = async () => {
    setBusy(true);
    const data = await call({
      query: PLAN_SKILL_SCHEDULE,
      variables: { skillKey: "evidence", startDate, sessionsPerWeek, timeOfDay },
    });
    setBusy(false);
    setWarnings(data?.planSkillSchedule?.warnings ?? []);
    await loadPlan();
    onChanged();
  };

  const clear = async () => {
    setBusy(true);
    await call({ query: CLEAR_SKILL_SCHEDULE, variables: { skillKey: "evidence" } });
    setBusy(false);
    setWarnings([]);
    await loadPlan();
    onChanged();
  };

  const upcoming = (plan ?? []).filter((s) => !s.done && new Date(s.tbd) >= new Date());
  const next = upcoming[0];

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("skills.plan.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("skills.plan.description")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? t("skills.plan.hide") : t("skills.plan.configure")}
        </Button>
      </div>

      {enabled && (
        <p className="mt-3 text-sm">
          {upcoming.length > 0
            ? t("skills.plan.scheduledSummary", {
                count: upcoming.length,
                date: next ? fmt(new Date(next.tbd), "dayMonthYear") : "",
              })
            : t("skills.plan.nothingUpcoming")}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">{t("skills.plan.twoSittingsNote")}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("skills.plan.startDate")}</span>
              <DateField value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("skills.plan.sessionsPerWeek")}</span>
              <Input
                type="number"
                min={1}
                max={7}
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("skills.plan.timeOfDay")}</span>
              <Input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">{t("skills.plan.rerunNote")}</p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void schedule()} disabled={busy}>
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
              {enabled ? t("skills.plan.reschedule") : t("skills.plan.schedule")}
            </Button>
            {enabled && (
              <Button variant="outline" onClick={() => void clear()} disabled={busy}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                {t("skills.plan.clear")}
              </Button>
            )}
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {upcoming.length > 0 && (
            <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
              {upcoming.slice(0, 6).map((s) => (
                <li key={s.actionId}>
                  {fmt(new Date(s.tbd), "dayMonthYear")} · {s.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
