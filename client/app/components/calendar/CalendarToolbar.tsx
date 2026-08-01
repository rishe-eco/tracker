import { Navigate, type ToolbarProps } from "react-big-calendar";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight, CircleDot } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Props compatible with any event type so Calendar can pass ToolbarProps<CalendarItem, object> */
type CalendarToolbarProps = Pick<ToolbarProps<object, object>, "label" | "onNavigate"> &
  Partial<Omit<ToolbarProps<object, object>, "label" | "onNavigate">>;

export default function CalendarToolbar({ label, onNavigate }: CalendarToolbarProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  return (
    <div className="rbc-toolbar flex flex-nowrap items-center justify-between gap-2 mb-2">
      <span className="rbc-toolbar-label font-medium text-sm">{label}</span>
      <span className="rbc-btn-group flex flex-nowrap items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 !flex !flex-row !items-center !justify-center"
          onClick={() => onNavigate(Navigate.TODAY)}
          aria-label={t("calendar.today")}
        >
          <CircleDot className="h-4 w-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">{t("calendar.today")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          aria-label={t("calendar.previous")}
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onNavigate(Navigate.NEXT)}
          aria-label={t("calendar.next")}
        >
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </span>
    </div>
  );
}
