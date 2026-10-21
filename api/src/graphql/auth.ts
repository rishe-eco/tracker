import jwt from "jsonwebtoken";
import { env } from "process";

export const SALT_ROUNDS = 10;

const JWT_SECRET = () => env.JWT_SECRET ?? "dev-secret";

export function signToken(user: { id: string }) {
  return jwt.sign({ userId: user.id }, JWT_SECRET(), { expiresIn: "7d" });
}

export function requireAuth<TArgs>(
  resolver: (parent: any, args: TArgs, ctx: any) => any
) {
  return async (parent: any, args: TArgs, ctx: any) => {
    if (!ctx.user) throw new Error("Unauthorized");
    // If DB was reset (e.g. migrate dev), token can reference a deleted user id.
    if (ctx.prisma?.user) {
      const existingUser = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true },
      });
      if (!existingUser) throw new Error("Unauthorized");
    }
    return resolver(parent, args, ctx);
  };
}

/** Throws if resource is missing or does not belong to the current user (use "Not found" to avoid leaking existence). */
export function ensureOwned<T extends { userId: string }>(resource: T | null, ctx: { user: { id: string } }): asserts resource is T {
  if (!resource || resource.userId !== ctx.user.id) {
    throw new Error("Not found");
  }
}

/** Reflect's refusal of an API-token caller, any scope. Not "Unauthorized": convention 11 treats that exact string as a dead session. */
export const REFLECT_SESSION_ONLY = "Reflect is only available in the app, not to API tokens.";

/**
 * Reflect holds the most private text in the app, so it is for a real sign-in
 * only (spec AC-4): a personal API token, read or write, is refused. Wrap it
 * inside `requireAuth`, so a caller with no user still gets `Unauthorized`.
 */
export function requireReflectSession<TArgs>(
  resolver: (parent: any, args: TArgs, ctx: any) => any
) {
  return (parent: any, args: TArgs, ctx: any) => {
    if (ctx.auth?.kind !== "session") throw new Error(REFLECT_SESSION_ONLY);
    return resolver(parent, args, ctx);
  };
}
