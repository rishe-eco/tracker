import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { GET_REFLECT_ENTRY, DELETE_REFLECT_ENTRY } from "../app/api/queries";

/**
 * Reflect, B4's three walks (build plan §5 B4): the pre-check's Not now to the
 * calm close, Stop here with text and a delete, and a reload on the story.
 *
 * The specs share globalSetup's one user, and Reflect keeps one open entry per
 * person, so each test starts and ends with no open entry. Closed entries with
 * text would show on the home as Past entries, so every walk that writes also
 * deletes what it wrote.
 */

async function deleteOpenEntry(request: Parameters<typeof gql>[0]) {
  const { reflectEntry } = await gql(request, GET_REFLECT_ENTRY);
  if (reflectEntry) await gql(request, DELETE_REFLECT_ENTRY, { entryId: reflectEntry.id });
}

test.beforeEach(async ({ request }) => {
  await deleteOpenEntry(request);
});

test.afterEach(async ({ request }) => {
  await deleteOpenEntry(request);
});

/** Resolves when a `saveReflectEntry` carrying `text` has been answered. */
function savedWith(page: Page, text: string) {
  return page.waitForResponse((r) => {
    if (r.request().method() !== "POST") return false;
    const body = r.request().postData() ?? "";
    return body.includes("saveReflectEntry") && body.includes(text);
  });
}

test("pre-check with a trigger: Not now, the calm close, and back to the home", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/reflect");

  await expect(page.getByRole("heading", { name: "Reflect" })).toBeVisible();
  await page.getByRole("button", { name: "Start an entry" }).click();

  await expect(page).toHaveURL(/\/tools\/reflect\/entry/);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop here" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);

  // A trigger answer swaps Next for the advisory's two choices; a second tap brings Next back.
  const days = page.getByRole("button", { name: "In the last few days" });
  await days.click();
  await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep going" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await days.click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await days.click();

  await page.getByRole("button", { name: "Not now" }).click();

  // The calm close. Nothing was written, so there is nothing to delete (G5).
  await expect(page.getByText("It's fine to stop here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete what I wrote" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to Reflect" }).click();

  await expect(page).toHaveURL(/\/tools\/reflect$/);
  await expect(page.getByRole("button", { name: "Start an entry" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue the entry/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Past entries" })).toHaveCount(0);
});

test("a second start: the story, Stop here, the calm close, delete, and the home", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/reflect");
  await page.getByRole("button", { name: "Start an entry" }).click();

  // Both pre-check questions skipped: straight on to the story.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();
  // No Back on the story (D-3).
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);

  await page.getByLabel("Where were you, and who was there?").fill("The kitchen, my sister and me");
  await page.getByLabel(/watching from across the room/).fill("She put the bag down. I said hello.");

  // Stop here saves what is being typed before it closes the entry.
  await page.getByRole("button", { name: "Stop here" }).click();
  await expect(page.getByText("It's fine to stop here.")).toBeVisible();
  await expect(page.getByText(/What you wrote is kept/)).toBeVisible();

  // Cancel removes nothing; Delete does, and lands on the home (G9).
  await page.getByRole("button", { name: "Delete what I wrote" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Delete what I wrote" })).toBeVisible();

  await page.getByRole("button", { name: "Delete what I wrote" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page).toHaveURL(/\/tools\/reflect$/);
  await expect(page.getByRole("button", { name: "Start an entry" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Past entries" })).toHaveCount(0);
});

test("a reload on the story keeps the text", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/reflect");
  await page.getByRole("button", { name: "Start an entry" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();

  const scene = "A kitchen on a Sunday";
  const story = "He opened the door. She looked up and said nothing.";
  // The save goes out 800 ms after typing pauses: wait for its response, not for a clock.
  const sceneSaved = savedWith(page, scene);
  await page.getByLabel("Where were you, and who was there?").fill(scene);
  await sceneSaved;
  const storySaved = savedWith(page, story);
  await page.getByLabel(/watching from across the room/).fill(story);
  await storySaved;

  await page.reload();

  await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();
  await expect(page.getByLabel("Where were you, and who was there?")).toHaveValue(scene);
  await expect(page.getByLabel(/watching from across the room/)).toHaveValue(story);

  // Leave nothing behind: Stop here, then delete through the calm close.
  await page.getByRole("button", { name: "Stop here" }).click();
  await page.getByRole("button", { name: "Delete what I wrote" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tools\/reflect$/);
});
