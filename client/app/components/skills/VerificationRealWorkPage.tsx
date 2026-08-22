import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import {
  ADD_NOTE,
  ADD_QUICK_ENTRY,
  GET_ALL_GOALS,
  GET_PROJECTS,
  START_VERIFICATION_REAL_WORK,
  SUBMIT_VERIFICATION_REAL_WORK,
} from "~/api/queries";

const VERDICTS = ["supported", "unsupported", "outdated", "cannot_verify"] as const;

type Record_ = { claim: string; oracle: string; result: string; verdict: (typeof VERDICTS)[number]; residualRisk: string };

/**
 * Real-work verification (04-verification-lab.md §5, §8, plate 8). No
 * bench here — inventing an oracle is the point, not picking from six — and
 * Tracker never runs the check: the learner checks outside the app and
 * pastes back what they found. Never scored into mastery or probes.
 */
type Stage = "claim" | "record" | "done";

export default function VerificationRealWorkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [stage, setStage] = useState<Stage>("claim");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [claim, setClaim] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [oracle, setOracle] = useState("");
  const [resultText, setResultText] = useState("");
  const [verdict, setVerdict] = useState<(typeof VERDICTS)[number] | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [residualRisk, setResidualRisk] = useState("");
  const [record, setRecord] = useState<Record_ | null>(null);

  const [saved, setSaved] = useState<"journal" | "note" | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [targets, setTargets] = useState<{ entityType: string; entityId: string; title: string }[] | null>(null);

  const startRecord = async () => {
    if (!claim.trim()) return;
    setBusy(true);
    setError(null);
    const data = await call({ query: START_VERIFICATION_REAL_WORK, variables: { claim } });
    setBusy(false);
    if (!data?.startVerificationRealWork) return setError(t("verification.realWork.errors.couldNotStart"));
    setAttemptId(data.startVerificationRealWork.attemptId);
    setStage("record");
  };

  const submitRecord = async () => {
    if (!attemptId || !oracle.trim() || !resultText.trim() || !verdict) return;
    setBusy(true);
    setError(null);
    const data = await call({
      query: SUBMIT_VERIFICATION_REAL_WORK,
      variables: { attemptId, oracle, result: resultText, verdict, confidence, residualRisk },
    });
    setBusy(false);
    if (!data?.submitVerificationRealWork) return setError(t("verification.realWork.errors.couldNotSubmit"));
    setRecord(data.submitVerificationRealWork.record);
    setStage("done");
  };

  const recordBody = (r: Record_) =>
    [
      `${t("verification.realWork.recordClaim")}: ${r.claim}`,
      `${t("verification.realWork.recordOracle")}: ${r.oracle}`,
      `${t("verification.realWork.recordResult")}: ${r.result}`,
      `${t("verification.realWork.recordVerdict")}: ${t(`verification.verdict.${r.verdict}`)}`,
      `${t("verification.realWork.recordResidualRisk")}: ${r.residualRisk}`,
    ].join("\n");

  const saveAsJournalEntry = async () => {
    if (!record) return;
    setBusy(true);
    const data = await call({ query: ADD_QUICK_ENTRY, variables: { body: recordBody(record) } });
    setBusy(false);
    if (!data?.addQuickEntry) return setError(t("verification.realWork.errors.couldNotSaveJournal"));
    setSaved("journal");
  };

  const openAttach = async () => {
    setAttachOpen(true);
    if (targets) return;
    const [g, p] = await Promise.all([call({ query: GET_ALL_GOALS }), call({ query: GET_PROJECTS })]);
    const goalTargets = (g?.goals ?? [])
      .filter((goal: any) => !goal.isGoalGroup)
      .map((goal: any) => ({ entityType: "goal", entityId: goal.id, title: goal.title }));
    const projectTargets = (p?.projects ?? []).map((project: any) => ({ entityType: "project", entityId: project.id, title: project.title }));
    setTargets([...goalTargets, ...projectTargets]);
  };

  const attachTo = async (entityType: string, entityId: string) => {
    if (!record) return;
    setBusy(true);
    const data = await call({ query: ADD_NOTE, variables: { entityType, entityId, body: recordBody(record) } });
    setBusy(false);
    if (!data?.addNote) return setError(t("verification.realWork.errors.couldNotAttach"));
    setSaved("note");
  };

  return (
    <InternalPageLayout title={t("verification.realWork.title")}>
      <div className="mx-auto max-w-xl space-y-5">
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

        {stage === "claim" && (
          <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {t("verification.realWork.claimLabel")}
            </p>
            <p className="text-sm text-muted-foreground">{t("verification.realWork.claimBody")}</p>
            <Input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder={t("verification.realWork.claimPlaceholder")} autoComplete="off" />
            <div className="border-t pt-3">
              <Button onClick={() => void startRecord()} disabled={busy || !claim.trim()}>
                {t("verification.realWork.startButton")}
              </Button>
            </div>
          </section>
        )}

        {stage === "record" && (
          <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {t("verification.realWork.recordTitle")}
            </p>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">{claim}</div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("verification.realWork.oracleLabel")}</p>
              <Input value={oracle} onChange={(e) => setOracle(e.target.value)} placeholder={t("verification.realWork.oraclePlaceholder")} autoComplete="off" />
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("verification.realWork.resultLabel")}</p>
              <Input value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder={t("verification.realWork.resultPlaceholder")} autoComplete="off" />
              <p className="mt-1 text-[11px] text-muted-foreground">{t("verification.realWork.resultHint")}</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t("verification.verdictLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {VERDICTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVerdict(v)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      verdict === v ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t(`verification.verdict.${v}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("verification.residualRiskLabel")}</p>
              <Input value={residualRisk} onChange={(e) => setResidualRisk(e.target.value)} placeholder={t("verification.residualRiskPlaceholder")} autoComplete="off" />
            </div>

            <div>
              <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("verification.confidenceLabel")}</span>
                <span className="font-mono">{confidence}</span>
              </p>
              <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full" />
            </div>

            <div className="border-t pt-3">
              <Button onClick={() => void submitRecord()} disabled={busy || !oracle.trim() || !resultText.trim() || !verdict}>
                {t("verification.realWork.saveRecordButton")}
              </Button>
            </div>
          </section>
        )}

        {stage === "done" && record && (
          <section className="space-y-4 overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04] p-5">
            <p className="text-sm font-semibold">{t("verification.realWork.recordDone")}</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("verification.realWork.recordClaim")}</dt>
                <dd>{record.claim}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("verification.realWork.recordOracle")}</dt>
                <dd>{record.oracle}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("verification.realWork.recordResult")}</dt>
                <dd>{record.result}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("verification.realWork.recordVerdict")}</dt>
                <dd className="font-medium">{t(`verification.verdict.${record.verdict}`)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("verification.realWork.recordResidualRisk")}</dt>
                <dd>{record.residualRisk}</dd>
              </div>
            </dl>

            {saved ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                {saved === "journal" ? t("verification.realWork.savedJournal") : t("verification.realWork.savedNote")}
              </p>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void saveAsJournalEntry()} disabled={busy}>
                    {t("verification.realWork.saveJournalButton")}
                  </Button>
                  <Button variant="outline" onClick={() => void openAttach()} disabled={busy}>
                    {t("verification.realWork.attachButton")}
                  </Button>
                </div>
                {attachOpen && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    {!targets ? (
                      <p className="text-xs text-muted-foreground">{t("skills.errors.retry")}</p>
                    ) : targets.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("verification.realWork.noTargets")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {targets.map((tg) => (
                          <button
                            key={`${tg.entityType}:${tg.entityId}`}
                            type="button"
                            disabled={busy}
                            onClick={() => void attachTo(tg.entityType, tg.entityId)}
                            className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                          >
                            {tg.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={() => navigate("/tools/skills/verification")}>{t("verification.backToLab")}</Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}
