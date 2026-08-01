import { request } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "http://localhost:4000/graphql";
export const AUTH_FILE = path.join(__dirname, ".auth", "e2e-user.json");

const MODULE_KEYS = [
  "today",
  "pre-day",
  "after-day",
  "goals-list",
  "manage-goal",
  "projects-list",
  "intervals-list",
  "calendar",
  "journals",
];

async function post(ctx: Awaited<ReturnType<typeof request.newContext>>, query: string, variables: object, token?: string) {
  const res = await ctx.post(API_URL, {
    data: JSON.stringify({ query, variables }),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function globalSetup() {
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true });

  const ctx = await request.newContext();
  const ts = Date.now();

  // ── Register main test user ───────────────────────────────────────────────
  const mainEmail = `e2e-main-${ts}@test.local`;
  const password = "e2e-Password-1";

  const regData = await post(ctx, `
    mutation Register($email: String!, $password: String!) {
      register(email: $email, password: $password) {
        token
        user { id email }
      }
    }
  `, { email: mainEmail, password });

  const mainToken = regData.register.token;

  // Complete onboarding (slideIndex >= 6 sets completedAt)
  await post(ctx, `
    mutation MarkSlideViewed($slideIndex: Int!) {
      markSlideViewed(slideIndex: $slideIndex) { completedAt }
    }
  `, { slideIndex: 6 }, mainToken);

  // Mark all module intros as viewed so overlays never block tests
  for (const moduleKey of MODULE_KEYS) {
    await post(ctx, `
      mutation MarkModuleIntroViewed($moduleKey: String!) {
        markModuleIntroViewed(moduleKey: $moduleKey)
      }
    `, { moduleKey }, mainToken);
  }

  // ── Register friend user (discoverable, used in journal access tests) ─────
  const friendEmail = `e2e-friend-${ts}@test.local`;

  const friendData = await post(ctx, `
    mutation Register($email: String!, $password: String!) {
      register(email: $email, password: $password) {
        token
        user { id email }
      }
    }
  `, { email: friendEmail, password });

  const friendToken = friendData.register.token;

  // Make the friend discoverable so addJournalAccess can find them
  await post(ctx, `
    mutation UpdateDiscoverability($discoverableByEmail: Boolean!) {
      updateDiscoverability(discoverableByEmail: $discoverableByEmail)
    }
  `, { discoverableByEmail: true }, friendToken);

  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    email: mainEmail,
    password,
    token: mainToken,
    friendEmail,
  }));

  await ctx.dispose();
}

export default globalSetup;
