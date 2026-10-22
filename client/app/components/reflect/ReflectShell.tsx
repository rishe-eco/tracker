import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import type { ReflectStep } from "./types";

/**
 * The frame every entry step plugs into: the banner, the step bar with Stop
 * here, the footer, the not-saved line. B5's step bodies import these.
 * Logical properties throughout, so the bar and the footer mirror in `fa`.
 */

/**
 * The draft-locale banner (spec §4.2, G17, W19). Shown when the interface
 * language isn't the practice content's, or the served pack is a draft. It has
 * no dismiss control: a dismissed banner can't meet "whenever the condition
 * holds".
 */
export function ReflectBanner({
  practiceLocale,
  reviewStatus,
}: {
  practiceLocale: string;
  reviewStatus: string;
}) {
  const { t, i18n } = useTranslation();
  if (i18n.language === practiceLocale && reviewStatus !== "draft") return null;
  return (
    <div
      role="note"
      data-testid="reflect-banner"
      className="flex gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm"
    >
      <p>{t("reflect.banner.body")}</p>
    </div>
  );
}

const STEP_NAME_KEY: Record<ReflectStep, string> = {
  PRECHECK: "reflect.steps.precheck",
  STORY: "reflect.steps.story",
  FEELINGS: "reflect.steps.feelings",
  REALITY: "reflect.steps.reality",
  CLOSE: "reflect.steps.close",
};

/**
 * The step named (never numbered, W3), with Stop here at the end of the bar
 * (W1): the same place on every step, left in `fa` by `ms-auto`.
 */
export function ReflectStepBar({
  step,
  onStop,
  stopDisabled,
}: {
  step: ReflectStep;
  onStop: () => void;
  stopDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-semibold" data-testid="reflect-step-name">
        {t(STEP_NAME_KEY[step])}
      </h2>
      <Button variant="outline" size="sm" className="ms-auto" onClick={onStop} disabled={stopDisabled}>
        {t("reflect.nav.stop")}
      </Button>
    </div>
  );
}

/**
 * Back at the start, Next at the end (W2). A step with no Back (the pre-check
 * and the story, D-3) passes no `onBack` and leaves the slot empty, so Next
 * never changes sides. `children` replaces Next where a step needs two choices
 * (the pre-check's advisory).
 */
export function ReflectFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  backDisabled,
  children,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  /** Replaces the Next button. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      {onBack ? (
        <Button variant="outline" onClick={onBack} disabled={backDisabled}>
          {t("reflect.nav.back")}
        </Button>
      ) : (
        <span />
      )}
      {children ?? (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel ?? t("reflect.nav.next")}
        </Button>
      )}
    </div>
  );
}

/**
 * The one not-saved line, with Try again (G3, W6): shown only when a save has
 * failed. The page passes a different line when the text was saved but the move
 * or the stop wasn't.
 */
export function ReflectNotSaved({
  onRetry,
  messageKey = "reflect.notSaved",
}: {
  onRetry: () => void;
  messageKey?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
    >
      <p>{t(messageKey)}</p>
      <Button variant="outline" size="sm" className="ms-auto" onClick={onRetry}>
        {t("reflect.tryAgain")}
      </Button>
    </div>
  );
}
