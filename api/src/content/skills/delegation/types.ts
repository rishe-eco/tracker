/**
 * Delegation Lab content types.
 *
 * Same spec/surface split as the other four tools (00-skills-engine.md §5.1).
 * The instrument is a judge-advisor system (JAS): an authored truth, the
 * learner's own estimate, an authored advice value, and a revision. The
 * derived measure — weight of advice (WOA) — is computed entirely offline
 * from these authored numbers; nothing here ever needs a model or a network
 * call (05-delegation-lab.md §1, §2; build plan §0).
 *
 * `adviceQuality` is deliberately NOT a field here — it is derived at scoring
 * time as `|advice - truth|` against the learner's own `|initial - truth|`,
 * which is what makes the instrument self-normalising against each learner's
 * competence (build plan §3 Phase 2). What IS authored, and what the
 * `advice-balance` validator rule checks, is a locale- and learner-independent
 * proxy: whether `advice` sits closer to `truth` than the naive midpoint of
 * `plausibleRange` does. The build plan states the balance rule ("advice
 * closer to truth than a naive midpoint on 50% ± 1 item...") without pinning
 * what "naive midpoint" means; `plausibleRange`'s own midpoint is the only
 * per-item quantity available to define it against, so `isAdviceGood` below
 * is that resolution, recorded rather than silently assumed.
 *
 * Two item kinds — `split` and `sequence` — have no single authored
 * truth/advice/cueDirection the way `estimate`/`cue`/`stakes` do: a split
 * item's "correctness" is which piece the key marks delegable, and a
 * sequence's three rounds each carry their own truth/advice. The build
 * plan's illustrative `DelegationItemSpec` sample marks every field
 * non-optional, but forcing a dummy numeric truth onto a split item (which
 * has none) would be an authored value with nowhere real to point — so
 * `truth`/`unit`/`plausibleRange`/`advice` are `null` and `cueDirection` is
 * `"none"` for those two kinds, and the validator's cue-balance and
 * advice-balance rules are scoped to the modules where the fields are
 * meaningful (`g1-own`, `g2-instance`, `g3-weigh`, `g5-stakes`).
 */

import type { Difficulty, FormId, Locale } from "../types";

// Re-exported so the delegation pack has one import surface.
export type { Difficulty, FormId, Locale };

export const DELEGATION_MODULE_KEYS = [
  "g1-own",
  "g2-instance",
  "g3-weigh",
  "g4-split",
  "g5-stakes",
  "g6-drift",
] as const;
export type DelegationModuleKey = (typeof DELEGATION_MODULE_KEYS)[number];

/** The six rubric criteria, one per module. */
export const DELEGATION_CRITERIA = ["G1", "G2", "G3", "G4", "G5", "G6"] as const;
export type DelegationCriterionId = (typeof DELEGATION_CRITERIA)[number];

export type RubricLevel = 0 | 1 | 2;

/**
 * How a criterion gets its level. Every criterion here resolves against the
 * authored key or arithmetic on authored/committed values — "judge" never
 * appears anywhere in this tool (spec §1, §4, §12: no model in the scored
 * path, full stop).
 */
export type DelegationScoringSource = "computed" | "key" | "key+computed";

export type DelegationRubricCriterion = {
  id: DelegationCriterionId;
  moduleKey: DelegationModuleKey;
  scoredBy: DelegationScoringSource;
  /** Short label, localised at render time via i18n, not here. */
  labelKey: string;
  /** Decision rules per level, transcribed from the spec's rubric table (§4). */
  levels: Record<RubricLevel, string>;
};

/** D-24: three rounds, measuring the documented post-error drop and deferring the undocumented recovery pattern. A content constant, never a literal. */
export const G6_ROUNDS = 3;

export type ItemKind = "estimate" | "cue" | "split" | "stakes" | "sequence";

export type CueDirection = "trust" | "keep" | "none";

export type CueOption = {
  cueId: string;
  kind: "category" | "instance" | "none";
  /** Whether this option, if selected, bears on which of the two judges (learner vs advisor) is more likely right on this instance. */
  bearsOnRelative: boolean;
};

export type SplitPiece = {
  pieceId: string;
  keyDisposition: "give" | "keep" | "either";
};

export type SequenceRound = {
  advice: number;
  truth: number;
  isSeededError: boolean;
};

export type DelegationItemSpec = {
  itemId: string;
  moduleKey: DelegationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  kind: ItemKind;
  /** The quantity's truth. Required for "estimate" | "cue" | "stakes"; null for "split" and "sequence" (each round of a sequence carries its own). */
  truth: number | null;
  unit: string | null;
  /** An estimate outside this range is void, not wrong. Null where there is no single estimate (split, sequence). */
  plausibleRange: [number, number] | null;
  advice: number | null;
  /**
   * Required (and meaningful) for "estimate" | "cue" | "stakes" — it is what
   * the item's WOA benchmark (build plan §4.2) is keyed against. "none" on
   * "split" and "sequence" items, which are scored on a different mechanism
   * entirely (which piece was delegated; the round-3/round-1 drop ratio).
   */
  cueDirection: CueDirection;
  /** "cue" items only: ≥1 category distractor, ≥1 instance option, exactly one "none" option. */
  cueOptions?: CueOption[];
  /** "split" items only. */
  splitPieces?: SplitPiece[];
  /** "stakes" items only: both halves of a pair carry the same id; neither scores alone. */
  stakesPairId?: string;
  stakesRole?: "low" | "high";
  /** "sequence" items only: exactly `G6_ROUNDS` entries, exactly one `isSeededError`, on round 2 (index 1). */
  sequenceRounds?: SequenceRound[];
  /** The reviewer's note — why this is the key, and what a re-verifier checks against. */
  keyNote: string;
  /** `null` blocks probe use (build plan §5); practice is unaffected. */
  keyVerifiedAt: string | null;
};

/** `|advice - truth| < |midpoint(plausibleRange) - truth|` — see this file's header note. Undefined (returns null) where there is no single truth/advice. */
export function isAdviceGood(item: Pick<DelegationItemSpec, "truth" | "advice" | "plausibleRange">): boolean | null {
  if (item.truth === null || item.advice === null || item.plausibleRange === null) return null;
  const midpoint = (item.plausibleRange[0] + item.plausibleRange[1]) / 2;
  return Math.abs(item.advice - item.truth) < Math.abs(midpoint - item.truth);
}

/** Modules where cueDirection/advice quality are meaningful content — used to scope the cue-balance and advice-balance validator rules. */
export const CUE_SCOPED_MODULES: readonly DelegationModuleKey[] = ["g1-own", "g2-instance", "g3-weigh", "g5-stakes"];

export type DelegationItemSurface = {
  itemId: string;
  /** The scenario/question prompt. For "split" items, the task being delegated. */
  ask: string;
  /** Localised unit label, e.g. "km", "people" — display only. */
  unitLabel?: string;
  /** "cue" items only: cueId -> display label. */
  cueLabels?: Record<string, string>;
  /** "split" items only: pieceId -> display label. */
  pieceLabels?: Record<string, string>;
  /** "sequence" items only: one flavour line per round, index-aligned with sequenceRounds. */
  roundContext?: string[];
};

/** g2-instance only: the perishable-costume capability list (spec §1, §10) — authored once, dated, shown as the thing being refuted rather than warned against. */
export type CapabilityClaim = { claim: string; stillTrue: boolean };

export type DelegationModuleSurface = {
  moduleKey: DelegationModuleKey;
  title: string;
  /** Step 1. One idea, ≤2 min, ≤250 words. */
  concept: string;
  /** Step 2. A worked contrast. */
  model: string;
  /** g2-instance only. */
  capabilityList?: CapabilityClaim[];
  capabilityListDate?: string;
};

export type DelegationPack = {
  skillKey: "delegation";
  contentVersion: string;
  rubricVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  modules: DelegationModuleSurface[];
  items: (DelegationItemSpec & { surface: DelegationItemSurface })[];
};

/**
 * What the client may see before `estimate_committed`: never `advice`, never
 * `truth`, never the split key, never the sequence's per-round advice/truth
 * beyond what has already been committed. Build plan §3's ordering rule —
 * "the advice is absent from the served payload until `estimate_committed`
 * is stamped" — is this type's entire reason to exist.
 */
export type PublicDelegationItem = {
  itemId: string;
  moduleKey: DelegationModuleKey;
  difficulty: Difficulty;
  kind: ItemKind;
  ask: string;
  unitLabel: string | null;
  plausibleRange: [number, number] | null;
  cueOptions: { cueId: string; label: string }[] | null;
  splitPieces: { pieceId: string; label: string }[] | null;
  stakesPairId: string | null;
  roundIndex: number | null;
  totalRounds: number | null;
};

export function toPublicDelegationItem(
  item: DelegationItemSpec & { surface: DelegationItemSurface },
  opts: { roundIndex?: number } = {}
): PublicDelegationItem {
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    difficulty: item.difficulty,
    kind: item.kind,
    ask: item.surface.ask,
    unitLabel: item.surface.unitLabel ?? null,
    plausibleRange: item.plausibleRange,
    cueOptions: item.cueOptions?.map((c) => ({ cueId: c.cueId, label: item.surface.cueLabels?.[c.cueId] ?? c.cueId })) ?? null,
    splitPieces: item.splitPieces?.map((p) => ({ pieceId: p.pieceId, label: item.surface.pieceLabels?.[p.pieceId] ?? p.pieceId })) ?? null,
    stakesPairId: item.stakesPairId ?? null,
    roundIndex: opts.roundIndex ?? (item.kind === "sequence" ? 0 : null),
    totalRounds: item.kind === "sequence" ? G6_ROUNDS : null,
  };
}
