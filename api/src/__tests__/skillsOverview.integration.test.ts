import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, prisma } from "../test/helpers";
import { getSkillsOverview, SKILL_ORDER } from "../services/skills/overview";
import { MODULE_KEYS_BY_SKILL } from "../services/skills/probes";

/**
 * The AI Training Lab hub's one query.
 *
 * What matters here is agreement, not arithmetic: the hub reads the same rows
 * six lab pages read, and a hub that disagreed with a lab page about what is
 * mastered or what is due would be worse than a hub showing nothing
 * (07-training-lab-hub.md §6a).
 */

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const NOW = new Date("2026-08-25T12:00:00.000Z");
const PAST = new Date("2026-08-20T00:00:00.000Z");
const FUTURE = new Date("2026-09-20T00:00:00.000Z");

const overviewFor = async (userId: string, skillKey: string, now: Date = NOW) => {
  const all = await getSkillsOverview(prisma, userId, "en", now);
  return all.find((o) => o.skillKey === skillKey)!;
};

describe("skillsOverview — shape", () => {
  it("returns all six skills in canonical order for an untouched account", async () => {
    const user = await createTestUser();

    const overview = await getSkillsOverview(prisma, user.id, "en", NOW);

    expect(overview.map((o) => o.skillKey)).toEqual(SKILL_ORDER);
    for (const o of overview) {
      expect(o.moduleCount).toBe(MODULE_KEYS_BY_SKILL[o.skillKey].length);
      expect(o.masteredCount).toBe(0);
      expect(o.inProgressCount).toBe(0);
      expect(o.totalAttempts).toBe(0);
      expect(o.lastAttemptAt).toBeNull();
      expect(o.hasBaseline).toBe(false);
      expect(o.assessmentSkipped).toBe(false);
      expect(o.dueModules).toEqual([]);
      expect(o.dueProbe).toBeNull();
    }
  });

  it("does not enrol anyone by being looked at", async () => {
    const user = await createTestUser();

    await getSkillsOverview(prisma, user.id, "en", NOW);

    // Every `get<Skill>Modules` goes through `ensureProfile`, which inserts on
    // first contact. The hub must not: visiting an index is not starting six
    // labs, and six phantom profiles would make `hasBaseline` meaningful for
    // labs the learner has never opened.
    expect(await prisma.skillProfile.count({ where: { userId: user.id } })).toBe(0);
  });

  it("carries module titles in the requested locale", async () => {
    const user = await createTestUser();
    await prisma.skillModuleProgress.create({
      data: { userId: user.id, skillKey: "monitoring", moduleKey: "s2-explain", state: "mastered", nextReviewAt: PAST },
    });

    const en = await overviewFor(user.id, "monitoring");
    const fa = (await getSkillsOverview(prisma, user.id, "fa", NOW)).find((o) => o.skillKey === "monitoring")!;

    expect(en.dueModules[0].moduleKey).toBe("s2-explain");
    expect(fa.dueModules[0].moduleKey).toBe("s2-explain");
    expect(fa.dueModules[0].title).not.toBe(en.dueModules[0].title);
    expect(fa.reviewStatus).toBe("draft");
    expect(en.reviewStatus).toBe("reviewed");
  });
});

describe("skillsOverview — counts", () => {
  it("counts mastered and tested-out together, and in-progress separately", async () => {
    const user = await createTestUser();
    const [a, b, c] = MODULE_KEYS_BY_SKILL.clarity;
    await prisma.skillModuleProgress.createMany({
      data: [
        { userId: user.id, skillKey: "clarity", moduleKey: a, state: "mastered" },
        { userId: user.id, skillKey: "clarity", moduleKey: b, state: "tested_out" },
        { userId: user.id, skillKey: "clarity", moduleKey: c, state: "in_progress" },
      ],
    });

    const clarity = await overviewFor(user.id, "clarity");
    expect(clarity.masteredCount).toBe(2);
    expect(clarity.inProgressCount).toBe(1);
  });

  it("moves a due module out of mastered and into in-progress", async () => {
    const user = await createTestUser();
    const [a, b] = MODULE_KEYS_BY_SKILL.delegation;
    await prisma.skillModuleProgress.createMany({
      data: [
        { userId: user.id, skillKey: "delegation", moduleKey: a, state: "mastered", nextReviewAt: PAST },
        { userId: user.id, skillKey: "delegation", moduleKey: b, state: "mastered", nextReviewAt: FUTURE },
      ],
    });

    const delegation = await overviewFor(user.id, "delegation");
    // The stored state still says `mastered` for both — due-ness is derived.
    expect(delegation.dueModules.map((m) => m.moduleKey)).toEqual([a]);
    expect(delegation.masteredCount).toBe(1);
    expect(delegation.inProgressCount).toBe(1);
  });

  it("keeps each skill's rows to itself", async () => {
    const user = await createTestUser();
    await prisma.skillModuleProgress.createMany({
      data: [
        { userId: user.id, skillKey: "evidence", moduleKey: MODULE_KEYS_BY_SKILL.evidence[0], state: "mastered" },
        { userId: user.id, skillKey: "verification", moduleKey: MODULE_KEYS_BY_SKILL.verification[0], state: "mastered" },
      ],
    });

    expect((await overviewFor(user.id, "evidence")).masteredCount).toBe(1);
    expect((await overviewFor(user.id, "verification")).masteredCount).toBe(1);
    expect((await overviewFor(user.id, "clarity")).masteredCount).toBe(0);
  });

  it("reports attempt count and the last attempt per skill", async () => {
    const user = await createTestUser();
    const later = new Date("2026-08-24T09:00:00.000Z");
    await prisma.skillAttempt.createMany({
      data: [
        { userId: user.id, skillKey: "decomposition", itemId: "x1", mode: "module", scores: "{}", scoredBy: "rule", contentVersion: "decomposition/v1", createdAt: PAST },
        { userId: user.id, skillKey: "decomposition", itemId: "x2", mode: "module", scores: "{}", scoredBy: "rule", contentVersion: "decomposition/v1", createdAt: later },
        { userId: user.id, skillKey: "clarity", itemId: "y1", mode: "module", scores: "{}", scoredBy: "rule", contentVersion: "clarity/v1", createdAt: PAST },
      ],
    });

    const decomposition = await overviewFor(user.id, "decomposition");
    expect(decomposition.totalAttempts).toBe(2);
    expect(decomposition.lastAttemptAt?.toISOString()).toBe(later.toISOString());
    expect((await overviewFor(user.id, "clarity")).totalAttempts).toBe(1);
    expect((await overviewFor(user.id, "monitoring")).totalAttempts).toBe(0);
  });

  it("reads the baseline off the profile without creating one", async () => {
    const user = await createTestUser();
    await prisma.skillProfile.create({
      data: {
        userId: user.id,
        skillKey: "evidence",
        contentVersion: "evidence/v2",
        assessmentCompletedAt: PAST,
      },
    });
    await prisma.skillProfile.create({
      data: { userId: user.id, skillKey: "clarity", contentVersion: "clarity/v1", assessmentSkipped: true },
    });

    expect((await overviewFor(user.id, "evidence")).hasBaseline).toBe(true);
    expect((await overviewFor(user.id, "clarity")).hasBaseline).toBe(false);
    expect((await overviewFor(user.id, "clarity")).assessmentSkipped).toBe(true);
    expect((await overviewFor(user.id, "monitoring")).hasBaseline).toBe(false);
  });
});

describe("skillsOverview — dueProbe", () => {
  it("offers the post probe once every module is done", async () => {
    const user = await createTestUser();
    await prisma.skillModuleProgress.createMany({
      data: MODULE_KEYS_BY_SKILL.verification.map((moduleKey) => ({
        userId: user.id,
        skillKey: "verification" as const,
        moduleKey,
        state: "mastered" as const,
      })),
    });

    expect((await overviewFor(user.id, "verification")).dueProbe).toBe("post");
  });

  it("does not offer the post probe while a module is still outstanding", async () => {
    const user = await createTestUser();
    const keys = MODULE_KEYS_BY_SKILL.verification;
    await prisma.skillModuleProgress.createMany({
      data: keys.slice(0, keys.length - 1).map((moduleKey) => ({
        userId: user.id,
        skillKey: "verification" as const,
        moduleKey,
        state: "mastered" as const,
      })),
    });

    expect((await overviewFor(user.id, "verification")).dueProbe).toBeNull();
  });

  it("offers a delayed probe only once its schedule has come due", async () => {
    const user = await createTestUser();
    await prisma.skillProbe.createMany({
      data: [
        { userId: user.id, skillKey: "evidence", timepoint: "post", formId: "B", contentVersion: "evidence/v2", completedAt: PAST },
        { userId: user.id, skillKey: "evidence", timepoint: "delayed", formId: "C", contentVersion: "evidence/v2", scheduledFor: FUTURE },
      ],
    });

    expect((await overviewFor(user.id, "evidence")).dueProbe).toBeNull();
    expect((await overviewFor(user.id, "evidence", new Date("2026-09-21T00:00:00.000Z"))).dueProbe).toBe("delayed");
  });

  it("stops offering a probe that has been completed", async () => {
    const user = await createTestUser();
    await prisma.skillModuleProgress.createMany({
      data: MODULE_KEYS_BY_SKILL.monitoring.map((moduleKey) => ({
        userId: user.id,
        skillKey: "monitoring" as const,
        moduleKey,
        state: "mastered" as const,
      })),
    });
    await prisma.skillProbe.create({
      data: { userId: user.id, skillKey: "monitoring", timepoint: "post", formId: "B", contentVersion: "monitoring/v1", completedAt: PAST },
    });

    expect((await overviewFor(user.id, "monitoring")).dueProbe).toBeNull();
  });
});
