import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_NOTICING_CONTENT, GET_NOTICING_HISTORY } from "~/api/queries";
import { useArrows } from "./arrows";

/**
 * What the person has noticed, grouped by day (spec §4.3).
 *
 * A record, and deliberately nothing more — the same refusals
 * `FeelingsNeedsHistoryPage.tsx` argues for its own module, restated here
 * because they're load-bearing for this one too:
 *
 * - **No counts, no streaks.** "You've done this 14 times" is the counting
 *   the pillar structurally refuses — a marker you can lose becomes the
 *   reason to act.
 * - **No patterns.** "You often notice this at work" is cross-entry pattern
 *   recognition, out of scope for this build (spec §2) and Reflect's job
 *   later, not this page's.
 * - **No missing-marks.** A day with nothing in it simply isn't here — not
 *   greyed out, not marked skipped, because nothing was owed.
 *
 * **The fourth refusal is this pillar's own, and it's the important one: no
 * grouping or filtering by person, and no search.** This is the dossier
 * fence (build plan §9.4) — a log you can filter by a name, or search a name
 * in, *is* a file on that person, however innocent each entry was. It goes
 * further than "no search box": this page does not even DISPLAY the person
 * field (spec §4.3's own list of what the log shows is place, observation,
 * need, small thing — person is conspicuously absent from it), and
 * `GET_NOTICING_HISTORY` doesn't request it at all. There's nothing to
 * accidentally expose because nothing here ever asked the server for it.
 *
 * Also silent, per phase 6's own instruction: `capacityTags` and
 * `motiveNote`. The capacity portrait accrues without a display surface, and
 * the Reflect handoff's answer is stored and shown nowhere — both by design,
 * not because this page forgot them.
 *
 * A pass with no `need` (either "not sure" or never reached) is rendered
 * identically to one with a need: the observation shows on its own, with no
 * arrow and no chip. There's no line distinguishing the two cases because
 * there's no way to distinguish them from the stored data, and inventing one
 * would tell one of the two a story that isn't true for it half the time.
 */

type Entry = {
  id: string;
  place: string | null;
  observation: string | null;
  need: string | null;
  smallThing: string | null;
};
type Sitting = { id: string; completedAt: string | null; entries: Entry[] };
type Palette = { id: string; label: string };

export default function NoticingLogPage() {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { leadsTo } = useArrows();
  const { call } = useApi();

  const [sittings, setSittings] = useState<Sitting[] | null>(null);
  const [pools, setPools] = useState<{ places: Palette[]; needs: Palette[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [h, c] = await Promise.all([
      call({ query: GET_NOTICING_HISTORY }),
      call({ query: GET_NOTICING_CONTENT }),
    ]);
    if (!h?.noticingHistory || !c?.noticingContent) {
      setFailed(true);
      return;
    }
    setSittings(h.noticingHistory);
    setPools({ places: c.noticingContent.places, needs: c.noticingContent.needs });
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("impact.noticing.log.open")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("impact.noticing.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("impact.noticing.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!sittings || !pools) return <LoadingBlock />;

  if (sittings.length === 0) {
    return (
      <InternalPageLayout title={t("impact.noticing.log.open")}>
        <p className="text-sm text-muted-foreground">{t("impact.noticing.log.empty")}</p>
      </InternalPageLayout>
    );
  }

  // Grouped here, not on the server: a day is a local-timezone concept, and
  // the server has no idea what the person's offset is.
  const days = groupByDay(sittings, (d) => fmt(d, "weekdayDayMonth"));
  const labelOf = (pool: Palette[], id: string | null) =>
    (id && pool.find((p) => p.id === id)?.label) || id || "";

  return (
    <InternalPageLayout title={t("impact.noticing.log.open")}>
      <div className="space-y-7">
        {days.map(({ dayKey, dayLabel, sittings: ofDay }) => (
          <section key={dayKey} className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dayLabel}
            </h2>

            <div className="space-y-3">
              {ofDay.map((s) => (
                <div key={s.id} className="space-y-3 rounded-lg border bg-card p-4">
                  {s.entries.map((e) => (
                    <div key={e.id} className="space-y-1">
                      {e.place && (
                        <p className="text-xs text-muted-foreground">{labelOf(pools.places, e.place)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-muted/60 px-2.5 py-0.5">
                          {e.observation || "—"}
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
                      {e.smallThing && (
                        <p className="text-xs italic text-muted-foreground">{e.smallThing}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </InternalPageLayout>
  );
}

/** Newest day first, newest sitting first within a day — same approach as `FeelingsNeedsHistoryPage.tsx`. */
function groupByDay(sittings: Sitting[], formatDay: (d: Date) => string) {
  const buckets = new Map<string, { dayLabel: string; sittings: Sitting[] }>();

  for (const s of sittings) {
    if (!s.completedAt) continue;
    const d = new Date(s.completedAt);
    // Local calendar day, not UTC — otherwise a late-evening sitting lands on
    // tomorrow for anyone east of Greenwich.
    const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, { dayLabel: formatDay(d), sittings: [] });
    }
    buckets.get(dayKey)!.sittings.push(s);
  }

  return [...buckets.entries()].map(([dayKey, v]) => ({ dayKey, ...v }));
}
