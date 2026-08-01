import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, Search, ShieldCheck, Timer } from "lucide-react";
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
  masteryUnmet: string[];
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
          <span>{t("skills.drill.itemLabel", { module: served.item.moduleKey })}</span>
          <span className="flex items-center gap-1.5">
            <Timer className="h-4 w-4" aria-hidden />
            {elapsed}s
          </span>
        </div>

        {/* The answer renders identically for control and faulty items. Any
            visual tell would let a learner score well without checking. */}
        <section className="space-y-3 rounded-lg border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">{served.item.prompt}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{served.item.answer}</div>
        </section>

        {!locked && (
          <section className="rounded-lg border bg-card p-5">
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
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("skills.drill.verdictLabel")}</p>
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
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label={t("skills.metrics.lateral")} value={result.lateral ? "✓" : "✗"} />
              <Metric label={t("skills.metrics.independent")} value={result.independence ? "✓" : "✗"} />
              <Metric label={t("skills.metrics.accurate")} value={result.accuracy ? "✓" : "✗"} />
              <Metric label={t("skills.metrics.trace")} value={`${result.traceQuality}/2`} />
            </div>

            {result.falseAlarm && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {t("skills.drill.falseAlarmNote")}
              </p>
            )}
            {result.overTrust && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {t("skills.drill.overTrustNote")}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("skills.drill.correctVerdict", {
                  verdict: t(`skills.verdict.${result.correctVerdict}`),
                })}
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {result.reveal}
              </div>
            </div>

            {result.masteryUnmet.length > 0 && (
              <div className="space-y-1 border-t pt-3">
                <p className="text-xs font-medium">{t("skills.drill.masteryRemaining")}</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {result.masteryUnmet.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 border-t pt-4">
              <Button onClick={() => void loadItem()}>{t("skills.drill.nextItem")}</Button>
              <Button variant="outline" onClick={() => navigate("/tools/skills/evidence")}>
                {t("skills.drill.backToOverview")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

/**
 * Suggested searches for live-search practice. Deliberately generic — the claim
 * itself and any identifier in it. Handing the learner the exact query that
 * exposes the fault would do the triage work for them, which is the skill
 * `e1-stop` is meant to train.
 */
function buildQueries(item: { prompt: string; answer: string }): string[] {
  const identifiers = Array.from(
    new Set(
      (item.answer.match(/\b(?:RFC|ECMA|ISO)\s?\d+|\b[A-Za-z]+\.[A-Za-z]+(?:\.[A-Za-z]+)*\(\)/g) ?? []).slice(0, 2)
    )
  );
  return [item.prompt.slice(0, 60), ...identifiers];
}
