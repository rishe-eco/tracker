import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "~/locales/en/common.json";
import faCommon from "~/locales/fa/common.json";

export const LANGUAGE_STORAGE_KEY = "tracker.language";
export const SUPPORTED_LANGUAGES = ["en", "fa"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function getDirection(language: AppLanguage): "ltr" | "rtl" {
  return language === "fa" ? "rtl" : "ltr";
}

export function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(saved)) return saved;
  return "en";
}

export function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dir = getDirection(language);
}

export async function setLanguage(language: AppLanguage) {
  if (!isSupportedLanguage(language)) return;
  await i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    fa: { common: faCommon },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language as AppLanguage);

i18n.on("languageChanged", (language) => {
  if (!isSupportedLanguage(language)) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
  applyDocumentLanguage(language);
});

export default i18n;
