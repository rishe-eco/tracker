import { useTranslation } from "react-i18next";

/**
 * The recomposition reveal (plate 6) — the direct analogue of Clarity's gap
 * reveal. The learner commits, then sees their own pieces played back against
 * the whole *they themselves stated*. Shown only after the attempt is
 * scored — never before, since the reveal is built from the answer key.
 */

export type RevealPiece = { id: string; label: string; required: boolean; atomic: boolean };
export type Pairing = { a: string; b: string };
export type Reveal = {
  pieces: RevealPiece[];
  overlapPairs: Pairing[];
  blockingEdges: Pairing[];
  independentPairs: Pairing[];
};

type Props = {
  wholeStatement: string;
  submittedLabels: { id: string; label: string }[];
  reveal: Reveal;
  /** Whether D6 (coverage) actually resolved a level — arrangement/repair/control do; breakdown doesn't without a judge. */
  coverageScored: boolean;
};

export default function RecomposeReveal({ wholeStatement, submittedLabels, reveal, coverageScored }: Props) {
  const { t } = useTranslation();
  const submittedIds = new Set(submittedLabels.map((n) => n.id));
  const requiredPieces = reveal.pieces.filter((p) => p.required);
  const missing = requiredPieces.filter((p) => !submittedIds.has(p.id));
  const overlapsHit = reveal.overlapPairs.filter((pair) => submittedIds.has(pair.a) && submittedIds.has(pair.b));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Pane title={t("decomposition.reveal.wholePane")}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{wholeStatement}</p>
      </Pane>

      <Pane title={t("decomposition.reveal.piecesPane")}>
        {submittedLabels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("decomposition.reveal.leftWhole")}</p>
        ) : (
          <ol className="list-decimal space-y-1 ps-4 text-sm">
            {submittedLabels.map((n) => (
              <li key={n.id}>{n.label}</li>
            ))}
          </ol>
        )}
      </Pane>

      {coverageScored ? (
        <Pane title={t("decomposition.reveal.gapPane")} warn={missing.length > 0 || overlapsHit.length > 0}>
          {missing.length === 0 && overlapsHit.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-500">{t("decomposition.reveal.noGap")}</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {missing.map((p) => (
                <li key={p.id} className="flex gap-1.5 text-amber-700 dark:text-amber-500">
                  <b className="shrink-0 font-mono">{t("decomposition.reveal.missing")}</b>
                  <span>{p.label}</span>
                </li>
              ))}
              {overlapsHit.map((pair, i) => {
                const labelOf = (id: string) => reveal.pieces.find((p) => p.id === id)?.label ?? id;
                return (
                  <li key={i} className="flex gap-1.5 text-amber-700 dark:text-amber-500">
                    <b className="shrink-0 font-mono">{t("decomposition.reveal.overlap")}</b>
                    <span>
                      {labelOf(pair.a)} + {labelOf(pair.b)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Pane>
      ) : (
        <Pane title={t("decomposition.reveal.gapPane")}>
          <p className="mb-2 text-xs text-muted-foreground">{t("decomposition.reveal.selfDiagnoseHint")}</p>
          <ul className="list-disc space-y-1 ps-4 text-xs">
            {requiredPieces.map((p) => (
              <li key={p.id}>{p.label}</li>
            ))}
          </ul>
        </Pane>
      )}
    </div>
  );
}

function Pane({ title, warn, children }: { title: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border p-3 ${warn ? "border-amber-500/40 bg-amber-500/5" : "bg-background/60"}`}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
