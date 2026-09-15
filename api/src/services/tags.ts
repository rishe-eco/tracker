/**
 * Time Themes: the shared tag vocabulary's fixed colour palette.
 *
 * A fixed set of keys (not free hex) keeps timeline bands legible in both
 * light and dark, and lets `createTag`/`recolorTag` reject a stray value
 * cheaply. Store the key, not the hex, so a future palette re-tune is one
 * place — the client's palette module (`client/app/lib/tagPalette.ts`) must
 * mirror this exact set of keys.
 */
export const TAG_PALETTE = ["indigo", "slate", "amber", "green", "plum", "teal", "rose"] as const;

export type TagColor = (typeof TAG_PALETTE)[number];

export function isValidTagColor(color: string): boolean {
  return (TAG_PALETTE as readonly string[]).includes(color);
}
