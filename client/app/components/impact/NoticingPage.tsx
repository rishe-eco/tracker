import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Eye, Wind, Play, BookOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_NOTICING_STATE } from "~/api/queries";

type NoticingState = {
  contentVersion: string;
  locale: string;
  reviewStatus: string;
  frameDone: boolean;
  graduationSurfaced: boolean;
  promptFadeLevel: number;
};

/**
 * The tool home for Noticing (Impact Act 1).
 *
 * Mirrors `learn/FeelingsNeedsPage.tsx`'s shape — a quiet landing that carries
 * the framing and routes into the practice — with one deliberate difference:
 * the day-one frame does NOT gate the loop here (spec §4.1, build plan §5
 * ordering notes). The frame is a rehearsal of the loop's own inference, not
 * a precondition for it, so the loop button is never disabled on `frameDone`.
 *
 * Phase 1 only: the frame, loop and log routes are stubs until phases 3–6b
 * land the session runner behind them.
 */
export default function NoticingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [state, setState] = useState<NoticingState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_NOTICING_STATE });
    if (!res?.noticingState) {
      setFailed(true);
      return;
    }
    setState(res.noticingState);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("impact.noticing.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("impact.noticing.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("impact.noticing.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!state) return <LoadingBlock />;

  return (
    <InternalPageLayout title={t("impact.noticing.title")}>
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("impact.noticing.subtitle")}
        </p>

        {state.reviewStatus === "draft" && (
          <div className="flex gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm">
            <p>{t("impact.noticing.banners.draftLocale")}</p>
          </div>
        )}

        {/* Same reasoning as Feelings & Needs: naming a need from the outside
            still happens in a language, and the practice content is
            English-only in the prototype. */}
        {!i18n.language.startsWith(state.locale) && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>{t("impact.noticing.banners.contentNotYourLanguage")}</p>
          </div>
        )}

        {!state.frameDone && (
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("impact.noticing.frame.cardTitle")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("impact.noticing.frame.cardBody")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/tools/impact/noticing/frame")}>
              {t("impact.noticing.frame.begin")}
            </Button>
          </section>
        )}

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-start gap-3">
            <Wind className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t("impact.noticing.loop.cardTitle")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("impact.noticing.loop.cardBody")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Never disabled on frameDone — the frame is a rehearsal, not a gate. */}
            <Button onClick={() => navigate("/tools/impact/noticing/loop")}>
              <Play className="mr-2 h-4 w-4" aria-hidden />
              {t("impact.noticing.loop.start")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("impact.noticing.loop.length")}
            </span>
          </div>
        </section>

        {/* Unconditional — unlike Feelings & Needs' history link, there is no
            sitting count in NoticingState to gate this on (no counter field
            anywhere in this tool). The log's own empty state carries the
            "nothing here yet" line instead. */}
        <div>
          <Button variant="ghost" onClick={() => navigate("/tools/impact/noticing/log")}>
            <BookOpen className="mr-2 h-4 w-4" aria-hidden />
            {t("impact.noticing.log.open")}
          </Button>
        </div>
      </div>
    </InternalPageLayout>
  );
}
