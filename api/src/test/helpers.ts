import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { DEFAULT_LOCALE, type RequestLocale } from "../graphql/requestLocale";

// Shared Prisma client for all tests — points to test.db via DATABASE_URL env var
export const prisma = new PrismaClient();

/**
 * Delete all rows in dependency order (children before parents).
 *
 * Runs as a single transaction: `$transaction` with an array executes the
 * operations in order, so the dependency ordering below still holds, but the
 * whole thing commits once instead of 21 times. As 21 separate writes this
 * took ~2.4s per test against SQLite; batched it is ~35ms.
 */
export async function clearDb() {
  await prisma.$transaction([
    prisma.note.deleteMany(),
    prisma.action.deleteMany(),
    prisma.dayState.deleteMany(),
    prisma.intervalStep.deleteMany(),
    prisma.interval.deleteMany(),
    prisma.routineStep.deleteMany(),
    prisma.routine.deleteMany(),
    prisma.project.deleteMany(),
    // Goals self-reference via parentGoalId — clear children first by nulling the FK
    prisma.goal.updateMany({ data: { parentGoalId: null, parentMilestoneId: null } }),
    prisma.milestone.deleteMany(),
    prisma.goal.deleteMany(),
    // Journals (entries and access before journals, journals before users)
    prisma.journalEntry.deleteMany(),
    prisma.journalAccess.deleteMany(),
    prisma.journal.deleteMany(),
    prisma.apiToken.deleteMany(),
    // Skills: check events cascade from attempts, and attempts reference probes,
    // so delete leaves first.
    prisma.skillCheckEvent.deleteMany(),
    prisma.skillAttempt.deleteMany(),
    prisma.skillProbe.deleteMany(),
    prisma.skillModuleProgress.deleteMany(),
    prisma.skillProfile.deleteMany(),
    // Feelings & Needs: entries hang off sittings, so leaves first here too.
    prisma.loopEntry.deleteMany(),
    prisma.loopSitting.deleteMany(),
    prisma.frameCompletion.deleteMany(),
    prisma.loopState.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/** Create a user with a low-cost bcrypt hash (rounds=4 for speed). */
export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
  discoverableByEmail?: boolean;
}) {
  const rawPassword = overrides?.password ?? "password123";
  const hashed = await bcrypt.hash(rawPassword, 4);
  return prisma.user.create({
    data: {
      email: overrides?.email ?? "test@example.com",
      password: hashed,
      name: overrides?.name ?? "Test User",
      ...(overrides?.discoverableByEmail !== undefined && {
        discoverableByEmail: overrides.discoverableByEmail,
      }),
    },
  });
}

/**
 * Build a resolver context object for the given user.
 *
 * `locale` defaults to English so the existing suite is untouched; pass "fa" to
 * exercise the Persian content path. In the running server this comes off
 * `Accept-Language` (`graphql/requestLocale.ts`).
 */
export function makeCtx(user: { id: string }, locale: RequestLocale = DEFAULT_LOCALE) {
  return { user, prisma, locale };
}
