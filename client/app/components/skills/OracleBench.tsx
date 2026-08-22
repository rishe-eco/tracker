import { useTranslation } from "react-i18next";

export type BenchEntry = { checkId: string; label: string; costSeconds: number };
export type RevealedOutcome = { checkId: string; outcome: string; costSeconds: number };

/**
 * The oracle bench (04-verification-lab.md §10, plates 3-4). Cost is always
 * visible before a check runs; the outcome is never visible before it runs.
 * Spending is irreversible — once `onReveal` fires for a checkId, this
 * component has no way to un-spend it, matching the server's own rule that a
 * revealed check can't be revealed twice.
 *
 * On the assisted rung, entries that would push the running total past the
 * ceiling render disabled rather than merely discouraged — the ceiling is
 * the entire lesson of that rung, so it has to be a wall, not a suggestion.
 */
export default function OracleBench({
  bench,
  revealed,
  rung,
  ceilingSeconds,
  disabled,
  onReveal,
}: {
  bench: BenchEntry[];
  revealed: RevealedOutcome[];
  rung: "assisted" | "unassisted";
  ceilingSeconds: number | null;
  disabled?: boolean;
  onReveal: (checkId: string) => void;
}) {
  const { t } = useTranslation();
  const revealedIds = new Set(revealed.map((r) => r.checkId));
  const spent = revealed.reduce((sum, r) => sum + r.costSeconds, 0);
  const pctOfCeiling = ceilingSeconds ? Math.min(100, (spent / ceilingSeconds) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5">
        {bench.map((entry) => {
          const outcome = revealed.find((r) => r.checkId === entry.checkId);
          const wouldExceed = ceilingSeconds != null && !outcome && spent + entry.costSeconds > ceilingSeconds;
          return (
            <div key={entry.checkId}>
              <button
                type="button"
                disabled={disabled || Boolean(outcome) || wouldExceed}
                onClick={() => onReveal(entry.checkId)}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-start text-sm transition-colors ${
                  outcome
                    ? "border-muted bg-muted/30 text-muted-foreground"
                    : wouldExceed
                      ? "cursor-not-allowed border-dashed opacity-40"
                      : "hover:bg-accent"
                }`}
              >
                <span className="flex-1">{entry.label}</span>
                <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {t("verification.bench.seconds", { count: entry.costSeconds })}
                </span>
              </button>
              {outcome && (
                <p className="ms-3 mt-1 border-s-2 ps-3 text-xs leading-relaxed text-muted-foreground">{outcome.outcome}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
        <span>{t("verification.bench.spent", { seconds: spent })}</span>
        {ceilingSeconds != null ? (
          <>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={`block h-full rounded-full ${pctOfCeiling >= 100 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${pctOfCeiling}%` }}
              />
            </span>
            <span>{t("verification.bench.ofCeiling", { seconds: ceilingSeconds })}</span>
          </>
        ) : (
          <span className="flex-1">{t(rung === "unassisted" ? "verification.bench.noLimit" : "verification.bench.noLimit")}</span>
        )}
      </div>
    </div>
  );
}
