import { useState } from "react";
import { Link, useNavigate } from "react-router";
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
  START_DELEGATION_REAL_WORK,
  SUBMIT_DELEGATION_REAL_WORK,
} from "~/api/queries";

type Record_ = { handingOver: string; keeping: string; wouldTellMeWrong: string; whatActuallyHappened: string };

/**
 * Real-work delegation (05-delegation-lab.md §5, §8, wireframe plate 7) —
 * the only mode in this engine that spans two sittings by design: logged
 * before a real decision, revisited after the outcome is known. Nothing
 * here is scored.
 */
type Stage = "before" | "after" | "done";

export default function DelegationRealWorkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [stage, setStage] = useState<Stage>("before");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [handingOver, setHandingOver] = useState("");
  const [keeping, setKeeping] = useState("");
  const [wouldTellMeWrong, setWouldTellMeWrong] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [whatActuallyHappened, setWhatActuallyHappened] = useState("");
  const [record, setRecord] = useState<Record_ | null>(null);

  const [saved, setSaved] = useState<"journal" | "note" | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [targets, setTargets] = useState<{ entityType: string; entityId: string; title: string }[] | null>(null);

  const canStart = handingOver.trim() && keeping.trim() && wouldTellMeWrong.trim();

  const startRecord = async () => {
    if (!canStart) return;
    setBusy(true);
    setError(null);
    const data = await call({ query: START_DELEGATION_REAL_WORK, variables: { handingOver, keeping, wouldTellMeWrong } });
    setBusy(false);
    if (!data?.startDelegationRealWork) return setError(t("delegation.realWork.errors.couldNotStart"));
    setAttemptId(data.startDelegationRealWork.attemptId);
    setStage("after");
  };

  const submitRecord = async () => {
    if (!attemptId || !whatActuallyHappened.trim()) return;
    setBusy(true);
    setError(null);
    const data = await call({ query: SUBMIT_DELEGATION_REAL_WORK, variables: { attemptId, whatActuallyHappened } });
    setBusy(false);
    if (!data?.submitDelegationRealWork) return setError(t("delegation.realWork.errors.couldNotSubmit"));
    setRecord(data.submitDelegationRealWork.record);
    setStage("done");
  };

  const recordBody = (r: Record_) =>
    [
      `${t("delegation.realWork.recordHandingOver")}: ${r.handingOver}`,
      `${t("delegation.realWork.recordKeeping")}: ${r.keeping}`,
      `${t("delegation.realWork.recordWouldTellMeWrong")}: ${r.wouldTellMeWrong}`,
      `${t("delegation.realWork.recordWhatHappened")}: ${r.whatActuallyHappened}`,
    ].join("\n");

  const saveAsJournalEntry = async () => {
    if (!record) return;
    setBusy(true);
    const data = await call({ query: ADD_QUICK_ENTRY, variables: { body: recordBody(record) } });
    setBusy(false);
    if (!data?.addQuickEntry) return setError(t("delegation.realWork.errors.couldNotSaveJournal"));
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
    if (!data?.addNote) return setError(t("delegation.realWork.errors.couldNotAttach"));
    setSaved("note");
  };

  return (
    <InternalPageLayout title={t("delegation.realWork.title")}>
      <div className="mx-auto max-w-xl space-y-5">
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

        {stage === "before" && (
          <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {t("delegation.realWork.beforeLabel")}
            </p>
            <p className="text-sm text-muted-foreground">{t("delegation.realWork.beforeBody")}</p>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("delegation.realWork.handingOverLabel")}</p>
              <Input value={handingOver} onChange={(e) => setHandingOver(e.target.value)} placeholder={t("delegation.realWork.handingOverPlaceholder")} autoComplete="off" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("delegation.realWork.keepingLabel")}</p>
              <Input value={keeping} onChange={(e) => setKeeping(e.target.value)} placeholder={t("delegation.realWork.keepingPlaceholder")} autoComplete="off" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("delegation.realWork.wouldTellMeWrongLabel")}</p>
              <Input
                value={wouldTellMeWrong}
                onChange={(e) => setWouldTellMeWrong(e.target.value)}
                placeholder={t("delegation.realWork.wouldTellMeWrongPlaceholder")}
                autoComplete="off"
              />
            </div>

            <div className="border-t pt-3">
              <Button onClick={() => void startRecord()} disabled={busy || !canStart}>
                {t("delegation.realWork.saveBeforeButton")}
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">{t("delegation.realWork.nothingScoredHere")}</p>
            </div>
          </section>
        )}

        {stage === "after" && (
          <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {t("delegation.realWork.afterLabel")}
            </p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordHandingOver")}</dt>
                <dd className="rounded-md border bg-muted/40 p-2">{handingOver}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordKeeping")}</dt>
                <dd className="rounded-md border bg-muted/40 p-2">{keeping}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordWouldTellMeWrong")}</dt>
                <dd className="rounded-md border bg-muted/40 p-2">{wouldTellMeWrong}</dd>
              </div>
            </dl>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("delegation.realWork.whatHappenedLabel")}</p>
              <Input
                value={whatActuallyHappened}
                onChange={(e) => setWhatActuallyHappened(e.target.value)}
                placeholder={t("delegation.realWork.whatHappenedPlaceholder")}
                autoComplete="off"
              />
            </div>

            <div className="border-t pt-3">
              <Button onClick={() => void submitRecord()} disabled={busy || !whatActuallyHappened.trim()}>
                {t("delegation.realWork.saveRecordButton")}
              </Button>
            </div>
          </section>
        )}

        {stage === "done" && record && (
          <section className="space-y-4 overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04] p-5">
            <p className="text-sm font-semibold">{t("delegation.realWork.recordDone")}</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordHandingOver")}</dt>
                <dd>{record.handingOver}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordKeeping")}</dt>
                <dd>{record.keeping}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordWouldTellMeWrong")}</dt>
                <dd>{record.wouldTellMeWrong}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{t("delegation.realWork.recordWhatHappened")}</dt>
                <dd>{record.whatActuallyHappened}</dd>
              </div>
            </dl>

            {saved ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                {saved === "journal" ? t("delegation.realWork.savedJournal") : t("delegation.realWork.savedNote")}
              </p>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void saveAsJournalEntry()} disabled={busy}>
                    {t("delegation.realWork.saveJournalButton")}
                  </Button>
                  <Button variant="outline" onClick={() => void openAttach()} disabled={busy}>
                    {t("delegation.realWork.attachButton")}
                  </Button>
                </div>
                {attachOpen && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    {!targets ? (
                      <p className="text-xs text-muted-foreground">{t("skills.errors.retry")}</p>
                    ) : targets.length === 0 ? (
                      // A fresh account lands here with the picker
                      // correctly empty and nothing to do about it.
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{t("delegation.realWork.noTargets")}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link to="/activities/goal">{t("delegation.realWork.createGoal")}</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link to="/tools/skills/delegation">{t("delegation.realWork.practiseInstead")}</Link>
                          </Button>
                        </div>
                      </div>
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
              <Button onClick={() => navigate("/tools/skills/delegation")}>{t("delegation.backToLab")}</Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}
