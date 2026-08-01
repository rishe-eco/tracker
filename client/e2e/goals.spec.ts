import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { GET_GOALS, ADD_GOAL, DELETE_GOAL } from "../app/api/queries";

async function clearGoals(request: Parameters<typeof gql>[0]) {
  const { goals } = await gql(request, GET_GOALS, {});
  for (const g of goals) {
    await gql(request, DELETE_GOAL, { id: g.id });
  }
}

test.beforeEach(async ({ request }) => {
  await clearGoals(request);
});

// ── Simple ────────────────────────────────────────────────────────────────────

test("goals list shows title and Add goal button", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/goals");

  // GoalsListPage title is a div with HintPopover, not a semantic heading
  await expect(page.locator("main").getByText("Goals").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Add goal/i })).toBeVisible();
});

test("goals list shows empty state when no goals", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/goals");

  await expect(page.getByText("No goals")).toBeVisible();
});

test("goals list renders goal title from API", async ({ page, request }) => {
  await gql(request, ADD_GOAL, { title: "Ship v2" });

  await authenticate(page);
  await page.goto("/activities/goals");

  await expect(page.getByText("Ship v2")).toBeVisible();
});

// ── Complex ───────────────────────────────────────────────────────────────────

test("click goal card navigates to manage goal page", async ({ page, request }) => {
  const { addGoal } = await gql(request, ADD_GOAL, { title: "Ship v2" });

  await authenticate(page);
  await page.goto("/activities/goals");
  await expect(page.getByText("Ship v2")).toBeVisible();

  await page.getByRole("button", { name: /Manage/i }).click();

  await expect(page).toHaveURL(new RegExp(`/activities/goal/${addGoal.id}`));
});
