import { useTranslation } from "react-i18next";

export type SequenceRoundView = {
  roundIndex: number;
  woaClamped: number | null;
  isSeededError: boolean;
};

/**
 * The g6-drift reveal (wireframe plate 6): three rounds, one visibly wrong,
 * each round's weighting drawn as a bar so the collapse — or the lack of one
 * — is visible at a glance. Not used during input; the session page commits
 * each round's estimate/revision itself and only renders this once the
 * sequence's third round has scored (05-delegation-lab.md §3, §10).
 */
export default function AdvisorSequence({ rounds }: { rounds: SequenceRoundView[] }) {
  const { t } = useTranslation();

  return (
    <div dir="ltr" className="flex flex-col gap-1.5">
      {rounds.map((r) => {
        const pct = r.woaClamped === null ? 0 : Math.round(r.woaClamped * 100);
        return (
          <div key={r.roundIndex} className="flex items-center gap-2 text-xs">
            <span className={`w-16 shrink-0 font-mono text-[10px] ${r.isSeededError ? "text-amber-600" : "text-muted-foreground"}`}>
              {t("delegation.sequence.round", { n: r.roundIndex + 1 })}
              {r.isSeededError ? " ✕" : ""}
            </span>
            <div className={`h-3 flex-1 overflow-hidden rounded border ${r.isSeededError ? "border-amber-500/50" : "border-border"} bg-muted/40`}>
              <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 shrink-0 text-end font-mono text-[10px] text-muted-foreground">
              {r.woaClamped === null ? "—" : r.woaClamped.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
