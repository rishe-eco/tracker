# Noticing build log

Running handoff note, appended after every phase. Factual and short. Specs:
`root-sot/ecosystem/working/impact-build/{01-noticing-spec,04-build-plan}.md`.

## Phase 1 — Scaffold

Branch: `impact-noticing` (off `main`, tree was clean).

### What landed

**Prisma.** Four models (`NoticingFrame`, `NoticingSitting`, `NoticingEntry`,
`NoticingState`) appended to `api/prisma/schema.prisma`, doc comments copied
verbatim from build-plan §6. Three `User` back-relations added
(`noticingFrame`, `noticingSittings`, `noticingState`). Migration
`20260920000750_add_noticing` applied clean.

**Content** — `api/src/content/noticing/`:
- `types.ts` — spec/surface split mirroring `feelings-needs/types.ts`.
  `toPublicPack` strips `catches` + `catchCopy` entirely (Noticing's
  `NoticingContent` GraphQL type, per build-plan §7's own sketch, has no
  catch-shaped field at all — catches surface only via `NtcCatch` on a loop
  mutation result, phase 5). `renderCatch` composes a catch from an already-
  matched `CatchTypeId`; the matcher itself is phase 5.
- `dials.ts` — all values from spec §6, provisional. `graduation.*` mirrors
  Feelings & Needs' fade mechanism exactly (build-plan §6 delta 2 says to).
- `v1/spec.ts` — palette ids. Needs palette is 20 ids: 10 reused from Module
  1 (`rest, connection, safety, space, ease, to_be_seen, understanding,
  support, respect, autonomy`) + 10 new, split 4 practical/physical
  (`warmth, food, a_seat, a_hand`), 3 informational
  (`to_know_whats_going_on, to_know_its_not_just_them, direction`), 3
  invite-no-offer (`to_be_left_alone, nothing_right_now, privacy`). Places:
  `home, commute, work, shop_or_street, someones_house`. Cues: `face,
  went_quiet, stayed_late, how_i_stood, said_in_passing,
  kept_checking_the_time`.
- `v1/surface.en.ts`, `v1/surface.fa.ts` — full pack shape filled with
  placeholder copy (short, bracketed `[placeholder]` where a line needed to
  be more than a label), marked `// PHASE 2` at the top of each file.
  `SURFACE_EN.reviewStatus = "reviewed"` (English is the authored language,
  not a translation — follows the Feelings & Needs convention that this
  field tracks translation review, not copy quality). `SURFACE_FA` is
  `"draft"` and structurally complete, not absent.
- `v1/index.ts`, `index.ts` — pack assembly + version registry, mirrors
  Feelings & Needs exactly (cache by `contentVersion:locale`, throw on
  missing locale surface, versions never deleted).

**Service** — `api/src/services/noticing/state.ts`: `ensureNoticingState`
(create-then-recover), `isFrameDone`, `computeFadeLevel`, `getNoticingState`.
Mirrors `feelingsNeeds/state.ts` closely, with one deliberate difference —
see "Decisions" below.

**GraphQL.** One block in `typeDefs.ts` (`# ── Impact · Noticing (Act 1) ──`,
after `FnFinishResult`): `NoticingState` type + `Query.noticingState`.
Resolver wired in `query.ts` (`getNoticingState(ctx.prisma, ctx.user.id,
ctx.locale)`).

**Client.** Four routes under `/tools/impact/noticing{,/frame,/loop,/log}` in
`protectedRoutes.tsx`. `components/impact/NoticingPage.tsx` is a working home
shell (loads `GET_NOTICING_STATE`, shows draft/language banners, frame card,
loop card, unconditional log link). `NoticingFramePage.tsx`,
`NoticingLoopPage.tsx`, `NoticingLogPage.tsx` are heading-only stubs. One card
added to `ToolsHomePage.tsx`. `GET_NOTICING_STATE` added to `queries.ts`.

**i18n.** `impact.noticing.*` tree in both `en/common.json` and
`fa/common.json` (title, subtitle, comingSoon, frame.*, loop.*, log.*,
banners.*, errors.*), plus `toolsHome.noticing{Title,Description}` /
`openNoticing`. `i18n:check-missing` and `i18n:check-hardcoded` both pass.

### Decisions the plan didn't specify

1. **`NoticingState` (GraphQL type) has no sitting count.** Feelings &
   Needs' equivalent (`FeelingsNeedsState.sittingCount`) exists for routing
   only, but build-plan §7's own sketch of `NoticingState` omits it, and the
   non-negotiable rule ("no counter... field in any Noticing model, type or
   resolver") reads more strictly for this tool. `getNoticingState` still
   queries `noticingSitting.count(...)` internally to feed
   `computeFadeLevel`, but that number is never returned. Follow-on: the
   client currently can't conditionally hide the log link on "nothing there
   yet" the way `FeelingsNeedsPage` does with `sittingCount > 0` — I made the
   log link unconditional instead and pushed the empty state into the log
   page itself (spec's own leaning, §11). Flagging in case you wanted the
   count kept internal-only in the type but exposed differently.
2. **`isFrameDone` does not gate the loop**, unlike Feelings & Needs where
   the frame is a required precondition. This is explicit in spec §4.1 and
   build-plan §7 ("Does NOT gate the loop") — `NoticingPage`'s loop button is
   never `disabled` on `frameDone`, and the docblock says why. Worth a
   second look at Gate A (build-plan §10) once the loop actually exists.
3. **Content structure went further than the phase-1 bullet list names.**
   The task instructions called out only the three palettes (places, cues,
   needs) as phase-1 deliverables; I read "structure complete" (file map,
   phase-1 row: "v1 with placeholder copy") as covering the *whole* pack —
   frame copy (5 beat-1 steps + reroute + beat 2), loop copy, the three catch
   lexicons' structural shape, capacity chips, graduation copy, and the
   third-party warning — all present now with placeholder strings, not just
   the palettes. Reasoning: phase 2's job (per the phase table) is authoring
   *good* copy, not inventing the shape; phase 4 (frame) and phase 5
   (catches) need the types to already exist so they can build behavior
   against them. If this reads as scope creep for phase 1, the placeholder
   surfaces are cheap to trim, but the types would need to shrink too, and
   phases 2/4/5 would then be doing structural design as well as their
   stated job.
4. **Catch lexicon shape.** Module 1's lexicon is 39 *concepts* grouped into
   5 *categories* (many words, one line each per category). Noticing's three
   catches are each one type with one lexicon and one line — there's no
   "category" layer, because there's no family of near-synonyms to group.
   `CatchLexiconSpec`/`CatchLexiconSurface` reflect that flatter shape rather
   than mirroring `LexiconConceptSpec`/`LexiconCategorySurface` structurally.
5. **`graduation.sittingsPerFadeStep` / `graduationFadeLevel` invented
   numerically.** Spec §6 states the self-initiation dial only as prose
   ("unprompted passes over ~2 weeks"), not a number pair. Build-plan §6
   delta 2 says to copy Feelings & Needs' derive-from-completed-sittings
   mechanism exactly, which needs numeric dials to exist. I carried over
   Module 1's own values (5, 3) as placeholders — genuinely arbitrary, flag
   for phase 7.
6. **Needs-palette id choices** for the three new directions are mine, not
   the spec's (spec only gives *examples*: "to know what's going on", "to be
   left alone", "nothing from anyone right now"). I read those three
   examples as anchors and filled out to ~20 with `warmth, food, a_seat,
   a_hand` (physical) and `to_know_its_not_just_them, direction`
   (informational) and `privacy` (invites no offer) to round out the pool.
   Phase 2 should treat this list as a first draft, not settled content —
   it's placeholder-adjacent even though the *ids* (unlike the labels) are
   meant to be stable per build-plan §3's pinning rule.

### What surprised me

- The build plan's own GraphQL sketch (§7) already answers a question I'd
  have otherwise had to guess at: `NoticingContent` has no catch-shaped
  field at all. Catches are only ever returned inline on a mutation result
  (`NtcEntryResult.catch`), never fetched ahead of time. That shaped
  `toPublicPack` — it doesn't need a "keep catch framing copy public but
  strip the lexicon" split the way Module 1's does, because Noticing's catch
  framing copy travels on `NtcCatch` itself, composed server-side at fire
  time, not on the content pack at all.
- `typeDefs.ts` is one big `` gql` `` template literal — a docblock comment
  containing backticks (`` `count` ``, `` `streak` ``) breaks the file with a
  bizarre "module declaration" TS error rather than a string-termination
  error. Caught by `tsc --noEmit`; worth remembering for phases 2–7's SDL
  edits (no backticks anywhere in the SDL block, including inside `"""`
  docstrings).
- `client/npm run typecheck` (`react-router typegen && tsc`) is broken on
  `main` independent of anything here — it wants `app/routes.ts`, which
  doesn't exist in this repo (routing is wired by hand through
  `protectedRoutes.tsx`, not React Router's file-based convention). Confirmed
  by stashing all Noticing changes and re-running on bare `main`: identical
  failure. Verified my own changes instead with bare `npx tsc --noEmit`
  (clean) plus the two i18n scripts (both clean). Flagging rather than
  fixing — not in scope for this build and didn't want to touch shared
  tooling on a guess.

### Verification (phase 1)

- `api && npx tsc --noEmit` — pass, no errors.
- `api && npm test` — pass, 57 files / 901 tests (pre-existing suites
  untouched and green; no Noticing test suites exist yet, per plan — those
  start at phase 2).
- `client && npm run typecheck` — fails on `main` too (missing
  `app/routes.ts`, pre-existing, unrelated). `npx tsc --noEmit` directly:
  pass, no errors.
- `client && npm run i18n:check-missing` — pass.
- `client && npm run i18n:check-hardcoded` — pass (ran as a bonus check;
  build-plan §9.5 wants it green too, even though it wasn't in the phase-1
  instruction's explicit four-command list).

### What phase 2 needs to know

- Every string in `v1/surface.en.ts` and `v1/surface.fa.ts` is placeholder
  and marked as such — replace, don't append to, both files together so they
  stay structurally matched.
- The needs-palette **ids** in `v1/spec.ts` are a first attempt at covering
  build-plan §4's three directions; the id-discipline rule (share Module 1's
  id where the meaning matches) is already applied for the 10 shared ones,
  but nothing has been checked against Module 1's `NEED_IDS` programmatically
  yet — that's the content-suite assertion (build-plan §9.1) phase 2 needs to
  write.
- The catch lexicons (`CATCHES_EN`/`CATCHES_FA` in the surfaces) have
  placeholder triggers only (3 words each) — phase 2 authors the real lists
  against spec §8.5, and the field-contract note in `types.ts`'s docblock
  (which field each catch type may match) is where the phase-5 matcher's
  contract already lives, written down now so it doesn't drift.
- `DIALS.graduation.*` in `content/noticing/dials.ts` are placeholder numbers
  copied from Module 1 (see decision 5 above) — worth an explicit look before
  phase 7, not just carried forward silently.
- No test suites exist yet for Noticing. Phase 2's content + guardrail suites
  (build-plan §9.1, §9.2) are the first ones; the fences suite (§9.4) can
  land any time after phase 1 since the schema and SDL it reads already
  exist — it doesn't need to wait for phase 2's content.
