import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Leaf, Wind, Play, History } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_FEELINGS_NEEDS_STATE } from "~/api/queries";

type FeelingsNeedsState = {
  contentVersion: string;
  locale: string;
  reviewStatus: string;
  frameDone: boolean;
  graduationSurfaced: boolean;
  promptFadeLevel: number;
  sittingCount: number;
};

/**
 * The tool home for Feelings & Needs (Learn Module 1).
 *
 * A deliberately quiet landing. It carries the framing and routes into the
 * practice — into the Day-1 frame when it hasn't been done, otherwise into the
 * daily loop. It shows no counts and no streak (plan §10): `sittingCount` routes
 * here, it is never surfaced as a score.
 */
export default function FeelingsNeedsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [state, setState] = useState<FeelingsNeedsState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_FEELINGS_NEEDS_STATE });
    if (!res?.feelingsNeedsState) {
      setFailed(true);
      return;
    }
    setState(res.feelingsNeedsState);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("learn.feelingsNeeds.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("learn.feelingsNeeds.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("learn.feelingsNeeds.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!state) return <LoadingBlock />;

  const introSteps = [1, 2, 3].map((n) => ({
    title: t(`learn.feelingsNeeds.intro.step${n}Title`),
    body: t(`learn.feelingsNeeds.intro.step${n}Body`),
  }));

  return (
    <InternalPageLayout title={t("learn.feelingsNeeds.title")}>
      <ModuleIntroOverlay moduleKey="learn.feelingsNeeds.v1" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("learn.feelingsNeeds.subtitle")}
        </p>

        {state.reviewStatus === "draft" && (
          <div className="flex gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm">
            <p>{t("learn.feelingsNeeds.banners.draftLocale")}</p>
          </div>
        )}

        {/* Affect labelling only regulates in the language a person actually
            feels in, so meeting the practice in a language that is not theirs is
            a real limitation and not a cosmetic one. Both locales now have their
            own words, so this should not fire — it stays because the *next*
            language will land in the same gap, and someone meeting it deserves
            to be told at the top rather than at the moment they reach for a
            word. */}
        {!i18n.language.startsWith(state.locale) && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>{t("learn.feelingsNeeds.banners.contentNotYourLanguage")}</p>
          </div>
        )}

        {/* The frame gates the loop — it is the once-only on-ramp (plan §4.1,
            §11.4). The server refuses to open a sitting without it; this just
            keeps the UI honest about why. */}
        {!state.frameDone && (
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-start gap-3">
              <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("learn.feelingsNeeds.frame.cardTitle")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("learn.feelingsNeeds.frame.cardBody")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/tools/learn/feelings-needs/frame")}>
              {t("learn.feelingsNeeds.frame.begin")}
            </Button>
          </section>
        )}

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-start gap-3">
            <Wind className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t("learn.feelingsNeeds.loop.cardTitle")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("learn.feelingsNeeds.loop.cardBody")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!state.frameDone}
              onClick={() => navigate("/tools/learn/feelings-needs/loop")}
            >
              <Play className="mr-2 h-4 w-4" aria-hidden />
              {t("learn.feelingsNeeds.loop.start")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {state.frameDone
                ? t("learn.feelingsNeeds.loop.length")
                : t("learn.feelingsNeeds.frame.locked")}
            </span>
          </div>
        </section>

        {/* Their own record, and only offered once there is one. A "0 entries"
            link would be the app asking to be kept up with. */}
        {state.sittingCount > 0 && (
          <div>
            <Button variant="ghost" onClick={() => navigate("/tools/learn/feelings-needs/history")}>
              <History className="mr-2 h-4 w-4" aria-hidden />
              {t("learn.feelingsNeeds.history.open")}
            </Button>
          </div>
        )}
      </div>
    </InternalPageLayout>
  );
}
