import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { ChevronDown, ChevronUp, CheckCircle2, Flag, X } from "lucide-react";
import { cn } from "~/lib/utils";

export type DimensionKey =
  | "observability"
  | "control"
  | "binary"
  | "ownership"
  | "decomposability";

export type ClarityResult = {
  dod: string;
  status: "green" | "amber";
  flaggedDimensions: DimensionKey[];
};

export type DimensionAnswer = "pass" | "flag" | null;

type Props = {
  initialDod: string;
  initialAnswers?: Record<DimensionKey, DimensionAnswer>;
  initialStep?: number;
  onComplete: (result: ClarityResult) => void;
  onClose: () => void;
  onAnswerChange?: (answers: Record<DimensionKey, DimensionAnswer>) => void;
};

export const DIMENSION_KEYS: DimensionKey[] = [
  "observability",
  "control",
  "binary",
  "ownership",
  "decomposability",
];

export function buildInitialAnswers(
  clarityStatus: string | null | undefined,
  flaggedDimensions: DimensionKey[]
): Record<DimensionKey, DimensionAnswer> | undefined {
  if (!clarityStatus) return undefined;
  const flaggedSet = new Set(flaggedDimensions);
  return {
    observability: flaggedSet.has("observability") ? "flag" : "pass",
    control: flaggedSet.has("control") ? "flag" : "pass",
    binary: flaggedSet.has("binary") ? "flag" : "pass",
    ownership: flaggedSet.has("ownership") ? "flag" : "pass",
    decomposability: flaggedSet.has("decomposability") ? "flag" : "pass",
  };
}

export function firstFlaggedStep(flaggedDimensions: DimensionKey[]): number {
  if (!flaggedDimensions.length) return 0;
  const idx = DIMENSION_KEYS.findIndex((k) => flaggedDimensions.includes(k));
  return idx === -1 ? 0 : idx;
}

export default function DodClarityWizard({
  initialDod,
  initialAnswers,
  initialStep = 0,
  onComplete,
  onClose,
  onAnswerChange,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(initialStep);
  const [dod, setDod] = useState(initialDod);
  const [answers, setAnswers] = useState<Record<DimensionKey, DimensionAnswer>>(
    initialAnswers ?? {
      observability: null,
      control: null,
      binary: null,
      ownership: null,
      decomposability: null,
    }
  );
  const [tipsOpen, setTipsOpen] = useState(false);

  const currentKey = DIMENSION_KEYS[step];

  function handleAnswer(answer: "pass" | "flag") {
    const key = DIMENSION_KEYS[step];
    const newAnswers = { ...answers, [key]: answer };
    setAnswers(newAnswers);
    onAnswerChange?.(newAnswers);
    setTipsOpen(false);

    const allAnswered = DIMENSION_KEYS.every((k) => newAnswers[k] !== null);

    if (!allAnswered) {
      // advance to first unanswered, or next step if all above answered
      const nextUnanswered = DIMENSION_KEYS.findIndex(
        (k, i) => i > step && newAnswers[k] === null
      );
      if (nextUnanswered !== -1) {
        setStep(nextUnanswered);
      } else {
        // wrap to first unanswered overall
        const firstUnanswered = DIMENSION_KEYS.findIndex((k) => newAnswers[k] === null);
        if (firstUnanswered !== -1) setStep(firstUnanswered);
      }
    } else {
      const flagged = DIMENSION_KEYS.filter((k) => newAnswers[k] === "flag");
      onComplete({
        dod,
        status: flagged.length === 0 ? "green" : "amber",
        flaggedDimensions: flagged,
      });
    }
  }

  const dimensionLabel = (key: DimensionKey) =>
    t(`dodClarity.dimension${key.charAt(0).toUpperCase() + key.slice(1)}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <span className="font-semibold text-sm">{t("dodClarity.wizardTitle")}</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("tools.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step nav — all steps freely navigable */}
        <nav aria-label={t("wizard.wizardStepsAria")} className="px-5 pt-4 pb-2 shrink-0">
          <ol className="flex gap-1">
            {DIMENSION_KEYS.map((key, idx) => {
              const answer = answers[key];
              const isCurrent = idx === step;
              return (
                <li key={key} className="flex-1">
                  <button
                    onClick={() => { setTipsOpen(false); setStep(idx); }}
                    className={cn(
                      "w-full text-xs py-1 px-0.5 rounded transition-colors truncate cursor-pointer hover:text-foreground",
                      isCurrent && "font-semibold text-foreground",
                      !isCurrent && answer === "pass" && "text-green-600",
                      !isCurrent && answer === "flag" && "text-amber-500",
                      !isCurrent && answer === null && "text-muted-foreground"
                    )}
                    title={dimensionLabel(key)}
                  >
                    {answer === "pass" && <CheckCircle2 className="h-3.5 w-3.5 inline mr-0.5 text-green-500" />}
                    {answer === "flag" && <Flag className="h-3.5 w-3.5 inline mr-0.5 text-amber-500" />}
                    <span>{dimensionLabel(key)}</span>
                  </button>
                  <div
                    className={cn(
                      "h-0.5 mt-0.5 rounded-full",
                      isCurrent && "bg-foreground",
                      !isCurrent && answer === "pass" && "bg-green-500",
                      !isCurrent && answer === "flag" && "bg-amber-400",
                      !isCurrent && answer === null && "bg-muted"
                    )}
                  />
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* DoD editable */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("dodClarity.yourDod")}
            </label>
            <textarea
              value={dod}
              onChange={(e) => setDod(e.target.value)}
              placeholder={t("dodClarity.dodPlaceholder")}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium leading-snug">
              {t(`dodClarity.${currentKey}Question`)}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`dodClarity.${currentKey}Description`)}
            </p>
          </div>

          {/* Accordion tips */}
          <div className="border rounded-md overflow-hidden">
            <button
              onClick={() => setTipsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <span>{t("dodClarity.tipsToggle")}</span>
              {tipsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {tipsOpen && (
              <ul className="px-4 pb-3 pt-1 space-y-1.5 border-t bg-muted/20">
                <li className="text-sm text-muted-foreground before:content-['•'] before:mr-2">
                  {t(`dodClarity.${currentKey}Tip1`)}
                </li>
                <li className="text-sm text-muted-foreground before:content-['•'] before:mr-2">
                  {t(`dodClarity.${currentKey}Tip2`)}
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Fixed actions */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          <Button
            variant="outline"
            className="flex-1 border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => handleAnswer("flag")}
          >
            <Flag className="h-4 w-4 mr-1.5" />
            {t("dodClarity.flag")}
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleAnswer("pass")}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {t("dodClarity.pass")}
          </Button>
        </div>
      </div>
    </div>
  );
}
