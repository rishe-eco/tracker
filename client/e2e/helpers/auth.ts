import type { Page } from "@playwright/test";
import * as fs from "fs";
import { AUTH_FILE } from "../ports";

/**
 * Inject the real JWT token from globalSetup into localStorage so the app
 * sees the test user as authenticated on first render.
 */
export async function authenticate(page: Page) {
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
  await page.addInitScript((token: string) => {
    window.localStorage.setItem("token", token);
  }, auth.token);
}

export function getAuthData(): { email: string; password: string; token: string; friendEmail: string } {
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
}
