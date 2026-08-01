import { test, expect } from "@playwright/test";
import { authenticate, getAuthData } from "./helpers/auth";

test("navigate from Today to Activities via sidebar", async ({ page }) => {
  await authenticate(page);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  await page.getByRole("link", { name: /Activities/i }).click();
  await expect(page).toHaveURL(/\/activities/);
});

test("logout: settings → Log out → redirected to /login", async ({ page }) => {
  await authenticate(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated access → /login → login → original destination", async ({ page }) => {
  const { email, password } = getAuthData();

  // Visit /today without auth — should redirect to /login
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);

  // Login with real credentials
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  // Should land on /today (the originally requested destination)
  await expect(page).toHaveURL(/\/today/, { timeout: 8000 });
});
