import { useTranslation } from "react-i18next";
import RubricPips from "./RubricPips";

/**
 * The six rubric criteria, on screen.
 *
 * Not a results panel — a teaching object. It stays visible while the learner
 * writes, which looks like handing out the answers and isn't: the guard against
 * writing-to-the-checklist is that no criterion reaches level 2 on surface
 * features alone (the detector caps, the reader deducts). Someone writing
 * toward six observable features is doing the intended thing.
 */

export const CRITERIA = ["R1", "R2", "R3", "R4", "R5", "R6"] as const;
export type Criterion = (typeof CRITERIA)[number];

export type CriterionScore = {
  criterion: string;
  level: number | null;
  source: string;
  findings: string[];
  evidenceQuote: string | null;
};

type Props = {
  /** Absent while writing; present once scored. */
  scores?: CriterionScore[];
  /** Criteria this locale can score with no model. */
  detectorCriteria?: string[];
  readerAvailable?: boolean;
  compact?: boolean;
};

export default function RubricRail({ scores, detectorCriteria, readerAvailable = true, compact }: Props) {
  const { t } = useTranslation();
  const byId = new Map((scores ?? []).map((s) => [s.criterion, s]));

  return (
    <ul className="flex flex-col gap-1.5">
      {CRITERIA.map((id) => {
        const score = byId.get(id);
        const needsReader = !readerAvailable && detectorCriteria && !detectorCriteria.includes(id);
        return (
          <li
            key={id}
            className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5"
          >
            <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
            <span className="min-w-0 truncate text-xs">
              {t(`clarity.rubric.${id}.label`)}
              {!compact && (
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {t(`clarity.rubric.${id}.test`)}
                </span>
              )}
            </span>
            {score ? (
              <RubricPips level={score.level} unscoredLabel={t("clarity.unscored")} unscoredHint={t("clarity.unscoredHint")} />
            ) : needsReader ? (
              <span className="text-[10px] text-muted-foreground">{t("clarity.needsReaderShort")}</span>
            ) : (
              <RubricPips level={undefined} unscoredLabel={t("clarity.unscored")} unscoredHint={t("clarity.unscoredHint")} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Two pips per criterion. `null` is drawn as dotted-empty and never as zero —
 * an unscored criterion is an absence of data, not a failure, and the two must
 * not look alike.
 */
