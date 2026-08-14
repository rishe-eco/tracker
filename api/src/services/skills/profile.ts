/**
 * Skill profile lookup.
 *
 * Its own module because both the session runner and the calendar planner need
 * it — importing it from either one into the other would make a cycle.
 */

import type { PrismaClient } from "@prisma/client";
import { CURRENT_VERSION, ENROLLABLE_EVIDENCE_VERSIONS } from "../../content/skills/versions";
import { EVIDENCE_MODULE_KEYS, type Locale, type SkillKey } from "../../content/skills/types";
import { CLARITY_MODULE_KEYS } from "../../content/skills/clarity/types";

const DEFAULT_ORDER: Record<SkillKey, readonly string[]> = {
  evidence: EVIDENCE_MODULE_KEYS,
  clarity: CLARITY_MODULE_KEYS,
};

/**
 * Look the profile up, creating it on first contact.
 *
 * The create races. The Evidence Lab page asks for modules and progress in
 * parallel and both go through here, so on a brand-new account both find
 * nothing, both insert, and the loser hits the `(userId, skillKey)` unique
 * constraint — one request fails and the page never finishes loading. It only
 * ever happened once per account, and a reload "fixed" it, which is what made it
 * easy to miss.
 *
 * Create-then-recover rather than `upsert`: Prisma's upsert still reads before
 * it writes on this provider, so it narrows the window without closing it. The
 * unique constraint is the only thing that actually arbitrates, so the fix is to
 * let it, and treat losing as the ordinary outcome it is.
 *
 * **`locale` records the language of enrollment and nothing reads it back.**
 * What language to *serve* comes from the request (`graphql/requestLocale.ts`),
 * because the app someone is looking at is the authority on that and a stored
 * copy is free to disagree with it. Every session function used to read this
 * column, no caller ever set it to anything but `"en"`, and the consequence was
 * a complete Persian content pack that could not be reached.
 */
export async function ensureProfile(
  prisma: PrismaClient,
  userId: string,
  locale: Locale = "en",
  skillKey: SkillKey = "evidence"
) {
  const existing = await prisma.skillProfile.findUnique({
    where: { userId_skillKey: { userId, skillKey } },
  });
  if (existing) return maybeUpgrade(prisma, existing);

  try {
    return await prisma.skillProfile.create({
      data: {
        userId,
        skillKey,
        contentVersion: CURRENT_VERSION[skillKey],
        locale,
        recommendedOrder: JSON.stringify(DEFAULT_ORDER[skillKey]),
      },
    });
  } catch (e: any) {
    if (e?.code !== "P2002") throw e;
    // Someone else created it between our read and our write. That is a
    // success, not an error — re-read theirs.
    const created = await prisma.skillProfile.findUnique({
      where: { userId_skillKey: { userId, skillKey } },
    });
    if (!created) throw e;
    return maybeUpgrade(prisma, created);
  }
}

/**
 * Move a learner onto the current content version when — and only when — there
 * is nothing for the change to invalidate.
 *
 * The pin exists so a content bump can't silently change what a learner's
 * scores mean, and that reasoning is entirely about the baseline: pre/post
 * comparison requires both sides to come from the same instrument. A learner
 * with no baseline has no comparison to break, so keeping them on a superseded
 * pack buys nothing and costs them the whole reason it was superseded.
 *
 * Past attempts are unaffected either way: `SkillAttempt.contentVersion` is
 * recorded per row and resolved against it, so an old attempt still finds its
 * item after the profile moves.
 */
async function maybeUpgrade<
  T extends {
    id: string;
    skillKey: string;
    contentVersion: string;
    assessmentCompletedAt: Date | null;
  }
>(prisma: PrismaClient, profile: T): Promise<T> {
  // Clarity has one content version and no superseded one to move off. The rule
  // is written for Evidence, where v1 was replaced for audience reasons.
  if (profile.skillKey !== "evidence") return profile;

  const current = CURRENT_VERSION.evidence;
  if (profile.contentVersion === current) return profile;
  if (!ENROLLABLE_EVIDENCE_VERSIONS.includes(current)) return profile;
  if (profile.assessmentCompletedAt) return profile;

  const updated = await prisma.skillProfile.update({
    where: { id: profile.id },
    data: { contentVersion: current },
  });
  return updated as unknown as T;
}
