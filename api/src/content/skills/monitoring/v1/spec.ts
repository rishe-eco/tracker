/**
 * Monitoring Lab `v1` content — locale-invariant specs.
 *
 * Trivia bank (s1, s3): general-knowledge facts chosen for stability — no
 * superlatives that change over time ("most moons"), no contested measures
 * ("longest river"). Self-monitoring is topic-agnostic, so the questions
 * exist only to produce a clean correct/incorrect signal, the same design
 * choice classic calibration-literature trivia sets make.
 *
 * s1-access pairs are two DISTINCT difficulty-matched questions, not one
 * question shown twice (types.ts's header note) — assisted half first in
 * each pair below, unassisted second, per pairId.
 *
 * Probe-form composition (validate.ts's `probe-form-composition`, resolving
 * build plan §5's unnumbered "recall items for resolution, one matched
 * pair, one transcript"): 6 recall + 1 pair (2 rows) + 1 transcript per
 * form. s4 gets forms A and C; s5 gets form B — the split isn't specified in
 * the spec, so it's recorded here: this pass gives s4 two probe data points
 * against s5's one purely to land on exactly one transcript per form.
 */

import {
  LONGSET_SIZE,
  MONITORING_MODULE_KEYS,
  S2_STEPS,
  type Countermeasure,
  type Difficulty,
  type FormId,
  type MonitoringItemSpec,
  type MonitoringModuleKey,
  type PairHalf,
  type PlantedInfluenceType,
} from "../types";

export const CONTENT_VERSION = "monitoring/v1";
export const MODULE_ORDER: readonly MonitoringModuleKey[] = MONITORING_MODULE_KEYS;

// ─── Shared s6 countermeasure set (build plan §4.6) ─────────────────────────
// One shared set across every s6 item: the choice being trained is a general
// workflow habit, not a scenario-specific one, and Countermeasure.trigger
// (see types.ts) is what separates bare effort (0) from a named trigger (1)
// from a structural, attention-independent check (2).
export const COUNTERMEASURE_OPTIONS: Countermeasure[] = [
  { optionId: "structural_every5", attentionDependent: false },
  { optionId: "structural_before_send", attentionDependent: false },
  { optionId: "trigger_skim", attentionDependent: true },
  { optionId: "trigger_tired", attentionDependent: true },
  { optionId: "effort_careful", attentionDependent: true },
  { optionId: "effort_slower", attentionDependent: true },
];
/** Which attention-dependent options additionally name a trigger vs bare effort — build plan §4.6's third state, scored in `services/skills/monitoring/metrics.ts`. */
export const COUNTERMEASURE_HAS_TRIGGER: Record<string, boolean> = {
  trigger_skim: true,
  trigger_tired: true,
  effort_careful: false,
  effort_slower: false,
};

function recall(itemId: string, formId: FormId, difficulty: Difficulty, keyNote: string): MonitoringItemSpec {
  return { itemId, moduleKey: "s3-resolution", formId, difficulty, kind: "recall", keyNote, keyVerifiedAt: null };
}

function pairHalf(
  itemId: string,
  pairId: string,
  half: PairHalf,
  formId: FormId,
  difficulty: Difficulty,
  keyNote: string
): MonitoringItemSpec {
  return {
    itemId,
    moduleKey: "s1-access",
    formId,
    difficulty,
    kind: "pair",
    pairId,
    pairHalf: half,
    keyNote,
    keyVerifiedAt: null,
  };
}

function explainItem(itemId: string, difficulty: Difficulty, loadBearingStep: 1 | 2 | 3, keyNote: string): MonitoringItemSpec {
  const causalSteps = [1, 2, 3].map((n) => ({ stepId: `${itemId}-step${n}`, loadBearing: n === loadBearingStep }));
  return { itemId, moduleKey: "s2-explain", formId: "pool", difficulty, kind: "explain", causalSteps, keyNote, keyVerifiedAt: null };
}

function transcriptItem(
  itemId: string,
  moduleKey: "s4-agreement" | "s5-anchor",
  formId: FormId,
  difficulty: Difficulty,
  opts: { isCleanControl: boolean; planted?: { turnId: string; type: PlantedInfluenceType; weight: 1 | 2 }[] },
  keyNote: string
): MonitoringItemSpec {
  const turnIds = ["u1", "a1", "u2", "a2"] as const;
  const turns = turnIds.map((turnId, i) => ({ turnId, role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant" }));
  return {
    itemId,
    moduleKey,
    formId,
    difficulty,
    kind: "transcript",
    turns,
    isCleanControl: opts.isCleanControl,
    planted: opts.isCleanControl ? [] : opts.planted,
    keyNote,
    keyVerifiedAt: null,
  };
}

function longsetItem(itemId: string, difficulty: Difficulty, claimPattern: boolean[], keyNote: string): MonitoringItemSpec {
  if (claimPattern.length !== LONGSET_SIZE) throw new Error(`${itemId}: claimPattern must have ${LONGSET_SIZE} entries.`);
  const checkpoints = claimPattern.map((claimCorrect, i) => ({ checkpointId: `${itemId}-c${i + 1}`, claimCorrect }));
  return {
    itemId,
    moduleKey: "s6-complacency",
    formId: "pool",
    difficulty,
    kind: "longset",
    checkpoints,
    countermeasures: COUNTERMEASURE_OPTIONS,
    keyNote,
    keyVerifiedAt: null,
  };
}

// ─── s3-resolution: recall, pool + 3 probe forms x 6 ────────────────────────
const S3_ITEMS: MonitoringItemSpec[] = [
  recall("s3-p01", "pool", 1, "Paris has been the capital of France since the 10th century; not a fact that changes."),
  recall("s3-p02", "pool", 1, "Rome has been Italy's capital since 1871 (with a WWII-era interruption); stable present-day fact."),
  recall("s3-p03", "pool", 2, "Au is gold's IUPAC symbol, from Latin aurum; fixed by nomenclature, not opinion."),
  recall("s3-p04", "pool", 2, "Na is sodium's IUPAC symbol, from Latin natrium."),
  recall("s3-p05", "pool", 3, "Fe is iron's IUPAC symbol, from Latin ferrum."),
  recall("s3-p06", "pool", 3, "Light in vacuum: ~299,792 km/s, accepted rounded to 300,000."),
  recall("s3-a01", "A", 1, "Tokyo has been Japan's de facto capital since 1868 (Meiji Restoration)."),
  recall("s3-a02", "A", 1, "Berlin has been the reunified capital of Germany since 1990/1991."),
  recall("s3-a03", "A", 2, "Jupiter is the largest planet by both mass and volume; not subject to redefinition the way Pluto's category was."),
  recall("s3-a04", "A", 2, "Mars's iron-oxide surface gives it the 'Red Planet' name; a stable descriptive fact."),
  recall("s3-a05", "A", 3, "The Berlin Wall fell on 1989-11-09; a fixed historical date."),
  recall("s3-a06", "A", 3, "WWII ended in 1945 (V-E Day May, V-J Day September); fixed historical date."),
  recall("s3-b01", "B", 1, "Madrid has been Spain's capital since 1561 (with brief exceptions)."),
  recall("s3-b02", "B", 1, "A leap year has 366 days by the Gregorian calendar's own rule."),
  recall("s3-b03", "B", 2, "The Pacific is the largest ocean by area; not a close or shifting comparison."),
  recall("s3-b04", "B", 2, "Plants absorb CO2 for photosynthesis; core biology, not contested."),
  recall("s3-b05", "B", 3, "Oxygen's atomic number is 8, fixed by its proton count."),
  recall("s3-b06", "B", 3, "Pi to two decimal places is 3.14; a mathematical constant."),
  recall("s3-c01", "C", 1, "Earth has 7 continents under the most common model taught in en/fa schooling."),
  recall("s3-c02", "C", 1, "Water freezes at 0C at standard atmospheric pressure; the defining point of the Celsius scale."),
  recall("s3-c03", "C", 2, "The adult human body has 206 bones (infants have more, which fuse with age)."),
  recall("s3-c04", "C", 2, "Shakespeare wrote Romeo and Juliet, c. 1594-96; settled literary history."),
  recall("s3-c05", "C", 3, "Canberra, not Sydney, is Australia's capital — a common trivia trap, which is exactly why it's useful here."),
  recall("s3-c06", "C", 3, "Vatican City is the smallest sovereign state by area (~0.49 sq km)."),
];

// ─── s1-access: matched pairs, pool (6 pairs) + 3 probe forms x 1 pair ──────
const S1_ITEMS: MonitoringItemSpec[] = [
  pairHalf("s1-p01u", "s1-pair-01", "unassisted", "pool", 1, "Water boils at 100C at sea level; defining point of the Celsius scale."),
  pairHalf("s1-p01a", "s1-pair-01", "assisted", "pool", 1, "A hexagon has 6 sides by definition."),
  pairHalf("s1-p02u", "s1-pair-02", "unassisted", "pool", 1, "Spiders (order Araneae) have 8 legs, distinguishing them from 6-legged insects."),
  pairHalf("s1-p02a", "s1-pair-02", "assisted", "pool", 1, "2 is the smallest prime and the only even one."),
  pairHalf("s1-p03u", "s1-pair-03", "unassisted", "pool", 2, "The Great Barrier Reef lies off Australia's Queensland coast."),
  pairHalf("s1-p03a", "s1-pair-03", "assisted", "pool", 2, "Ottawa has been Canada's capital since 1857."),
  pairHalf("s1-p04u", "s1-pair-04", "unassisted", "pool", 2, "Association football fields 11 players per side."),
  pairHalf("s1-p04a", "s1-pair-04", "assisted", "pool", 2, "Mitochondria are the cell's primary ATP-producing organelle."),
  pairHalf("s1-p05u", "s1-pair-05", "unassisted", "pool", 3, "A typical human somatic cell has 46 chromosomes (23 pairs)."),
  pairHalf("s1-p05a", "s1-pair-05", "assisted", "pool", 3, "Jane Austen published Pride and Prejudice in 1813."),
  pairHalf("s1-p06u", "s1-pair-06", "unassisted", "pool", 3, "Table salt's chemical formula is NaCl."),
  pairHalf("s1-p06a", "s1-pair-06", "assisted", "pool", 3, "One human hand has 27 bones (8 carpals, 5 metacarpals, 14 phalanges)."),
  pairHalf("s1-a01u", "s1-pair-a", "unassisted", "A", 1, "The square root of 64 is 8."),
  pairHalf("s1-a01a", "s1-pair-a", "assisted", "A", 1, "Japan's currency is the yen (JPY), introduced 1871."),
  pairHalf("s1-b01u", "s1-pair-b", "unassisted", "B", 2, "The square root of 144 is 12."),
  pairHalf("s1-b01a", "s1-pair-b", "assisted", "B", 2, "A rainbow is conventionally described with 7 colors (Newton's division)."),
  pairHalf("s1-c01u", "s1-pair-c", "unassisted", "C", 3, "Nitrogen (~78%) is the primary gas in Earth's atmosphere by volume."),
  pairHalf("s1-c01a", "s1-pair-c", "assisted", "C", 3, "Apollo 11 landed the first humans on the Moon on 1969-07-20."),
];

// ─── s2-explain: rate -> explain -> select steps -> re-rate, pool only ──────
const S2_ITEMS: MonitoringItemSpec[] = [
  explainItem("s2-p01", 1, 3, "Bicycle hand brake: lever pulls cable, cable presses pad to rim/disc, friction converts motion to heat. Step 3 (friction->heat) is the load-bearing mechanism; steps 1-2 are just linkage."),
  explainItem("s2-p02", 1, 2, "Zipper: slider travels the two tooth rows, a wedge inside interlocks them in sequence, interlocked teeth resist sideways pull. Step 2 (the wedge interlocking) is the actual mechanism."),
  explainItem("s2-p03", 2, 3, "Flush toilet: handle lifts the flapper, tank water rushes into the bowl, the rush plus trap siphon pulls contents down the drain. Step 3 is the mechanism; 1-2 just move water."),
  explainItem("s2-p04", 2, 3, "Refrigerator: compressor pressurizes and heats refrigerant, coils release that heat outside, the liquid evaporates inside and absorbs heat from food. Step 3 is where cooling actually happens."),
  explainItem("s2-p05", 3, 3, "Rainbow: sunlight refracts entering a raindrop, reflects once off the drop's back, refracts again on exit and splits by wavelength. Step 3 is where colors actually separate."),
  explainItem("s2-p06", 3, 2, "Rearview mirror: light from behind travels to the mirror, the flat surface reflects it at an equal angle rather than scattering it, the reflection reaches the driver's eye. Step 2 (specular reflection, not scattering) is the mechanism."),
];

// ─── s4-agreement: transcripts, pool (6, >=2 clean) + probe forms A, C ──────
const S4_ITEMS: MonitoringItemSpec[] = [
  transcriptItem("s4-p01", "s4-agreement", "pool", 1, { isCleanControl: false, planted: [{ turnId: "a1", type: "flattery", weight: 1 }, { turnId: "a2", type: "agreement_reversal", weight: 2 }] }, "a1 flatters the idea unearned; a2 reverses an earlier correct caution to agree with the user's pushback."),
  transcriptItem("s4-p02", "s4-agreement", "pool", 1, { isCleanControl: true }, "Clean control: the assistant disagrees once and holds its position under pushback — nothing to mark."),
  transcriptItem("s4-p03", "s4-agreement", "pool", 2, { isCleanControl: false, planted: [{ turnId: "a1", type: "agreement_reversal", weight: 2 }, { turnId: "a2", type: "flattery", weight: 1 }] }, "a1 drops a stated risk the moment the user objects; a2 praises the user's 'good instinct' with no basis given."),
  transcriptItem("s4-p04", "s4-agreement", "pool", 2, { isCleanControl: true }, "Clean control: the assistant asks a clarifying question instead of agreeing either way."),
  transcriptItem("s4-p05", "s4-agreement", "pool", 3, { isCleanControl: false, planted: [{ turnId: "a1", type: "flattery", weight: 1 }, { turnId: "a2", type: "agreement_reversal", weight: 2 }] }, "a1 compliments the user's reasoning generically; a2 reverses a stated fact once the user disputes it, with no new evidence offered."),
  transcriptItem("s4-p06", "s4-agreement", "pool", 3, { isCleanControl: false, planted: [{ turnId: "a1", type: "agreement_reversal", weight: 2 }, { turnId: "a2", type: "flattery", weight: 1 }] }, "a1 concedes a numeric estimate immediately on pushback; a2 calls the user 'clearly on top of this'."),
  transcriptItem("s4-a01", "s4-agreement", "A", 2, { isCleanControl: false, planted: [{ turnId: "a1", type: "flattery", weight: 1 }, { turnId: "a2", type: "agreement_reversal", weight: 2 }] }, "Probe form A: same shape as s4-p01/p05 — flattery then an unearned reversal."),
  transcriptItem("s4-c01", "s4-agreement", "C", 2, { isCleanControl: true }, "Probe form C: clean control, matching s4-p02/p04's shape."),
];

// ─── s5-anchor: transcripts, pool (6, >=2 clean) + probe form B ─────────────
const S5_ITEMS: MonitoringItemSpec[] = [
  transcriptItem("s5-p01", "s5-anchor", "pool", 1, { isCleanControl: false, planted: [{ turnId: "u1", type: "anchor", weight: 2 }, { turnId: "a2", type: "smuggled_premise", weight: 1 }] }, "u1 plants an early number the rest of the exchange orbits; a2 assumes a premise the user never agreed to."),
  transcriptItem("s5-p02", "s5-anchor", "pool", 1, { isCleanControl: true }, "Clean control: no early number, no smuggled premise — a plain back-and-forth."),
  transcriptItem("s5-p03", "s5-anchor", "pool", 2, { isCleanControl: false, planted: [{ turnId: "a1", type: "smuggled_premise", weight: 2 }, { turnId: "u2", type: "anchor", weight: 1 }] }, "a1 quietly assumes a constraint that was never stated; u2 reintroduces an earlier figure as if it were settled."),
  transcriptItem("s5-p04", "s5-anchor", "pool", 2, { isCleanControl: true }, "Clean control: every figure mentioned was actually agreed to earlier in the same exchange."),
  transcriptItem("s5-p05", "s5-anchor", "pool", 3, { isCleanControl: false, planted: [{ turnId: "u1", type: "anchor", weight: 2 }, { turnId: "a2", type: "smuggled_premise", weight: 1 }] }, "u1's first-mentioned estimate anchors every later number; a2 treats an unstated scope limit as agreed."),
  transcriptItem("s5-p06", "s5-anchor", "pool", 3, { isCleanControl: false, planted: [{ turnId: "a1", type: "smuggled_premise", weight: 2 }, { turnId: "u2", type: "anchor", weight: 1 }] }, "a1 folds in an assumption about timeline the user didn't grant; u2 anchors on a round number stated once."),
  transcriptItem("s5-b01", "s5-anchor", "B", 2, { isCleanControl: false, planted: [{ turnId: "u1", type: "anchor", weight: 2 }, { turnId: "a2", type: "smuggled_premise", weight: 1 }] }, "Probe form B: same shape as s5-p01/p05 — an early anchor plus a smuggled premise."),
];

// ─── s6-complacency: longset, pool only ─────────────────────────────────────
// claimPattern: true = the claim is accurate. Index maps 1:1 to checkpointId.
const S6_ITEMS: MonitoringItemSpec[] = [
  longsetItem("s6-p01", 1, [true, true, false, true, true, false, true, true, true], "Space facts: checkpoints 3 and 6 are the seeded false claims (Great Wall visibility myth; Earth-Sun distance error)."),
  longsetItem("s6-p02", 1, [true, false, true, true, false, true, true, true, true], "Human-body facts: checkpoints 2 and 5 are seeded false (tongue map myth; 10%-of-brain myth)."),
  longsetItem("s6-p03", 2, [true, true, true, false, true, true, false, true, true], "Unit-conversion facts: checkpoints 4 and 7 are seeded false (wrong km/mile and kg/lb figures)."),
  longsetItem("s6-p04", 2, [false, true, true, true, false, true, true, true, true], "History-date facts: checkpoints 1 and 5 are seeded false (wrong year attributions)."),
  longsetItem("s6-p05", 3, [true, true, false, true, true, true, false, true, true], "Geography facts: checkpoints 3 and 7 are seeded false (wrong capital and wrong largest-desert claim)."),
  longsetItem("s6-p06", 3, [true, false, true, true, true, false, true, true, true], "Everyday-science facts: checkpoints 2 and 6 are seeded false (glass-is-liquid myth; lightning-never-strikes-twice myth)."),
];

export const ITEM_SPECS: MonitoringItemSpec[] = [...S1_ITEMS, ...S2_ITEMS, ...S3_ITEMS, ...S4_ITEMS, ...S5_ITEMS, ...S6_ITEMS];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((i) => [i.itemId, i]));

// Sanity check against S2_STEPS at import time — a constant drift here would
// otherwise only surface as a cryptic validator error far from the cause.
if (S2_ITEMS.some((i) => i.causalSteps?.length !== S2_STEPS)) {
  throw new Error("monitoring/v1/spec.ts: an s2-explain item's causalSteps.length does not match S2_STEPS.");
}
