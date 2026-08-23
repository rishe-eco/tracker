import { useTranslation } from "react-i18next";

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
              {!compact && score && score.level !== null && <span className="ms-1.5 text-[11px] text-muted-foreground">{score.evidence}</span>}
            </span>
            <Pips level={score ? score.level : undefined} />
          </li>
        );
      })}
    </ul>
  );
}

function Pips({ level }: { level: number | null | undefined }) {
  const { t } = useTranslation();
  if (level === null) {
    return (
      <span className="text-[10px] text-muted-foreground" title={t("monitoring.unscoredHint")}>
        {t("monitoring.unscored")}
      </span>
    );
  }
  return (
    <span className="flex gap-1" aria-label={level === undefined ? undefined : `${level} of 2`}>
      {[0, 1].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-[2px] border ${
            level !== undefined && i < level ? "border-primary bg-primary" : "border-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}
