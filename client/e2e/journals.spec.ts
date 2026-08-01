import { test, expect } from "@playwright/test";
import { authenticate, getAuthData } from "./helpers/auth";
import { gql } from "./helpers/api";
import {
  CREATE_JOURNAL,
  ARCHIVE_JOURNAL,
  DELETE_JOURNAL,
  GET_JOURNALS,
  CREATE_ENTRY,
  ADD_QUICK_ENTRY,
} from "../app/api/queries";

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function clearJournals(request: Parameters<typeof gql>[0]) {
  const { journals } = await gql(request, GET_JOURNALS, { includeArchived: true });
  for (const j of journals) {
    if (!j.isArchived) await gql(request, ARCHIVE_JOURNAL, { id: j.id });
    await gql(request, DELETE_JOURNAL, { id: j.id });
  }
}

test.beforeEach(async ({ request }) => {
  await clearJournals(request);
});

// ── Simple: list page renders ─────────────────────────────────────────────────

test("journals list shows heading and New journal button", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/journals");

  await expect(page.getByRole("heading", { name: "Journals" })).toBeVisible();
  await expect(page.getByRole("button", { name: /New journal/i })).toBeVisible();
});

test("journals list shows empty state when no journals", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/journals");

  await expect(page.getByText("No journals yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create your first journal/i })).toBeVisible();
});

test("journals list renders journal title and entry count from API", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });
  await gql(request, CREATE_ENTRY, { journalId: createJournal.id, body: "First entry" });

  await authenticate(page);
  await page.goto("/tools/journals");

  await expect(page.getByText("Work Log")).toBeVisible();
  await expect(page.getByText("1 entry")).toBeVisible();
});

test("journals list shows journal description", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Work Log", description: "Daily work notes" });

  await authenticate(page);
  await page.goto("/tools/journals");

  await expect(page.getByText("Daily work notes")).toBeVisible();
});

test("non-default journal shows set-as-default button, default journal does not", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Work Log" });       // becomes default (first journal)
  await gql(request, CREATE_JOURNAL, { title: "Side Notes" });     // non-default

  await authenticate(page);
  await page.goto("/tools/journals");

  await expect(page.getByText("Work Log")).toBeVisible();
  await expect(page.getByTitle("Set as default")).toHaveCount(1);
});

// ── Complex: list page interactions ──────────────────────────────────────────

test("clicking New journal button reveals create form", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/journals");

  await page.getByRole("button", { name: /New journal/i }).click();

  await expect(page.getByPlaceholder("Journal title")).toBeVisible();
  await expect(page.getByPlaceholder("Description (optional)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
});

test("creating a journal navigates to its detail page", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/journals");

  await page.getByRole("button", { name: /New journal/i }).click();
  await page.getByPlaceholder("Journal title").fill("My New Journal");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/tools\/journals\//, { timeout: 5000 });
  await expect(page.getByText("My New Journal")).toBeVisible();
});

test("cancel on create form hides the form", async ({ page }) => {
  await authenticate(page);
  await page.goto("/tools/journals");

  await page.getByRole("button", { name: /New journal/i }).click();
  await expect(page.getByPlaceholder("Journal title")).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByPlaceholder("Journal title")).not.toBeVisible();
});

test("archive button on journal card removes journal from list", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Default Journal" }); // default
  await gql(request, CREATE_JOURNAL, { title: "Work Log" });         // non-default

  await authenticate(page);
  await page.goto("/tools/journals");
  await expect(page.getByText("Work Log")).toBeVisible();

  const card = page.locator("li").filter({ hasText: "Work Log" });
  await card.getByRole("button").last().click();

  await expect(page.getByText("Work Log")).not.toBeVisible({ timeout: 5000 });
});

test("set default button makes journal the default", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Work Log" });    // auto-default
  await gql(request, CREATE_JOURNAL, { title: "Side Notes" }); // non-default

  await authenticate(page);
  await page.goto("/tools/journals");

  // Only one set-as-default button visible (for Side Notes)
  await expect(page.getByTitle("Set as default")).toHaveCount(1);

  await page.getByTitle("Set as default").click();

  // After setting Side Notes as default, no set-as-default buttons remain for Side Notes
  // (Work Log now has one instead)
  const sideCard = page.locator("li").filter({ hasText: "Side Notes" });
  await expect(sideCard.getByTitle("Set as default")).toHaveCount(0, { timeout: 5000 });
});

test("clicking journal card navigates to detail page", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto("/tools/journals");
  await expect(page.getByText("Work Log")).toBeVisible();

  await page.locator("li").filter({ hasText: "Work Log" }).click();

  await expect(page).toHaveURL(new RegExp(`/tools/journals/${createJournal.id}`), { timeout: 5000 });
});

// ── Simple: detail page renders ───────────────────────────────────────────────

test("journal detail page shows journal title and entry composer", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await expect(page.getByText("Work Log")).toBeVisible();
  await expect(page.getByPlaceholder(/Write an entry/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add entry" })).toBeVisible();
});

test("journal detail shows empty entry state when no entries", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await expect(page.getByText("No entries yet. Write the first one below.")).toBeVisible();
});

test("journal detail renders existing entries", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });
  await gql(request, CREATE_ENTRY, { journalId: createJournal.id, body: "Fixed the auth bug" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await expect(page.getByText("Fixed the auth bug")).toBeVisible();
});

test("archived journal shows archived notice and hides composer", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });
  await gql(request, ARCHIVE_JOURNAL, { id: createJournal.id });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await expect(page.getByText("This journal is archived.")).toBeVisible();
  await expect(page.getByPlaceholder(/Write an entry/)).not.toBeVisible();
});

// ── Complex: detail page interactions ────────────────────────────────────────

test("submitting the composer adds entry to the list", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await page.getByPlaceholder(/Write an entry/).fill("Today I fixed the login bug.");
  await page.getByRole("button", { name: "Add entry" }).click();

  await expect(page.getByText("Today I fixed the login bug.")).toBeVisible({ timeout: 5000 });
});

test("pressing Enter in composer submits the entry", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await page.getByPlaceholder(/Write an entry/).fill("Quick thought");
  await page.getByPlaceholder(/Write an entry/).press("Enter");

  await expect(page.getByText("Quick thought")).toBeVisible({ timeout: 5000 });
});

test("settings panel opens and shows access list section when settings button clicked", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await expect(page.getByText("Journal settings")).not.toBeVisible();

  await page.getByRole("button", { name: "Journal settings" }).click();

  await expect(page.getByText("Journal settings")).toBeVisible();
  await expect(page.getByText("Access list")).toBeVisible();
  await expect(page.getByPlaceholder("Add by email...")).toBeVisible();
});

test("adding a discoverable email adds them to the access list", async ({ page, request }) => {
  const { friendEmail } = getAuthData();
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await page.getByRole("button", { name: "Journal settings" }).click();
  await page.getByPlaceholder("Add by email...").fill(friendEmail);
  await page.getByPlaceholder("Add by email...").press("Enter");

  await expect(page.getByText(friendEmail)).toBeVisible({ timeout: 5000 });
});

test("access error message appears when email is not discoverable", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await page.getByRole("button", { name: "Journal settings" }).click();
  await page.getByPlaceholder("Add by email...").fill("ghost@nowhere.invalid");
  await page.getByPlaceholder("Add by email...").press("Enter");

  await expect(page.getByText(/No user found/i)).toBeVisible({ timeout: 5000 });
});

test("archive journal button in settings panel archives the journal", async ({ page, request }) => {
  const { createJournal } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto(`/tools/journals/${createJournal.id}`);

  await page.getByRole("button", { name: "Journal settings" }).click();
  await page.getByRole("button", { name: "Archive journal" }).click();

  // After archiving, the archived notice replaces the composer
  await expect(page.getByText("This journal is archived.")).toBeVisible({ timeout: 5000 });
});

// ── Today: journal quick-add ─────────────────────────────────────────────────

test("today page shows journal quick-add section when journals exist", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto("/today");

  await expect(page.getByText("Journal")).toBeVisible({ timeout: 8000 });
  await expect(page.getByPlaceholder("Quick journal entry...")).toBeVisible();
});

test("today page hides journal quick-add when no journals", async ({ page }) => {
  // beforeEach already cleared all journals
  await authenticate(page);
  await page.goto("/today");

  await expect(page.getByPlaceholder("Quick journal entry...")).not.toBeVisible({ timeout: 8000 });
});

test("quick-add entry clears field after successful submission", async ({ page, request }) => {
  await gql(request, CREATE_JOURNAL, { title: "Work Log" });

  await authenticate(page);
  await page.goto("/today");
  await expect(page.getByPlaceholder("Quick journal entry...")).toBeVisible({ timeout: 8000 });

  await page.getByPlaceholder("Quick journal entry...").fill("Shipped the feature");
  await page.getByPlaceholder("Quick journal entry...").press("Enter");

  // Successful submission clears the input
  await expect(page.getByPlaceholder("Quick journal entry...")).toHaveValue("", { timeout: 5000 });
});

test("journal picker on today page routes entry to selected journal", async ({ page, request }) => {
  const { createJournal: j1 } = await gql(request, CREATE_JOURNAL, { title: "Work Log" });   // default
  const { createJournal: j2 } = await gql(request, CREATE_JOURNAL, { title: "Personal" });

  await authenticate(page);
  await page.goto("/today");
  await expect(page.getByText("Work Log")).toBeVisible({ timeout: 8000 });

  // Open the picker dropdown and select Personal
  await page.getByText("Work Log").click();
  await expect(page.getByText("Personal")).toBeVisible();
  await page.getByText("Personal").click();

  // Submit an entry
  await page.getByPlaceholder("Quick journal entry...").fill("Personal note");
  await page.getByPlaceholder("Quick journal entry...").press("Enter");
  await expect(page.getByPlaceholder("Quick journal entry...")).toHaveValue("", { timeout: 5000 });

  // Verify the entry landed in the Personal journal
  await page.goto(`/tools/journals/${j2.id}`);
  await expect(page.getByText("Personal note")).toBeVisible({ timeout: 5000 });
});
