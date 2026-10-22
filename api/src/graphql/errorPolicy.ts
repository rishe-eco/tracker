import type { GraphQLError, GraphQLFormattedError } from "graphql";

/**
 * What a GraphQL error carries back to the caller.
 *
 * Apollo Server 3 turns `debug` on unless NODE_ENV is "production" or "test",
 * and with it every error ships `extensions.exception.stacktrace`: server paths,
 * node_modules frames. Even with `debug` off, `extensions.exception` still holds
 * the original error's own fields (a Prisma error's `meta`, for one). So in
 * production the exception is dropped outright; `message`, `path`, `locations`
 * and `extensions.code` are what a client reads, and they stay.
 *
 * Explicit rather than left to Apollo's default, so the behaviour is visible
 * here; the image sets NODE_ENV=production (api/Dockerfile).
 */
export function errorPolicy(nodeEnv: string | undefined = process.env.NODE_ENV) {
  const production = nodeEnv === "production";
  return {
    debug: !production,
    formatError: production ? withoutException : undefined,
  };
}

function withoutException(error: GraphQLError): GraphQLFormattedError {
  const { exception: _exception, ...extensions } = (error.extensions ?? {}) as Record<string, unknown>;
  return {
    message: error.message,
    ...(error.locations && { locations: error.locations }),
    ...(error.path && { path: error.path }),
    extensions,
  };
}
