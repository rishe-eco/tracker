/**
 * Reflect `v1`: the locale-invariant spec.
 *
 * The lexicon's four family ids only; the words live in `surface.<locale>.ts`.
 * See `../types.ts` for why the split exists.
 */

import type { FamilySpec, ReflectSpec } from "../types";

export const CONTENT_VERSION = "reflect/v1";

/**
 * The interpretation lexicon's families (spec §4.6): absolutes, mind-reading,
 * labels, and verdicts dressed as events. Every locale realizes all four.
 */
export const FAMILY_SPECS: FamilySpec[] = [
  { id: "absolute" },
  { id: "mind_reading" },
  { id: "label" },
  { id: "verdict" },
];

export const SPEC: ReflectSpec = {
  contentVersion: CONTENT_VERSION,
  families: FAMILY_SPECS,
};
