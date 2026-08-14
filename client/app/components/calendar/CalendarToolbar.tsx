import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight, CircleDot } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The three actions the toolbar can emit. These were react-big-calendar's
 * `Navigate` constants; the strings are kept verbatim so the week and day views
 * that already switched on them did not have to change when RBC went away.
 */
export type CalendarNavAction = "PREV" | "NEXT" | "TODAY";

type CalendarToolbarProps = {
  label: string;
  onNavigate: (action: CalendarNavAction) => void;
};

export default function CalendarToolbar({ label, onNavigate }: CalendarToolbarProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  return (
    <div className="flex flex-nowrap items-center justify-between gap-2 mb-2">
      <span className="font-medium text-sm">{label}</span>
      <span className="flex flex-nowrap items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 !flex !flex-row !items-center !justify-center"
          onClick={() => onNavigate("TODAY")}
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
          onClick={() => onNavigate("PREV")}
          aria-label={t("calendar.previous")}
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onNavigate("NEXT")}
          aria-label={t("calendar.next")}
        >
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </span>
    </div>
  );
}
