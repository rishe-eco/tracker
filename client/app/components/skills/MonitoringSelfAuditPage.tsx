import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { ADD_NOTE, ADD_QUICK_ENTRY, GET_ALL_GOALS, GET_PROJECTS, START_MONITORING_SELF_AUDIT, SUBMIT_MONITORING_SELF_AUDIT } from "~/api/queries";

type Record_ = { flattery: string; anchor: string; smuggledPremise: string; agreementReversal: string };

const QUESTION_KEYS = ["flattery", "anchor", "smuggled_premise", "agreement_reversal"] as const;

/**
 * Session self-audit (06-monitoring-lab.md §5, §8, wireframe plate 8) — the
 * retention feature: review one of your own real AI conversations against
 * the four influence types this tool's transcripts are built from. One
 * sitting, never scored — there is no key for a real conversation.
 */
export default function MonitoringSelfAuditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [flattery, setFlattery] = useState("");
  const [anchor, setAnchor] = useState("");
  const [smuggledPremise, setSmuggledPremise] = useState("");
  const [agreementReversal, setAgreementReversal] = useState("");
  const [record, setRecord] = useState<Record_ | null>(null);

  const [saved, setSaved] = useState<"journal" | "note" | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [targets, setTargets] = useState<{ entityType: string; entityId: string; title: string }[] | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await call({ query: START_MONITORING_SELF_AUDIT });
      setLoading(false);
      if (!data?.startMonitoringSelfAudit) return setError(t("monitoring.selfAudit.errors.couldNotStart"));
      setAttemptId(data.startMonitoringSelfAudit.attemptId);
    })();
  }, [call, t]);

  const canSubmit = flattery.trim() && anchor.trim() && smuggledPremise.trim() && agreementReversal.trim();

  const submit = async () => {
    if (!attemptId || !canSubmit) return;
    setBusy(true);
    setError(null);
    const data = await call({
      query: SUBMIT_MONITORING_SELF_AUDIT,
      variables: { attemptId, answers: { flattery, anchor, smuggledPremise, agreementReversal } },
    });
    setBusy(false);
    if (!data?.submitMonitoringSelfAudit) return setError(t("monitoring.selfAudit.errors.couldNotSubmit"));
    setRecord(data.submitMonitoringSelfAudit.record);
  };

  const recordBody = (r: Record_) =>
    [
      `${t("monitoring.selfAudit.recordFlattery")}: ${r.flattery}`,
      `${t("monitoring.selfAudit.recordAnchor")}: ${r.anchor}`,
      `${t("monitoring.selfAudit.recordSmuggledPremise")}: ${r.smuggledPremise}`,
      `${t("monitoring.selfAudit.recordAgreementReversal")}: ${r.agreementReversal}`,
    ].join("\n");

  const saveAsJournalEntry = async () => {
    if (!record) return;
    setBusy(true);
    const data = await call({ query: ADD_QUICK_ENTRY, variables: { body: recordBody(record) } });
    setBusy(false);
    if (!data?.addQuickEntry) return setError(t("monitoring.selfAudit.errors.couldNotSaveJournal"));
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
    if (!data?.addNote) return setError(t("monitoring.selfAudit.errors.couldNotAttach"));
    setSaved("note");
  };

  if (loading) return <LoadingBlock />;

  return (
    <InternalPageLayout title={t("monitoring.selfAudit.title")}>
      <div className="mx-auto max-w-xl space-y-5">
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

        {!record && attemptId && (
          <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {t("monitoring.selfAudit.introLabel")}
            </p>
            <p className="text-sm text-muted-foreground">{t("monitoring.selfAudit.introBody")}</p>

            {QUESTION_KEYS.map((key) => (
              <div key={key}>
                <p className="mb-1 text-xs text-muted-foreground">{t(`monitoring.selfAudit.question.${key}`)}</p>
                <Input
                  value={key === "flattery" ? flattery : key === "anchor" ? anchor : key === "smuggled_premise" ? smuggledPremise : agreementReversal}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (key === "flattery") setFlattery(v);
                    else if (key === "anchor") setAnchor(v);
                    else if (key === "smuggled_premise") setSmuggledPremise(v);
                    else setAgreementReversal(v);
                  }}
                  placeholder={t(`monitoring.selfAudit.placeholder.${key}`)}
                  autoComplete="off"
                />
              </div>
            ))}

            <div className="border-t pt-3">
              <Button onClick={() => void submit()} disabled={busy || !canSubmit}>
                {t("monitoring.selfAudit.submitButton")}
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">{t("monitoring.selfAudit.nothingScoredHere")}</p>
            </div>
          </section>
        )}

        {record && (
          <section className="space-y-4 overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04] p-5">
            <p className="text-sm font-semibold">{t("monitoring.selfAudit.recordDone")}</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("monitoring.selfAudit.recordFlattery")}</dt>
                <dd>{record.flattery}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("monitoring.selfAudit.recordAnchor")}</dt>
                <dd>{record.anchor}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("monitoring.selfAudit.recordSmuggledPremise")}</dt>
                <dd>{record.smuggledPremise}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("monitoring.selfAudit.recordAgreementReversal")}</dt>
                <dd>{record.agreementReversal}</dd>
              </div>
            </dl>

            {saved ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                {saved === "journal" ? t("monitoring.selfAudit.savedJournal") : t("monitoring.selfAudit.savedNote")}
              </p>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void saveAsJournalEntry()} disabled={busy}>
                    {t("monitoring.selfAudit.saveJournalButton")}
                  </Button>
                  <Button variant="outline" onClick={() => void openAttach()} disabled={busy}>
                    {t("monitoring.selfAudit.attachButton")}
                  </Button>
                </div>
                {attachOpen && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    {!targets ? (
                      <p className="text-xs text-muted-foreground">{t("skills.errors.retry")}</p>
                    ) : targets.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("monitoring.selfAudit.noTargets")}</p>
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
              <Button onClick={() => navigate("/tools/skills/monitoring")}>{t("monitoring.backToLab")}</Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}
