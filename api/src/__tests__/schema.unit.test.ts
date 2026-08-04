/**
 * The GraphQL schema parses and every type it references exists.
 *
 * `typeDefs` is a template literal, so TypeScript has nothing to say about what
 * is inside it. A renamed type that only got renamed in half its usages compiles
 * perfectly and then throws at `new ApolloServer(...)` — which means the first
 * thing that notices is a server that will not boot, and the failure surfaces as
 * a page that cannot reach its API rather than as anything pointing at the
 * schema.
 *
 * This is that check, at unit speed. It is deliberately not about any one
 * feature: it protects every future edit to the SDL.
 */

import { describe, expect, it } from "vitest";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "../graphql/schema/typeDefs";
import { resolvers } from "../graphql/resolvers";

describe("the GraphQL schema", () => {
  it("builds without unknown or malformed types", () => {
    expect(() => makeExecutableSchema({ typeDefs, resolvers })).not.toThrow();
  });

  it("exposes every resolver against a field that exists", () => {
    // The mirror of the above: a resolver for a field the SDL does not declare
    // is dead code that looks live, and `makeExecutableSchema` only complains
    // about it with `requireResolversToMatchSchema`.
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const queryFields = schema.getQueryType()?.getFields() ?? {};
    const mutationFields = schema.getMutationType()?.getFields() ?? {};

    const orphaned = [
      ...Object.keys(resolvers.Query ?? {}).filter((f) => !(f in queryFields)),
      ...Object.keys(resolvers.Mutation ?? {}).filter((f) => !(f in mutationFields)),
    ];
    expect(orphaned).toEqual([]);
  });
});
