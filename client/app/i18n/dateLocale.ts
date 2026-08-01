import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { faIR } from "date-fns/locale/fa-IR";
import type { AppLanguage } from "./config";

export function getDateFnsLocale(language: AppLanguage): Locale {
  return language === "fa" ? faIR : enUS;
}

export function getWeekStartsOn(language: AppLanguage): 0 | 6 {
  return language === "fa" ? 6 : 0;
}
