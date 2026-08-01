import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { GET_MODULE_INTRO_VIEWED, MARK_MODULE_INTRO_VIEWED } from "~/api/queries";
import { useOnboardingTour } from "./OnboardingTourContext";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";

export type IntroStep = {
  title: string;
  body: string;
  // spotlight?: { selector: string }; // reserved for future use
};

type Props = {
  moduleKey: string;
  steps: IntroStep[];
};

export default function ModuleIntroOverlay({ moduleKey, steps }: Props) {
  const { t } = useTranslation();
  const { call } = useApi();
  const { status: tourStatus } = useOnboardingTour();
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  // The welcome tour goes first: it and this overlay are both `fixed inset-0
  // z-50`, so showing both stacks them and the top one eats the other's clicks.
  // Wait until the tour is off screen — finished, or closed for the session —
  // before even asking whether this intro is due.
  const tourClear = tourStatus === "hidden";

  useEffect(() => {
    if (!tourClear) return;
    call({ query: GET_MODULE_INTRO_VIEWED, variables: { moduleKey } }).then((res: any) => {
      if (!res?.moduleIntroViewed) setVisible(true);
      setLoaded(true);
    });
  }, [moduleKey, tourClear]);

  const dismiss = async () => {
    setVisible(false);
    await call({ query: MARK_MODULE_INTRO_VIEWED, variables: { moduleKey } });
  };

  if (!loaded || !visible) return null;

  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const step = steps[current];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border bg-background p-6 shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("onboarding.nav.slideOf", { current: current + 1, total: steps.length })}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("onboarding.nav.skip")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === current ? "bg-primary" : i < current ? "bg-primary/40" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold mb-2">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrent((c) => c - 1)}
            disabled={isFirst}
          >
            {t("onboarding.nav.previous")}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground">
            {t("onboarding.nav.skip")}
          </Button>
          {isLast ? (
            <Button size="sm" onClick={dismiss}>
              {t("onboarding.nav.gotIt")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCurrent((c) => c + 1)}>
              {t("onboarding.nav.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
