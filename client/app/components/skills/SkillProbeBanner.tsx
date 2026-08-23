import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useApi } from "~/api/useApi";
import { GET_DUE_SKILL_PROBES, SKIP_SKILL_ASSESSMENT, START_SKILL_PROBE } from "~/api/queries";

type SkillKey = "evidence" | "clarity" | "decomposition" | "verification" | "delegation";
type Timepoint = "baseline" | "post" | "delayed";

/**
 * The baseline/post/delayed call to action, shared across all three Lab
 * pages. Baseline is offered until taken or explicitly skipped; post and
 * delayed only ever appear once `dueSkillProbes` says they're actually due —
 * never a nag before that, the same restraint the review queue already
 * applies (00-skills-engine.md §12).
 */
export default function SkillProbeBanner({
  skillKey,
  sessionRoute,
  hasBaseline,
  assessmentSkipped,
  onSkipped,
}: {
  skillKey: SkillKey;
  sessionRoute: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  onSkipped: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();
  const [due, setDue] = useState<Timepoint | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDue = useCallback(async () => {
    const data = await call({ query: GET_DUE_SKILL_PROBES });
    const mine = (data?.dueSkillProbes ?? []).find((d: any) => d.skillKey === skillKey);
    setDue(mine?.timepoint ?? null);
  }, [call, skillKey]);

  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  const start = async (timepoint: Timepoint) => {
    setBusy(true);
    const data = await call({ query: START_SKILL_PROBE, variables: { skillKey, timepoint } });
    setBusy(false);
    if (!data?.startSkillProbe) return;
    const { probeId } = data.startSkillProbe;
    navigate(`${sessionRoute}?mode=assessment&timepoint=${timepoint}&probeId=${probeId}`);
  };

  const skip = async () => {
    setBusy(true);
    await call({ query: SKIP_SKILL_ASSESSMENT, variables: { skillKey } });
    setBusy(false);
    onSkipped();
  };

  if (!hasBaseline && !assessmentSkipped) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            {t("skills.probe.baselineTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("skills.probe.baselineBody")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => void start("baseline")} disabled={busy}>
            {t("skills.probe.startBaseline")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void skip()} disabled={busy}>
            {t("skills.probe.skipBaseline")}
          </Button>
        </div>
      </div>
    );
  }

  if (due === "post") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{t("skills.probe.postReadyTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("skills.probe.postReadyBody")}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => void start("post")} disabled={busy}>
          {t("skills.probe.startPost")}
        </Button>
      </div>
    );
  }

  if (due === "delayed") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{t("skills.probe.delayedReadyTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("skills.probe.delayedReadyBody")}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => void start("delayed")} disabled={busy}>
          {t("skills.probe.startDelayed")}
        </Button>
      </div>
    );
  }

  return null;
}
