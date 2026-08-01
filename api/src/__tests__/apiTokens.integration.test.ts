import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser } from "../test/helpers";
import {
  generateToken,
  hashToken,
  looksLikeApiToken,
  authenticateApiToken,
  TOKEN_PREFIX,
} from "../services/apiTokens";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function sessionCtx(userId: string) {
  return { prisma, user: { id: userId }, auth: { kind: "session" } };
}

function tokenCtx(userId: string, tokenId: string, scope: "read" | "write") {
  return { prisma, user: { id: userId }, auth: { kind: "apiToken", tokenId, scope } };
}

describe("token generation", () => {
  it("produces a prefixed, high-entropy, non-repeating token", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(looksLikeApiToken(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThan(40);
    expect(a.prefix).toBe(a.token.slice(0, TOKEN_PREFIX.length + 8));
  });

  it("stores a digest, never the secret", () => {
    const { token, tokenHash } = generateToken();
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not mistake a JWT for an API token", () => {
    expect(looksLikeApiToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def")).toBe(false);
  });
});

describe("createApiToken", () => {
  it("returns the secret once and persists only its hash", async () => {
    const user = await createTestUser();
    const result = await mutationResolvers.createApiToken(
      null,
      { name: "Claude Code", scope: "write" },
      sessionCtx(user.id)
    );

    expect(result.token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(result.apiToken.scope).toBe("write");

    const stored = await prisma.apiToken.findUnique({ where: { id: result.apiToken.id } });
    expect(stored!.tokenHash).toBe(hashToken(result.token));
    expect(JSON.stringify(stored)).not.toContain(result.token);
  });

  it("sets an expiry when asked", async () => {
    const user = await createTestUser();
    const result = await mutationResolvers.createApiToken(
      null,
      { name: "Short lived", scope: "read", expiresInDays: 7 },
      sessionCtx(user.id)
    );
    const days = (result.apiToken.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("rejects a blank name and an out-of-range expiry", async () => {
    const user = await createTestUser();
    await expect(
      mutationResolvers.createApiToken(null, { name: "   ", scope: "read" }, sessionCtx(user.id))
    ).rejects.toThrow(/name is required/);
    await expect(
      mutationResolvers.createApiToken(
        null,
        { name: "x", scope: "read", expiresInDays: 0 },
        sessionCtx(user.id)
      )
    ).rejects.toThrow(/expiresInDays/);
  });

  it("refuses to mint a token when the caller is itself a token", async () => {
    const user = await createTestUser();
    const first = await mutationResolvers.createApiToken(
      null,
      { name: "Root", scope: "write" },
      sessionCtx(user.id)
    );
    await expect(
      mutationResolvers.createApiToken(
        null,
        { name: "Escalated", scope: "write" },
        tokenCtx(user.id, first.apiToken.id, "write")
      )
    ).rejects.toThrow(/cannot manage API tokens/);
  });
});

describe("authenticateApiToken", () => {
  async function issue(userId: string, scope: "read" | "write" = "write", expiresInDays?: number) {
    return mutationResolvers.createApiToken(
      null,
      { name: "t", scope, expiresInDays },
      sessionCtx(userId)
    );
  }

  it("resolves a valid token to its owner and scope", async () => {
    const user = await createTestUser();
    const { token, apiToken } = await issue(user.id, "read");
    const auth = await authenticateApiToken(prisma, token);
    expect(auth).toEqual({ userId: user.id, tokenId: apiToken.id, scope: "read" });
  });

  it("records lastUsedAt so an unused token is visibly safe to revoke", async () => {
    const user = await createTestUser();
    const { token, apiToken } = await issue(user.id);
    expect(apiToken.lastUsedAt).toBeNull();
    await authenticateApiToken(prisma, token);
    const after = await prisma.apiToken.findUnique({ where: { id: apiToken.id } });
    expect(after!.lastUsedAt).not.toBeNull();
  });

  it("rejects an unknown token", async () => {
    await createTestUser();
    expect(await authenticateApiToken(prisma, TOKEN_PREFIX + "not-a-real-token")).toBeNull();
  });

  it("rejects a revoked token", async () => {
    const user = await createTestUser();
    const { token, apiToken } = await issue(user.id);
    await mutationResolvers.revokeApiToken(null, { id: apiToken.id }, sessionCtx(user.id));
    expect(await authenticateApiToken(prisma, token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const user = await createTestUser();
    const { token, apiToken } = await issue(user.id);
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await authenticateApiToken(prisma, token)).toBeNull();
  });
});

describe("token ownership", () => {
  it("lists only the caller's own tokens", async () => {
    const mine = await createTestUser();
    const theirs = await createTestUser({ email: "other@example.com" });
    await mutationResolvers.createApiToken(null, { name: "Mine", scope: "read" }, sessionCtx(mine.id));
    await mutationResolvers.createApiToken(null, { name: "Theirs", scope: "read" }, sessionCtx(theirs.id));

    const listed = await queryResolvers.apiTokens(null, {}, sessionCtx(mine.id));
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Mine");
  });

  it("will not revoke another user's token", async () => {
    const mine = await createTestUser();
    const theirs = await createTestUser({ email: "other@example.com" });
    const victim = await mutationResolvers.createApiToken(
      null,
      { name: "Theirs", scope: "read" },
      sessionCtx(theirs.id)
    );
    await expect(
      mutationResolvers.revokeApiToken(null, { id: victim.apiToken.id }, sessionCtx(mine.id))
    ).rejects.toThrow(/Not found/);
  });
});
