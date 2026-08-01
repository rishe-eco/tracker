import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { PrismaClient } from "@prisma/client";

/** Marks a value as a Tracker personal access token in logs, secret scanners, and support tickets. */
export const TOKEN_PREFIX = "trk_";

/** Characters of the token kept in plaintext so the UI can identify it later. */
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 8;

export type ApiTokenScope = "read" | "write";

/**
 * SHA-256 rather than bcrypt: the token is 32 bytes of CSPRNG output, so there
 * is no low-entropy secret to brute-force, and a plain digest keeps
 * authentication a single indexed lookup instead of a bcrypt comparison
 * against every row.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateToken(): { token: string; tokenHash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

export function looksLikeApiToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}

/** Constant-time digest comparison, so lookup timing can't confirm a guess. */
function digestsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export type ApiTokenAuth = {
  userId: string;
  tokenId: string;
  scope: ApiTokenScope;
};

/**
 * Resolve a bearer token to its owner, or null if it is unknown, revoked or
 * expired. Touches `lastUsedAt` so an unused token is visibly safe to revoke.
 */
export async function authenticateApiToken(
  prisma: PrismaClient,
  token: string
): Promise<ApiTokenAuth | null> {
  const tokenHash = hashToken(token);
  const record = await prisma.apiToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (!digestsMatch(record.tokenHash, tokenHash)) return null;
  if (record.revokedAt != null) return null;
  if (record.expiresAt != null && record.expiresAt.getTime() <= Date.now()) return null;

  // Best-effort: a failed bookkeeping write must not deny an otherwise valid request.
  await prisma.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    userId: record.userId,
    tokenId: record.id,
    scope: record.scope as ApiTokenScope,
  };
}
