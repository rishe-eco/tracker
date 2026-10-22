/**
 * GraphQL errors over HTTP: production keeps message, path, locations and
 * extensions.code, and never ships extensions.exception or a stack trace.
 *
 * Over a real socket rather than executeOperation, so what is asserted is the
 * body a caller receives. The server is built like src/index.ts builds it, with
 * an anonymous context, which is what an unauthenticated request gets.
 */

import { afterAll, afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { ApolloServer } from "apollo-server-express";
import { prisma } from "../test/helpers";
import { typeDefs, resolvers } from "../graphql";
import { errorPolicy } from "../graphql/errorPolicy";

let running: { apollo: ApolloServer; http: Server } | null = null;

afterEach(async () => {
  if (!running) return;
  await running.apollo.stop();
  await new Promise((resolve) => running!.http.close(resolve));
  running = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function post(nodeEnv: string | undefined, query: string) {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    ...errorPolicy(nodeEnv),
    context: () => ({ user: null, auth: null, prisma, locale: "en" }),
  });
  await apollo.start();
  const app = express();
  apollo.applyMiddleware({ app: app as any });
  const http = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  running = { apollo, http };
  const { port } = http.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  return { text, body: JSON.parse(text) };
}

describe("GraphQL errors in production", () => {
  it("a resolver error keeps message, path, locations and code, and has no exception", async () => {
    const { text, body } = await post("production", "{ reflectHome { hasPast } }");
    const [error] = body.errors;
    expect(error.message).toBe("Unauthorized");
    expect(error.path).toEqual(["reflectHome"]);
    expect(error.locations).toEqual([{ line: 1, column: 3 }]);
    expect(error.extensions.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.extensions).not.toHaveProperty("exception");
    expect(text).not.toMatch(/stacktrace/i);
    expect(text).not.toMatch(/node_modules|\.js:\d+/);
  });

  it("a validation error keeps its code and has no exception", async () => {
    const { text, body } = await post("production", "{ noSuchField }");
    const [error] = body.errors;
    expect(error.message).toMatch(/noSuchField/);
    expect(error.extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
    expect(error.extensions).not.toHaveProperty("exception");
    expect(text).not.toMatch(/stacktrace/i);
  });
});

describe("GraphQL errors in development", () => {
  it("keeps the stack trace", async () => {
    const { body } = await post(undefined, "{ reflectHome { hasPast } }");
    expect(body.errors[0].extensions.exception.stacktrace.length).toBeGreaterThan(0);
  });
});
