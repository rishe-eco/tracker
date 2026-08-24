import { useTranslation } from "react-i18next";

export type RelianceDirection = "over" | "under" | "costly" | "ok";

type Props = {
  initial: number;
  final: number;
  advice: number;
  truth: number;
  unitLabel: string | null;
  direction: RelianceDirection;
  woaRaw: number | null;
  netGain: number | null;
  isVoid: boolean;
};

function fmt(n: number): string {
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n * 100) / 100);
}

/**
 * The tool's one new component (build plan §10, wireframe plate 4): your
 * estimate, the advice, the truth, and the movement between them.
 *
 * The number line is deliberately rendered `dir="ltr"` regardless of the
 * document direction (05-delegation-lab.md §10, wireframe plate 8) — a
 * quantity axis is not text, and mirroring it in RTL would make "moved
 * toward the advice" mean the opposite thing on the same screen for two
 * learners. Only the labels and surrounding prose follow the document
 * direction; this element and its numbers never do.
 */
export default function ThreePositionReveal({ initial, final, advice, truth, unitLabel, direction, woaRaw, netGain, isVoid }: Props) {
  const { t } = useTranslation();

  const values = [initial, final, advice, truth];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.12;
  const lo = min - pad;
  const hi = max + pad;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const moveLeft = Math.min(pct(initial), pct(final));
  const moveWidth = Math.max(pct(initial), pct(final)) - moveLeft;

  return (
    <div className="space-y-3">
      <div dir="ltr" className="relative h-16 select-none">
        <div className="absolute inset-x-0 top-7 h-0.5 rounded bg-border" />
        <div
          className={`absolute top-6 h-1.5 rounded-full opacity-60 ${direction === "over" || direction === "costly" ? "bg-amber-500" : "bg-primary/60"}`}
          style={{ left: `${moveLeft}%`, width: `${moveWidth}%` }}
        />
        <Pin pct={pct(initial)} tone="you" labelUp label={`${t("delegation.reveal.you")} ${fmt(initial)}`} />
        <Pin pct={pct(final)} tone="final" labelDown label={`${t("delegation.reveal.final")} ${fmt(final)}`} />
        <Pin pct={pct(advice)} tone="advice" labelUp={pct(advice) >= pct(truth)} labelDown={pct(advice) < pct(truth)} label={`${t("delegation.reveal.advice")} ${fmt(advice)}`} />
        <Pin pct={pct(truth)} tone="truth" labelUp={pct(truth) > pct(advice)} labelDown={pct(truth) <= pct(advice)} label={`${t("delegation.reveal.truth")} ${fmt(truth)}`} />
      </div>
      <div dir="ltr" className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          {fmt(lo)} {unitLabel}
        </span>
        <span>
          {fmt(hi)} {unitLabel}
        </span>
      </div>

      {isVoid ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t("delegation.reveal.voidNote")}</p>
      ) : (
        <p className={`rounded-md border p-3 text-sm ${direction === "ok" ? "bg-muted/40" : "border-amber-500/40 bg-amber-500/10"}`}>
          {direction === "over" && t("delegation.reveal.overNote")}
          {direction === "under" && t("delegation.reveal.underNote")}
          {direction === "costly" && t("delegation.reveal.costlyNote")}
          {direction === "ok" && t("delegation.reveal.okNote")}
          {woaRaw !== null && (
            <span className="ms-1 font-mono text-xs text-muted-foreground">
              ({t("delegation.reveal.woaLabel")} {woaRaw.toFixed(2)}
              {netGain !== null ? `, ${t("delegation.reveal.netGain")} ${netGain >= 0 ? "+" : ""}${fmt(netGain)}` : ""})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function Pin({
  pct,
  tone,
  label,
  labelUp,
  labelDown,
}: {
  pct: number;
  tone: "you" | "final" | "advice" | "truth";
  label: string;
  labelUp?: boolean;
  labelDown?: boolean;
}) {
  const color =
    tone === "you" ? "bg-foreground" : tone === "final" ? "bg-foreground/70" : tone === "advice" ? "bg-primary" : "bg-emerald-600";
  return (
    <div className="absolute top-2 h-11" style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}>
      <div className={`h-11 w-0.5 -translate-x-1/2 rounded ${color}`} />
      {(labelUp ?? true) && !labelDown && (
        <span className="absolute -top-1 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">{label}</span>
      )}
      {labelDown && (
        <span className="absolute top-11 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
