import { useTranslation } from "react-i18next";
import RubricPips from "./RubricPips";

/**
 * The six rubric criteria, on screen — the Decomposition Lab analogue of
 * `RubricRail`. Kept as its own component rather than generalising the
 * Clarity one: the field names differ (`id`/`evidence` vs
 * `criterion`/`findings`/`evidenceQuote`), and criteria are D1-D6 in their
 * own `decomposition.rubric.*` namespace.
 */

export const DECOMPOSITION_CRITERIA = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;
export type DecompositionCriterion = (typeof DECOMPOSITION_CRITERIA)[number];

export type DecompositionCriterionScore = {
  id: string;
  level: number | null;
  scoredBy: string;
  evidence: string;
};

type Props = {
  /** Absent while authoring; present once scored. */
  scores?: DecompositionCriterionScore[];
  compact?: boolean;
};

export default function DecompositionRubricRail({ scores, compact }: Props) {
  const { t } = useTranslation();
  const byId = new Map((scores ?? []).map((s) => [s.id, s]));

  return (
    <ul className="flex flex-col gap-1.5">
      {DECOMPOSITION_CRITERIA.map((id) => {
        const score = byId.get(id);
        return (
          <li key={id} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
            <span className="min-w-0 truncate text-xs">
              {t(`decomposition.rubric.${id}.label`)}
              {!compact && (
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {t(`decomposition.rubric.${id}.test`)}
                </span>
              )}
            </span>
            <RubricPips level={score ? score.level : undefined} unscoredLabel={t("decomposition.unscored")} unscoredHint={t("decomposition.unscoredHint")} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Two pips per criterion. `null` renders as the words "not scored", never an
 * empty two-pip row — an empty row is indistinguishable from a level of 0.
 */
