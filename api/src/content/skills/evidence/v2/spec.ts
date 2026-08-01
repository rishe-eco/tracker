/**
 * Evidence Lab — locale-invariant item specs, content version `evidence/v2`.
 *
 * ## What changed from v1, and why
 *
 * v1's claims were all software claims: RFC numbers, SQLite features, npm
 * defaults. That was a deliberate v1 choice — triage judgement (`e1-stop`) only
 * trains on material where the learner can feel the stakes, and the first
 * learner was a developer. It does not survive a wider audience: a reader who
 * does not know what an RFC *is* cannot practise deciding whether this one is
 * load-bearing, so the item stops measuring evidence skill and starts measuring
 * domain familiarity.
 *
 * v2 replaces the whole set with claims that need no specialist background to
 * *feel* and no specialist access to *check* — history, language, everyday
 * science, health guidance, statistics, consumer facts. The design constraint
 * is unchanged and is the hard part: every claim must still be resolvable by an
 * ordinary search in well under a minute, or the drill trains patience rather
 * than checking.
 *
 * v2 is also much larger. v1 shipped two practice items in total, which meant
 * four of the six modules had no practice at all and none of them could reach
 * mastery — mastery needs five at-criterion attempts inside a six-attempt
 * window, so a module needs at least six items before the bar is even
 * reachable. Every module now carries six.
 *
 * Nothing here is language-specific. The words live in `surface.en.ts` and
 * `surface.fa.ts`; what is here is what makes each item an instrument, authored
 * exactly once for every locale.
 *
 * Every key below is an authoring assertion until a human re-checks it:
 * `keyVerifiedAt: null` blocks the item from probe use (see `validate.ts`).
 */

import type {
  EvidenceItemSpec,
  EvidenceModuleKey,
  EvidenceProfile,
  FaultTag,
  Verdict,
} from "../../types";

export const CONTENT_VERSION = "evidence/v2";

/**
 * The verdict a profile implies. Keeping this derivable means an authoring slip
 * — a `contested_as_settled` item keyed `unsupported`, say — is caught by the
 * validator instead of quietly mis-scoring every learner who meets it.
 */
export const EXPECTED_VERDICT: Record<EvidenceProfile, Verdict> = {
  true_cited: "supported",
  true_uncited: "supported",
  fabricated_citation: "unsupported",
  plausible_nonexistent: "unsupported",
  subtle_numeric: "unsupported",
  real_source_misquoted: "misattributed",
  real_source_wrong_claim: "misattributed",
  outdated: "outdated",
  contested_as_settled: "contested",
};

/**
 * Which element fails, per profile — derived for the same reason the verdict is:
 * so trace-quality scoring can't drift from the item's own definition of what
 * went wrong.
 */
export const FAULT_TAG: Record<EvidenceProfile, FaultTag> = {
  true_cited: "none",
  true_uncited: "none",
  fabricated_citation: "citation",
  real_source_misquoted: "quote",
  real_source_wrong_claim: "claim_support",
  outdated: "recency",
  contested_as_settled: "framing",
  plausible_nonexistent: "existence",
  subtle_numeric: "figure",
};

/** Module order is the default teaching sequence; the baseline profile may reorder it. */
export const MODULE_ORDER: EvidenceModuleKey[] = [
  "e1-stop",
  "e2-source",
  "e3-sideways",
  "e4-trace",
  "e5-independence",
  "e6-reflex",
];

const pendingSnapshot = (...queries: string[]) => ({
  status: "pending" as const,
  fetchedAt: null,
  verifiedBy: null,
  queries: queries.map((query) => ({ query, results: [] })),
});

/**
 * What a `pendingSnapshot` becomes once a human has run the searches, captured
 * the results, and re-checked the answer key **against those exact results**.
 *
 * Both halves are required together and the validator enforces it: a verified
 * snapshot sitting next to an unverified key is an error, because refreshing the
 * evidence without re-reading the key is the one way this design can go wrong
 * silently. See `06-specs/02a-evidence-verification-brief.md` for the procedure.
 */
export const verifiedSnapshot = (
  fetchedAt: string,
  verifiedBy: string,
  queries: { query: string; results: { title: string; url: string; snippet: string }[] }[]
) => ({ status: "verified" as const, fetchedAt, verifiedBy, queries });

export const ITEM_SPECS: EvidenceItemSpec[] = [
  // ── Probe form A ─────────────────────────────────────────────────────────
  {
    itemId: "ev2-a1",
    moduleKey: "e4-trace",
    formId: "A",
    difficulty: 2,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "The 1945 US Food and Nutrition Board recommendation is real and is quoted roughly correctly. Its next sentence — that most of that water is already contained in prepared foods — is what the eight-glasses advice drops. The document exists, is cited, and does not support the conclusion drawn from it.",
    keyVerifiedAt: null,
    faultTarget: "the step from the 1945 recommendation to the advice drawn from it",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot(
      "1945 Food and Nutrition Board water recommendation",
      "eight glasses of water a day origin"
    ),
  },
  {
    itemId: "ev2-a2",
    moduleKey: "e1-stop",
    formId: "A",
    difficulty: 2,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "Jupiter's confirmed moon count was 79 around 2018 and has climbed past 95; Saturn overtook it in 2023 and is now well past 100. Chosen because the count is exactly the kind of number that is repeated long after it stops being true, and one search settles it.",
    keyVerifiedAt: null,
    faultTarget: "the moon count and the claim that Jupiter leads",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("how many moons does Jupiter have", "Saturn moon count confirmed"),
  },
  {
    itemId: "ev2-a3",
    moduleKey: "e3-sideways",
    formId: "A",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — accurate and correctly cited. Petrichor was named by Bear and Thomas in Nature in 1964, and the geosmin account is right. A learner who flags this has learned distrust rather than checking.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: ["nature.com"],
    snapshot: pendingSnapshot("petrichor Bear Thomas 1964 Nature", "geosmin smell of rain"),
  },
  {
    itemId: "ev2-a4",
    moduleKey: "e2-source",
    formId: "A",
    difficulty: 3,
    profile: "plausible_nonexistent",
    key: EXPECTED_VERDICT.plausible_nonexistent,
    keyNote:
      "There is no FDA '90-Minute Rule'. The real guidance is the two-hour rule (one hour above 90°F) and the 40–140°F danger zone. Note the direction of the error: the invented rule is stricter than the real one, so following it is harmless — which is precisely why nobody would ever catch it by consequence.",
    keyVerifiedAt: null,
    faultTarget: "the named rule, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("FDA two hour rule food left out", "USDA danger zone food safety"),
  },
  {
    itemId: "ev2-a5",
    moduleKey: "e5-independence",
    formId: "A",
    difficulty: 3,
    profile: "contested_as_settled",
    key: EXPECTED_VERDICT.contested_as_settled,
    keyNote:
      "Morning-versus-evening training is an open question: findings differ by outcome measure, by sex, by training status, and effect sizes are small next to the effect of simply training consistently. The answer is not false, it is falsely settled — the learner should reach `contested`, not `unsupported`.",
    keyVerifiedAt: null,
    faultTarget: "the framing of an open question as resolved",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot(
      "morning vs evening exercise which is better research",
      "time of day exercise performance meta-analysis"
    ),
  },
  {
    itemId: "ev2-a6",
    moduleKey: "e6-reflex",
    formId: "A",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — accurate and completely unsourced. The syn-propanethial-S-oxide account is correct. The correct verdict is `supported` *after checking*: a missing citation is a reason to check, never a reason to disbelieve.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why do onions make you cry chemistry", "syn-propanethial-S-oxide"),
  },

  // ── Practice pool · e1-stop ──────────────────────────────────────────────
  {
    itemId: "ev2-e1-1",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 1,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — giraffes really do have seven cervical vertebrae, as do almost all mammals. Surprising is not the same as wrong, and this item exists to make that distinction cost something.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("giraffe cervical vertebrae seven"),
  },
  {
    itemId: "ev2-e1-2",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 2,
    profile: "subtle_numeric",
    key: EXPECTED_VERDICT.subtle_numeric,
    keyNote:
      "Alcohol supplies about 7 kcal per gram, not 9. Fat 9, protein 4, carbohydrate 4 are all correct, so three right numbers certify the fourth.",
    keyVerifiedAt: null,
    faultTarget: "the calories-per-gram figure for alcohol",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("calories per gram alcohol protein fat carbohydrate"),
  },
  {
    itemId: "ev2-e1-3",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 3,
    profile: "contested_as_settled",
    key: EXPECTED_VERDICT.contested_as_settled,
    keyNote:
      "Standing desks are an active research question. Measured energy differences are small, and health findings are mixed and mostly observational. Presented here as an established result.",
    keyVerifiedAt: null,
    faultTarget: "the framing of mixed evidence as established",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("standing desk health benefits evidence review"),
  },
  {
    itemId: "ev2-e1-4",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — Rayleigh scattering, correctly described and correctly attributed. Included early because a learner who has just met the idea of checking tends to flag everything, and this is where that shows.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why is the sky blue Rayleigh scattering"),
  },
  {
    itemId: "ev2-e1-5",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 2,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "India passed China in population during 2023. The figure was correct for decades, which is what makes it the archetype of a claim nobody thinks to re-check.",
    keyVerifiedAt: null,
    faultTarget: "which country is currently the most populous",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("most populous country in the world"),
  },
  {
    itemId: "ev2-e1-6",
    moduleKey: "e1-stop",
    formId: "pool",
    difficulty: 3,
    profile: "plausible_nonexistent",
    key: EXPECTED_VERDICT.plausible_nonexistent,
    keyNote:
      "There is no 'Clean Origin Certificate'. The real mechanism is the Kimberley Process Certification Scheme. The World Diamond Council is a real body, which is what carries the invented document.",
    keyVerifiedAt: null,
    faultTarget: "the named certificate, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("conflict free diamond certification scheme"),
  },

  // ── Practice pool · e2-source ────────────────────────────────────────────
  {
    itemId: "ev2-e2-1",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 2,
    profile: "fabricated_citation",
    key: EXPECTED_VERDICT.fabricated_citation,
    keyNote:
      "The conclusion is broadly right and the citation is invented. The real work is Mueller and Oppenheimer, Psychological Science, 2014. A right conclusion is doing the job of certifying a source that does not exist.",
    keyVerifiedAt: null,
    faultTarget: "the cited study, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("handwriting vs typing notes study Mueller Oppenheimer"),
  },
  {
    itemId: "ev2-e2-2",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 3,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "Mehrabian's work is real and the 7/38/55 split is really his. It came from two small studies on how people resolve *conflicting* signals about feelings and attitudes — single spoken words, no ordinary conversation. Mehrabian himself has said the general claim misuses it.",
    keyVerifiedAt: null,
    faultTarget: "the generalisation from the study's conditions to all communication",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("Mehrabian 7 38 55 rule misinterpretation"),
  },
  {
    itemId: "ev2-e2-3",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — piloerection, arrector pili muscles, and the vestigial explanation are all correct and correctly attributed.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why do we get goosebumps arrector pili"),
  },
  {
    itemId: "ev2-e2-4",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — starch retrogradation is the right account, and the counter-intuitive detail (the fridge speeds staling up) is also right. Accurate, surprising, and entirely unsourced.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why does bread go stale starch retrogradation"),
  },
  {
    itemId: "ev2-e2-5",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 3,
    profile: "fabricated_citation",
    key: EXPECTED_VERDICT.fabricated_citation,
    keyNote:
      "NOAA really does say most of the ocean is unmapped and unexplored, but there is no publication called the 'NOAA 2021 Ocean Exploration Report'. A real institution plus a real-sounding title is the cheapest fabrication there is.",
    keyVerifiedAt: null,
    faultTarget: "the named report, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("NOAA how much of the ocean is explored"),
  },
  {
    itemId: "ev2-e2-6",
    moduleKey: "e2-source",
    formId: "pool",
    difficulty: 2,
    profile: "plausible_nonexistent",
    key: EXPECTED_VERDICT.plausible_nonexistent,
    keyNote:
      "No such body. Element names are approved by IUPAC. The invented council is named the way real standards bodies are named, which is the whole trick.",
    keyVerifiedAt: null,
    faultTarget: "the organisation named, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("who approves names of new chemical elements"),
  },

  // ── Practice pool · e3-sideways ──────────────────────────────────────────
  {
    itemId: "ev2-e3-1",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 1,
    profile: "real_source_misquoted",
    key: EXPECTED_VERDICT.real_source_misquoted,
    keyNote:
      "The insanity line is not Einstein's. The earliest documented appearances are in Narcotics Anonymous literature around 1981 and a Rita Mae Brown novel in 1983. Nothing about the sentence is wrong except who said it — and reading it again will never tell you that.",
    keyVerifiedAt: null,
    faultTarget: "the attribution of the quote",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("definition of insanity quote Einstein misattribution"),
  },
  {
    itemId: "ev2-e3-2",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 1,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — rock weathering carried by rivers, plus hydrothermal vents, is the standard and correct account. No citation offered.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why is the ocean salty"),
  },
  {
    itemId: "ev2-e3-3",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 2,
    profile: "plausible_nonexistent",
    key: EXPECTED_VERDICT.plausible_nonexistent,
    keyNote:
      "No horned Viking helmet has ever been excavated. The image comes from 19th-century costume design, largely Wagner's Ring cycle. Birka is a real and famous site, which is what makes the invented find plausible.",
    keyVerifiedAt: null,
    faultTarget: "the archaeological finds, which do not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("did vikings wear horned helmets archaeology"),
  },
  {
    itemId: "ev2-e3-4",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 1,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "7.6 billion was the figure around 2018; world population passed 8 billion in November 2022. A number that drifts continuously and is quoted as though it were a constant.",
    keyVerifiedAt: null,
    faultTarget: "the population figure",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("current world population"),
  },
  {
    itemId: "ev2-e3-5",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 3,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "Fleming's VARK questionnaire is real and people really do report preferences. What the cited work does not show is the meshing hypothesis — that matching teaching to the preference improves learning — which is what the answer uses it for. Controlled tests have repeatedly failed to find that effect.",
    keyVerifiedAt: null,
    faultTarget: "the step from reported preference to improved learning",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("learning styles meshing hypothesis evidence"),
  },
  {
    itemId: "ev2-e3-6",
    moduleKey: "e3-sideways",
    formId: "pool",
    difficulty: 2,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — and deliberately inverted: the answer debunks a myth, correctly and with a real source. A learner running on suspicion tends to flag whatever contradicts something familiar, which is the same error in the other direction.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: ["nasa.gov"],
    snapshot: pendingSnapshot("Great Wall of China visible from space NASA"),
  },

  // ── Practice pool · e4-trace ─────────────────────────────────────────────
  {
    itemId: "ev2-e4-1",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 2,
    profile: "real_source_misquoted",
    key: EXPECTED_VERDICT.real_source_misquoted,
    keyNote:
      "1 Timothy 6:10 exists and is correctly located. The text is 'the love of money is a root of all kinds of evil'; the quotation drops 'the love of' and hardens 'a root of all kinds' into 'the root of all'. Two small edits, a different claim.",
    keyVerifiedAt: null,
    faultTarget: "the wording of the quotation",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("1 Timothy 6:10 exact wording love of money"),
  },
  {
    itemId: "ev2-e4-2",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 3,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "Rousseau's Confessions really does contain the brioche line, quoted accurately here. It is attributed to 'a great princess' and was written when Marie Antoinette was a child in Austria. The source exists and is quoted correctly; it does not support the attribution.",
    keyVerifiedAt: null,
    faultTarget: "the step from the source to the person named",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("let them eat cake Rousseau Confessions great princess"),
  },
  {
    itemId: "ev2-e4-3",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 2,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — and an unusual one: the accurate answer is that the origin is unknown and the famous wife-beating story has no basis in English law. Correct, sourced, and unsatisfying. Learners flag it because it refuses to give them a story.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("rule of thumb origin etymology wife beating myth"),
  },
  {
    itemId: "ev2-e4-4",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 3,
    profile: "fabricated_citation",
    key: EXPECTED_VERDICT.fabricated_citation,
    keyNote:
      "Boas 1911 is a real book — the Handbook of American Indian Languages — but there is no 'census of Eskimo vocabulary', and Boas mentioned four roots, not fifty. Real author, real year, invented document, inflated number.",
    keyVerifiedAt: null,
    faultTarget: "the cited work, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("Eskimo words for snow Boas 1911 origin of claim"),
  },
  {
    itemId: "ev2-e4-5",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — the honest answer is that nobody knows, and the answer says so while naming the circulating stories as undocumented. Accurate, calibrated, unsourced. An answer admitting uncertainty is not a hedge to be punished.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("origin of saying bless you after sneeze"),
  },
  {
    itemId: "ev2-e4-6",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 1,
    profile: "subtle_numeric",
    key: EXPECTED_VERDICT.subtle_numeric,
    keyNote:
      "1337 to 1453 is 116 years. The answer gives correct start and end dates and then a duration that does not follow from them — the arithmetic is checkable without leaving the answer, which is why it is the easiest item in the pool.",
    keyVerifiedAt: null,
    faultTarget: "the stated duration, which contradicts the stated dates",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("Hundred Years War dates duration"),
  },

  // ── Practice pool · e5-independence ──────────────────────────────────────
  {
    itemId: "ev2-e5-1",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 2,
    profile: "contested_as_settled",
    key: EXPECTED_VERDICT.contested_as_settled,
    keyNote:
      "The breakfast literature is dominated by observational studies with heavy confounding; controlled trials have not reliably found the effect. Genuinely open, presented as long settled — and the fact that everyone repeats it is the point of putting it in this module.",
    keyVerifiedAt: null,
    faultTarget: "the framing of contested evidence as consensus",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("is breakfast the most important meal evidence trials"),
  },
  {
    itemId: "ev2-e5-2",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 3,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "The Wolraich meta-analysis in JAMA (1995) is real and is cited here in support of the opposite of what it found: no effect of sugar on behaviour. Blinded trials also show parents rate children as more hyperactive when told they were given sugar.",
    keyVerifiedAt: null,
    faultTarget: "the direction of the cited meta-analysis's finding",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("sugar hyperactivity children meta-analysis JAMA 1995"),
  },
  {
    itemId: "ev2-e5-3",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — no association between knuckle cracking and arthritis has been found, and the answer's caveats about grip strength and swelling are fairly stated. Unsourced.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("knuckle cracking arthritis study"),
  },
  {
    itemId: "ev2-e5-4",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 2,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "Kipchoge's 2:01:09 was the record from Berlin 2022 until Kelvin Kiptum ran 2:00:35 in Chicago in October 2023. Records are the cleanest possible case of a claim that was true, is repeated, and has a date attached to its expiry.",
    keyVerifiedAt: null,
    faultTarget: "the record time and holder",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("marathon world record men current"),
  },
  {
    itemId: "ev2-e5-5",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 3,
    profile: "fabricated_citation",
    key: EXPECTED_VERDICT.fabricated_citation,
    keyNote:
      "The conclusion is correct — goldfish memory runs to weeks and months, and the three-second claim is folklore — but the named study and authors do not exist. Agreeing with the reader is not evidence, and this item exists to separate the two.",
    keyVerifiedAt: null,
    faultTarget: "the cited study, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("goldfish memory span research"),
  },
  {
    itemId: "ev2-e5-6",
    moduleKey: "e5-independence",
    formId: "pool",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — lightning strikes tall structures repeatedly and the Empire State Building figure is in the right range, correctly attributed to the US weather service.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: ["weather.gov"],
    snapshot: pendingSnapshot("does lightning strike the same place twice Empire State Building"),
  },

  // ── Practice pool · e6-reflex ────────────────────────────────────────────
  {
    itemId: "ev2-e6-1",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 2,
    profile: "subtle_numeric",
    key: EXPECTED_VERDICT.subtle_numeric,
    keyNote:
      "The Gregorian correction skips a leap year in century years not divisible by 400 — 1900 was not a leap year, 2000 was. The answer says every 1,000 years. Everything around the wrong number is correct.",
    keyVerifiedAt: null,
    faultTarget: "the interval at which a leap year is skipped",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("gregorian calendar leap year 100 400 rule"),
  },
  {
    itemId: "ev2-e6-2",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — there is no settled explanation for yawning, the brain-cooling and arousal hypotheses are the live ones, and the oxygen explanation really has been tested and not supported. Accurate and honest about its own uncertainty.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("why do we yawn brain cooling hypothesis"),
  },
  {
    itemId: "ev2-e6-3",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 1,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "The periodic table has had 118 elements since the four additions were named in 2016. 112 was the count around 2010. One search, and it is the fastest item here — which is the point in a module about speed.",
    keyVerifiedAt: null,
    faultTarget: "the number of elements",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("how many elements in the periodic table"),
  },
  {
    itemId: "ev2-e6-4",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 2,
    profile: "real_source_misquoted",
    key: EXPECTED_VERDICT.real_source_misquoted,
    keyNote:
      "The 'most responsive to change' line is not in On the Origin of Species and is not Darwin's. It traces to Leon Megginson paraphrasing Darwin in a 1963 address, and drifted into quotation marks from there.",
    keyVerifiedAt: null,
    faultTarget: "the attribution and the source named",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("most responsive to change Darwin quote Megginson"),
  },
  {
    itemId: "ev2-e6-5",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — shaving does not change hair thickness or growth rate; the blunt cut tip explains the impression. Correctly stated and correctly attributed.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("does shaving make hair grow back thicker study"),
  },
  {
    itemId: "ev2-e6-6",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 3,
    profile: "contested_as_settled",
    key: EXPECTED_VERDICT.contested_as_settled,
    keyNote:
      "Head-to-head trials mostly find intermittent fasting and continuous calorie restriction produce comparable weight loss when calories are matched. Whether it has advantages beyond that is open. Presented here as decided.",
    keyVerifiedAt: null,
    faultTarget: "the framing of an open comparison as decided",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("intermittent fasting vs calorie restriction trial comparison"),
  },
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((s) => [s.itemId, s]));
