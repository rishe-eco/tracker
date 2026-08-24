import { useTranslation } from "react-i18next";

/**
 * The tool's shortest screen, on purpose (build plan §0, wireframe plate 4
 * changelog note): two numbers and one line of fact. Every draft that added
 * an encouraging sentence made it worse. No interpretation, no "don't worry,"
 * no streak — the drop IS the lesson (spec §2 trap 2).
 */
export default function DeflationDisplay({ before, after }: { before: number; after: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      <div className="text-center">
        <p className="font-mono text-3xl font-medium tabular-nums">{before}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t("monitoring.deflation.before")}</p>
      </div>
      <span className="text-lg text-muted-foreground" aria-hidden>
        →
      </span>
      <div className="text-center">
        <p className={`font-mono text-3xl font-medium tabular-nums ${after < before ? "text-amber-600" : ""}`}>{after}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t("monitoring.deflation.after")}</p>
      </div>
      <p className="ms-2 max-w-[16rem] text-sm text-muted-foreground">
        {after < before ? t("monitoring.deflation.droppedFact", { count: before - after }) : t("monitoring.deflation.heldFact")}
      </p>
    </div>
  );
}
