import { useTranslation } from "react-i18next";
import RubricPips from "./RubricPips";

export const VERIFICATION_CRITERIA = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
export type VerificationCriterion = (typeof VERIFICATION_CRITERIA)[number];

export type VerificationCriterionScore = {
  id: string;
  level: number | null;
  scoredBy: string;
  evidence: string;
};

type Props = {
  scores?: VerificationCriterionScore[];
  compact?: boolean;
};

export default function VerificationRubricRail({ scores, compact }: Props) {
  const { t } = useTranslation();
  const byId = new Map((scores ?? []).map((s) => [s.id, s]));

  return (
    <ul className="flex flex-col gap-1.5">
      {VERIFICATION_CRITERIA.map((id) => {
        const score = byId.get(id);
        return (
          <li key={id} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
            <span className="min-w-0 truncate text-xs">
              {t(`verification.rubric.${id}.label`)}
              {!compact && (
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {/* Before an attempt there is no evidence to show, and the
                      rail stood there as six bare labels — the standing
                      reference for a lab whose vocabulary is the hard part.
                      The gloss holds that slot until a criterion actually
                      scores; an unscored row keeps the gloss rather than
                      repeating "not this item's module" six times. */}
                  {score && score.level !== null ? score.evidence : t(`verification.rubric.${id}.test`)}
                </span>
              )}
            </span>
            <RubricPips level={score ? score.level : undefined} unscoredLabel={t("verification.unscored")} unscoredHint={t("verification.unscoredHint")} />
          </li>
        );
      })}
    </ul>
  );
}

/** `null` renders as "not scored on this rung" — an inapplicable or ceiling-blocked criterion is never a silent zero. */
