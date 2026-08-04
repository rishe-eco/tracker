import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs, resolvers } from "./graphql";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "process";
import cors from "cors";
import { authenticateApiToken, looksLikeApiToken } from "./services/apiTokens";
import { applySqlitePragmas } from "./db/sqlitePragmas";
import { requestLocale } from "./graphql/requestLocale";

const prisma = new PrismaClient();
const app = express();

const corsOrigins =
  process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

/** How the caller proved who they are — the app's own session, or a personal access token. */
type Auth =
  | { kind: "session" }
  | { kind: "apiToken"; tokenId: string; scope: "read" | "write" };

function bearerToken(req: any): string | null {
  const auth = req.headers?.authorization;
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

async function authenticate(
  req: any
): Promise<{ user: { id: string } | null; auth: Auth | null }> {
  const token = bearerToken(req);
  if (!token) return { user: null, auth: null };

  if (looksLikeApiToken(token)) {
    const result = await authenticateApiToken(prisma, token);
    if (!result) return { user: null, auth: null };
    return {
      user: { id: result.userId },
      auth: { kind: "apiToken", tokenId: result.tokenId, scope: result.scope },
    };
  }

  const JWT_SECRET = env.JWT_SECRET || "dev-secret";
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { user: { id: decoded.userId }, auth: { kind: "session" } };
  } catch {
    return { user: null, auth: null };
  }
}

/**
 * Scope is enforced here rather than per-resolver: the operation's type is only
 * known once the document is parsed, and one missed resolver would silently
 * make a read-only token writable.
 */
const enforceTokenScope = {
  async requestDidStart() {
    return {
      async didResolveOperation({ operation, context }: any) {
        const auth = context?.auth;
        if (auth?.kind !== "apiToken") return;
        if (operation.operation === "mutation" && auth.scope !== "write") {
          throw new Error("This API token is read-only. Issue a write-scoped token to make changes.");
        }
        if (operation.operation === "subscription") {
          throw new Error("Subscriptions are not available to API tokens.");
        }
      },
    };
  },
};

async function startServer() {
  await applySqlitePragmas(prisma);

  const PORT = env.PORT || 4000;
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [enforceTokenScope],
    context: async ({ req }) => {
      const { user, auth } = await authenticate(req);
      return { user, auth, prisma, locale: requestLocale(req) };
    },
  });

  await server.start();
  server.applyMiddleware({ app: app as any });

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer();
