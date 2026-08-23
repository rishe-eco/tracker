import { useTranslation } from "react-i18next";

export const DELEGATION_CRITERIA = ["G1", "G2", "G3", "G4", "G5", "G6"] as const;
export type DelegationCriterion = (typeof DELEGATION_CRITERIA)[number];

export type DelegationCriterionScore = {
  id: string;
  level: number | null;
  scoredBy: string;
  evidence: string;
};

type Props = {
  scores?: DelegationCriterionScore[];
  compact?: boolean;
};

/**
 * Unlike Verification's rail, most rows here are `not scored` on any given
 * attempt — a single delegation item only ever trains the one criterion its
 * own module maps to (05-delegation-lab.md §3, build plan §3 Phase 3). That
 * is expected, not a gap: the rail still shows all six so a learner can see
 * which module trains which line.
 */
export default function DelegationRubricRail({ scores, compact }: Props) {
  const { t } = useTranslation();
  const byId = new Map((scores ?? []).map((s) => [s.id, s]));

  return (
    <ul className="flex flex-col gap-1.5">
      {DELEGATION_CRITERIA.map((id) => {
        const score = byId.get(id);
        return (
          <li key={id} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
            <span className="min-w-0 truncate text-xs">
              {t(`delegation.rubric.${id}.label`)}
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
      <span className="text-[10px] text-muted-foreground" title={t("delegation.unscoredHint")}>
        {t("delegation.unscored")}
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
