/**
 * Reflect's content read: the practice locale's pack, the palettes, the limits.
 * Never the lexicon (§6.5). Served in `DIALS.practiceLocale` whatever the
 * request's language (PD-7, D-16).
 */

import type { PrismaClient } from "@prisma/client";
import { DIALS, getReflectPack } from "../../content/reflect";
import { getFeelingsNeedsPack } from "../../content/feelings-needs";
import { pinnedVersions } from "./state";
import { selectPalettes } from "./palettes";

export async function getContent(prisma: PrismaClient, userId: string) {
  const v = await pinnedVersions(prisma, userId);
  const locale = DIALS.practiceLocale;
  const pack = getReflectPack(v.contentVersion, locale);
  const fn = getFeelingsNeedsPack(v.fnContentVersion, locale);
  const { feelings, needs } = selectPalettes(fn);
  const { metOptions, ...feelingsCopy } = pack.feelings;
  return {
    locale,
    reviewStatus: pack.reviewStatus,
    prompts: {
      story: pack.story,
      feelings: {
        ...feelingsCopy,
        metOptions: { met: metOptions.met, unmet: metOptions.unmet, notSure: metOptions.not_sure },
      },
      reality: pack.reality,
      close: pack.close,
      interpretation: pack.interpretation,
    },
    feelings,
    needs,
    otherLabel: fn.loop.nameOther,
    limits: {
      ...DIALS.limits,
      storySoftLine: DIALS.storySoftLine,
      momentsCap: DIALS.momentsCap,
      readingsCap: DIALS.readingsCap,
    },
  };
}

/** For the home: the practice locale and its pack's review status. */
export async function getServedPack(prisma: PrismaClient, userId: string) {
  const v = await pinnedVersions(prisma, userId);
  const pack = getReflectPack(v.contentVersion, DIALS.practiceLocale);
  return { practiceLocale: pack.locale, reviewStatus: pack.reviewStatus };
}
