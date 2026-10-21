/**
 * Reflect: per-user state.
 *
 * `ReflectState` pins the content versions a person practices on (Reflect's
 * own pack and Feelings & Needs', which Reflect borrows its palettes from) and
 * holds the catch cooldown dates (B3). It is written on the first
 * `startReflectEntry` only; reads before then serve the current versions
 * without writing (B2 decision 2).
 */

import type { PrismaClient } from "@prisma/client";
import { CURRENT_VERSION } from "../../content/reflect";
import { CURRENT_VERSION as FN_CURRENT_VERSION } from "../../content/feelings-needs";
import { withUserLock } from "../userLock";

/**
 * Look the state up, creating it on first start. Under a per-user lock, and
 * create-then-recover on the `userId` unique key as `ensureLoopState` does, so
 * a lost race re-reads the winner's row.
 */
export function ensureReflectState(prisma: PrismaClient, userId: string) {
  return withUserLock("rfl-state:" + userId, async () => {
    const existing = await prisma.reflectState.findUnique({ where: { userId } });
    if (existing) return existing;
    try {
      return await prisma.reflectState.create({
        data: { userId, contentVersion: CURRENT_VERSION, fnContentVersion: FN_CURRENT_VERSION },
      });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
      const created = await prisma.reflectState.findUnique({ where: { userId } });
      if (!created) throw e;
      return created;
    }
  });
}

/** The versions to serve: the pinned ones, or the current ones for a person who has not started. Never writes. */
export async function pinnedVersions(prisma: PrismaClient, userId: string) {
  const state = await prisma.reflectState.findUnique({ where: { userId } });
  return {
    contentVersion: state?.contentVersion ?? CURRENT_VERSION,
    fnContentVersion: state?.fnContentVersion ?? FN_CURRENT_VERSION,
  };
}
