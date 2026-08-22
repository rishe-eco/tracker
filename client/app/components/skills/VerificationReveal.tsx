import { useTranslation } from "react-i18next";
import type { BenchEntry, RevealedOutcome } from "./OracleBench";

export type Reveal = { failingElementLabel: string | null; cheapestCheckId: string | null; cheapestCostSeconds: number | null };

/**
 * The ritual-first reveal (04-verification-lab.md §10, plate 6) — the most
 * important screen in the tool. It states whether the checks that were run
 * could have failed *before* it says whether the verdict was right, because
 * a correct verdict reached by ritual is the single failure most likely to
 * be mistaken for competence. This line renders in all four states, on
 * every reveal, and is never suppressed after N sightings (settled
 * 2026-08-11) — the negative form disappears when the learner stops
 * triggering it, never because the UI stopped saying it.
 */
export default function VerificationReveal({
  ritualLine,
  ritualState,
  verdictCorrect,
  bench,
  revealed,
  reveal,
  costSpent,
  costRatio,
  predictedCostSeconds,
}: {
  ritualLine: string;
  ritualState: "none-run" | "none-could-fail" | "some-could-fail" | "all-could-fail";
  verdictCorrect: boolean;
  bench: BenchEntry[];
  revealed: RevealedOutcome[];
  reveal: Reveal;
  costSpent: number;
  costRatio: number | null;
  predictedCostSeconds: number | null;
}) {
  const { t } = useTranslation();
  const labelOf = (checkId: string) => bench.find((b) => b.checkId === checkId)?.label ?? checkId;
  const tone = ritualState === "all-could-fail" ? "good" : ritualState === "some-could-fail" ? "neutral" : "warn";

  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border p-3 text-sm ${
          tone === "good"
            ? "border-emerald-500/40 bg-emerald-500/10"
            : tone === "warn"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-sky-500/40 bg-sky-500/10"
        }`}
      >
        <p className="font-medium">{ritualLine}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("verification.reveal.whatYouRan")}
          </p>
          {revealed.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("verification.reveal.nothingRun")}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {revealed.map((r) => (
                <li key={r.checkId} className="flex justify-between gap-2">
                  <span>{labelOf(r.checkId)}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{t("verification.bench.seconds", { count: r.costSeconds })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("verification.reveal.wouldHaveSettledIt")}
          </p>
          {reveal.cheapestCheckId ? (
            <p className="text-xs">
              <span className="font-medium">{labelOf(reveal.cheapestCheckId)}</span>{" "}
              <span className="font-mono text-muted-foreground">
                {t("verification.bench.seconds", { count: reveal.cheapestCostSeconds ?? 0 })}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("verification.reveal.nothingSettlesIt")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("verification.reveal.verdict")} value={verdictCorrect ? t("verification.reveal.verdictCorrect") : t("verification.reveal.verdictIncorrect")} />
        <Stat
          label={t("verification.reveal.costRatio")}
          value={costRatio == null ? "—" : `${costRatio.toFixed(1)}x`}
          hint={t("verification.bench.spent", { seconds: costSpent })}
        />
        {predictedCostSeconds != null && (
          <Stat
            label={t("verification.reveal.predicted")}
            value={t("verification.bench.seconds", { count: predictedCostSeconds })}
            hint={
              reveal.cheapestCostSeconds != null
                ? t("verification.reveal.actualWas", { seconds: reveal.cheapestCostSeconds })
                : undefined
            }
          />
        )}
      </div>

      {reveal.failingElementLabel && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">{t("verification.reveal.whatFailed")}</p>
          <p>{reveal.failingElementLabel}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-background/60 p-2.5">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
