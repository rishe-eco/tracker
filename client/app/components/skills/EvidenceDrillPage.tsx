import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  LOG_SKILL_CHECK_EVENT,
  START_SKILL_ITEM,
  SUBMIT_SKILL_ATTEMPT,
} from "~/api/queries";
import MasteryGapList, { type MasteryGap } from "./MasteryGapList";
import RichText from "./RichText";

const VERDICTS = [
  "supported",
  "unsupported",
  "misattributed",
  "outdated",
  "contested",
  "cant_tell",
] as const;

const FAULT_TAGS = [
  "none",
  "citation",
  "quote",
  "claim_support",
  "recency",
  "framing",
  "existence",
  "figure",
] as const;

type SnapshotQuery = {
  query: string;
  results: { title: string; url: string; snippet: string }[];
};

type ServedItem = {
  attemptId: string;
  item: {
    itemId: string;
    moduleKey: string;
    difficulty: number;
    prompt: string;
    answer: string;
    snapshotQueries: SnapshotQuery[] | null;
  };
};

type AttemptResult = {
  lateral: number;
  independence: number;
  accuracy: number;
  traceQuality: number;
  strict: number;
  timeToFirstCheckMs: number | null;
  falseAlarm: boolean;
  overTrust: boolean;
  correctVerdict: string;
  reveal: string;
  moduleState: string;
  masteryUnmet: MasteryGap[];
};

export default function EvidenceDrillPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { call } = useApi();

  const mode = params.get("mode") ?? "calibrated_practice";
  const moduleKey = params.get("module") ?? undefined;

  const [served, setServed] = useState<ServedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [sources, setSources] = useState<{ url: string; snippet?: string }[]>([]);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftSnippet, setDraftSnippet] = useState("");

  const [verdict, setVerdict] = useState<string>("");
  const [faultTag, setFaultTag] = useState<string>("");
  const [confidence, setConfidence] = useState(50);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const resultRef = useRef<HTMLElement | null>(null);

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPanelOpen(false);
    setSources([]);
    setDraftUrl("");
    setDraftSnippet("");
    setVerdict("");
    setFaultTag("");
    setConfidence(50);

    const data = await call({
      query: START_SKILL_ITEM,
      variables: { skillKey: "evidence", mode, moduleKey },
    });

    if (!data) {
      setError(t("skills.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startSkillItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    setServed(data.startSkillItem);
    startedAt.current = Date.now();
    setElapsed(0);
    setLoading(false);
  }, [call, mode, moduleKey, t]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  // Committing unmounts the check and verdict panels, so the page collapses and
  // the feedback lands wherever that leaves it — often below the fold, and never
  // where the button the learner just pressed used to be. Move to it and give it
  // focus, so it's found by scroll position and by a screen reader alike.
  useEffect(() => {
    if (!result) return;
    // Optional-called: an environment without scrollIntoView would otherwise
    // take down the whole feedback panel to make the page scroll nicely.
    resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    resultRef.current?.focus?.({ preventScroll: true });
  }, [result]);

  // Visible but never punitive: the timer informs the speed metric and the
  // learner can see it, but running over does not void the item.
  useEffect(() => {
    if (result || loading) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [result, loading]);

  const logEvent = useCallback(
    async (kind: string, payload?: string) => {
      if (!served) return;
      await call({
        query: LOG_SKILL_CHECK_EVENT,
        variables: { attemptId: served.attemptId, kind, payload },
      });
    },
    [call, served]
  );

  const openPanel = async () => {
    setPanelOpen(true);
    await logEvent("opened_sideways");
  };

  const runSearch = async (query: string) => {
    await logEvent("search_issued", query);
    // Practice deliberately uses a real new tab: the drill should look like the
    // thing it is training.
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, "_blank", "noopener");
  };

  const addSource = async () => {
    const url = draftUrl.trim();
    if (!url) return;
    setSources((prev) => [...prev, { url, snippet: draftSnippet.trim() || undefined }]);
    setDraftUrl("");
    setDraftSnippet("");
    await logEvent("source_submitted", url);
  };

  const commit = async () => {
    if (!served || !verdict || !faultTag) return;
    setSubmitting(true);
    // The forcing function: the verdict is committed before anything is
    // revealed, and a check made after this point does not count.
    await logEvent("verdict_set", verdict);
    const data = await call({
      query: SUBMIT_SKILL_ATTEMPT,
      variables: {
        attemptId: served.attemptId,
        verdict,
        confidence,
        faultTag,
        sources,
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    });
    setSubmitting(false);
    if (!data?.submitSkillAttempt) {
      setError(t("skills.errors.couldNotSubmit"));
      return;
    }
    setResult(data.submitSkillAttempt);
    await logEvent("revealed");
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    return (
      <InternalPageLayout title={t("skills.evidence.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("skills.drill.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("skills.drill.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/evidence")}>
            {t("skills.drill.backToOverview")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("skills.evidence.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("skills.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const locked = result !== null;

  return (
    <InternalPageLayout title={t("skills.evidence.title")}>
      <div className="space-y-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t(`skills.moduleName.${served.item.moduleKey}`, {
              defaultValue: served.item.moduleKey,
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Timer className="h-4 w-4" aria-hidden />
            {elapsed}s
          </span>
        </div>

        {/* Collapsed by default and always present. The intro overlay is shown
            once and then unreachable, which is exactly the wrong shape for a
            reminder someone wants on their third item, not their first. */}
        <details className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("skills.drill.howTitle")}
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-muted-foreground">
            <li>{t("skills.drill.how1")}</li>
            <li>{t("skills.drill.how2")}</li>
            <li>{t("skills.drill.how3")}</li>
            <li>{t("skills.drill.how4")}</li>
          </ol>
        </details>

        <StageBar stage={locked ? 3 : panelOpen ? 2 : 1} />

        {/* Question and answer are separated hard. They used to sit in one card
            in near-identical type, and a learner who can't tell which half is
            the claim can't evaluate the claim. The distinction is structural —
            two boxes, two labels, two icons — not a font weight.

            What stays identical is the *answer* box across control and faulty
            items. Any visual tell there would let a learner score well without
            checking. */}
        <section className="space-y-3">
          <div className="rounded-lg border border-dashed bg-muted/40 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {t("skills.drill.questionLabel")}
            </p>
            <p className="text-sm font-medium leading-relaxed">{served.item.prompt}</p>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t("skills.drill.answerLabel")}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {t("skills.drill.answerCaption")}
              </span>
            </div>
            <RichText text={served.item.answer} className="text-sm leading-relaxed" />
          </div>
        </section>

        {!locked && (
          <section className="rounded-lg border bg-card p-5">
            <SectionHeading step={2} title={t("skills.drill.checkStepTitle")} />
            {!panelOpen ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("skills.drill.sidewaysHint")}</p>
                <Button onClick={openPanel} variant="secondary">
                  <Search className="mr-2 h-4 w-4" aria-hidden />
                  {t("skills.drill.checkSideways")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {served.item.snapshotQueries ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">{t("skills.drill.frozenResults")}</p>
                    {served.item.snapshotQueries.map((q) => (
                      <div key={q.query} className="space-y-2 rounded-md border p-3">
                        <p className="text-xs font-medium">{q.query}</p>
                        {q.results.map((r) => (
                          <a
                            key={r.url}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded p-2 hover:bg-accent"
                            onClick={() => void logEvent("search_issued", q.query)}
                          >
                            <span className="text-sm font-medium">{r.title}</span>
                            <span className="block text-xs text-muted-foreground">{r.snippet}</span>
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t("skills.drill.suggestedSearches")}</p>
                    <div className="flex flex-wrap gap-2">
                      {buildQueries(served.item).map((q) => (
                        <Button key={q} size="sm" variant="outline" onClick={() => void runSearch(q)}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground">{t("skills.drill.pasteBackHint")}</p>
                  <Input
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder={t("skills.drill.urlPlaceholder")}
                  />
                  <Textarea
                    value={draftSnippet}
                    onChange={(e) => setDraftSnippet(e.target.value)}
                    placeholder={t("skills.drill.snippetPlaceholder")}
                    rows={2}
                  />
                  <Button size="sm" onClick={() => void addSource()} disabled={!draftUrl.trim()}>
                    {t("skills.drill.addSource")}
                  </Button>
                </div>

                {sources.length > 0 && (
                  <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    {sources.map((s, i) => (
                      <li key={`${s.url}-${i}`} className="truncate">
                        {s.url}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {!locked && (
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <SectionHeading step={3} title={t("skills.drill.decideStepTitle")} />
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("skills.drill.verdictLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("skills.drill.verdictHint")}</p>
              <div className="flex flex-wrap gap-2">
                {VERDICTS.map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={verdict === v ? "default" : "outline"}
                    onClick={() => setVerdict(v)}
                  >
                    {t(`skills.verdict.${v}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("skills.drill.faultLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {FAULT_TAGS.map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={faultTag === f ? "default" : "outline"}
                    onClick={() => setFaultTag(f)}
                  >
                    {t(`skills.faultTag.${f}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confidence">
                {t("skills.drill.confidenceLabel", { value: confidence })}
              </label>
              <input
                id="confidence"
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs text-muted-foreground">{t("skills.drill.commitWarning")}</p>
              <Button onClick={() => void commit()} disabled={!verdict || !faultTag || submitting}>
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                {t("skills.drill.commit")}
              </Button>
            </div>
          </section>
        )}

        {result && (
          /* The feedback used to be another `border bg-card p-5` section — the
             same box as the question, the answer and the verdict form — opening
             on four ✓/✗ tiles. It was possible to read the whole thing without
             realising it was the reply to what you just did.

             So: its own colour, a heading that says what it is, and the plain
             answer first. Whether you were right comes before any measurement of
             how you got there. */
          <section
            ref={resultRef}
            tabIndex={-1}
            className={`overflow-hidden rounded-lg border-2 ${
              result.accuracy
                ? "border-emerald-500/50 bg-emerald-500/[0.06]"
                : "border-amber-500/60 bg-amber-500/[0.07]"
            }`}
          >
            <header className="flex items-center gap-2 border-b border-inherit px-5 py-3">
              {result.accuracy ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("skills.drill.resultLabel")}
                </p>
                <p className="text-base font-semibold">
                  {result.accuracy ? t("skills.drill.gotItRight") : t("skills.drill.gotItWrong")}
                </p>
              </div>
            </header>

            <div className="space-y-5 p-5">
              {/* Side by side, because "correct verdict: outdated" on its own
                  makes you scroll back up to remember what you picked. */}
              <div className="grid grid-cols-2 gap-3">
                <VerdictChip
                  label={t("skills.drill.yourVerdict")}
                  value={t(`skills.verdict.${verdict}`)}
                  tone={result.accuracy ? "good" : "bad"}
                />
                <VerdictChip
                  label={t("skills.drill.actualVerdict")}
                  value={t(`skills.verdict.${result.correctVerdict}`)}
                  tone="neutral"
                />
              </div>

              {result.falseAlarm && (
                <Note text={t("skills.drill.falseAlarmNote")} />
              )}
              {result.overTrust && <Note text={t("skills.drill.overTrustNote")} />}

              {/* The reveal is the teaching, so it reads at full contrast. It was
                  set in muted-foreground, which made the least important text on
                  the page — the metric captions — more legible than the most. */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("skills.drill.explanationLabel")}
                </p>
                <RichText text={result.reveal} className="text-sm leading-relaxed" />
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("skills.drill.scoreLabel")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label={t("skills.metrics.lateral")} ok={result.lateral === 1} />
                  <Metric label={t("skills.metrics.independent")} ok={result.independence === 1} />
                  <Metric label={t("skills.metrics.accurate")} ok={result.accuracy === 1} />
                  <Metric
                    label={t("skills.metrics.trace")}
                    ok={result.traceQuality === 2}
                    value={`${result.traceQuality}/2`}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("skills.drill.scoreHint")}
                </p>
              </div>

              {result.masteryUnmet.length > 0 && (
                <div className="space-y-1 border-t pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("skills.drill.masteryRemaining")}
                  </p>
                  <MasteryGapList gaps={result.masteryUnmet} ns="skills" />
                </div>
              )}

              <div className="flex gap-2 border-t pt-4">
                <Button onClick={() => void loadItem()}>{t("skills.drill.nextItem")}</Button>
                <Button variant="outline" onClick={() => navigate("/tools/skills/evidence")}>
                  {t("skills.drill.backToOverview")}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

/** Where you are in the item. Three states, because there are three moves. */
function StageBar({ stage }: { stage: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const labels = [t("skills.drill.stageRead"), t("skills.drill.stageCheck"), t("skills.drill.stageDecide")];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === stage;
        const done = n < stage;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {n < 3 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b pb-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {step}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function VerdictChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const ring =
    tone === "good"
      ? "border-emerald-500/50"
      : tone === "bad"
        ? "border-amber-500/60"
        : "border-border";
  return (
    <div className={`rounded-md border bg-background/60 p-3 ${ring}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed">
      {text}
    </p>
  );
}

/**
 * Pass/fail carries in the icon, the colour, *and* a word.
 *
 * A tick against a cross is the whole result for three of these four rows, and
 * both glyphs were `aria-hidden` with no text alternative — so the row read as
 * four bare labels to a screen reader, and as four labels plus two shapes to
 * anyone who does not already know which shape means which.
 */
function Metric({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  const { t } = useTranslation();
  const state = ok ? t("skills.metrics.met") : t("skills.metrics.notMet");
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        <p className={`text-[11px] ${ok ? "text-emerald-700 dark:text-emerald-500" : "text-muted-foreground"}`}>
          {value ? `${value} · ${state}` : state}
        </p>
      </div>
    </div>
  );
}

/**
 * Suggested searches for live-search practice. Deliberately generic — the
 * question itself, plus whatever the answer put in bold or in quotes, which is
 * how a named source or a figure presents itself regardless of subject.
 *
 * Handing the learner the exact query that exposes the fault would do the triage
 * work for them, which is the skill `e1-stop` is meant to train. (The earlier
 * version pattern-matched RFC and ECMA identifiers, which produced nothing at
 * all once the items stopped being about software.)
 */
function buildQueries(item: { prompt: string; answer: string }): string[] {
  const emphasised = Array.from(
    new Set(
      [...item.answer.matchAll(/\*\*(.+?)\*\*|["“”«»](.{6,60}?)["“”«»]/g)]
        .map((m) => (m[1] ?? m[2] ?? "").trim())
        .filter((s) => s.length >= 3 && s.length <= 60)
    )
  ).slice(0, 3);

  return [item.prompt.replace(/\s+/g, " ").slice(0, 60), ...emphasised];
}
