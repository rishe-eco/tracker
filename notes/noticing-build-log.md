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

## Phase 2 — Content

### Corrections from phase 1 review, applied first

1. **`NoticingFrame.completedAt` made nullable.** Was `DateTime @default(now())`,
   copied from `FrameCompletion` (a row written once, at the end) without
   noticing `NoticingFrame` is written progressively across five steps.
   Migration `20260920004517_noticing_frame_completed_at_nullable` applied.
   `isFrameDone` (`services/noticing/state.ts`) now checks `completedAt !=
   null` instead of row existence, with the docblock explaining why the
   distinction matters. No code writes `NoticingFrame` rows yet (that's
   phase 4), so there was no data to migrate.
2. **Needs palette: `to_matter` restored, `privacy` cut.** Pool stays at 20 —
   11 shared-with-Module-1 ids (was 10), 4 physical, 3 informational, 2
   invite-no-offer (was 3). Added `SHARED_WITH_MODULE1_NEED_IDS` as an
   explicit export in `v1/spec.ts` so the id-discipline rule is an assertion
   against a named list, not something the content test has to reconstruct.
   Cut `privacy` rather than `to_be_left_alone` or `nothing_right_now`: the
   coordinator's read (state they want vs. a response to *me* specifically)
   is the real distinction, and `privacy` is the narrower case of the first
   — logged in `v1/spec.ts`'s comment on the list.

### What landed

**Content — real copy, both locales, all nine assets of spec §8:**
- Places, cues, needs: labels finalized. **Found and fixed a real bug in the
  phase-1 placeholder while writing real copy**: the cue chips (beat-1 step
  3) were phrased in third person ("their face", "that they'd gone quiet").
  Spec §4.1's own step-3 chip wording is **first person** — the chip
  describes what *the person recalling the memory* was visibly doing while
  their own unsaid need went unsaid, not what the helper was doing. Fixed in
  both `v1/spec.ts` labels and `surface.{en,fa}.ts`, with a docblock note on
  `CUES_EN` explaining the first-person framing so it doesn't regress.
- Day-one frame: all five beat-1 steps + the `can't think of one` reroute +
  beat 2's prediction and correction. Steps 4 and 5 use spec §4.1's exact
  quoted lines verbatim (the "turn" line and the "no idea" response).
  Graduation copy also uses spec §4.5's exact line ("You've been looking on
  your own lately. That's the whole thing."). Added a `knowResponse` field to
  the reverse step (spec only gives the "no idea" response; a "know"
  response was needed for symmetry — authored as a short factual line,
  "You were looking, then.", to avoid it reading as a stated lesson).
- Loop: all five prompts + close + repeat invite + soft-cap close + recap,
  **plus terse variants** for the four spine prompts (`place`, `person`,
  `observation`, `need`) for phase 7's prompt fade — authored as different
  short sentences, not truncations, matching Feelings & Needs' register
  (`"where?"`, `"who?"`, `"what did you see?"`, `"if it points somewhere —
  what?"`). `smallThingPrompt` and `capacityPrompt` have no terse form, same
  reasoning as Module 1's breath/small-step prompts.
- Catch lexicons: three real trigger lists (~10-15 words each) with response
  copy. **Added `matchesFields` to `CatchLexiconSpec`** (`content/noticing/types.ts`)
  so build-plan §8's field contract is encoded in the spec itself —
  `read: ["observation"]`, `strategy: ["need","smallThing"]`,
  `protective: ["smallThing","motiveNote"]` — rather than living only as a
  comment for phase 5 to reimplement correctly. `renderCatch` now takes a
  `matchedWord` parameter and substitutes it into each line's `{{word}}`,
  matching spec §4.4's own examples, all of which quote the person's word
  back ("'difficult' is your read on it", "'should' is worth a look").
  `protective` (N6-c) has no hints and a `routeTo: "reflect"`, per spec.
- Capacity chips: 6 real starters each for head/hands/heart + escape label.
- Third-party warning tightened to "Someone else is in this entry. Write it
  as if they could read it." (from the spec's draft "You're writing about
  someone else...") — shorter, and "entry" rather than "writing about"
  keeps it from reading as an accusation about what the person is doing.

**Tests** — `api/src/__tests__/noticingContent.unit.test.ts` (55 tests) and
`noticingGuardrails.unit.test.ts` (42 tests), both mirroring the Feelings &
Needs suites' structure and both green. Content suite covers spec↔surface
parity for all three palettes and both locales, the id-discipline rule
(reads `content/feelings-needs/v1/spec`'s `NEED_IDS` read-only — the one
place the two modules touch, an authoring assertion not a runtime import),
catch-lexicon structural checks (hint-slot counts, no cross-field trigger
collisions, `{{word}}` substitution, never matching `person`), dial-vs-content
agreement, the client-safe projection, and locale handling. Guardrail suite
covers the six voice rules from both English regex sweeps and a separate
Persian block restating each rule with Persian evidence (per the coordinator's
instruction — not a shared regex). **Sanity-checked the sweep itself**: planted
a deliberate "help" in `loop.smallThingPrompt`, confirmed the guardrail suite
caught it (2 failing tests, correct diagnostics), then reverted — the two
suites are not vacuously green.

### Decisions the plan didn't specify

1. **Strategy catch's hints are fixed, not per-trigger.** Spec §8.5 says
   "two or three needs offered per common strategy," which reads as though
   different triggers ("a ride" vs "money") might offer different hint
   chips. The data shape (`CatchLexiconSurface.hints: string[]`, one array
   per catch *type*) doesn't support that, and neither does build-plan §7's
   `NtcCatch` sketch (one `hints` array, no per-trigger structure). I kept
   one shared set of three hints (`rest?`, `support?`, `safety?`) broad
   enough to fit any concrete-act trigger, rather than adding a richer
   per-trigger hint structure the build plan doesn't ask for. Flag if you
   wanted the richer version — it's a type change, not just a content one.
2. **Persian register choices beyond the FN precedent's own rules.** Two
   places where I made a translation call rather than a literal one: "a
   hand" (need id `a_hand`) is «یک دست یاری» (a hand of *یاری*, aid) rather
   than the more literal «یک دست کمک» (a hand of *کمک*, help) — kept the
   English lexical choice (avoid the literal word for "help") across the
   locale rather than losing it in translation. Beat 2's prompt avoids
   «کمک» entirely for the same reason, phrased as "a small thing" (کاری
   کوچک) instead of "a small help." Both are first-pass authoring calls on
   a declared-draft surface, not a native speaker's judgment — flagging for
   whoever does the eventual native review.
3. **`personThirdPartyWarning` and the top-level `thirdPartyWarning` hold
   identical text** in both locales, by choice — the docblock in `types.ts`
   says they're allowed to diverge (kept as two fields for the loop
   wizard's convenience), but I saw no reason to author two different
   sentences for the same warning and didn't invent one.
4. **Didn't write the fences suite** (`noticingFences.unit.test.ts`,
   build-plan §9.4) this phase — the coordinator's phase-2 instructions
   named only the content and guardrail suites, and the build plan itself
   assigns the fences suite's own "done when" to phase 6b. The schema and
   SDL it would read are already stable from phase 1, so it can land
   whenever without needing to wait on anything from this phase.

### What surprised me

- The needs palette's first-person cue bug (see above) is exactly the kind
  of thing the coordinator's Phase 1 correction #1 was about — I read the
  spec table once in phase 1 and mis-transcribed the perspective without
  re-checking against the literal quoted chip list. Re-reading spec §4.1's
  table character-by-character while writing real copy caught it; skimming
  a spec table once and moving on is exactly the failure mode "read the
  whole message before touching anything" exists to prevent, and I'd already
  read it once and still got this detail wrong.
- Writing the guardrail sweep taught me the `triggers` arrays need to be
  excluded from almost every general sweep, because the catch lexicons are
  the one place the app's *authored content* is deliberately full of the
  words the app's *voice* must avoid ("should," "lazy," "have to," "the
  least I can do"). A test that swept the whole pack naively would either
  force euphemistic, useless trigger lists or produce permanent false
  positives. Scoped the exclusion narrowly (`.triggers[N]` paths only, not
  `.hints` or `.line`) so the lines and hints — which ARE the app's voice —
  stay covered.

### Verification (phase 2)

- `api && npx tsc --noEmit` — pass, no errors.
- `api && npm test` — pass, 59 files / 998 tests (901 pre-existing + 97 new:
  55 in `noticingContent.unit.test.ts`, 42 in `noticingGuardrails.unit.test.ts`).
- `client && npx tsc --noEmit` — pass, no errors (per phase 1's finding,
  `npm run typecheck` itself is broken on `main`, unrelated).
- `client && npm run i18n:check-missing` — pass.

### What phase 3 needs to know

- The needs palette is now 20 ids, finalized per the coordinator's review —
  treat `v1/spec.ts`'s `NEED_SPECS` list as settled unless something concrete
  surfaces during the spine build.
- `DIALS.needs.displayCount` (6) selection logic — which 6 of the 20 show on
  a given pass — is explicitly a phase-3 service-layer concern (spec §4.2:
  "not narrowed by the chosen place"). Nothing in the content layer picks a
  subset; `session.ts` will need to do that itself, deterministically per
  spec's own reasoning in Feelings & Needs (no reshuffling that stops
  someone building familiarity with their own words) — though Noticing's
  needs aren't tiered the way Module 1's feelings are, so a simpler rotation
  than `selectFeelingIds` should suffice.
- The four spine prompts now have `*PromptTerse` fields ready for phase 7's
  fade — nothing consumes them yet, `session.ts` should read
  `promptFadeLevel` the same way `feelingsNeeds/session.ts` does once that
  phase arrives, but there's no reason phase 3 can't wire the plumbing for
  "read terse vs full based on fade level" now if convenient, since the
  content already supports it.
- `renderCatch(pack, type, matchedWord)` now takes a third argument — phase
  5's `catches.ts` should call it with whichever trigger string actually
  matched, not the whole field's text.

### Copy I'm least happy with — please look here first

- **The strategy catch's fixed hints** (`rest?`, `support?`, `safety?`) — see
  decision 1 above. They're generic enough to not be *wrong* for any
  trigger, which also means they're not especially *sharp* for any of them.
  If the richer per-trigger version is worth the type change, this is where
  I'd start over.
- **Beat 2's correction body** ("The people who study it find the opposite:
  others are usually gladder than you'd guess, less bothered by being asked
  than you'd guess — and offering usually feels better than expected, for
  the one who offers too.") — three clauses in one sentence, and it reads a
  little like a list dressed as prose. Spec gives three specific findings
  and I tried to fit all three without a slogan; it might land better split
  into two sentences or with one finding cut.
- **The graduation body's second half** ("It's yours now — the prompts were
  only ever the scaffolding.") — borrowed the shape of Feelings & Needs'
  own graduation line almost exactly ("It's yours now — the app was only
  ever the scaffolding."). Close enough to the precedent that it may read as
  reused rather than written for this tool; worth a second pass to give
  Noticing's graduation its own image rather than Module 1's.
- **`to_know_its_not_just_them`** as a need label/id — spec's own phrase, but
  it's a mouthful in a chip, and I don't have a shorter version that keeps
  the specific meaning (this is different from generic "understanding,"
  which is already on the list). Flagging rather than shortening on my own
  judgment, since the length may be a legitimate cost of precision here.
