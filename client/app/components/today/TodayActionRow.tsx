import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useApi } from "~/api/useApi";
import {
  TOGGLE_ACTION,
  POSTPONE_ACTION,
  OUTSOURCE_ACTION,
  SET_ACTION_IGNORE,
  SET_ACTION_PASSED_ARCHIVED,
} from "~/api/queries";
import { MoreVertical, Pencil } from "lucide-react";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export type TodayAction = {
  id: string;
  title: string;
  done?: boolean;
  tbd?: string | null;
  forDate?: string | null;
  project?: { id: string; title: string } | null;
  isGathered?: boolean;
  sourceType?: string | null;
  startTimeOfDay?: string | null;
  estimatedTimeMinutes?: number | null;
};

type Props = {
  action: TodayAction;
  onRefetch: () => void;
};

function canIgnore(action: TodayAction): boolean {
  return (
    !action.project &&
    (action.isGathered ? action.sourceType === "routine" : true)
  );
}

function canPass(action: TodayAction): boolean {
  return Boolean(action.isGathered && action.sourceType === "interval");
}

function todayMinDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TodayActionRow({ action, onRefetch }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [showOutsource, setShowOutsource] = useState(false);
  const [outsourceForm, setOutsourceForm] = useState({
    doTitle: "",
    doDate: "",
    ensureTitle: "",
    ensureDate: "",
  });
  const { call } = useApi();

  const handleToggle = async () => {
    try {
      await call({ query: TOGGLE_ACTION, variables: { id: action.id } });
      onRefetch();
    } catch (e) {
      console.error(e);
    }
  };

  // One fate per row at a time — each of these refetches the day.
  const { submitting: acting, run: runAct } = useSubmitGuard();

  const handlePostpone = async () => {
    if (!postponeDate) return;
    await runAct(async () => {
    try {
      await call({
        query: POSTPONE_ACTION,
        variables: { id: action.id, newDate: postponeDate },
      });
      setPostponeDate("");
      setOpen(false);
      onRefetch();
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handleOutsource = async () => {
    if (!outsourceForm.doDate || !outsourceForm.ensureDate) return;
    await runAct(async () => {
    try {
      await call({
        query: OUTSOURCE_ACTION,
        variables: {
          id: action.id,
          doOutsourcingTitle: outsourceForm.doTitle || t("wizard.doOutsourcingDefault"),
          doOutsourcingDate: outsourceForm.doDate,
          ensureDoneTitle: outsourceForm.ensureTitle || t("wizard.ensureDoneDefault"),
          ensureDoneDate: outsourceForm.ensureDate,
        },
      });
      setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
      setShowOutsource(false);
      setOpen(false);
      onRefetch();
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handleIgnore = async () => {
    await runAct(async () => {
    try {
      await call({ query: SET_ACTION_IGNORE, variables: { id: action.id } });
      setOpen(false);
      onRefetch();
    } catch (e) {
      console.error(e);
    }
    });
  };

  const handlePass = async () => {
    await runAct(async () => {
    try {
      await call({
        query: SET_ACTION_PASSED_ARCHIVED,
        variables: { id: action.id },
      });
      setOpen(false);
      onRefetch();
    } catch (e) {
      console.error(e);
    }
    });
  };

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={action.done ?? false}
          onCheckedChange={handleToggle}
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{action.title}</div>
          <div className="text-xs text-muted-foreground">
            {action.project?.title && (
              <span>{t("today.fromProject", { title: action.project.title })}</span>
            )}
            {action.startTimeOfDay && (
              <span className="ml-1">{action.startTimeOfDay}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 h-8 w-8"
          aria-label={t("actions.options")}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Postpone */}
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="today-row-postpone-date" className="sr-only flex items-center gap-2">
              {t("wizard.postponeToDate")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Label>
            <Input
              id="today-row-postpone-date"
              type="date"
              min={todayMinDate()}
              value={postponeDate}
              onChange={(e) => setPostponeDate(e.target.value)}
              className="w-40"
            />
            <Button size="sm" variant="outline" onClick={handlePostpone} disabled={!postponeDate} loading={acting}>
              {t("wizard.postpone")}
            </Button>
          </div>

          {/* Outsource: toggle form */}
          {!showOutsource ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowOutsource(true)}
            >
              {t("wizard.outsource")}…
            </Button>
          ) : (
            <div className="rounded border p-3 space-y-2">
              <div className="text-sm font-medium">{t("wizard.outsourceSetDatesIntro")}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="today-row-outsource-do-title" className="text-xs flex items-center gap-2">
                    {t("wizard.doOutsourcingTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="today-row-outsource-do-title"
                    placeholder={t("wizard.delegatePlaceholder")}
                    value={outsourceForm.doTitle}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, doTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="today-row-outsource-do-date" className="text-xs flex items-center gap-2">
                    {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="today-row-outsource-do-date"
                    type="date"
                    min={todayMinDate()}
                    value={outsourceForm.doDate}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, doDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="today-row-outsource-ensure-title" className="text-xs flex items-center gap-2">
                    {t("wizard.ensureDoneTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="today-row-outsource-ensure-title"
                    placeholder={t("wizard.confirmPlaceholder")}
                    value={outsourceForm.ensureTitle}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, ensureTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="today-row-outsource-ensure-date" className="text-xs flex items-center gap-2">
                    {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="today-row-outsource-ensure-date"
                    type="date"
                    min={todayMinDate()}
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
                  loading={acting}
                  onClick={handleOutsource}
                  disabled={!outsourceForm.doDate || !outsourceForm.ensureDate}
                >
                  {t("wizard.confirmOutsource")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowOutsource(false);
                    setOutsourceForm({
                      doTitle: "",
                      doDate: "",
                      ensureTitle: "",
                      ensureDate: "",
                    });
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}

          {/* Ignore (bucket list) - if available */}
          {canIgnore(action) && (
            <Button size="sm" variant="outline" onClick={handleIgnore} loading={acting}>
              {t("wizard.ignoreBucketList")}
            </Button>
          )}

          {/* Pass - if available */}
          {canPass(action) && (
            <Button size="sm" variant="outline" onClick={handlePass} loading={acting}>
              {t("wizard.pass")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
