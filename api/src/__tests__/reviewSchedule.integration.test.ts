import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, prisma } from "../test/helpers";
import { updateDecompositionModuleProgress } from "../services/skills/decomposition/decompositionSession";
import { updateVerificationModuleProgress } from "../services/skills/verification/verificationSession";
import { updateDelegationModuleProgress } from "../services/skills/delegation/delegationSession";
import { updateMonitoringModuleProgress } from "../services/skills/monitoring/monitoringSession";

/**
 * The review schedule, for the four labs built after `scheduleOnReviewSubmitted`
 * was written. Evidence and Clarity are covered in `skills.integration.test.ts`
 * and `claritySession.integration.test.ts`.
 *
 * The defect these lock down: nothing anywhere wrote `reviewIntervalIndex`, so
 * `scheduleOnMastery` always read the Prisma default of 0 and every review in
 * every lab rescheduled at the first rung of a 1/3/7/21/60 ladder. A failed
 * review also never wrote `currentStep`, so it never routed back to step 5
 * (diagnose and fix) the way `onReviewFailed` says it should.
 *
 * These call `update*ModuleProgress` directly with a seeded progress row rather
 * than driving a whole scored attempt through each lab's submit path: the unit
 * under test is the scheduling branch, and four full item walkthroughs would
 * test four content packs instead.
 */

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const MASTERED_AT = new Date("2026-07-01T00:00:00.000Z");
const OLD_DUE = new Date("2026-07-02T00:00:00.000Z");

async function seedMastered(userId: string, skillKey: any, moduleKey: string, reviewIntervalIndex: number) {
  await prisma.skillModuleProgress.create({
    data: {
      userId,
      skillKey,
      moduleKey,
      state: "mastered",
      masteredAt: MASTERED_AT,
      reviewIntervalIndex,
      nextReviewAt: OLD_DUE,
    },
  });
}

const read = (userId: string, skillKey: any, moduleKey: string) =>
  prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey, moduleKey } },
  });

/** Every lab's `update*ModuleProgress`, reduced to the shape this file needs. */
const LABS = [
  {
    name: "decomposition",
    skillKey: "decomposition",
    moduleKey: "d1-frame",
    update: (userId: string, submitted: any) =>
      updateDecompositionModuleProgress(prisma, userId, "d1-frame" as any, 0, submitted),
  },
  {
    name: "verification",
    skillKey: "verification",
    moduleKey: "v1-oracle",
    update: (userId: string, submitted: any) =>
      updateVerificationModuleProgress(prisma, userId, "v1-oracle" as any, 0, submitted),
  },
  {
    name: "delegation",
    skillKey: "delegation",
    moduleKey: "g4-split",
    update: (userId: string, submitted: any) =>
      updateDelegationModuleProgress(prisma, userId, "g4-split" as any, 0, submitted),
  },
  {
    name: "monitoring",
    skillKey: "monitoring",
    moduleKey: "s2-explain",
    update: (userId: string, submitted: any) =>
      updateMonitoringModuleProgress(prisma, userId, "s2-explain" as any, 0, submitted),
  },
] as const;

describe.each(LABS)("$name — a review submission moves the schedule", (lab) => {
  it("advances the interval ladder and resumes at the review step on a pass", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, lab.skillKey, lab.moduleKey, 1);

    await lab.update(user.id, { mode: "review", passed: true });

    const progress = await read(user.id, lab.skillKey, lab.moduleKey);
    expect(progress?.reviewIntervalIndex).toBe(2);
    expect(progress?.currentStep).toBe(7);
    expect(progress?.nextReviewAt!.getTime()).toBeGreaterThan(OLD_DUE.getTime());
  });

  it("resets the interval and routes back to diagnose (step 5) on a fail", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, lab.skillKey, lab.moduleKey, 3);

    await lab.update(user.id, { mode: "review", passed: false });

    const progress = await read(user.id, lab.skillKey, lab.moduleKey);
    expect(progress?.reviewIntervalIndex).toBe(0);
    expect(progress?.currentStep).toBe(5);
  });

  it("holds at the top rung rather than running off the end of the ladder", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, lab.skillKey, lab.moduleKey, 4);

    await lab.update(user.id, { mode: "review", passed: true });

    const progress = await read(user.id, lab.skillKey, lab.moduleKey);
    expect(progress?.reviewIntervalIndex).toBe(4);
  });

  it("leaves the schedule alone when the submission was not a review", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, lab.skillKey, lab.moduleKey, 2);

    await lab.update(user.id, { mode: "module", passed: true });

    const progress = await read(user.id, lab.skillKey, lab.moduleKey);
    // Not a review, and no attempts exist, so the module is no longer mastered
    // and nothing reschedules it. The stored index must survive untouched —
    // advancing it here would let ordinary practice inflate the interval.
    expect(progress?.reviewIntervalIndex).toBe(2);
    expect(progress?.nextReviewAt!.getTime()).toBe(OLD_DUE.getTime());
  });
});

/**
 * G1/G6 in Delegation and S1/S3 in Monitoring are scored over a window and
 * never carry a per-attempt level, so there is no per-attempt pass/fail to
 * read. `passed: null` says so, and the schedule falls back to whether the
 * module still holds — which, with no attempts on record, it does not.
 */
describe("window-level modules fall back to the module's own verdict", () => {
  it("delegation g1-own treats a null verdict as a failed review", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, "delegation", "g1-own", 3);

    await updateDelegationModuleProgress(prisma, user.id, "g1-own" as any, 0, { mode: "review", passed: null });

    const progress = await read(user.id, "delegation", "g1-own");
    expect(progress?.reviewIntervalIndex).toBe(0);
    expect(progress?.currentStep).toBe(5);
  });

  it("monitoring s3-resolution treats a null verdict as a failed review", async () => {
    const user = await createTestUser();
    await seedMastered(user.id, "monitoring", "s3-resolution", 3);

    await updateMonitoringModuleProgress(prisma, user.id, "s3-resolution" as any, 0, { mode: "review", passed: null });

    const progress = await read(user.id, "monitoring", "s3-resolution");
    expect(progress?.reviewIntervalIndex).toBe(0);
    expect(progress?.currentStep).toBe(5);
  });
});
