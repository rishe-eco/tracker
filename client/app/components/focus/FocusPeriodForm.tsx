import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import {
  CREATE_FOCUS_PERIOD,
  DELETE_FOCUS_PERIOD,
  GET_FOCUS_PERIOD_RANGES,
  GET_FOCUS_PICKER_PROJECTS,
  UPDATE_FOCUS_PERIOD,
} from "~/api/queries";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { DateField } from "~/components/ui/date-field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useAppDate } from "~/i18n/useAppDate";
import { parseDateOnly } from "~/utils/dateUtils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import {
  findOverlap,
  groupForPicker,
  isProjectDone,
  projectContext,
  toKey,
  type FocusPeriod,
  type FocusPeriodRange,
  type FocusProject,
} from "./focusLogic";

const TITLE_MAX = 120;

type Props = {
  mode: "create" | "edit";
  /** The period being edited (edit mode). */
  period?: FocusPeriod;
  /** Starting values for a new period — the look-back's carry-over uses this (B3). */
  initial?: { startDate?: string; projectIds?: string[] };
  todayKey: string;
  onSaved: () => void;
  onCancel?: () => void;
  onDeleted?: () => void;
};

/**
 * Start or edit a focus period (spec §4.1, §4.2, §4.4; wireframes plates 3–5).
 *
 * The overlap check runs here first so the message can name the period in the
 * way (build plan PD-8); the server refuses an overlap too, as the backstop.
 * Edit saves everything — name, dates and the full project list — in one call
 * (PD-5).
 */
export default function FocusPeriodForm({ mode, period, initial, todayKey, onSaved, onCancel, onDeleted }: Props) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const [title, setTitle] = useState(period?.title ?? "");
  const [start, setStart] = useState(period ? toKey(period.startDate) : initial?.startDate ?? todayKey);
  const [end, setEnd] = useState(period ? toKey(period.endDate) : "");
  const [selected, setSelected] = useState<string[]>(
    period ? period.projects.map((p) => p.id) : initial?.projectIds ?? []
  );
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(mode === "create");
  const [projects, setProjects] = useState<FocusProject[]>([]);
  const [ranges, setRanges] = useState<FocusPeriodRange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([call({ query: GET_FOCUS_PICKER_PROJECTS }), call({ query: GET_FOCUS_PERIOD_RANGES })]).then(
      ([p, r]) => {
        if (cancelled) return;
        setProjects(p?.projects ?? []);
        setRanges(r?.focusPeriodRanges ?? []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [call]);

  // Projects already in the period stay listed even once finished, so they
  // can be unticked (wireframes W7).
  const keepIds = useMemo(() => new Set(period?.projects.map((p) => p.id) ?? []), [period]);
  const carriedIds = useMemo(() => new Set(initial?.projectIds ?? []), [initial]);
  const byId = useMemo(() => {
    const m = new Map<string, FocusProject>();
    for (const p of period?.projects ?? []) m.set(p.id, p);
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects, period]);

  const groups = useMemo(() => groupForPicker(projects, start, end, search, keepIds), [projects, start, end, search, keepIds]);

  const trimmed = title.trim();
  const rangeComplete = Boolean(start && end);
  const endBeforeStart = rangeComplete && end < start;
  const overlap = rangeComplete && !endBeforeStart ? findOverlap(ranges, start, end, period?.id) : null;
  const canSave = trimmed.length > 0 && trimmed.length <= TITLE_MAX && rangeComplete && !endBeforeStart && !overlap && !submitting;

  const fmtRange = (s: string, e: string) =>
    t("focus.dateRange", { start: fmt(parseDateOnly(toKey(s)), "dayMonth"), end: fmt(parseDateOnly(toKey(e)), "dayMonth") });

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = () =>
    run(async () => {
      if (!canSave) return;
      setError(null);
      const input = { title: trimmed, startDate: start, endDate: end, projectIds: selected };
      const res =
        mode === "edit" && period
          ? await call({ query: UPDATE_FOCUS_PERIOD, variables: { id: period.id, input } })
          : await call({ query: CREATE_FOCUS_PERIOD, variables: { input } });
      if (!res) {
        setError(t("focus.saveError"));
        return;
      }
      onSaved();
    });

  const remove = async () => {
    if (!period) return;
    const res = await call({ query: DELETE_FOCUS_PERIOD, variables: { id: period.id } });
    setConfirmDelete(false);
    if (res) onDeleted?.();
    else setError(t("focus.saveError"));
  };

  const projectSub = (p: FocusProject) => {
    const ctx = projectContext(p);
    const where = ctx.goal ?? ctx.milestone ?? t("focus.noGoal");
    const when = p.startDate && p.endDate ? fmtRange(p.startDate, p.endDate) : t("focus.noDates");
    return `${where} · ${when}`;
  };

  const pickRow = (p: FocusProject) => (
    <label key={p.id} className="flex items-center gap-2 border-b py-2 text-sm cursor-pointer">
      <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.title} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{p.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{projectSub(p)}</span>
      </span>
      {carriedIds.has(p.id) && <span className="text-xs text-muted-foreground">{t("focus.carriedOver")}</span>}
    </label>
  );

  // In edit mode the sheet lists what's already in the period, and "+ Add
  // projects" opens the full picker for the rest (wireframes W12).
  // Unticking keeps the row in place (unticked) so a slip is easy to undo.
  const inPeriodIds =
    mode === "edit" ? [...keepIds, ...selected.filter((id) => !keepIds.has(id))] : [];
  const inPeriod = inPeriodIds.map((id) => byId.get(id)).filter(Boolean) as FocusProject[];
  const listed = new Set(inPeriodIds);
  const pickerScheduled = groups.scheduled.filter((p) => !listed.has(p.id));
  const pickerOther = groups.other.filter((p) => !listed.has(p.id));
  const nothingToPick = projects.length === 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{mode === "edit" ? t("focus.editTitle") : t("focus.newPeriodTitle")}</h2>

      <div className="space-y-1">
        <Label htmlFor="focus-title">{t("focus.name")}</Label>
        <Input
          id="focus-title"
          value={title}
          maxLength={TITLE_MAX}
          placeholder={t("focus.namePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="focus-start">{t("focus.start")}</Label>
          <DateField id="focus-start" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="focus-end">{t("focus.end")}</Label>
          <DateField id="focus-end" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {endBeforeStart && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t("focus.endBeforeStart")}
        </p>
      )}
      {overlap && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t("focus.overlap", {
            title: overlap.title,
            start: fmt(parseDateOnly(toKey(overlap.startDate)), "dayMonth"),
            end: fmt(parseDateOnly(toKey(overlap.endDate)), "dayMonth"),
          })}
        </p>
      )}

      <div className="space-y-2">
        <Label>{mode === "edit" ? t("focus.inThisPeriod") : t("focus.projects")}</Label>

        {mode === "edit" && (
          <div>
            {inPeriod.map((p) => (
              <label key={p.id} className="flex items-center gap-2 border-b py-2 text-sm cursor-pointer">
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.title} />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                {isProjectDone(p) && <Badge className="bg-green-100 text-green-800">{t("focus.done")}</Badge>}
              </label>
            ))}
            <p className="mt-2 text-xs text-muted-foreground">{t("focus.finishedStays")}</p>
            {!pickerOpen && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPickerOpen(true)}>
                {t("focus.addProjects")}
              </Button>
            )}
          </div>
        )}

        {pickerOpen && (
          <div className="space-y-2">
            {mode === "edit" && <Label className="pt-2">{t("focus.projects")}</Label>}
            {nothingToPick ? (
              <p className="text-sm text-muted-foreground">{t("focus.noProjectsToPick")}</p>
            ) : (
              <>
                <Input
                  value={search}
                  placeholder={t("focus.searchProjects")}
                  aria-label={t("focus.searchProjects")}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {pickerScheduled.length > 0 && (
                  <div>
                    <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("focus.scheduledInDates")}
                    </p>
                    {pickerScheduled.map(pickRow)}
                  </div>
                )}
                {pickerOther.length > 0 && (
                  <div>
                    <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("focus.otherProjects")}
                    </p>
                    {pickerOther.map(pickRow)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("focus.finishedNotListed")}</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={!canSave}>
          {mode === "edit" ? t("focus.save") : t("focus.startPeriod")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("focus.cancel")}
          </Button>
        )}
      </div>

      {mode === "edit" && period && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            {t("focus.deletePeriod")}
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={() => setConfirmDelete(false)}
            title={t("focus.deleteConfirmTitle", { title: period.title })}
            description={t("focus.deleteConfirmBody")}
            confirmLabel={t("focus.delete")}
            cancelLabel={t("focus.cancel")}
            variant="destructive"
            onConfirm={remove}
          />
        </>
      )}
    </section>
  );
}
