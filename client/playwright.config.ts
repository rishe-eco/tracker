import { defineConfig } from "@playwright/test";
import { API_PORT, WEB_PORT, API_URL, API_HEALTH_URL, WEB_URL } from "./e2e/ports";

/**
 * Lane-safe e2e: its own ports, its own scratch database, never a dev server.
 * Variables and slots: e2e/README.md.
 *
 * The scratch database is built from a constant, never from the shell's
 * DATABASE_URL: `prisma db push --force-reset` wipes whatever it points at.
 * The file is per API port, so two slots in one checkout don't share it.
 */
const E2E_DATABASE_URL = `file:./prisma/p${API_PORT}-e2e.db`;

function assertScratchDatabase(url: string) {
  const ok = url.endsWith("e2e.db") && !/dev\.db|test\.db|prod\.db/.test(url);
  if (!ok) {
    throw new Error(`e2e refuses to run: DATABASE_URL "${url}" is not a scratch e2e.db`);
  }
}
assertScratchDatabase(E2E_DATABASE_URL);

const slot = String(API_PORT);

export default defineConfig({
  testDir: "./e2e",
  outputDir: `./test-results/${slot}`,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: "./e2e/globalSetup.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: `playwright-report/${slot}` }]],

  use: {
    baseURL: WEB_URL,
    channel: process.env.PW_CHANNEL ?? "msedge",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  webServer: [
    {
      command: "npx prisma db push --skip-generate --force-reset && npx ts-node src/index.ts",
      cwd: "../api",
      // /graphql answers a bare GET with 400 (it wants Accept: text/html); the health route is a plain 200
      url: API_HEALTH_URL,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        PORT: String(API_PORT),
        CORS_ORIGINS: WEB_URL,
        JWT_SECRET: "e2e-secret",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 60_000,
      env: {
        VITE_API_URL: API_URL,
        E2E_VITE_CACHE_DIR: `node_modules/.vite-e2e-${WEB_PORT}`,
      },
    },
  ],
});
