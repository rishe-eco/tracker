import { useState } from "react";
import { useTranslation } from "react-i18next";

export type MonitoringTurn = { turnId: string; role: "user" | "assistant"; text: string };

type Props = {
  turns: MonitoringTurn[];
  onSubmit: (marks: { turnId: string; movedWhat: string }[]) => void;
  busy: boolean;
};

/**
 * The tool's other new component (build plan §10, wireframe plates 5-6):
 * renders a real conversation with no visual difference between a planted
 * turn and a clean one — a single CSS class for every turn, asserted in the
 * component's own test, because any styling difference here destroys the
 * instrument (the rule Evidence Lab learned from real use, spec §10).
 */
export default function TranscriptAudit({ turns, onSubmit, busy }: Props) {
  const { t } = useTranslation();
  const [marked, setMarked] = useState<Record<string, string>>({});

  const toggle = (turnId: string) => {
    setMarked((prev) => {
      const next = { ...prev };
      if (turnId in next) delete next[turnId];
      else next[turnId] = "";
      return next;
    });
  };

  const setNote = (turnId: string, movedWhat: string) => {
    setMarked((prev) => ({ ...prev, [turnId]: movedWhat }));
  };

  const submit = () => {
    onSubmit(Object.entries(marked).map(([turnId, movedWhat]) => ({ turnId, movedWhat })));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5">
        {turns.map((turn) => {
          const isMarked = turn.turnId in marked;
          return (
            <div key={turn.turnId} className={`monitoring-turn flex flex-col gap-1 ${turn.role === "user" ? "items-end" : "items-start"}`}>
              <button
                type="button"
                onClick={() => toggle(turn.turnId)}
                className={`max-w-[85%] rounded-lg border px-3 py-2 text-start text-sm leading-relaxed transition-colors ${
                  isMarked ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                {turn.text}
              </button>
              {isMarked && (
                <input
                  type="text"
                  value={marked[turn.turnId]}
                  onChange={(e) => setNote(turn.turnId, e.target.value)}
                  placeholder={t("monitoring.transcript.movedWhatPlaceholder")}
                  className="w-full max-w-[85%] rounded-md border bg-background px-2.5 py-1.5 text-xs"
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("monitoring.transcript.instructions")}</p>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        {t("monitoring.transcript.commit")}
      </button>
    </div>
  );
}
