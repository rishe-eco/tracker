import { useTranslation } from "react-i18next";
import RubricPips from "./RubricPips";

export const MONITORING_CRITERIA = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
export type MonitoringCriterion = (typeof MONITORING_CRITERIA)[number];

export type MonitoringCriterionScore = {
  id: string;
  level: number | null;
  scoredBy: string;
  evidence: string;
};

type Props = {
  scores?: MonitoringCriterionScore[];
  compact?: boolean;
};

/**
 * Like Delegation's rail, most rows are "not scored" on any given attempt —
 * one item only ever trains the one criterion its own module maps to. S1 and
 * S3 never carry a per-attempt level at all (they're window-level patterns,
 * not a property of one item), so "unscored" here covers two different
 * reasons and the rail doesn't distinguish them — a learner sees the same
 * "not this item" copy either way, since the distinction is an
 * implementation detail, not something they act on differently.
 */
export default function MonitoringRubricRail({ scores, compact }: Props) {
  const { t } = useTranslation();
  const byId = new Map((scores ?? []).map((s) => [s.id, s]));

  return (
    <ul className="flex flex-col gap-1.5">
      {MONITORING_CRITERIA.map((id) => {
        const score = byId.get(id);
        return (
          <li key={id} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
            <span className="min-w-0 truncate text-xs">
              {t(`monitoring.rubric.${id}.label`)}
              {!compact && (
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {/* Before an attempt there is no evidence to show, and the
                      rail stood there as six bare labels — the standing
                      reference for a lab whose vocabulary is the hard part.
                      The gloss holds that slot until a criterion actually
                      scores; an unscored row keeps the gloss rather than
                      repeating "not this item's module" six times. */}
                  {score && score.level !== null ? score.evidence : t(`monitoring.rubric.${id}.test`)}
                </span>
              )}
            </span>
            <RubricPips level={score ? score.level : undefined} unscoredLabel={t("monitoring.unscored")} unscoredHint={t("monitoring.unscoredHint")} />
          </li>
        );
      })}
    </ul>
  );
}

