import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addAction", () => {
  it("creates a standalone action", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Buy milk" }, ctx);
    expect(action.title).toBe("Buy milk");
    expect(action.userId).toBe(user.id);
    expect(action.done).toBe(false);
  });

  it("links action to an owned project", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, { title: "Project A" }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "Task 1", projectId: project.id }, ctx);
    expect(action.projectId).toBe(project.id);
  });

  it("requires estimatedTimeMinutes when tbd is set", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(
      mutationResolvers.addAction(null, { title: "Timed task", tbd: "2025-06-01T00:00:00.000Z" }, ctx)
    ).rejects.toThrow("estimatedTimeMinutes is required");
  });

  it("rejects linking to another user's project", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const project = await mutationResolvers.addProject(null, { title: "P" }, makeCtx(user1));
    await expect(
      mutationResolvers.addAction(null, { title: "Steal", projectId: project.id }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });
});

describe("Time Themes: project tag init-from-project (build-plan.md Phase 3a)", () => {
  it("a new action under a tagged project carries those tags, and stays editable", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "creative", color: "amber" }, ctx);
    const project = await mutationResolvers.addProject(null, { title: "Q4 redesign" }, ctx);
    await mutationResolvers.setProjectTags(null, { projectId: project.id, tagIds: [tag.id] }, ctx);

    const action = await mutationResolvers.addAction(null, { title: "Draft nav", projectId: project.id }, ctx);
    expect(action.tags.map((t: any) => t.id)).toEqual([tag.id]);

    // Project-origin, not gathered: setActionTags still succeeds.
    const other = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const updated = await mutationResolvers.setActionTags(
      null,
      { actionId: action.id, tagIds: [other.id] },
      ctx
    );
    expect(updated.tags.map((t: any) => t.id)).toEqual([other.id]);
  });

  it("is a copy, not a live link — retagging the project afterward does not retro-propagate", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tagA = await mutationResolvers.createTag(null, { name: "a", color: "indigo" }, ctx);
    const tagB = await mutationResolvers.createTag(null, { name: "b", color: "amber" }, ctx);
    const project = await mutationResolvers.addProject(null, { title: "P" }, ctx);
    await mutationResolvers.setProjectTags(null, { projectId: project.id, tagIds: [tagA.id] }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "Existing", projectId: project.id }, ctx);
    expect(action.tags.map((t: any) => t.id)).toEqual([tagA.id]);

    await mutationResolvers.setProjectTags(null, { projectId: project.id, tagIds: [tagB.id] }, ctx);
    const unchanged = await prisma.action.findUnique({ where: { id: action.id }, include: { tags: true } });
    expect(unchanged!.tags.map((t) => t.id)).toEqual([tagA.id]);
  });

  it("a standalone action (no projectId) starts with no tags", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Call the accountant" }, ctx);
    expect(action.tags).toEqual([]);
  });
});

describe("updateAction", () => {
  it("updates the title", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Old" }, ctx);
    const updated = await mutationResolvers.updateAction(null, { id: action.id, title: "New" }, ctx);
    expect(updated.title).toBe("New");
  });

  it("rejects updating another user's action", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const action = await mutationResolvers.addAction(null, { title: "Mine" }, makeCtx(user1));
    await expect(
      mutationResolvers.updateAction(null, { id: action.id, title: "Stolen" }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });
});

describe("deleteAction", () => {
  it("removes the action", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Temp" }, ctx);
    await mutationResolvers.deleteAction(null, { id: action.id }, ctx);
    const found = await prisma.action.findUnique({ where: { id: action.id } });
    expect(found).toBeNull();
  });
});

describe("toggleAction", () => {
  it("marks action done then undone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Toggle me" }, ctx);
    expect(action.done).toBe(false);
    const done = await mutationResolvers.toggleAction(null, { id: action.id }, ctx);
    expect(done.done).toBe(true);
    const undone = await mutationResolvers.toggleAction(null, { id: action.id }, ctx);
    expect(undone.done).toBe(false);
  });
});
