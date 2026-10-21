/**
 * Reflect's palette selection (PD-8, D-6).
 *
 * A pure function of the pinned Feelings & Needs pack: the first two `early`
 * feelings, the first four `broaden` feelings, and the first five needs.
 * Static, not rotated, so nothing is counted to choose them (Feelings & Needs'
 * own selection is keyed on its sitting count, which AC-26 forbids reading).
 * It leans to the broaden tier because a Reflect scene is a hard one.
 */

import type { FeelingsNeedsPack } from "../../content/feelings-needs";

export const PALETTE_EARLY = 2;
export const PALETTE_BROADEN = 4;
export const PALETTE_NEEDS = 5;

export type PaletteWord = { id: string; label: string };

export function selectPalettes(pack: FeelingsNeedsPack): { feelings: PaletteWord[]; needs: PaletteWord[] } {
  const word = ({ id, label }: { id: string; label: string }): PaletteWord => ({ id, label });
  const early = pack.feelings.filter((f) => f.tier === "early").slice(0, PALETTE_EARLY);
  const broaden = pack.feelings.filter((f) => f.tier === "broaden").slice(0, PALETTE_BROADEN);
  return {
    feelings: [...early, ...broaden].map(word),
    needs: pack.needs.slice(0, PALETTE_NEEDS).map(word),
  };
}
