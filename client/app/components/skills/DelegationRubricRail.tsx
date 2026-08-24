import { useTranslation } from "react-i18next";
import RubricPips from "./RubricPips";

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
              {!compact && (
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {/* Before an attempt there is no evidence to show, and the
                      rail stood there as six bare labels — the standing
                      reference for a lab whose vocabulary is the hard part.
                      The gloss holds that slot until a criterion actually
                      scores; an unscored row keeps the gloss rather than
                      repeating "not this item's module" six times. */}
                  {score && score.level !== null ? score.evidence : t(`delegation.rubric.${id}.test`)}
                </span>
              )}
            </span>
            <RubricPips level={score ? score.level : undefined} unscoredLabel={t("delegation.unscored")} unscoredHint={t("delegation.unscoredHint")} />
          </li>
        );
      })}
    </ul>
  );
}

