import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useApi } from "~/api/useApi";
import { GET_ONBOARDING_PROGRESS, MARK_SLIDE_VIEWED, GET_ME_DISCOVERABILITY, UPDATE_DISCOVERABILITY } from "~/api/queries";
import { useOnboardingTour } from "./OnboardingTourContext";
import { setLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from "~/i18n/config";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const TOTAL_SLIDES = 7;

/**
 * "Close for now" has to survive a navigation, or it isn't a close — it is a
 * pause until the next route change. Session-scoped rather than persisted: the
 * tour is genuinely worth offering again on the next visit, just not three
 * screens later.
 */
const CLOSED_FOR_NOW_KEY = "tracker.onboarding.closedForNow";

function readClosedForNow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CLOSED_FOR_NOW_KEY) === "1";
  } catch {
    return false;
  }
}

type OnboardingSlideshowProps = {
  /**
   * Replay mode: show the tour on demand (from Settings) regardless of stored
   * progress, and leave that progress untouched — it is a re-read, not a redo.
   */
  replay?: boolean;
  /**
   * Hold the tour back on routes it has no business covering.
   *
   * Suppressed rather than unmounted, so it still reports "hidden" to the
   * sequencing context — a tour that simply isn't rendered leaves that context
   * on "pending" forever, and every module intro waits behind a tour that is
   * never coming.
   */
  suppressed?: boolean;
  /** Called when a replayed tour is closed or finished. */
  onClose?: () => void;
};

export default function OnboardingSlideshow({
  replay = false,
  suppressed = false,
  onClose,
}: OnboardingSlideshowProps = {}) {
  const { t, i18n } = useTranslation();
  const { call } = useApi();
  const { setStatus } = useOnboardingTour();
  const [loaded, setLoaded] = useState(replay);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(readClosedForNow);
  const [current, setCurrent] = useState(0);
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [discoverableByEmail, setDiscoverableByEmail] = useState(false);

  useEffect(() => {
    if (suppressed) return;
    if (!replay) {
      call({ query: GET_ONBOARDING_PROGRESS }).then((res: any) => {
        const progress = res?.onboardingProgress;
        if (progress?.completedAt) {
          setCompleted(true);
        } else if (progress?.lastSlideViewed != null) {
          setCurrent(Math.min(progress.lastSlideViewed + 1, TOTAL_SLIDES - 1));
        } else {
          // Nothing viewed yet — this is the first login, so ask which language
          // to read the rest of the tour (and the app) in before it starts.
          // Someone resuming mid-tour has already answered.
          setPickingLanguage(true);
        }
        setLoaded(true);
      });
    }
    call({ query: GET_ME_DISCOVERABILITY }).then((res: any) => {
      setDiscoverableByEmail(res?.me?.discoverableByEmail ?? false);
    });
  }, [replay, suppressed]);

  const handleDiscoverabilityChange = (val: boolean) => {
    setDiscoverableByEmail(val);
    call({ query: UPDATE_DISCOVERABILITY, variables: { discoverableByEmail: val } });
  };

  const showing = !suppressed && loaded && !completed && !dismissed;

  // Tell the module intros whether this tour owns the screen. A replay is
  // opened deliberately from Settings, so it doesn't drive the first-run
  // sequencing.
  useEffect(() => {
    if (replay) return;
    setStatus(suppressed ? "hidden" : !loaded ? "pending" : showing ? "visible" : "hidden");
  }, [replay, suppressed, loaded, showing]);

  if (!showing) return null;

  const isFirst = current === 0;
  const isLast = current === TOTAL_SLIDES - 1;

  const handleFinish = () => {
    setCompleted(true);
    // Taking a CTA finishes the tour just as much as clicking through to the
    // end — persist that, or it reappears on every load. Fire-and-forget so
    // navigation isn't held up.
    if (!replay) {
      void call({ query: MARK_SLIDE_VIEWED, variables: { slideIndex: TOTAL_SLIDES - 1 } });
    }
    onClose?.();
  };

  const handleNext = async () => {
    // Replaying is a re-read — don't rewrite the stored progress.
    if (!replay) {
      await call({ query: MARK_SLIDE_VIEWED, variables: { slideIndex: current } });
    }
    if (isLast) {
      handleFinish();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handlePrev = () => setCurrent((c) => Math.max(0, c - 1));
  const handleClose = () => {
    setDismissed(true);
    if (!replay) {
      try {
        window.sessionStorage.setItem(CLOSED_FOR_NOW_KEY, "1");
      } catch {
        // Private-mode storage failures are not worth failing a dismissal over.
      }
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-slide-title"
        className="relative w-full max-w-lg rounded-2xl border bg-background shadow-2xl mx-4 overflow-hidden"
      >
        {/* Close (session-only) */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("onboarding.nav.closeForNow")}
        >
          <X className="h-4 w-4" />
        </button>

        {pickingLanguage ? (
          <LanguageStep
            t={t}
            currentLanguage={i18n.language}
            onContinue={() => setPickingLanguage(false)}
          />
        ) : (
          <>
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i < current ? "bg-primary" : i === current ? "bg-primary/70" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="px-6 pt-5 pb-2 min-h-64">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            {t("onboarding.nav.slideOf", { current: current + 1, total: TOTAL_SLIDES })}
          </p>
          <SlideContent
            current={current}
            t={t}
            discoverableByEmail={discoverableByEmail}
            onDiscoverabilityChange={handleDiscoverabilityChange}
          />
        </div>

        {/* Navigation */}
        {!isLast && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={isFirst}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("onboarding.nav.previous")}
            </Button>
            <Button size="sm" onClick={handleNext}>
              {t("onboarding.nav.next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Last slide CTAs */}
        {isLast && (
          <div className="flex flex-col gap-2 px-6 py-4 border-t">
            <Button asChild className="w-full">
              <Link to="/activities/goal" onClick={handleFinish}>
                {t("onboarding.slides.6.ctaGoal")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/concepts" onClick={handleFinish}>
                {t("onboarding.slides.6.ctaGuide")}
              </Link>
            </Button>
            <button
              type="button"
              onClick={handleNext}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline py-1"
            >
              {t("onboarding.slides.6.ctaToday")}
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

function LanguageStep({
  t,
  currentLanguage,
  onContinue,
}: {
  t: (key: string, opts?: any) => string;
  currentLanguage: string;
  onContinue: () => void;
}) {
  return (
    <div className="px-6 pt-8 pb-6">
      <h2 id="onboarding-slide-title" className="text-xl font-bold mb-2">{t("onboarding.language.title")}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {t("onboarding.language.body")}
      </p>
      <div className="flex flex-col gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Button
            key={lang}
            variant={currentLanguage === lang ? "default" : "outline"}
            className="w-full justify-center"
            onClick={() => void setLanguage(lang as AppLanguage)}
          >
            {t(lang === "fa" ? "language.persian" : "language.english")}
          </Button>
        ))}
      </div>
      <Button size="sm" className="w-full mt-5" onClick={onContinue}>
        {t("onboarding.nav.next")}
      </Button>
    </div>
  );
}

function SlideContent({
  current,
  t,
  discoverableByEmail,
  onDiscoverabilityChange,
}: {
  current: number;
  t: (key: string, opts?: any) => string;
  discoverableByEmail: boolean;
  onDiscoverabilityChange: (val: boolean) => void;
}) {
  switch (current) {
    case 0:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.0.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("onboarding.slides.0.body")}</p>
        </>
      );
    case 1:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.1.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("onboarding.slides.1.body")}</p>
        </>
      );
    case 2:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.2.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t("onboarding.slides.2.body")}</p>
          <pre className="font-mono text-xs bg-muted/40 rounded-md p-3 leading-relaxed select-none">
{`Goal
 └─ Milestone
     └─ Project
         └─ Action`}
          </pre>
        </>
      );
    case 3:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.3.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("onboarding.slides.3.body")}</p>
        </>
      );
    case 4:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-2">{t("onboarding.slides.4.title")}</h2>
          <p className="text-sm text-muted-foreground mb-3">{t("onboarding.slides.4.intro")}</p>
          <div className="space-y-2.5">
            {(["1", "2", "3"] as const).map((n) => (
              <div key={n} className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold mb-0.5">{t(`onboarding.slides.4.step${n}Title`)}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(`onboarding.slides.4.step${n}Body`)}</p>
              </div>
            ))}
          </div>
        </>
      );
    case 5:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.5.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{t("onboarding.slides.5.body")}</p>
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <Switch checked={discoverableByEmail} onCheckedChange={onDiscoverabilityChange} />
            <div>
              <p className="text-sm font-medium">
                {discoverableByEmail ? t("onboarding.slides.5.stateOn") : t("onboarding.slides.5.stateOff")}
              </p>
              <p className="text-xs text-muted-foreground">{t("onboarding.slides.5.hint")}</p>
            </div>
          </div>
        </>
      );
    case 6:
      return (
        <>
          <h2 id="onboarding-slide-title" className="text-xl font-bold mb-3">{t("onboarding.slides.6.title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("onboarding.slides.6.body")}</p>
        </>
      );
    default:
      return null;
  }
}
