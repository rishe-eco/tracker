import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { GET_PROJECTS, ADD_PROJECT, DELETE_PROJECT } from "../app/api/queries";

async function clearProjects(request: Parameters<typeof gql>[0]) {
  const { projects } = await gql(request, GET_PROJECTS);
  for (const p of projects) {
    await gql(request, DELETE_PROJECT, { id: p.id });
  }
}

test.beforeEach(async ({ request }) => {
  await clearProjects(request);
});

test("projects list shows heading and Add project button", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/projects");

  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add project/i })).toBeVisible();
});

test("projects list shows empty state when no projects", async ({ page }) => {
  await authenticate(page);
  await page.goto("/activities/projects");

  await expect(page.getByText("No projects")).toBeVisible();
});

test("projects list renders project title from API", async ({ page, request }) => {
  await gql(request, ADD_PROJECT, { title: "Redesign homepage", priority: "P" });

  await authenticate(page);
  await page.goto("/activities/projects");

  await expect(page.getByText("Redesign homepage")).toBeVisible();
});
