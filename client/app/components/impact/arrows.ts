import { useTranslation } from "react-i18next";
import { getDirection, type AppLanguage } from "../../i18n/config";

/**
 * Arrows that mean a direction have to follow the reading direction.
 *
 * The bidi algorithm mirrors paired punctuation — brackets, quotes — but not
 * arrows: U+2190 `←` renders pointing left in Persian exactly as it does in
 * English. So "← back" and "observation → need", both correct in an LTR
 * column, come out in Persian pointing the wrong way.
 *
 * Duplicated from `components/learn/arrows.ts` rather than imported —
 * Noticing shares no code with Feelings & Needs (build plan §3), including
 * at the client layer, since the two component trees migrate to separate
 * standalone apps later and an import between them is exactly the coupling
 * that would need untangling then.
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
