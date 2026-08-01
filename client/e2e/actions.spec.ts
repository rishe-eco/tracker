import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { GET_ACTIONS, ADD_ACTION, DELETE_ACTION } from "../app/api/queries";

async function clearActions(request: Parameters<typeof gql>[0]) {
  const { actions } = await gql(request, GET_ACTIONS);
  for (const a of actions) {
    await gql(request, DELETE_ACTION, { id: a.id });
  }
}

test.beforeEach(async ({ request }) => {
  await clearActions(request);
});

// ── Simple: page renders ──────────────────────────────────────────────────────

test("actions list shows heading and Add action button", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/actions");

  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add action/i })).toBeVisible();
});

test("actions list shows empty state when no actions", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/actions");

  await expect(page.getByText("No actions match current filters.")).toBeVisible();
});

test("actions list renders action title from API", async ({ page, request }) => {
  await gql(request, ADD_ACTION, { title: "Write tests", priority: "P" });

  await authenticate(page);
  await page.goto("/activities/actions");

  await expect(page.getByText("Write tests")).toBeVisible();
});

// ── Complex: interactions ──────────────────────────────────────────────────────

test("click Add action button navigates to action form", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/actions");

  await page.getByRole("button", { name: /Add action/i }).click();
  await expect(page).toHaveURL(/\/activities\/action$/);
});

test("delete action: confirm dialog → item removed from list", async ({ page, request }) => {
  await gql(request, ADD_ACTION, { title: "Write tests", priority: "P" });

  await authenticate(page);
  await page.goto("/activities/actions");
  await expect(page.getByText("Write tests")).toBeVisible();

  // Click the trash/delete button (sr-only text "Delete")
  await page.getByRole("button", { name: "Delete" }).click();

  // Confirm the dialog
  await page.getByRole("button", { name: /^Delete$/ }).last().click();

  await expect(page.getByText("Write tests")).not.toBeVisible({ timeout: 5000 });
});
