import { format, parse, startOfWeek, getDay } from "date-fns";
import { dateFnsLocalizer } from "react-big-calendar";
import { enUS } from "date-fns/locale/en-US";
import { faIR } from "date-fns/locale/fa-IR";
import type { AppLanguage } from "~/i18n/config";
import { getWeekStartsOn } from "~/i18n/dateLocale";

const locales = {
  en: enUS,
  fa: faIR,
};

export function getCalendarLocalizer(language: AppLanguage) {
  return dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: getWeekStartsOn(language) }),
    getDay,
    locales,
  });
}
