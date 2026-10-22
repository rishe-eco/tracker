import type { APIRequestContext, Page } from "@playwright/test";
import { API_URL } from "../ports";

/**
 * A user signed up through the API for one test, with onboarding and the module
 * intros done as `globalSetup.ts` does for the shared user. Reflect's two
 * catches are each held to a cooldown per person, so a walk that expects both
 * needs a user who has never surfaced one: the shared user's state would fail a
 * second run, or a CI retry (B5 card, decision 3). Lives in the run's scratch
 * database, keyed by the slot's API port like everything else.
 */
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

async function post(request: APIRequestContext, query: string, variables: object, token?: string) {
  const res = await request.post(API_URL, {
    data: JSON.stringify({ query, variables }),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

let counter = 0;

export async function signUpFreshUser(request: APIRequestContext): Promise<{ token: string }> {
  const email = `e2e-reflect-${Date.now()}-${counter++}@test.local`;
  const reg = await post(
    request,
    `mutation Register($email: String!, $password: String!) { register(email: $email, password: $password) { token } }`,
    { email, password: "e2e-Password-1" }
  );
  const token = reg.register.token as string;
  await post(request, `mutation($i: Int!) { markSlideViewed(slideIndex: $i) { completedAt } }`, { i: 6 }, token);
  for (const moduleKey of MODULE_KEYS) {
    await post(request, `mutation($k: String!) { markModuleIntroViewed(moduleKey: $k) }`, { k: moduleKey }, token);
  }
  return { token };
}

/** The same call as `helpers/api.ts`'s `gql`, as a given user. */
export function gqlAs(request: APIRequestContext, token: string, query: string, variables?: Record<string, any>) {
  return post(request, query, variables ?? {}, token);
}

/** Sign the page in as that user, as `authenticate` does for the shared one. */
export async function authenticateAs(page: Page, token: string) {
  await page.addInitScript((t: string) => {
    window.localStorage.setItem("token", t);
  }, token);
}
