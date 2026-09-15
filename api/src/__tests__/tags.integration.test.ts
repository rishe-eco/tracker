import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";
import { typeResolvers } from "../graphql/resolvers/typeResolvers";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createTag / renameTag / recolorTag / deleteTag", () => {
  it("creates a tag", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    expect(tag.name).toBe("deep-work");
    expect(tag.color).toBe("indigo");
    expect(tag.userId).toBe(user.id);
  });

  it("rejects an unknown palette color", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(
      mutationResolvers.createTag(null, { name: "deep-work", color: "#ff00ff" }, ctx)
    ).rejects.toThrow(/color/i);
  });

  it("rejects a duplicate name for the same user (@@unique[userId, name])", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.createTag(null, { name: "admin", color: "slate" }, ctx);
    await expect(
      mutationResolvers.createTag(null, { name: "admin", color: "amber" }, ctx)
    ).rejects.toThrow(/already exists/i);
  });

  it("allows the same tag name across two different users", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const t1 = await mutationResolvers.createTag(null, { name: "admin", color: "slate" }, makeCtx(user1));
    const t2 = await mutationResolvers.createTag(null, { name: "admin", color: "slate" }, makeCtx(user2));
    expect(t1.id).not.toBe(t2.id);
  });

  it("renames a tag, rejecting a collision with another owned tag", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const a = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const b = await mutationResolvers.createTag(null, { name: "creative", color: "amber" }, ctx);
    const renamed = await mutationResolvers.renameTag(null, { id: a.id, name: "focus" }, ctx);
    expect(renamed.name).toBe("focus");
    await expect(
      mutationResolvers.renameTag(null, { id: b.id, name: "focus" }, ctx)
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects renaming another user's tag", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const tag = await mutationResolvers.createTag(null, { name: "mine", color: "indigo" }, makeCtx(user1));
    await expect(
      mutationResolvers.renameTag(null, { id: tag.id, name: "stolen" }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });

  it("recolors a tag, rejecting an unknown color", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const recolored = await mutationResolvers.recolorTag(null, { id: tag.id, color: "green" }, ctx);
    expect(recolored.color).toBe("green");
    await expect(
      mutationResolvers.recolorTag(null, { id: tag.id, color: "chartreuse" }, ctx)
    ).rejects.toThrow(/color/i);
  });

  it("deletes a tag and scrubs the connection from everything it was on", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const project = await mutationResolvers.addProject(null, { title: "P" }, ctx);
    await mutationResolvers.setProjectTags(null, { projectId: project.id, tagIds: [tag.id] }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "Standalone" }, ctx);
    await mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: [tag.id] }, ctx);

    const result = await mutationResolvers.deleteTag(null, { id: tag.id }, ctx);
    expect(result).toBe(true);

    const projectTags = await typeResolvers.Project.tags({ id: project.id, tags: undefined }, null, ctx);
    expect(projectTags).toEqual([]);
    const actionTags = await typeResolvers.Action.tags({ id: action.id, tags: undefined }, null, ctx);
    expect(actionTags).toEqual([]);
  });
});

describe("setXTags", () => {
  it("sets tags on a project, interval, routine, and standalone action (happy path)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const t1 = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const t2 = await mutationResolvers.createTag(null, { name: "creative", color: "amber" }, ctx);

    const project = await mutationResolvers.addProject(null, { title: "P" }, ctx);
    const updatedProject = await mutationResolvers.setProjectTags(
      null,
      { projectId: project.id, tagIds: [t1.id, t2.id] },
      ctx
    );
    expect(updatedProject.tags.map((t: any) => t.id).sort()).toEqual([t1.id, t2.id].sort());

    const interval = await mutationResolvers.addInterval(null, { title: "I", estimatedTimeMinutes: 30 }, ctx);
    const updatedInterval = await mutationResolvers.setIntervalTags(
      null,
      { intervalId: interval.id, tagIds: [t1.id] },
      ctx
    );
    expect(updatedInterval.tags.map((t: any) => t.id)).toEqual([t1.id]);

    const routine = await mutationResolvers.addRoutine(null, { title: "R", estimatedTimeMinutes: 15 }, ctx);
    const updatedRoutine = await mutationResolvers.setRoutineTags(
      null,
      { routineId: routine.id, tagIds: [t2.id] },
      ctx
    );
    expect(updatedRoutine.tags.map((t: any) => t.id)).toEqual([t2.id]);

    const action = await mutationResolvers.addAction(null, { title: "A" }, ctx);
    const updatedAction = await mutationResolvers.setActionTags(
      null,
      { actionId: action.id, tagIds: [t1.id, t2.id] },
      ctx
    );
    expect(updatedAction.tags.map((t: any) => t.id).sort()).toEqual([t1.id, t2.id].sort());
  });

  it("replaces the connection (set semantics), not accumulates", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const t1 = await mutationResolvers.createTag(null, { name: "a", color: "indigo" }, ctx);
    const t2 = await mutationResolvers.createTag(null, { name: "b", color: "amber" }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "A" }, ctx);
    await mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: [t1.id] }, ctx);
    const updated = await mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: [t2.id] }, ctx);
    expect(updated.tags.map((t: any) => t.id)).toEqual([t2.id]);
  });

  it("rejects a foreign tag id", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const foreignTag = await mutationResolvers.createTag(null, { name: "not-yours", color: "indigo" }, makeCtx(user1));
    const action = await mutationResolvers.addAction(null, { title: "A" }, makeCtx(user2));
    await expect(
      mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: [foreignTag.id] }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });

  it("rejects an unknown tag id", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "A" }, ctx);
    await expect(
      mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: ["does-not-exist"] }, ctx)
    ).rejects.toThrow("Not found");
  });

  it("rejects setActionTags on a gathered action", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const gathered = await prisma.action.create({
      data: {
        userId: user.id,
        title: "Gathered occurrence",
        sourceType: "interval",
        sourceId: "some-interval-id",
        isGathered: true,
        forDate: new Date("2026-09-15T00:00:00.000Z"),
      },
    });
    await expect(
      mutationResolvers.setActionTags(null, { actionId: gathered.id, tagIds: [tag.id] }, ctx)
    ).rejects.toThrow(/come from its interval or routine/);
  });
});

describe("Tag.usageCount", () => {
  it("counts usage across two different entity kinds", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const project = await mutationResolvers.addProject(null, { title: "P" }, ctx);
    await mutationResolvers.setProjectTags(null, { projectId: project.id, tagIds: [tag.id] }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "A" }, ctx);
    await mutationResolvers.setActionTags(null, { actionId: action.id, tagIds: [tag.id] }, ctx);

    const usageCount = await typeResolvers.Tag.usageCount({ id: tag.id }, null, ctx);
    expect(usageCount).toBe(2);
  });

  it("is zero for an unused tag", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "unused", color: "slate" }, ctx);
    const usageCount = await typeResolvers.Tag.usageCount({ id: tag.id }, null, ctx);
    expect(usageCount).toBe(0);
  });
});

describe("tags query", () => {
  it("returns only the caller's tags", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    await mutationResolvers.createTag(null, { name: "mine", color: "indigo" }, makeCtx(user1));
    await mutationResolvers.createTag(null, { name: "theirs", color: "amber" }, makeCtx(user2));
    const tags = await queryResolvers.tags(null, {}, makeCtx(user1));
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("mine");
  });
});
