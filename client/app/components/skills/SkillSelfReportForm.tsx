import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";

const QUESTION_KEYS = ["q1", "q2", "q3", "q4"] as const;
const SCALE = [0, 25, 50, 75, 100] as const;

/**
 * Four self-efficacy questions, collected at every probe timepoint and never
 * scored (00-skills-engine.md §6). Deliberately shared, generic wording
 * across all three tools rather than a per-skill rewrite — the questions
 * exist to let a learner compare their own self-report line against their
 * behaviour line, and that comparison works the same way regardless of
 * which skill it's about.
 */
export default function SkillSelfReportForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: number[]) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null]);

  const complete = answers.every((a) => a !== null);

  return (
    <section className="space-y-5 rounded-lg border-2 border-primary/40 bg-card p-5">
      <div>
        <p className="text-sm font-semibold">{t("skills.probe.selfReport.title")}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("skills.probe.selfReport.body")}</p>
      </div>

      <div className="space-y-4">
        {QUESTION_KEYS.map((key, i) => (
          <div key={key} className="space-y-2">
            <p className="text-sm font-medium">{t(`skills.probe.selfReport.${key}`)}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                {t("skills.probe.selfReport.scaleLow")}
              </span>
              <div className="flex flex-1 gap-1.5">
                {SCALE.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={answers[i] === value}
                    onClick={() =>
                      setAnswers((prev) => prev.map((a, j) => (j === i ? value : a)))
                    }
                    className={`h-8 flex-1 rounded-md border text-xs transition-colors ${
                      answers[i] === value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <span className="w-16 shrink-0 text-end text-[11px] text-muted-foreground">
                {t("skills.probe.selfReport.scaleHigh")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <Button
          onClick={() => complete && onSubmit(answers as number[])}
          disabled={!complete || busy}
        >
          {t("skills.probe.selfReport.submit")}
        </Button>
      </div>
    </section>
  );
}
