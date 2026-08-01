import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/test/globalSetup.ts",
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      JWT_SECRET: "test-secret-key",
    },
    // Serialize test files to avoid concurrent SQLite writes
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          // Integration tests do real Prisma work against SQLite, which runs
          // with journal_mode=delete and synchronous=FULL — every write is its
          // own transaction and costs an fsync (~100-600ms once the disk is
          // busy, e.g. with the dev servers up). clearDb alone is 21 sequential
          // writes, so a correct test can legitimately take 5-10s wall-clock.
          // The default 5s timeout was killing slow-but-passing tests midway.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
