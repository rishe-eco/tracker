import { useTranslation } from "react-i18next";
import { getDirection, type AppLanguage } from "../../i18n/config";

/**
 * Arrows that mean a direction have to follow the reading direction.
 *
 * The bidi algorithm mirrors paired punctuation — brackets, quotes — but not
 * arrows: U+2190 `←` renders pointing left in Persian exactly as it does in
 * English. So "← back" and "feeling → need", both correct in an LTR column, come
 * out in Persian pointing at the next step and away from the need. The glyph has
 * to be chosen rather than trusted.
 *
 * Kept in one place because the alternative was the same conditional in three
 * components, which is the arrangement where one of them gets missed.
 */
export function useArrows() {
  const { i18n } = useTranslation();
  const rtl = getDirection(i18n.language as AppLanguage) === "rtl";
  return {
    /** Backwards, against the reading direction. */
    back: rtl ? "→" : "←",
    /** "this leads to that" — with the reading direction. */
    leadsTo: rtl ? "←" : "→",
  };
}
