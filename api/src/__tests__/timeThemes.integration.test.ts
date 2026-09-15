import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const BASE_INPUT = {
  title: "Deep-work morning",
  startTimeOfDay: "08:30",
  endTimeOfDay: "12:00",
  tagIds: [] as string[],
};

describe("createTimeTheme / updateTimeTheme", () => {
  it("creates a theme with ownership and tags", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const theme = await mutationResolvers.createTimeTheme(
      null,
      { input: { ...BASE_INPUT, tagIds: [tag.id] } },
      ctx
    );
    expect(theme.title).toBe("Deep-work morning");
    expect(theme.status).toBe("active");
    expect(theme.userId).toBe(user.id);
    expect(theme.tags.map((t: any) => t.id)).toEqual([tag.id]);
  });

  it("rejects endTimeOfDay <= startTimeOfDay", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(
      mutationResolvers.createTimeTheme(
        null,
        { input: { ...BASE_INPUT, startTimeOfDay: "12:00", endTimeOfDay: "08:30" } },
        ctx
      )
    ).rejects.toThrow(/endTimeOfDay must be after startTimeOfDay/);
    await expect(
      mutationResolvers.createTimeTheme(
        null,
        { input: { ...BASE_INPUT, startTimeOfDay: "12:00", endTimeOfDay: "12:00" } },
        ctx
      )
    ).rejects.toThrow(/endTimeOfDay must be after startTimeOfDay/);
  });

  it("rejects malformed HH:mm", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(
      mutationResolvers.createTimeTheme(null, { input: { ...BASE_INPUT, startTimeOfDay: "8:30am" } }, ctx)
    ).rejects.toThrow(/must be HH:mm/);
  });

  it("rejects a foreign tag id", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const foreignTag = await mutationResolvers.createTag(null, { name: "x", color: "indigo" }, makeCtx(user1));
    await expect(
      mutationResolvers.createTimeTheme(null, { input: { ...BASE_INPUT, tagIds: [foreignTag.id] } }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });

  it("rejects updating another user's theme", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const theme = await mutationResolvers.createTimeTheme(null, { input: BASE_INPUT }, makeCtx(user1));
    await expect(
      mutationResolvers.updateTimeTheme(null, { id: theme.id, input: BASE_INPUT }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });

  it("updates title, time span, and tag set", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const t1 = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const t2 = await mutationResolvers.createTag(null, { name: "creative", color: "amber" }, ctx);
    const theme = await mutationResolvers.createTimeTheme(null, { input: { ...BASE_INPUT, tagIds: [t1.id] } }, ctx);
    const updated = await mutationResolvers.updateTimeTheme(
      null,
      { id: theme.id, input: { ...BASE_INPUT, title: "Renamed", startTimeOfDay: "09:00", tagIds: [t2.id] } },
      ctx
    );
    expect(updated.title).toBe("Renamed");
    expect(updated.startTimeOfDay).toBe("09:00");
    expect(updated.tags.map((t: any) => t.id)).toEqual([t2.id]);
  });
});

describe("timeTheme(id) — singular getter (mirrors interval(id)/project(id))", () => {
  it("returns the caller's own theme", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const theme = await mutationResolvers.createTimeTheme(null, { input: BASE_INPUT }, ctx);
    const found = await queryResolvers.timeTheme(null, { id: theme.id }, ctx);
    expect(found?.id).toBe(theme.id);
  });

  it("returns null for another user's theme", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const theme = await mutationResolvers.createTimeTheme(null, { input: BASE_INPUT }, makeCtx(user1));
    const found = await queryResolvers.timeTheme(null, { id: theme.id }, makeCtx(user2));
    expect(found).toBeNull();
  });
});

describe("setTimeThemeStatus / deleteTimeTheme", () => {
  it("sets status to inactive and back", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const theme = await mutationResolvers.createTimeTheme(null, { input: BASE_INPUT }, ctx);
    const inactive = await mutationResolvers.setTimeThemeStatus(null, { id: theme.id, status: "inactive" }, ctx);
    expect(inactive.status).toBe("inactive");
    const active = await mutationResolvers.setTimeThemeStatus(null, { id: theme.id, status: "active" }, ctx);
    expect(active.status).toBe("active");
  });

  it("deletes and returns true; has zero effect on actions (soft, by design)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const theme = await mutationResolvers.createTimeTheme(null, { input: BASE_INPUT }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "Unrelated" }, ctx);
    const result = await mutationResolvers.deleteTimeTheme(null, { id: theme.id }, ctx);
    expect(result).toBe(true);
    const found = await prisma.timeTheme.findUnique({ where: { id: theme.id } });
    expect(found).toBeNull();
    const untouchedAction = await prisma.action.findUnique({ where: { id: action.id } });
    expect(untouchedAction).not.toBeNull();
  });
});

describe("timeThemesForDate — recurrence resolution (build-plan.md Phase 4)", () => {
  it("a weekly theme fires on the right weekdays and not on others", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    // Mon(1)/Wed(3), anchored before the test window.
    await prisma.timeTheme.create({
      data: {
        title: "Mon/Wed mornings",
        startTimeOfDay: "08:00",
        endTimeOfDay: "10:00",
        status: "active",
        customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1, 3] }),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        userId: user.id,
      },
    });
    // 2025-01-06 = Monday, 2025-01-07 = Tuesday, 2025-01-08 = Wednesday
    const mon = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-06" }, ctx);
    const tue = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-07" }, ctx);
    const wed = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-08" }, ctx);
    expect(mon).toHaveLength(1);
    expect(tue).toHaveLength(0);
    expect(wed).toHaveLength(1);
  });

  it("endTime stops the theme from firing", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await prisma.timeTheme.create({
      data: {
        title: "Ends soon",
        startTimeOfDay: "08:00",
        endTimeOfDay: "09:00",
        status: "active",
        repeatValue: 1,
        repeatUnit: "day",
        endTime: new Date("2025-01-06T23:59:59.000Z"),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        userId: user.id,
      },
    });
    const before = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-06" }, ctx);
    const after = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-07" }, ctx);
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(0);
  });

  it("excludes inactive themes", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await prisma.timeTheme.create({
      data: {
        title: "Paused",
        startTimeOfDay: "08:00",
        endTimeOfDay: "09:00",
        status: "inactive",
        repeatValue: 1,
        repeatUnit: "day",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        userId: user.id,
      },
    });
    const result = await queryResolvers.timeThemesForDate(null, { dateKey: "2025-01-06" }, ctx);
    expect(result).toHaveLength(0);
  });

  it("reuse-proof: a theme and an interval with identical recurrence fields agree on firing dates", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sharedRule = JSON.stringify({ unit: "week", daysOfWeek: [2, 4] }); // Tue/Thu
    const anchor = new Date("2025-01-01T00:00:00.000Z");

    const interval = await prisma.interval.create({
      data: {
        title: "Interval twin",
        status: "active",
        estimatedTimeMinutes: 30,
        customRepeatRule: sharedRule,
        createdAt: anchor,
        userId: user.id,
      },
    });
    await prisma.timeTheme.create({
      data: {
        title: "Theme twin",
        startTimeOfDay: "08:00",
        endTimeOfDay: "09:00",
        status: "active",
        customRepeatRule: sharedRule,
        createdAt: anchor,
        userId: user.id,
      },
    });

    const { intervalOccursOnDate } = await import("../services/actionGathering");
    const datesToCheck = ["2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10"];
    for (const dateKey of datesToCheck) {
      const intervalFires = intervalOccursOnDate(interval, dateKey);
      const themeResult = await queryResolvers.timeThemesForDate(null, { dateKey }, ctx);
      const themeFires = themeResult.length > 0;
      expect(themeFires).toBe(intervalFires);
    }
  });
});
