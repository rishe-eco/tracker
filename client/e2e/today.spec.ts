import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { GET_ACTIONS, DELETE_ACTION, GET_PROJECTS, DELETE_PROJECT, ADD_PROJECT, ADD_ACTION } from "../app/api/queries";

async function clearActionsAndProjects(request: Parameters<typeof gql>[0]) {
  // Actions must be cleared before projects (project delete sets projectId to null via SetNull)
  const { actions } = await gql(request, GET_ACTIONS);
  for (const a of actions) {
    await gql(request, DELETE_ACTION, { id: a.id });
  }
  const { projects } = await gql(request, GET_PROJECTS);
  for (const p of projects) {
    await gql(request, DELETE_PROJECT, { id: p.id });
  }
}

test.beforeEach(async ({ request }) => {
  await clearActionsAndProjects(request);
});

// ── Simple: page renders ──────────────────────────────────────────────────────

test("today page shows heading and Organize/Review buttons", async ({ page }) => {
  await authenticate(page);
  await page.goto("/today");

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Organize" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
});

test("today page shows empty state when no actions returned", async ({ page }) => {
  await authenticate(page);
  await page.goto("/today");

  await expect(page.getByText("No linked actions for today.")).toBeVisible();
  await expect(page.getByText("No standalone actions for today.")).toBeVisible();
});

test("today page shows linked action card from API", async ({ page, request }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { addProject } = await gql(request, ADD_PROJECT, { title: "Backend", priority: "P" });
  await gql(request, ADD_ACTION, {
    title: "Fix the bug", tbd: today, projectId: addProject.id,
    priority: "P", estimatedTimeMinutes: 30, startTimeOfDay: "09:00",
  });

  await authenticate(page);
  await page.goto("/today");

  await expect(page.getByText("Fix the bug")).toBeVisible({ timeout: 8000 });
});

// ── Complex: interactions ──────────────────────────────────────────────────────

test("toggle action checkbox marks action as done", async ({ page, request }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { addProject } = await gql(request, ADD_PROJECT, { title: "Backend", priority: "P" });
  await gql(request, ADD_ACTION, {
    title: "Fix the bug", tbd: today, projectId: addProject.id,
    priority: "P", estimatedTimeMinutes: 30, startTimeOfDay: "09:00",
  });

  await authenticate(page);
  await page.goto("/today");
  await expect(page.getByText("Fix the bug")).toBeVisible({ timeout: 8000 });

  const checkbox = page.getByRole("checkbox").first();
  await checkbox.click();

  await expect(checkbox).toBeChecked({ timeout: 5000 });
});

test("add standalone action: title + est + time → action appears in list", async ({ page }) => {
  await authenticate(page);
  await page.goto("/today");

  await page.getByPlaceholder("Add a new action (title)").fill("Buy groceries");

  await page.locator("#today-add-estimated").waitFor({ state: "visible" });
  await page.locator("#today-add-estimated").fill("30");
  await page.locator("#today-add-time").fill("10:00");

  await page.locator("#today-add-action-title ~ button").click();

  await expect(page.getByText("Buy groceries")).toBeVisible({ timeout: 5000 });
});
