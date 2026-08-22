import { useTranslation } from "react-i18next";

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
              {!compact && score && <span className="ms-1.5 text-[11px] text-muted-foreground">{score.evidence}</span>}
            </span>
            <Pips level={score ? score.level : undefined} />
          </li>
        );
      })}
    </ul>
  );
}

/** `null` renders as "not scored on this rung" — an inapplicable or ceiling-blocked criterion is never a silent zero. */
function Pips({ level }: { level: number | null | undefined }) {
  const { t } = useTranslation();
  if (level === null) {
    return (
      <span className="text-[10px] text-muted-foreground" title={t("verification.unscoredHint")}>
        {t("verification.unscored")}
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
