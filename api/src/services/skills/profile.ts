/**
 * Skill profile lookup.
 *
 * Its own module because both the session runner and the calendar planner need
 * it — importing it from either one into the other would make a cycle.
 */

import type { PrismaClient } from "@prisma/client";
import { CURRENT_VERSION } from "../../content/skills";
import type { Locale } from "../../content/skills/types";
import { MODULE_ORDER } from "../../content/skills/evidence/v1";

export async function ensureProfile(
  prisma: PrismaClient,
  userId: string,
  locale: Locale = "en"
) {
  const existing = await prisma.skillProfile.findUnique({
    where: { userId_skillKey: { userId, skillKey: "evidence" } },
  });
  if (existing) return existing;

  return prisma.skillProfile.create({
    data: {
      userId,
      skillKey: "evidence",
      contentVersion: CURRENT_VERSION.evidence,
      locale,
      recommendedOrder: JSON.stringify(MODULE_ORDER),
    },
  });
}
