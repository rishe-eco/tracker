import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateField } from "~/components/ui/date-field";
import { Label } from "~/components/ui/label";
import { Pencil, Plus, X } from "lucide-react";

export type AddActionWidgetProps = {
  title: string;
  onTitleChange: (value: string) => void;
  estimatedMinutes: string;
  onEstimatedMinutesChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  startTimeOfDay: string;
  onStartTimeOfDayChange: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  /** yyyy-MM-dd for min date and to show Start time when date is today */
  todayKey: string;
  canAdd: boolean;
  /** True while the add mutation is in flight. */
  busy?: boolean;
  /** Optional size for the trigger-style Add button when used as inline variant */
  addButtonSize?: "default" | "sm";
};

/** Order: title, est. time, date, time (if date is today). */
export default function AddActionWidget({
  title,
  onTitleChange,
  estimatedMinutes,
  onEstimatedMinutesChange,
  date,
  onDateChange,
  startTimeOfDay,
  onStartTimeOfDayChange,
  onAdd,
  onCancel,
  todayKey,
  canAdd,
  busy = false,
  addButtonSize = "default",
}: AddActionWidgetProps) {
  const { t } = useTranslation();
  const dateIsToday = date === todayKey;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onAdd();
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="add-action-title" className="text-xs text-muted-foreground flex items-center gap-2">
          {t("today.addActionTitle")} * <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Label>
        <Input
          id="add-action-title"
          placeholder={t("today.addActionTitle")}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full"
          autoFocus
          aria-required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="add-action-est" className="text-xs text-muted-foreground flex items-center gap-2">
          {t("today.addActionEst")} * <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Label>
        <Input
          id="add-action-est"
          type="number"
          min={0}
          max={1440}
          placeholder={t("intervals.estimatedPlaceholder")}
          value={estimatedMinutes}
          onChange={(e) => onEstimatedMinutesChange(e.target.value)}
          className="w-full max-w-xs"
          aria-required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="add-action-date" className="text-xs text-muted-foreground flex items-center gap-2">
          {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Label>
        <DateField
          id="add-action-date"
          min={todayKey}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full max-w-xs"
        />
      </div>
      {dateIsToday && (
        <div className="space-y-1">
          <Label htmlFor="add-action-start" className="text-xs text-muted-foreground flex items-center gap-2">
            {t("today.addActionStart")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Label>
          <Input
            id="add-action-start"
            type="time"
            value={startTimeOfDay}
            onChange={(e) => onStartTimeOfDayChange(e.target.value)}
            className="w-full max-w-xs"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="default"
          size={addButtonSize}
          onClick={onAdd}
          disabled={!canAdd}
          loading={busy}
          title={t("actionsList.addAction")}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("today.add")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={addButtonSize}
          onClick={onCancel}
          title={t("common.cancel")}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
