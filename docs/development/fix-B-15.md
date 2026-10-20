# Fix B-15: a goal group's manage page showed a status

*The fix record for B-15: what the review found the cause to be, what was built and decided, what is owed, and how it was verified.*

**Version 0.1 · Status: verified, not merged · 2026-10-20 · Owner: founder** · branch `fix/b-15-goal-group-status` @ `2143e39` on `main` @ `e90ceda` · gate: `GATE OK` · reviewed by `verify --fix`, Opus, high effort, forked

---

## Cause

A goal group's manage page (`client/app/components/goals/ManageGoal.tsx`) always showed a status badge. `getGoalStatus` returns `"GoalGroup"` for a group, and the page's status-to-label ternary had no branch for it, so it fell through to `statusIgnored`: every goal group read **"Ignored"**.

This matches the commit's cause. It doesn't match the known-issues entry (see *Flagged for close-out*). `getGoalStatus` has returned `"GoalGroup"` for a group since `75e7b2f` (`init`, 2026-08-02). Since the same commit, `GoalsListPage.tsx` lets a group through every status filter and `GoalPreview.tsx` hides the status badge for a group. The list was right before the entry was written (2026-09-21). Only the manage page was wrong.

## Built

- `goalStatusKey(status)` in `GoalPreview.tsx` maps a computed status to its `goalManage.*` key and returns `null` for a goal group. `GoalPreview` and `ManageGoal` both use it in place of two copies of the same ternary.
- `ManageGoal` shows the existing `goalsList.goalGroup` badge ("Goal group" / «گروه هدف») for a group, as the list does, and the status badge otherwise.
- Tests: `client/app/test/ManageGoalStatus.test.tsx` (new, 2 tests) renders `ManageGoal` for a group and for an ordinary goal. `client/app/test/goalStatus.test.ts` has 2 new `goalStatusKey` tests.

No new strings, keys, dependencies, API or schema changes.

## Decided

- **A goal group has no status: it's a container.** This is the entry's first option. The other option, deriving a group's status from its child goals, wasn't taken. *Accepted:* it is what the list has done since `init`, and what the comment on `getGoalStatus` says. Deriving a status would be new behaviour, which belongs on the Change track.
- **The manage page shows the "Goal group" badge where a goal shows its status.** *Accepted:* it matches the list and reuses a key that exists in both locales.
- **`goalStatusKey` returns `null` for any string it doesn't know, not only `"GoalGroup"`.** The old ternary mapped unknown strings to `statusIgnored`. *Accepted:* `getGoalStatus` returns only six values (checked by reading), so no caller sees a difference.
- **No merge of `main` was needed.** `main` and `origin/main` are at the merge base, `e90ceda`.

## Owed

- **The live site after the deploy** (verification ceiling): the founder signs in, opens a goal group's manage page, and sees "Goal group" and not "Ignored". Row added to `root-sot/team/open-work.md`, *Past the verification ceiling*.
- **The type-check command** (not this fix's): `npm run typecheck` fails in `react-router typegen` because `app/routes.ts` doesn't exist. It fails on `main` too. `npx tsc --noEmit` is clean. Whether `lifecycle/projects/tracker/config.md` §3 should name `npx tsc --noEmit` is already an open question in `root-sot/lifecycle/STATE.md`.

## Flagged for close-out

- **B-15's entry is stale** (`tracker/canon/04-roadmap/01-known-issues-and-debt.md`, line 27). It has the wrong symptom and the wrong cause:
  - It says a group's status is always "Backlog" because `getGoalStatus` reads the group's empty `props.projects`. That hasn't been true since `init`: `getGoalStatus` returns `"GoalGroup"` first.
  - It says the "Hide Done" filter breaks for groups. Groups pass every status filter on purpose (`GoalsListPage.tsx`, `case "GoalGroup": return true`).
  - The real defect was "Ignored" on the manage page, fixed in `2143e39`.

  Strike B-15 with that cause and the fix's hash.
- **`tracker/canon/01-product/00-concepts-and-hierarchy.md` §5's grounding note** names B-15 as the known-incomplete part of the cascade for goal groups. With B-15 closed, a group's lack of status is a design choice, not a bug. The note needs a new pointer, or the derived group status recorded as an open idea.
- **Dark scheme.** Under `prefers-color-scheme: dark` the manage page renders light, because nothing in `client/app` sets the `.dark` class. This predates the fix and isn't caused by it. `03-frontend.md` says nothing about a dark scheme, but `lifecycle/projects/tracker/review-checklist.md` §4 asks for "both colour schemes". Either the checklist item is dropped for Tracker, or a missing dark scheme is added as a known issue. That is the founder's call.

## Verification

**Failing first, against the merge base `e90ceda`.** I put `GoalPreview.tsx` and `ManageGoal.tsx` back to `e90ceda` and kept the branch's test files. Result: 3 tests failed, 11 passed. `ManageGoalStatus.test.tsx › shows no status for a goal group` failed on its assertion:

> `expected document not to contain element, found <span … data-slot="badge">goalManage.statusIgnored</span>`

That is the defect itself. The two `goalStatusKey` tests failed with `goalStatusKey is not a function`, which only shows the export is missing, not the defect. I then restored the files and confirmed `git status` was clean.

**Rerun at the review** (client, `npx vitest run`): `ManageGoalStatus.test.tsx`, `goalStatus.test.ts`, `GoalPreview.test.tsx`: 3 files, **21 passed**. These are every unit test file that imports `GoalPreview` or `ManageGoal`. `npx tsc --noEmit`: clean. `npm run i18n:check-missing`: pass. `npm run i18n:check-hardcoded`: pass. **e2e** `goals.spec.ts` (it renders `GoalPreview` through the list and opens a manage page): **4 passed**. Chrome stood in for Edge through a scratch config that changed only `channel`. The run used a fresh scratch SQLite database, never `dev.db`. **Flakes:** none.

**Probes, by hand.**
- `goalStatusKey`'s other callers: only `GoalPreview` and `ManageGoal` import it (grep).
- `GoalPreview` still renders the status badge only when `!isGoalGroup`, so a `null` key never reaches the screen.
- `GoalsListPage` calls `getGoalStatus`, which didn't change.

**Driven in a browser** (graded *screenshots, not a window*). The method was scripted Playwright in Chrome at 360 × 740, against the API and the Vite dev server on a scratch database. It drove a goal group with one child goal, and an ordinary goal with no dates, each in `en` and `fa`, in light and dark emulation. I looked at the screenshots.
- The group shows "Goal group" / «گروه هدف» and no status.
- The goal shows "Backlog" / «فهرست انتظار».
- `fa` is `dir=rtl` and mirrored.
- `scrollWidth` is 360 in all eight views: no horizontal scroll.

**Checklist grades**

| Item | Grade |
|---|---|
| §1 What must not break | Not applicable. No resolver, daily-flow, session, fence or content-pack file is touched (by reading). |
| §2.6 Network through `useApi` | Unchanged (by reading). |
| §2.7 Strings in `en` and `fa` | No new strings. `goalsList.goalGroup` exists in both locales (by reading); both i18n checks pass (by test). |
| §2.2–4, 7d, 7e, word boundaries, 8–10 | Not applicable. |
| §3 Scope, dependencies | 4 files, all for B-15; no new dependency (by reading). |
| §3 Tests placed and passing | Client logic in a unit test; a thin component test with `useApi` mocked. No test depends on today's date. Passing at the review (by test). |
| §3 Probes | By hand (above). |
| §3 A test the review adds | None added. |
| §3 Flakes | None. |
| §3 Shared rules | Every importer's test file rerun, plus `goals.spec.ts` (by test). |
| §3 Known issues | B-15 flagged for close-out (above). |
| §4 Driven in a browser | Screenshots, not a window: both languages, light and dark emulation, 360 px, RTL (by hand). |
| §4 Reflow at 180 px | Not checked. The fix adds no control and swaps one badge for another of about the same width. |
| §4 Calendars, states, labels and keyboard | Not applicable. The badge isn't interactive and shows no date. |
| §5 Schema | Not applicable. |
| §6 Typecheck | `npx tsc --noEmit` clean. `npm run typecheck` fails in typegen on `main` as well (*Owed*). |

**The verification ceiling**

| Can't be checked here | Status |
|---|---|
| e2e on the Linux machine | **Done with a fallback:** Chrome stood in for Edge through a scratch config, until the browser channel is read from the environment. |
| Two lanes' e2e at once | Not applicable. |
| Persian copy quality | Not applicable: no new strings. |
| Content packs' human review | Not applicable. |
| The live site after a deploy | **Owed (after the deploy):** founder, in open-work. |
| Feel-tests and gates | Not applicable. |

---

## Changelog

- **0.1 · 2026-10-20** — Created by `verify --fix B-15` on `fix/b-15-goal-group-status` @ `2143e39`.
