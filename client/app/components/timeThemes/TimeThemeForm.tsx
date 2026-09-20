import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DateTimeField } from "~/components/ui/date-field";
import { Switch } from "~/components/ui/switch";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import TagPicker from "~/components/tags/TagPicker";
import { useTagVocabulary } from "~/components/tags/useTagVocabulary";
import RecurrenceControl, { toDateTimeLocal, fromDateTimeLocal } from "~/components/schedule/RecurrenceControl";
import { useApi } from "~/api/useApi";
import {
  GET_TIME_THEME,
  CREATE_TIME_THEME,
  UPDATE_TIME_THEME,
  DELETE_TIME_THEME,
} from "~/api/queries";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

/** A Time Theme = tag(s) + a time-of-day span + the same recurrence control the
 * Interval editor uses (time-themes.md §4, §7.4). No outcome, no estimate, no
 * steps, no goal/project link — only a shaped, recurring stretch of time. */
export default function TimeThemeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [startTimeOfDay, setStartTimeOfDay] = useState("08:00");
  const [endTimeOfDay, setEndTimeOfDay] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [repeatValue, setRepeatValue] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<string>("week");
  const [customRepeatDates, setCustomRepeatDates] = useState<string[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [yearDaysOfMonth, setYearDaysOfMonth] = useState<number[]>([]);
  const { availableTags, createTag } = useTagVocabulary();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const minDateTimeLocal = format(new Date(), "yyyy-MM-dd") + "T00:00";


  useEffect(() => {
    if (!isEdit || !id) return;
    call({ query: GET_TIME_THEME, variables: { id } }).then((res) => {
      const data = res?.timeTheme;
      if (!data) return;
      setTitle(data.title ?? "");
      setStatus(data.status === "inactive" ? "inactive" : "active");
      setStartTimeOfDay(data.startTimeOfDay ?? "08:00");
      setEndTimeOfDay(data.endTimeOfDay ?? "09:00");
      setEndTime(data.endTime ? toDateTimeLocal(data.endTime) : "");
      setRepeatValue(data.repeatValue ?? 1);
      setRepeatUnit(data.repeatUnit ?? "week");
      setCustomRepeatDates(Array.isArray(data.customRepeatDates) ? data.customRepeatDates : []);
      setTagIds((data.tags ?? []).map((tg: any) => tg.id));
      if (data.customRepeatRule) {
        try {
          const rule = JSON.parse(data.customRepeatRule) as {
            unit?: string;
            daysOfWeek?: number[];
            daysOfMonth?: number[];
            months?: number[];
          };
          setDaysOfWeek(Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : []);
          setDaysOfMonth(rule.unit === "month" && Array.isArray(rule.daysOfMonth) ? rule.daysOfMonth : []);
          setMonths(Array.isArray(rule.months) ? rule.months : []);
          setYearDaysOfMonth(rule.unit === "year" && Array.isArray(rule.daysOfMonth) ? rule.daysOfMonth : []);
        } catch {
          setDaysOfWeek([]);
          setDaysOfMonth([]);
          setMonths([]);
          setYearDaysOfMonth([]);
        }
      } else {
        setDaysOfWeek([]);
        setDaysOfMonth([]);
        setMonths([]);
        setYearDaysOfMonth([]);
      }
    });
  }, [id, isEdit]);

  const addCustomDate = () => setCustomRepeatDates((prev) => [...prev, ""]);
  const setCustomDateAt = (index: number, value: string) => {
    const next = value ? fromDateTimeLocal(value) : "";
    setCustomRepeatDates((prev) => {
      const out = [...prev];
      out[index] = next;
      return out;
    });
  };
  const removeCustomDate = (index: number) => setCustomRepeatDates((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(performSubmit);
  };

  const performSubmit = async () => {
    setTitleError(null);
    setTimeError(null);
    if (!title.trim()) {
      setTitleError(t("timeThemes.errors.titleRequired"));
      return;
    }
    if (!startTimeOfDay || !endTimeOfDay || endTimeOfDay <= startTimeOfDay) {
      setTimeError(t("timeThemes.errors.endAfterStart"));
      return;
    }

    let customRepeatRulePayload: string | undefined;
    if (repeatUnit === "week" && daysOfWeek.length > 0) {
      customRepeatRulePayload = JSON.stringify({ unit: "week", daysOfWeek: [...daysOfWeek].sort((a, b) => a - b) });
    } else if (repeatUnit === "month" && daysOfMonth.length > 0) {
      customRepeatRulePayload = JSON.stringify({ unit: "month", daysOfMonth: [...daysOfMonth].sort((a, b) => a - b) });
    } else if (repeatUnit === "year" && months.length > 0) {
      const yearRule: { unit: string; months: number[]; daysOfMonth?: number[] } = {
        unit: "year",
        months: [...months].sort((a, b) => a - b),
      };
      if (yearDaysOfMonth.length > 0) yearRule.daysOfMonth = [...yearDaysOfMonth].sort((a, b) => a - b);
      customRepeatRulePayload = JSON.stringify(yearRule);
    }

    const input = {
      title: title.trim(),
      startTimeOfDay,
      endTimeOfDay,
      repeatValue,
      repeatUnit: repeatUnit || null,
      customRepeatDates: customRepeatDates.filter(Boolean).length > 0 ? customRepeatDates.filter(Boolean) : undefined,
      customRepeatRule: customRepeatRulePayload,
      endTime: endTime ? fromDateTimeLocal(endTime) : undefined,
      tagIds,
    };

    try {
      if (isEdit) {
        const res = await call({ query: UPDATE_TIME_THEME, variables: { id, input } });
        if (res?.updateTimeTheme) {
          if (res.updateTimeTheme.status !== status) {
            // status is edited via its own toggle (below), already committed immediately.
          }
          navigate("/activities/timeThemes");
        }
      } else {
        const res = await call({ query: CREATE_TIME_THEME, variables: { input } });
        if (res?.createTimeTheme) navigate("/activities/timeThemes");
      }
    } catch (err) {
      console.error("Failed to submit time theme", err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    await call({ query: DELETE_TIME_THEME, variables: { id } });
    setDeleteConfirmOpen(false);
    navigate("/activities/timeThemes");
  };

  return (
    <InternalPageLayout
      backLink={{ to: "/activities/timeThemes", label: `← ${t("timeThemes.backToList")}` }}
      title={isEdit ? t("timeThemes.editTitle") : t("timeThemes.addTitle")}
      maxWidth="max-w-2xl"
      actions={
        isEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive ms-2"
            onClick={() => setDeleteConfirmOpen(true)}
            title={t("timeThemes.deleteTheme")}
            aria-label={t("timeThemes.deleteTheme")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme-title">{t("timeThemes.nameLabel")}</Label>
          <Input
            id="theme-title"
            placeholder={t("timeThemes.namePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(titleError)}
            className={titleError ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
          />
          {titleError && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {titleError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("timeThemes.natureLabel")}</Label>
          <TagPicker availableTags={availableTags} selectedTagIds={tagIds} onChange={setTagIds} onCreateTag={createTag} />
          <p className="text-xs text-muted-foreground">{t("timeThemes.natureHelp")}</p>
        </div>

        <div className="flex gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor="theme-start">{t("timeThemes.fromLabel")}</Label>
            <Input
              id="theme-start"
              type="time"
              value={startTimeOfDay}
              onChange={(e) => setStartTimeOfDay(e.target.value)}
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label htmlFor="theme-end">{t("timeThemes.toLabel")}</Label>
            <Input id="theme-end" type="time" value={endTimeOfDay} onChange={(e) => setEndTimeOfDay(e.target.value)} />
          </div>
        </div>
        {timeError && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {timeError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Label htmlFor="theme-status" className="text-sm font-medium">
            {t("intervals.status")}
          </Label>
          <Switch
            id="theme-status"
            checked={status === "active"}
            onCheckedChange={async (checked) => {
              const next = checked ? "active" : "inactive";
              setStatus(next);
              if (isEdit && id) {
                await call({
                  query: UPDATE_TIME_THEME,
                  variables: {
                    id,
                    input: {
                      title: title.trim() || t("timeThemes.namePlaceholder"),
                      startTimeOfDay,
                      endTimeOfDay,
                      repeatValue,
                      repeatUnit: repeatUnit || null,
                      customRepeatDates: customRepeatDates.filter(Boolean).length > 0 ? customRepeatDates.filter(Boolean) : undefined,
                      endTime: endTime ? fromDateTimeLocal(endTime) : undefined,
                      tagIds,
                    },
                  },
                });
              }
            }}
          />
          <span className="text-sm text-muted-foreground">
            {status === "active" ? t("intervals.active") : t("intervals.inactive")}
          </span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme-endTime">{t("intervals.endDateOptional")}</Label>
          <DateTimeField
            id="theme-endTime"
            min={minDateTimeLocal}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <div className="rounded-md border p-4 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t("timeThemes.recurrenceTitle")}</h3>
          <RecurrenceControl
            repeatValue={repeatValue}
            onRepeatValueChange={setRepeatValue}
            repeatUnit={repeatUnit}
            onRepeatUnitChange={setRepeatUnit}
            daysOfWeek={daysOfWeek}
            onDaysOfWeekChange={setDaysOfWeek}
            daysOfMonth={daysOfMonth}
            onDaysOfMonthChange={setDaysOfMonth}
            months={months}
            onMonthsChange={setMonths}
            yearDaysOfMonth={yearDaysOfMonth}
            onYearDaysOfMonthChange={setYearDaysOfMonth}
            customRepeatDates={customRepeatDates}
            onAddCustomDate={addCustomDate}
            onCustomDateChange={setCustomDateAt}
            onRemoveCustomDate={removeCustomDate}
            minDateTimeLocal={minDateTimeLocal}
            toDateTimeLocal={toDateTimeLocal}
            showTimeOfDayBlocks={false}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" loading={submitting}>
            {t("intervals.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/activities/timeThemes")} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>

      {isEdit && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
          title={t("timeThemes.deleteConfirmTitle")}
          description={t("timeThemes.deleteConfirmDescription")}
          confirmLabel={t("common.delete")}
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      )}
    </InternalPageLayout>
  );
}
