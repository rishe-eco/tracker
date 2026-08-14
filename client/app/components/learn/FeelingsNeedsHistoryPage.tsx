import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_FEELINGS_NEEDS_CONTENT, GET_LOOP_HISTORY } from "~/api/queries";
import { useArrows } from "./arrows";

/**
 * What the person has written, grouped by day.
 *
 * A record, and deliberately nothing more. It would be easy — and would feel
 * generous — to add "you've done this 14 times" or "3 days in a row" or "you
 * often feel this in your chest". All three are out: the first two are the
 * counting this module refuses (a marker you can lose is a marker that becomes
 * the reason to act), and the third is pattern-recognition across entries, which
 * plan §2 puts out of scope for this build. Noticing patterns in a life is
 * storytelling's job, and storytelling is tier 4.
 *
 * So this page shows days, times, and what was named. Nothing is aggregated,
 * nothing is missing-marked, and a week with nothing in it simply isn't here.
 */

type Entry = {
  id: string;
  passIndex: number;
  bodyLocation: string | null;
  bodyTexture: string | null;
  feelingWord: string | null;
  need: string | null;
  smallAction: string | null;
};
type Sitting = { id: string; completedAt: string | null; entries: Entry[] };
type Palette = { id: string; label: string };

export default function FeelingsNeedsHistoryPage() {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { leadsTo } = useArrows();
  const { call } = useApi();

  const [sittings, setSittings] = useState<Sitting[] | null>(null);
  const [pools, setPools] = useState<{
    locations: Palette[];
    textures: Palette[];
    feelings: Palette[];
    needs: Palette[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [h, c] = await Promise.all([
      call({ query: GET_LOOP_HISTORY }),
      call({ query: GET_FEELINGS_NEEDS_CONTENT }),
    ]);
    if (!h?.loopHistory || !c?.feelingsNeedsContent) {
      setFailed(true);
      return;
    }
    setSittings(h.loopHistory);
    const p = c.feelingsNeedsContent;
    setPools({
      locations: p.locations,
      textures: p.textures,
      feelings: p.feelings,
      needs: p.needs,
    });
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("learn.feelingsNeeds.history.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("learn.feelingsNeeds.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("learn.feelingsNeeds.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!sittings || !pools) return <LoadingBlock />;

  if (sittings.length === 0) {
    return (
      <InternalPageLayout title={t("learn.feelingsNeeds.history.title")}>
        <p className="text-sm text-muted-foreground">{t("learn.feelingsNeeds.history.empty")}</p>
      </InternalPageLayout>
    );
  }

  // Grouped here rather than on the server: a day is a local-timezone concept,
  // and the server has no idea what the person's offset is.
  const days = groupByDay(sittings, (d) => fmt(d, "weekdayDayMonth"));
  const labelOf = (pool: Palette[], id: string | null) =>
    (id && pool.find((p) => p.id === id)?.label) || id || "";

  return (
    <InternalPageLayout title={t("learn.feelingsNeeds.history.title")}>
      <div className="space-y-7">
        {days.map(({ dayKey, dayLabel, sittings: ofDay }) => (
          <section key={dayKey} className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dayLabel}
            </h2>

            <div className="space-y-3">
              {ofDay.map((s) => (
                <div key={s.id} className="rounded-lg border bg-card p-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {formatTime(s.completedAt, (d) => fmt(d, "time"))}
                  </p>
                  <div className="space-y-2">
                    {s.entries.map((e) => (
                      <div key={e.id} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-full bg-muted/60 px-2.5 py-0.5">
                            {labelOf(pools.feelings, e.feelingWord) || "—"}
                          </span>
                          {e.need && (
                            <>
                              <span className="text-muted-foreground">{leadsTo}</span>
                              <span className="rounded-full bg-muted/60 px-2.5 py-0.5">
                                {labelOf(pools.needs, e.need)}
                              </span>
                            </>
                          )}
                        </div>
                        {(e.bodyTexture || e.bodyLocation) && (
                          <p className="text-xs text-muted-foreground">
                            {[
                              labelOf(pools.textures, e.bodyTexture),
                              labelOf(pools.locations, e.bodyLocation),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {e.smallAction && (
                          <p className="text-xs italic text-muted-foreground">{e.smallAction}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </InternalPageLayout>
  );
}

/**
 * Newest day first, and newest sitting first within a day.
 *
 * Takes a formatter rather than a locale tag. It used to call
 * `toLocaleDateString(i18n.language, …)`, which for `"fa"` makes `Intl` pick
 * both the Jalali calendar *and* Persian digits — the second breaks conventions
 * §7d outright, and the first decided the calendar question by language behind
 * everyone's back. Same for the clock below.
 */
function groupByDay(sittings: Sitting[], formatDay: (d: Date) => string) {
  const buckets = new Map<string, { dayLabel: string; sittings: Sitting[] }>();

  for (const s of sittings) {
    if (!s.completedAt) continue;
    const d = new Date(s.completedAt);
    // Local calendar day, not UTC — otherwise a late-evening sitting lands on
    // tomorrow for anyone east of Greenwich.
    const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, {
        dayLabel: formatDay(d),
        sittings: [],
      });
    }
    buckets.get(dayKey)!.sittings.push(s);
  }

  return [...buckets.entries()].map(([dayKey, v]) => ({ dayKey, ...v }));
}

function formatTime(iso: string | null, formatClock: (d: Date) => string) {
  if (!iso) return "";
  return formatClock(new Date(iso));
}
