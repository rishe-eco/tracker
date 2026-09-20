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

## Phase 2 corrections (coordinator review, applied at the start of phase 3)

Five corrections landed before phase 3 work started; all five are in the
`content/noticing/` files and both test suites, not a separate commit.

1. **Beat 2's correction was a standing statistic — a real defect.** A single
   unconditional `"Most people guess this low."` fired regardless of the
   guess, so picking `very` (the one guess the finding doesn't contradict)
   got told they were wrong. Fixed: `FrameBeatTwoSurface.correction` is now
   `{ lineByGuess: Record<"not_very"|"somewhat"|"very", string>, body }`.
   `very`'s line ("You guessed high. Most people don't.") reports rather
   than congratulates. Added a guardrail test asserting all three lines
   exist and that `very`'s line never says "guess low" or "you were right".
2. **Strategy-catch hints made per-trigger, not one fixed set.** Changed
   `CatchLexiconSurface.triggers` from `string[]` to
   `{ match: string; hints: string[] }[]`, plus a `fallbackHints` escape
   hatch. `renderCatch` now looks up the matched trigger's own hints,
   falling back only if the word isn't found. `hintSlots` for `strategy`
   dropped from 3 to 2 to match what got authored (spec says "two or
   three"; two per trigger felt right once each was actually being
   written).
3. **`catchCopy.note` rewritten** — "your words, reflected back" was
   counselling register and inaccurate (the catch contrasts, it doesn't
   reflect). Now: "your own words — nothing added, nothing corrected."
4. **Graduation's second line rewritten** — dropped the borrowed scaffolding
   image ("the prompts were only ever the scaffolding"), which named what
   the *app* stopped doing. Now names what the *person* can do: "You don't
   need a prompt to look anymore — you just do."
5. **`to_know_its_not_just_them`'s label shortened** to "that it isn't just
   them"; the id is unchanged (it's the persisted value and stays precise).

All five applied in both `surface.en.ts` and `surface.fa.ts`. Two of my own
test assertions caught real mistakes while applying these: `CATCH_SPECS`
still said `hintSlots: 3` after I'd authored 2 hints per trigger (content
suite caught it), and the guardrail suite's trigger-path exclusion regex
(`isTriggerPath`) still matched the old `.triggers[N]` shape and silently
stopped excluding anything once the shape changed to `.triggers[N].match`,
which let `"i owe them"` (a `protective` trigger) get flagged by the
no-streak-or-debt sweep. Both fixed; noted here because they're exactly the
kind of thing a shape change can break quietly.

## Phase 3 — The spine

Branch: `impact-noticing`, continuing from phase 2's commit.

### What landed

**Service** — `api/src/services/noticing/session.ts`: `getContent`,
`startSitting`, `getActiveSitting`, `updateEntry`, `addPass`,
`finishSitting`, `getHistory`. Modeled closely on
`feelingsNeeds/session.ts`'s three structural rules (commits as it goes,
soft-capped repeat, passes never cross-referenced), written fresh against
Noticing's own model — no shared code or import.

One deliberate divergence, stated in the file's docblock: `startSitting`
does **not** gate on `isFrameDone`, unlike Feelings & Needs. This was
already decided in phase 1 (`NoticingState.frameDone` "does NOT gate the
loop") — phase 3 is where it actually mattered, since this is the first
code that could have quietly added the gate back by copying the precedent
too literally.

Also landed, per the brief:
- `selectNeedIds` — a plain round-robin over the 20-need pool, keyed on
  completed sittings (not random, not tier-weighted — see the function's
  own docblock for why a static "first six forever" would defeat the reason
  the pool is wider than Module 1's).
- `serveLoopCopy` — the fade-level copy withdrawal. **One threshold, not
  two.** The brief described a 3-level scheme (0 authored / 1 drops helper
  lines / 2+ terse) mirroring Feelings & Needs exactly, but Noticing's loop
  copy has no helper-line fields at all — every step is one line by design
  (spec §4.2's table has no secondary line for any loop step, and this
  phase's own "what feels right" section says "if a step needs a paragraph
  of explanation, the step is wrong"). There is nothing to drop at an
  intermediate level, so I implemented `level <= 0` → authored,
  `level >= 1` → terse, and said so in the docblock rather than inventing
  helper lines just to fill a three-tier shape that phase 2's content
  didn't call for. Flagging this explicitly since it's a place I changed the
  mechanism, not just the numbers.

**GraphQL** — one SDL block: `NoticingContent` and its constituent types
(`NtcFrameCopy`, `NtcLoopCopy`, `NtcCapacityCopy`, `NtcGraduationCopy`,
`NtcDisplaySelection`), `NtcSitting`/`NtcEntry`, `NtcEntryResult` and
`NtcFinishResult` (both deliberately minimal now — `catch` and `graduation`
land as additive fields in phases 5 and 7, which is the whole reason these
are result objects rather than the mutations returning `NtcSitting`
directly). Query: `noticingContent`, `activeNoticingSitting`. Mutations:
`startNoticingSitting`, `updateNoticingEntry`, `addNoticingPass`,
`finishNoticingSitting`. No `noticingHistory` query yet — the brief's
GraphQL list didn't include it, and the log page that would need it is
phase 6b, so the integration test exercises `getHistory` directly against
the service instead of through GraphQL.

Two GraphQL-boundary reshapes happen in `session.ts`'s `getContent`, both
because GraphQL SDL can't express what the content types can: `capacity.chips`
(a `{head,hands,heart}` record) becomes `headChips`/`handsChips`/`heartChips`,
and `correction.lineByGuess`'s `not_very` key becomes `notVery`. Both are
pure reshapes of already-public data, not new logic.

Hit the same backtick-in-docblock gotcha from phase 1 three more times
while writing the SDL (a "`body`", a "`catch`", a "`graduation`" in
docblock comments) — `tsc --noEmit` catches it immediately with a
non-obvious "module declaration" error, so it cost seconds each time, but
noting again in case phase 4 onward hits it too.

**Client** — `components/impact/NoticingLoopPage.tsx`, a full rewrite of
the phase-1 stub: place (chips + escape) → person (free text, third-party
warning under the field) → observation (free text) → need (chips + escape +
"not sure") → optional small thing → close (one line + observation→need
pair) → optional repeat → recap. `components/impact/arrows.ts` duplicates
`learn/arrows.ts`'s tiny RTL-arrow hook rather than importing it, to keep
the two component trees fully independent (they migrate to separate
standalone apps later, per build plan §1). `GET_NOTICING_CONTENT`,
`GET_ACTIVE_NOTICING_SITTING`, `START_NOTICING_SITTING`,
`UPDATE_NOTICING_ENTRY`, `ADD_NOTICING_PASS`, `FINISH_NOTICING_SITTING`
added to `queries.ts`. `impact.noticing.nav.{next,back}` and
`impact.noticing.loop.addAnother` added to both locales.

**Tests** — `api/src/__tests__/noticing.integration.test.ts` (9 tests):
opens without the frame done, commits each step independently, runs the
loop end to end, records a "not sure" pass as complete, resumes today's
open sitting instead of duplicating it, drops a trailing blank pass on
finish, refuses `addPass` past the soft cap, and history returns only
completed sittings (newest first) without an abandoned sitting inflating
the count that feeds the fade level. Also had to add the four Noticing
tables to `test/helpers.ts`'s `clearDb()` — they weren't there yet, and
without them the Noticing integration tests would have leaked rows across
test files sharing the same test database.

### Decisions the brief didn't specify (interaction, not structure)

Per the ask — these are the places a spec can't reach and where "feels like
a form" actually gets decided:

1. **Back-navigation re-hydrates free-text fields from the server, not from
   whatever was last typed.** `person`/`observation`/`smallThing` are plain
   `useState` strings, but a `useEffect` keyed on `[step, pass]` resets them
   from `pass.person`/`pass.observation`/`pass.smallThing` every time the
   step becomes active. So going back to "person" always shows what's
   actually committed for this pass, not a stale local draft. This wasn't
   specified anywhere — I chose "trust the server's own record on
   re-entry" over "preserve whatever's in the box," on the theory that a
   pass is meant to be resumable across a closed tab, and a text field that
   silently disagreed with the database would be a worse bug than losing an
   uncommitted edit.
2. **Landing on the loop with a sitting already open resumes at the first
   *core* field that's empty (place → person → observation), or at "need"
   if all three are filled** — mirroring Feelings & Needs' own resolution
   of the same ambiguity (`need` and `smallThing` are both skippable, so an
   empty one can't be told apart from a skipped one). Concretely: someone
   who picked a need and was mid-sentence on the small-thing field, then
   closed the tab, lands back on "need" (one extra, harmless tap) rather
   than "small". I copied this exact tradeoff from the precedent rather
   than inventing a different one, since it's the same shape of ambiguity.
3. **A step "mid-entry" is a single-line `Input` plus a `Next` button** for
   the three free-text steps (person, observation, small thing) — no
   secondary helper text, no placeholder copy beyond what phase 2 authored,
   and `Next` stays disabled until the field is non-blank for person and
   observation (not for the small thing, which is optional by design). This
   is the most direct reading of "if a step needs a paragraph, the step is
   wrong," but it's my call, not a spec quote.
4. **"not sure" on the need step is a committing action, not a bare local
   skip.** Clicking it calls `updateNoticingEntry` with `need: null` and
   *then* advances, whereas skipping the small thing just moves the step
   forward without writing anything (there's nothing to write — the field
   is already `null` by default). I treated "not sure" as a real, distinct
   answer worth persisting immediately (matching spec §4.2's "null is a
   complete pass, not a missing answer") rather than something to leave for
   whenever the pass next gets read.
5. **The third-party warning is a fixed line under the person input,
   rendered only while that step is on screen** — not a global banner, not
   something that persists onto later steps once the person's name has been
   entered. Spec §7 says "persistent, quiet... not dismissible-forever" but
   doesn't say whether "persistent" means "for the whole sitting" or "for
   as long as the field is visible." I read it as the latter (the warning
   belongs to the field, not the sitting), since showing it on the
   observation or need screens — after the person's name is already
   written and can't be un-written — would be closing the barn door.

### What surprised me

- Writing `serveLoopCopy` is what surfaced that Noticing's loop prompts have
  no helper-line fields at all — a structural fact I'd authored in phase 1
  and wordsmithed in phase 2 without ever noticing its consequence for the
  fade mechanism specifically. The brief's 3-level description assumed the
  Feelings & Needs shape; the content didn't have that shape to withdraw
  from. Neither phase 1 nor phase 2's tests caught this because nothing
  before phase 3 exercised the fade path against real loop copy.
- The `lineByGuess`/`headChips` reshaping at the `getContent` boundary is a
  translation step that didn't exist in Feelings & Needs' precedent at all
  (nothing in its content needs per-guess branching or a record-shaped
  palette), so there was no example to mirror — I invented the "reshape at
  the query boundary, keep the content types clean" split myself. Worth a
  second look at Gate A whether this is the right seam, or whether the
  content types should just match the GraphQL shape directly and skip the
  translation.

### Verification (phase 3)

- `api && npx tsc --noEmit` — pass, no errors.
- `api && npm test` — pass, 60 files / 1015 tests (1015 = 998 from phase 2
  + 9 new in `noticing.integration.test.ts` + 8 net new from the phase-2
  correction assertions added to the content/guardrail suites).
- `client && npx tsc --noEmit` — pass, no errors.
- `client && npm run i18n:check-missing` — pass.
- `client && npm run i18n:check-hardcoded` — pass (bonus check, as in
  earlier phases).
- Bonus: `schema.unit.test.ts` (the repo's own SDL-parses-and-resolves
  check) — pass, confirming the new SDL block builds a valid executable
  schema with every resolver matched.

### What phase 4 needs to know

- The frame's GraphQL surface (`NtcFrameCopy` and children) is fully wired
  and served by `noticingContent` already — phase 4 only needs to build
  `NoticingFramePage.tsx` against it and the `completeNoticingFrame`
  mutation (not yet written; `NoticingFrame` rows are still never created
  by any code path).
- `isFrameDone` was fixed in phase 2 to check `completedAt`, not row
  existence — phase 4's frame-completion mutation needs to actually set
  `completedAt` at the end of beat 2, not create the row with it already
  set (that was the original phase-1 bug).
- `resumeStep`'s "land on the ambiguous step" tradeoff (decision 2 above)
  exists in `NoticingLoopPage.tsx` now; if phase 4's frame wizard has the
  same skippable-field-at-the-end shape, the same tradeoff will come up
  there too.
- No catch UI exists yet in the loop wizard — `updateEntry`'s result always
  carries `catch: null`, and the client doesn't render anything for it.
  Phase 5 adds both sides together.

## Phase 4 — The day-one frame

Branch: `impact-noticing`, continuing from phase 3's commit.

### What landed

**Service** — `api/src/services/noticing/state.ts` gains the frame's own
commit-as-you-go surface, alongside `isFrameDone`: `getFrameProgress` (the
raw row, or null if beat 1 step 1 has never run), `updateFrameStep` (creates
the row on first call, refuses to touch a completed frame), and
`completeNoticingFrame` (the only place `completedAt` is ever written, and
only once — a second call is a no-op that still returns `frameDone: true`).
Kept in `state.ts` rather than a new file: the build plan's own file map
already assigns "state, frame, fade, graduation" to this module.

**Content** — two fields added to the frame's authored copy, in both
`types.ts` and both surfaces (`surface.en.ts`, `surface.fa.ts`):
`beatOne.moment.wishedPrompt` and `beatOne.turn.wishedLine`. Neither existed
before phase 4, and both turned out to be load-bearing — see "what surprised
me" below for why the reroute could not simply reuse phase 2's copy
unchanged, despite spec §4.1 saying "steps 2–4 then run unchanged."

**GraphQL** — `NtcFrameMoment.wishedPrompt` and `NtcFrameTurn.wishedLine`
added to the existing types; a new `NtcFrame` type (the progress row, all
fields nullable except `wishedInstead`); `Query.noticingFrame` (nullable —
null means never started, a different fact from `frameDone: false`, which
also covers "started but not finished"); `Mutation.updateNoticingFrame`
(commits one step, mirrors `updateNoticingEntry`'s shape) and
`Mutation.completeNoticingFrame` (no arguments — every field is already
committed by the time this runs; it only sets the timestamp). Hit the
backtick-in-docblock gotcha zero times this phase — wrote the SDL comments
free of backticks from the start, having been bitten by it three times
across phases 1 and 3.

**Client** — `components/impact/NoticingFramePage.tsx`, a full rewrite of
the phase-1 stub: intro → moment (with the `can't think of one` reroute) →
unsaid need (chips, the same six the loop would show) → visible cues
(multi-select chips, new to this file — nothing in the loop is multi-select)
→ the turn (no input) → the reverse (two-way pick, response shown inline) →
the welcome guess → the correction, which ends by completing the frame and
navigating straight into `/tools/impact/noticing/loop`. No "frame complete!"
screen anywhere (spec §4.1: "ends with the loop, not with a summary").
Landing here after `completedAt` is already set shows a short static card
instead of the wizard, rather than a redirect or a silent re-run — see
decision 4 below. `GET_NOTICING_FRAME`, `UPDATE_NOTICING_FRAME`,
`COMPLETE_NOTICING_FRAME` added to `queries.ts`; `GET_NOTICING_CONTENT`
extended with `wishedPrompt` / `wishedLine`. Two new i18n keys
(`frame.alreadyDoneTitle`, `frame.alreadyDoneBody`) plus
`noticing.backToNoticing`, in both locales. `NoticingPage.tsx` needed no
change — it already only offers the frame card while `!frameDone` (a phase-1
decision), which is exactly what "don't keep surfacing a completed one-time
thing" asks for.

**Tests** — `noticing.integration.test.ts` gains a "the day-one frame"
block: commits land independently and `frameDone` stays false until
`completeNoticingFrame` runs even with every field but the timestamp set;
completing twice is a no-op, not an error, and doesn't move the timestamp;
a second `updateNoticingFrame` call against a completed frame is refused;
the reroute sets `wishedInstead` and completes normally through the
unchanged steps 2–4; the loop opens with no frame ever started; and the
frame completes normally for someone who already ran a full loop sitting
first, with the loop still usable afterward. `noticingGuardrails.unit.test.ts`
gains a new block, "the reroute doesn't presuppose that help ever arrived"
(English and Persian), plus extends the existing "never state the lesson"
check to cover `turn.wishedLine` alongside `turn.line`.
`noticingContent.unit.test.ts` gains a structural check that both locales
author a `wishedPrompt` and `wishedLine` distinct from their ordinary
counterparts.

### Decisions the brief didn't specify

1. **The reverse step (beat 1 step 5) persists nothing.** `NoticingFrame`'s
   own data model (build plan §6) has no field for the "I know / no idea"
   pick — only `moment`, `unsaidNeed`, `visibleCues`, `wishedInstead`,
   `welcomeGuess`. That's not an oversight to fix; nothing downstream reads
   that pick, it only exists to show one of two response lines once. The
   client holds it as local component state and never calls a mutation for
   it — the one step in the whole frame that commits nothing, and it's
   correct that it doesn't.
2. **`resumeStep`'s "land one step conservatively early" tradeoff, again.**
   Phase 3 flagged that the loop's own version of this ambiguity would recur
   here, and it did, one step worse: because the reverse step commits
   nothing, a person who has already answered the welcome guess but closed
   the tab before seeing the correction is indistinguishable, from the
   server's own record, from someone who closed the tab right after
   `visibleCues`. Resuming both of them at "turn" (rather than trying to
   guess which of turn/reverse/guess they'd actually reached) means
   replaying up to two harmless, idempotent display steps in the worse case,
   which is cheap; guessing wrong and skipping a step they hadn't actually
   seen would not be. The one exception: once `welcomeGuess` **is** set,
   resuming goes straight to "correction" rather than replaying the guess
   step, since that one *is* committed and re-asking it would silently
   discard an answer that's already on record.
3. **Step 3 (visible cues) requires at least one chip or the free-text
   escape before "Next" enables**, the same shape as the loop's `person` /
   `observation` fields being required. Spec §4.1 doesn't say the step is
   mandatory, but leaving it answerable-with-nothing would make step 4 (the
   turn) render an empty first half of the pair — the exact "renders
   something the person didn't write" failure the brief warned against, just
   inverted into "renders nothing where there should be something." Requiring
   an answer is what keeps the turn meaningful every time it's reached.
4. **The frame stays reachable after completion, but shows a static card,
   not the wizard.** Chose this over removing the route or redirecting away,
   for the same reason `NoticingLogPage` and the loop's own "not sure" close
   warmly rather than erroring: a direct visit (a bookmark, a back-button)
   to a one-time thing that's already done is not a mistake to punish, just
   a fact to state plainly. `updateFrameStep`'s guard against writing into a
   completed frame is the actual enforcement; the card is only the honest
   surface for it.
5. **The reroute is one-directional within a sitting at the client.**
   Clicking `can't think of one` sets local `wishedInstead` state and hides
   the link; there is no "actually, here's one" to switch back before
   submitting step 1. Nothing commits until the moment text is actually
   submitted (moment and `wishedInstead` commit together, in one call), so
   this is a UI choice, not a data-loss risk — I judged that letting people
   flip back and forth cheapens what the brief calls "a first-class path,
   not a fallback," by turning it into a toggle to fiddle with rather than a
   door to walk through.
6. **The unsaid-need step (beat 1 step 2) shows the same six needs the loop
   would show**, reading `content.display.needIds` — the server's existing
   deterministic rotation — rather than inventing a separate selection for
   the frame or showing the full pool of twenty. Reusing it means the frame
   and the day's loop (if run same-day) show the same six words, which reads
   as consistency rather than a coincidence, and avoids adding a second
   "which needs to show" decision next to `selectNeedIds` for no stated
   reason.

### What surprised me

- **Spec §4.1's "steps 2–4 then run unchanged" turned out to be true only
  for steps 2 and 3, not step 4.** I read that sentence in the handoff
  material as settled and expected the reroute to need zero new content.
  Rewriting the turn's exact quoted line for the reroute case is what
  surfaced the gap: `line` ("They got from one to the other without you
  saying anything") is a factual claim that someone made a connection — true
  by construction on the ordinary path (the recalled help could only have
  happened if it was read), and false by construction on the reroute path,
  where by definition nobody did. Rendering the unchanged line there would
  have told the person their own material means something it doesn't — the
  exact failure mode beat 1 was rebuilt from two steps to five to stop doing,
  now showing up one level down, inside the five-step version, on one path
  through it. I read "unchanged" as being about the *step structure*
  (same four fields collected, same order) rather than *every string*, which
  is probably what was meant, but it's the kind of sentence that reads as
  "nothing to do here" until you actually try to render it.
- **Multi-select doesn't exist anywhere else in this tool.** Every chip
  palette in the loop and in beat 1's other steps is single-pick. Step 3
  needed its own small toggle-and-collect component rather than the
  single-select `Chips` every other step reuses (by local copy, per this
  tool's own no-shared-code convention within `components/impact/`) — not
  a large addition, but worth flagging since it's the one piece of frame UI
  with no precedent anywhere else in Noticing to pattern-match against.

### Verification (phase 4)

- `api && npx tsc --noEmit` — pass, no errors.
- `api && npm test` — pass, see exact file/test counts below.
- `client && npx tsc --noEmit` — pass, no errors.
- `client && npm run i18n:check-missing` — pass.
- `client && npm run i18n:check-hardcoded` — pass (bonus check, as in earlier
  phases).

### Does beat 1 hold together, read as a person?

Read start to finish (ordinary path): step 1 asks for a real memory. Step 2
asks what I actually needed, unsaid — answerable because it's a fact about
me, from the inside, at the time. Step 3 asks what was visible instead, which
requires a small perspective shift — from "what I needed" to "what someone
watching me would have seen" — but the shift is signposted by the prompt
itself ("They couldn't hear that. So what could they actually see?"), which
bridges from step 2's "not saying it out loud" directly into step 3's
question. Step 4 then shows exactly those two answers, side by side, with
the line "they got from one to the other without you saying anything" — and
it lands, because I said both halves myself two screens ago; the line isn't
telling me something new, it's naming what I'm already looking at. That
transition is the one the brief asked me to scrutinize hardest, and I don't
think it's a jump — the closest thing to friction in the whole sequence is
the pronoun shift at step 3 (from "I" to being the object of someone else's
looking), and even that is the entire point of "rehearsing from the other
side," not an accident of the copy. Step 5 (the reverse) is a bigger, clearly
intentional pivot — from my own memory to a real person, today — and it reads
as a natural next question rather than a non sequitur, because it reuses the
same insight step 4 just landed ("you can get better at looking") and turns
it outward. On the reroute path, step 4's new line ("Both of those were real,
at the same time. Nobody put them together.") lands differently — flatter,
a little sadder — which matches spec §4.1's own prediction that this path
"arguably lands harder," and I believe it does, for the same reason: nothing
is being argued, it's just naming what was true and wasn't caught.

### What phase 5 needs to know

- The frame's `NoticingFrame` row now actually gets created and completed —
  phase 5's catch engine has no dependency on it, but any future work reading
  `NoticingFrame` for real (not just `completedAt`) will find `visibleCues`
  stored as a JSON string (`{ chips: string[], other: string | null }`),
  parsed client-side only; nothing server-side reads its contents yet.
- `updateFrameStep`'s guard ("The day-one frame is already complete.") is a
  thrown `Error`, matching `updateEntry`'s convention on a finished sitting —
  not a typed result, so a client that ignores the error would see a failed
  mutation rather than a silent no-op. This was a deliberate choice, not an
  oversight: silently no-opping a write against a finished frame would hide
  a real client bug (routing someone back into a completed wizard) behind
  success-shaped output.
- The frame and the loop still don't share any code, including their small
  UI atoms (`Chips`, `QuietAction`-equivalents) — both `NoticingLoopPage.tsx`
  and `NoticingFramePage.tsx` now separately define nearly-identical private
  `Chips` components. This is consistent with the standing rule (they migrate
  to separate standalone apps later), not an oversight, but it's worth
  naming in case a future phase wants to reconsider the rule for genuinely
  tool-internal presentational atoms, as opposed to content or services.
- Nothing about the catch engine (phase 5) touches the frame — catches match
  against `NoticingEntry` fields only (`observation`, `need`, `smallThing`,
  `motiveNote`), and the frame's fields aren't in that list. The two phases
  don't intersect.

## Phase 5 — The catches

Branch: `impact-noticing`, continuing from phase 4's commit. Coordinator
review corrected the reroute finding upstream into spec v0.5, attributed to
the build; no code changes to Noticing followed from that review beyond what
phase 4 already had.

### What landed

**Service** — `api/src/services/noticing/catches.ts`, the engine. Modeled on
`feelingsNeeds/distinctions.ts` (word-boundary matching via a Unicode
letter-ish lookaround rather than `\b`, longest-match-wins, `normalizeForMatch`
for Persian's Arabic-fold/ZWNJ/diacritic handling) — read that file for the
precedent, shares no code with it. `detectCatch(pack, type, text)` is the
pure matcher, compiled and cached per `(pack, type)` in a `WeakMap`, same
caching shape as the precedent. `maybeCatch(prisma, userId, pack, entry,
changedFields)` is the whole decision: one per pass (reads
`NoticingEntry.caughtTypes`), one per sitting (`DIALS.catches.perSitting`,
counting sibling entries), per-type cooldown (`NoticingState.lastCatchAt`,
a JSON map written the moment a catch is *surfaced*, never derived from
entries — build plan §6 delta 3, restated in the file's own docblock because
it's the one place this module structurally diverges from the precedent).
`changedFields` is deliberately only the field(s) the current commit is
actually writing — never a re-scan of the whole entry — so the catch fires
at the moment a word is named, the same timing the mechanism depends on in
Module 1.

**Wiring** — `services/noticing/session.ts`'s `updateEntry` gained a
required `locale` parameter (matching `feelingsNeeds/session.ts`'s own
`updateEntry` shape) and now calls `maybeCatch` whenever `observation`,
`need`, or `smallThing` is part of the current patch, returning the real
`catch` field instead of the placeholder `null` phases 3–4 left it as.
`person` is never a candidate — not filtered out by a runtime check, but
simply never one of the three fields the code even looks at.

**GraphQL** — `NtcCatch` (type, line, hints, dismiss, note, routeTo) and
`NtcEntryResult.catch: NtcCatch`, both sketched in build-plan §7 but not
actually written into the SDL until now. Resolver: `updateNoticingEntry` now
passes `ctx.locale` through.

**Schema correction** — `NoticingEntry.caughtTypes`'s comment in
`schema.prisma` said "read for cooldown only," which phase 5 (per the
coordinator's brief) explicitly contradicts: the cooldown lives on
`NoticingState.lastCatchAt`, written at surface time, and `caughtTypes` is
the one-per-pass gate plus the spec §12 learning signal. Fixed the comment;
no schema change, no migration.

**Client** — `NoticingLoopPage.tsx` gained a `"catch"` step (not in
`STEP_DOTS` — an interruption, not a step) and a `pendingCatch` state
carrying the surfaced catch plus `followUp`, the step the triggering commit
would have gone to had nothing fired. `commitEntry` now detours to the catch
step instead of `next` whenever the mutation result carries one;
`hints.length > 0` gates whether the hint row renders at all (`read` and
`protective` never have any); clicking a hint commits `{ need:
stripQuestion(hint) }` to `followUp`; dismissing goes straight to
`followUp` without committing anything. No new i18n keys — every string on
the catch card comes from the server payload.

**Dial change** — `DIALS.catches.cooldownDays` raised from the spec's
provisional 3 to 5. See "the judgment call" below.

**Tests** — `noticingCatches.unit.test.ts` (21 tests, new): the detector's
word-boundary and longest-match behavior directly against `detectCatch`
(including the real nesting case in the `read` lexicon, "dramatic" inside
"being dramatic"); the field contract exercised through `updateEntry` field
by field, including the case where a `smallThing` answer could read as both
`strategy` and `protective` at once; one catch per pass and one per sitting;
the per-type cooldown, including the specific claim that a catch nobody
"accepted" still starts it (nothing in the test resembles an accept action
between surfacing and checking the cooldown); cooldowns independent per
type; `protective`'s no-hints-but-a-route shape and `strategy`'s
per-trigger, all-questions hints; the `{{word}}` substitution. Also
confirmed `noticing.integration.test.ts`, `noticingContent.unit.test.ts`,
`noticingGuardrails.unit.test.ts` and `schema.unit.test.ts` all still pass
unmodified against the new `catch` field and the `updateEntry` signature
change.

### Decisions the brief didn't specify

1. **Priority order when two catch types could both fire on the same field.**
   Only `strategy` and `protective` share a field (`smallThing`); `read`
   never overlaps with either. When a `smallThing` answer contains both a
   strategy trigger ("a ride") and a protective one ("should"), I check
   `protective` first. Reasoning: protective is the motive check, and spec
   §5's own failure modes (guilt accumulation, savior framing) are about
   acting *from* obligation — putting the motive question in front of the
   person before the concrete-act refinement gets any more attention reads
   as more consistent with the pillar's priorities than the reverse. This is
   a judgment call, not a spec quote; flagging it explicitly in case the
   coordinator reads it the other way round.
2. **`maybeCatch` takes already-committed, already-trimmed field values,
   not the raw patch.** `session.ts` builds `changedFields` from the same
   `trim()` output it just wrote to the row, so the matcher never sees
   whitespace or a value that didn't actually get saved. This also means a
   field set to `null` (e.g., "not sure" on `need`) is correctly inert —
   `detectCatch` returns `null` immediately on empty input — without the
   catch engine needing its own null-handling convention.
3. **The client's `followUp` mechanism, not a hardcoded per-type
   destination.** `feelingsNeedsLoopPage.tsx`'s catch handlers hardcode
   where each action goes (`setStep("need")` on dismiss, `setStep("small")`
   on a need-hint pick). Noticing's catch can fire from three different
   steps (`observation`, `need`, `smallThing`), each with its own correct
   next step, so hardcoding per-type destinations would have meant either
   three near-identical catch-UI branches or a lookup table duplicating
   information the commit call already has. Passing the intended `next`
   through as `followUp` at the moment of the interrupted commit was cheaper
   and cannot drift out of sync with the step order, because it isn't a
   second copy of it.
4. **A hint always writes to `need`, never to `smallThing`, regardless of
   which field the catch fired on.** Spec §4.4's own strategy example ("a
   ride is one way to meet it. What's underneath?") is asking what need the
   concrete act serves, and that answer belongs in the `need` field whether
   the strategy word was typed *as* the need or hiding inside the small
   thing. Concretely: catching "a ride" in `smallThing` and having a hint
   fill in `need` retroactively answers a question the person may have
   skipped earlier ("not sure") — which I treated as a feature (the "not
   sure" they gave earlier wasn't a lie, it just hadn't been prompted yet)
   rather than something to guard against.

### What surprised me

- **`NtcCatch` and `NtcEntryResult.catch` didn't exist in the SDL at all.**
  Build-plan §7's sketch shows both, and phases 3–4's comments referred to
  the catch field as something that would "arrive as an additive field" —
  reading that, I expected to find a stub type already sitting in
  `typeDefs.ts` waiting for a resolver. It wasn't there; the sketch was
  exactly that, a sketch, and phase 5 is where it actually gets written.
  Cheap to add, but worth flagging since "the type already exists, only the
  resolver is missing" was a wrong assumption I carried in from the build
  log's own phase-4 language before checking.
- Writing the priority-order comment (decision 1) is what made me notice
  `read` has no field overlap with the other two at all — it's the only
  type that ever touches `observation`. The `CATCH_PRIORITY` list still
  orders it last for completeness, but nothing in the current lexicons ever
  exercises that position. Worth remembering if a future catch type ever
  gets added to `observation`'s contract: that's the first time this
  ordering would do real work outside of `smallThing`.

### The judgment call — where does a touch become a spellchecker

Read side by side, the three lexicons are not equally likely to fire.
`strategy`'s triggers ("a ride," "a lawyer," "a loan") and `protective`'s
("should," "guilty," "the least I can do") are concrete and somewhat
self-selecting for context — they mostly show up when someone is actually
naming an act or catching themselves mid-obligation, and both only get
checked against `smallThing`/`need`, fields that are optional or often
answered "not sure." `read`'s list — rude, difficult, fine, cold, annoying,
being dramatic — is exactly the casual evaluative shorthand people reach for
constantly when describing someone in a sentence or two, and it runs against
`observation`, the one field every single pass fills in.

At the spec's original `cooldownDays: 3`, a person whose ordinary voice
tends toward that shorthand (which is most people, some of the time) would
plausibly retrip `read` roughly every 3-4 days indefinitely — call it twice
a week, forever, with no decay and no relationship to whether the last one
landed well. That reads less like the distributed touch spec §4.4 asks for
and more like a standing commentary on word choice, precisely the "grammar
checker" `feelingsNeeds/distinctions.ts`'s own docblock names as the failure
mode to stay clear of. `strategy` and `protective` were never going to be
the ones that hit this ceiling — their trigger lists are narrower and their
fields are skipped by default — so the risk is concentrated entirely in one
of the three types sharing one shared number with the other two.

**What I changed:** raised `DIALS.catches.cooldownDays` from 3 to 5,
uniformly. This is a real, if modest, adjustment — it mostly reins in `read`
(the type actually likely to hit the ceiling) without meaningfully starving
`strategy`/`protective` (which were far from it to begin with).

**What I didn't change, and think is a better fix later:** a single shared
`cooldownDays` sitting on top of a *per-type* `lastCatchAt` map is already a
slight mismatch in shape — the state was authored expecting each type to
have its own rhythm, and the dial doesn't yet let it. The structurally
cleaner fix is a per-type cooldown (`read` longer than `strategy`/
`protective`), which the state shape already supports for free. I didn't do
it now because guessing a *second* number with no usage data is worse than
adjusting the one number that's actually in front of me — this is exactly
what build plan §10's gates are for, and it's a five-minute change once
there's real text to look at rather than lexicons on a page.

**On `perSitting: 1`:** left alone. It's already justified by the spec's own
prose ("two in one sitting reads as correction"), not merely provisional in
the way the cooldown number was, and at one per sitting there's no room left
to tighten it without disabling the mechanism outright. If anything is too
rare, it will be this — but making it rarer is a strictly worse failure mode
than making it too frequent (silence teaches nothing; a repeated point at
least tries), so I left it exactly where the spec put it.

### Verification (phase 5)

- `api && npx tsc --noEmit` — pass, no errors.
- `api && npm test` — pass, see exact count below.
- `client && npx tsc --noEmit` — pass, no errors.
- `client && npm run i18n:check-missing` — pass.
- `client && npm run i18n:check-hardcoded` — pass (bonus check, as in earlier
  phases).

### What phase 6 needs to know

- `NtcCatch.routeTo` is already carried end to end (server composes it,
  GraphQL exposes it, the client receives it on `pendingCatch.routeTo`) but
  the client does **nothing** with it yet — the protective catch's card
  looks identical to read's (line, no hints, dismiss, note). Phase 6's
  Reflect handoff stub is where `routeTo` actually earns a distinct
  treatment (a link-out, however thin) and where `motiveNote` gets an actual
  write path via `setNoticingMotive`. Until then, protective's `routeTo` is
  structurally present and functionally inert.
- `protective`'s `matchesFields` includes `motiveNote`, but nothing writes
  that field yet — `maybeCatch` will simply never be asked to check it until
  phase 6 wires `setNoticingMotive`. When it does, that mutation should
  build its own `changedFields` the same way `updateEntry` does here (one
  key, the trimmed value, only when the field is actually part of the
  patch) rather than reusing `updateEntry`'s, since they're different
  mutations committing different fields at different times — but the
  one-per-pass gate (`caughtTypes`) is shared across the whole entry
  regardless of which mutation writes to it: if `smallThing` already used
  this pass's one catch, a `motiveNote` written moments later on the same
  entry will correctly get nothing.
- The needs-hint retroactive-fill behavior (decision 4) means a person who
  answered "not sure" on `need` and later gets a `strategy` catch on
  `smallThing` can end up with a non-null `need` they never directly chose
  from the need step's own chips. Nothing downstream currently depends on
  `need`'s provenance (there's no `needSource` field the way Feelings &
  Needs has `feelingSource`), so this is inert today, but worth knowing if
  a future phase wants to distinguish "chosen at the need step" from
  "filled in by a catch hint."
- Cooldown tuning is a paper exercise until phase 8's feel-test — the
  judgment call above changed one number based on reading the lexicons, not
  on any real usage. Treat `cooldownDays: 5` as no more settled than the
  original `3` was.
