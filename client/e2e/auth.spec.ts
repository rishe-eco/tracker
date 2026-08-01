import { test, expect } from "@playwright/test";
import { getAuthData } from "./helpers/auth";

// ── Simple: page renders ──────────────────────────────────────────────────────

test("login page renders email, password fields and submit button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("register page renders email, password and confirm password fields", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Confirm Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /Register/i })).toBeVisible();
});

test("unauthenticated visit to /today redirects to /login", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

// ── Complex: flows ─────────────────────────────────────────────────────────────

test("login flow: valid credentials → redirect to /today", async ({ page }) => {
  const { email, password } = getAuthData();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/today/, { timeout: 8000 });
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("login wrong credentials: error message shown", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("nobody@nowhere.invalid");
  await page.getByPlaceholder("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator(".text-red-500")).toBeVisible();
});

test("register flow: valid details → redirect to /today", async ({ page }) => {
  const unique = `e2e-reg-${Date.now()}@test.local`;

  await page.goto("/register");
  await page.getByPlaceholder("Email").fill(unique);
  await page.getByPlaceholder("Password", { exact: true }).fill("TestPass-1");
  await page.getByPlaceholder("Confirm Password").fill("TestPass-1");
  await page.getByRole("button", { name: /Register/i }).click();

  await expect(page).toHaveURL(/\/today/, { timeout: 8000 });
});

test("register passwords mismatch: client-side error shown without API call", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/graphql", (route) => {
    calls.push("called");
    route.continue();
  });

  await page.goto("/register");
  await page.getByPlaceholder("Email").fill("user@example.com");
  await page.getByPlaceholder("Password", { exact: true }).fill("abc");
  await page.getByPlaceholder("Confirm Password").fill("xyz");
  await page.getByRole("button", { name: /Register/i }).click();

  await expect(page.locator(".text-red-500")).toContainText("Passwords do not match");
  expect(calls).toHaveLength(0);
});
