import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authenticate } from "./helpers/auth";
import { gql } from "./helpers/api";
import { authenticateAs, gqlAs, signUpFreshUser } from "./helpers/freshUser";
import { expectReflow } from "./helpers/reflow";
import { GET_REFLECT_ENTRY, DELETE_REFLECT_ENTRY } from "../app/api/queries";

/**
 * Reflect: B4's three walks, and B5's J1 end to end with both catches, the
 * reload on the reality check, and the reload after Finish (build plan §5 B4,
 * §5 B5).
 *
 * Every walk runs at the default width, at 360 px and at 180 px, and at each
 * screen checks that every control sits inside the content column after the
 * fonts have loaded (design checklist §4, the reflow rule).
 *
 * B4's walks share globalSetup's one user, and Reflect keeps one open entry per
 * person, so each starts and ends with no open entry; closed entries with text
 * would show on the home as Past entries, so each walk that writes also deletes
 * what it wrote. B5's walks each sign up their own user through the API: both
 * catches need a person off cooldown, and the shared user's state would fail a
 * second run or a retry.
 */

const WIDTHS = [1280, 360, 180];

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

/** Resolves when a mutation named `op` carrying `text` has been answered. */
function savedWith(page: Page, op: string, text: string) {
  return page.waitForResponse((r) => {
    if (r.request().method() !== "POST") return false;
    const body = r.request().postData() ?? "";
    return body.includes(op) && body.includes(text);
  });
}

const entrySaved = (page: Page, text: string) => savedWith(page, "saveReflectEntry", text);
const momentSaved = (page: Page, text: string) => savedWith(page, "saveReflectMoment", text);
const readingSaved = (page: Page, text: string) => savedWith(page, "saveReflectReading", text);

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });
    // J1 walks eight screens with an 800 ms autosave behind each field; the first load of a cold Vite is slow too.
    test.describe.configure({ timeout: 120_000 });

    test("pre-check with a trigger: Not now, the calm close, and back to the home", async ({ page }) => {
      await authenticate(page);
      await page.goto("/tools/reflect");

      await expect(page.getByRole("heading", { name: "Reflect" })).toBeVisible();
      await expectReflow(page);
      await page.getByRole("button", { name: "Start an entry" }).click();

      await expect(page).toHaveURL(/\/tools\/reflect\/entry/);
      await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Stop here" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
      await expectReflow(page);

      // A trigger answer swaps Next for the advisory's two choices; a second tap brings Next back.
      const days = page.getByRole("button", { name: "In the last few days" });
      await days.click();
      await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Keep going" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
      await expectReflow(page);
      await days.click();
      await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
      await days.click();

      await page.getByRole("button", { name: "Not now" }).click();

      // The calm close. Nothing was written, so there is nothing to delete (G5).
      await expect(page.getByText("It's fine to stop here.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete what I wrote" })).toHaveCount(0);
      await expectReflow(page);
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
      await expectReflow(page);

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
      const sceneSaved = entrySaved(page, scene);
      await page.getByLabel("Where were you, and who was there?").fill(scene);
      await sceneSaved;
      const storySaved = entrySaved(page, story);
      await page.getByLabel(/watching from across the room/).fill(story);
      await storySaved;

      await page.reload();

      await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();
      await expect(page.getByLabel("Where were you, and who was there?")).toHaveValue(scene);
      await expect(page.getByLabel(/watching from across the room/)).toHaveValue(story);
      await expectReflow(page);

      // Leave nothing behind: Stop here, then delete through the calm close.
      await page.getByRole("button", { name: "Stop here" }).click();
      await page.getByRole("button", { name: "Delete what I wrote" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page).toHaveURL(/\/tools\/reflect$/);
    });

    test("J1: a first entry with both catches, Back from the reality check, and the done line", async ({
      page,
      request,
    }) => {
      const { token } = await signUpFreshUser(request);
      await authenticateAs(page, token);
      await page.goto("/tools/reflect");
      await page.getByRole("button", { name: "Start an entry" }).click();

      // J1.4: the pre-check, answered without an advisory.
      await page.getByRole("button", { name: "Longer ago" }).click();
      await button(page, "No").click();
      await button(page, "Next").click();

      // J1.5: the scene and the story, with a trigger word in the story.
      await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();
      const scene = "My sister's kitchen, Sunday lunch";
      const story = "She always does this when we visit. I said hello and sat down.";
      const sceneSaved = entrySaved(page, scene);
      await page.getByLabel("Where were you, and who was there?").fill(scene);
      await sceneSaved;
      const storySaved = entrySaved(page, story);
      await page.getByLabel(/watching from across the room/).fill(story);
      await storySaved;
      await button(page, "Next").click();

      // J1.7: a first moment from the palettes, with Unmet.
      await expect(page.getByRole("heading", { name: "Feelings and needs" })).toBeVisible();
      await expectReflow(page);
      const feelings = page.getByRole("group", { name: "Feeling", exact: true });
      const needs = page.getByRole("group", { name: "Need", exact: true });
      await expect(feelings.getByRole("button")).toHaveCount(7); // six words and other → type it
      await expect(needs.getByRole("button")).toHaveCount(6); // five words and other → type it
      const when1 = "when she closed the door";
      const whenSaved = momentSaved(page, when1);
      await page.getByLabel("When", { exact: true }).fill(when1);
      await whenSaved;
      const feelingSaved = momentSaved(page, '"feelingSource":"PALETTE"');
      await feelings.getByRole("button").first().click();
      await feelingSaved;
      const needSaved = momentSaved(page, '"needSource":"PALETTE"');
      await needs.getByRole("button").first().click();
      await needSaved;
      const metSaved = momentSaved(page, '"met":"UNMET"');
      await button(page, "Unmet").click();
      await metSaved;
      await expect(page.getByTestId("reflect-faux-offer")).toHaveCount(0);

      // J1.8: a second moment with an own feeling that the faux-feeling catch matches.
      await page.getByRole("button", { name: "Add another moment" }).click();
      await expect(page.getByTestId("reflect-moment-card")).toHaveCount(1);
      await expectReflow(page);
      await feelings.getByRole("button", { name: "other → type it" }).click();
      const own = page.getByRole("textbox", { name: "Feeling", exact: true });
      await own.fill("ignored");
      // Typing alone commits nothing: the offer waits for Enter (or a blur).
      await page.waitForTimeout(1200);
      await expect(page.getByTestId("reflect-faux-offer")).toHaveCount(0);
      const ownSaved = momentSaved(page, '"feelingSource":"OWN"');
      await own.press("Enter");
      await ownSaved;
      const offer = page.getByTestId("reflect-faux-offer");
      await expect(offer).toBeVisible();
      await expectReflow(page);
      // Use one, then a hint: the feeling is replaced and the offer goes.
      await offer.getByRole("button", { name: "Use one" }).click();
      const hint = offer.getByRole("button").first();
      const hintWord = ((await hint.innerText()) ?? "").replace(/[?؟]+\s*$/u, "").trim();
      const hintSaved = momentSaved(page, `"feeling":"${hintWord}"`);
      await hint.click();
      await hintSaved;
      await expect(offer).toHaveCount(0);

      // J1.9: a third moment, and then no Add another and nothing in its place.
      await page.getByRole("button", { name: "Add another moment" }).click();
      const when3 = "when he said I never help";
      const when3Saved = momentSaved(page, when3);
      await page.getByLabel("When", { exact: true }).fill(when3);
      await when3Saved;
      await expect(page.getByRole("button", { name: "Add another moment" })).toHaveCount(0);
      await expectReflow(page);

      // J1.10: the reality check. The story is shown back, one offer names the word, the pairs wait below it.
      await button(page, "Next").click();
      await expect(page.getByRole("heading", { name: "Reality check" })).toBeVisible();
      const interpretation = page.getByTestId("reflect-interpretation-offer");
      await expect(interpretation).toBeVisible();
      await expect(interpretation).toContainText("always");
      const shown = page.getByTestId("reflect-story-shown");
      await expect(shown).toContainText("She always does this when we visit.");
      await expectReflow(page);
      // A tap on the story only expands it.
      await shown.locator("p").click();
      await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
      await expect(interpretation).toBeVisible();
      await expectReflow(page);

      // J1.11: Use this fills the first reading with the sentence, and the camera half takes focus.
      // The sentence as the server splits it: without its closing full stop (B3, D-13).
      const sentence = "She always does this when we visit";
      const readingFilled = readingSaved(page, sentence);
      await interpretation.getByRole("button", { name: "Use this" }).click();
      await readingFilled;
      await expect(page.getByLabel("A reading in it")).toHaveValue(sentence);
      await expect(page.getByLabel("What a camera would have caught there")).toBeFocused();
      await expect(interpretation).toHaveCount(0);
      const camera = "She put the bag down and looked at the floor.";
      const cameraSaved = readingSaved(page, camera);
      await page.getByLabel("What a camera would have caught there").fill(camera);
      await cameraSaved;

      // J1.12: Back reaches Feelings, then the story, every field in place; fix a name and come forward.
      await button(page, "Back").click();
      await expect(page.getByRole("heading", { name: "Feelings and needs" })).toBeVisible();
      await expect(page.getByTestId("reflect-faux-offer")).toHaveCount(0);
      await expect(page.getByTestId("reflect-moment-card")).toHaveCount(1);
      await expect(page.getByLabel("When", { exact: true })).toHaveValue(when3);
      await expectReflow(page);
      await button(page, "Back").click();
      await expect(page.getByRole("heading", { name: "The scene" })).toBeVisible();
      await expect(page.getByLabel("Where were you, and who was there?")).toHaveValue(scene);
      const fixed = "Anna always does this when we visit. I said hello and sat down.";
      const fixedSaved = entrySaved(page, fixed);
      await page.getByLabel(/watching from across the room/).fill(fixed);
      await fixedSaved;
      await button(page, "Next").click();
      await expect(page.getByRole("heading", { name: "Feelings and needs" })).toBeVisible();
      await button(page, "Next").click();
      await expect(page.getByRole("heading", { name: "Reality check" })).toBeVisible();
      // Surfaced once per entry: no second offer, and the pair as it was left.
      await expect(page.getByTestId("reflect-interpretation-offer")).toHaveCount(0);
      await expect(page.getByLabel("A reading in it")).toHaveValue(sentence);
      await expect(page.getByLabel("What a camera would have caught there")).toHaveValue(camera);

      // J1.13: the close, with Finish.
      await button(page, "Next").click();
      await expect(page.getByRole("heading", { name: "Looking at it now" })).toBeVisible();
      const close = "It was smaller than it felt.";
      const closeSaved = entrySaved(page, close);
      await page.getByLabel(/what do you see that you didn't/).fill(close);
      await closeSaved;
      await expect(button(page, "Finish")).toBeEnabled();
      await expectReflow(page);
      await button(page, "Finish").click();

      // J1.14: three equal answers and Skip, no Stop here, no Back.
      const answers = ["I see it a bit differently", "About the same", "More caught up in it"];
      for (const a of answers) await expect(button(page, a)).toBeVisible();
      await expect(button(page, "Skip")).toBeVisible();
      await expect(button(page, "Stop here")).toHaveCount(0);
      await expect(button(page, "Back")).toHaveCount(0);
      await expectReflow(page);
      await button(page, answers[0]).click();

      // J1.15: the done line, then the home, which now lists Past entries.
      await expect(page.getByText(/That's the entry/)).toBeVisible();
      await expectReflow(page);
      await button(page, "Back to Reflect").click();
      await expect(page).toHaveURL(/\/tools\/reflect$/);
      await expect(page.getByRole("link", { name: "Past entries" })).toBeVisible();
    });

    test("a reload on the reality check returns there with the pair half-written and no offer", async ({
      page,
      request,
    }) => {
      const { token } = await signUpFreshUser(request);
      // Prepared through the API: an entry at Feelings with a trigger in the story.
      const started = await gqlAs(
        request,
        token,
        `mutation { startReflectEntry { id } }`
      );
      const entryId = started.startReflectEntry.id as string;
      await gqlAs(request, token, `mutation($id: ID!) { saveReflectEntry(entryId: $id, story: "He never listens to me.") { id } }`, { id: entryId });
      await gqlAs(request, token, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: STORY) { entry { id } } }`, { id: entryId });
      await gqlAs(request, token, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: FEELINGS) { entry { id } } }`, { id: entryId });

      await authenticateAs(page, token);
      await page.goto("/tools/reflect/entry");
      await expect(page.getByRole("heading", { name: "Feelings and needs" })).toBeVisible();
      await button(page, "Next").click();
      await expect(page.getByRole("heading", { name: "Reality check" })).toBeVisible();
      await expect(page.getByTestId("reflect-interpretation-offer")).toContainText("never");

      const half = "He seems to stop hearing me";
      const saved = readingSaved(page, half);
      await page.getByLabel("A reading in it").fill(half);
      await saved;

      await page.reload();

      await expect(page.getByRole("heading", { name: "Reality check" })).toBeVisible();
      await expect(page.getByLabel("A reading in it")).toHaveValue(half);
      await expect(page.getByLabel("What a camera would have caught there")).toHaveValue("");
      await expect(page.getByTestId("reflect-interpretation-offer")).toHaveCount(0);
      await expectReflow(page);
    });

    test("a reload after Finish shows the done line, not the question", async ({ page, request }) => {
      const { token } = await signUpFreshUser(request);
      const started = await gqlAs(request, token, `mutation { startReflectEntry { id } }`);
      const entryId = started.startReflectEntry.id as string;
      for (const to of ["STORY", "FEELINGS", "REALITY", "CLOSE"]) {
        await gqlAs(request, token, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: ${to}) { entry { id } } }`, { id: entryId });
      }

      await authenticateAs(page, token);
      await page.goto("/tools/reflect/entry");
      await expect(page.getByRole("heading", { name: "Looking at it now" })).toBeVisible();
      await button(page, "Finish").click();
      await expect(button(page, "About the same")).toBeVisible();

      await page.reload();

      await expect(page.getByText(/That's the entry/)).toBeVisible();
      await expect(button(page, "About the same")).toHaveCount(0);
      await expectReflow(page);
      await button(page, "Back to Reflect").click();
      await expect(page).toHaveURL(/\/tools\/reflect$/);
    });
  });
}

/** A closed entry with a story, written through the API as `token`'s user. Returns its id. */
async function closedEntry(request: Parameters<typeof gql>[0], token: string, story: string, scene?: string) {
  const started = await gqlAs(request, token, `mutation { startReflectEntry { id } }`);
  const entryId = started.startReflectEntry.id as string;
  await gqlAs(
    request,
    token,
    `mutation($entryId: ID!, $story: String, $scene: String) { saveReflectEntry(entryId: $entryId, story: $story, scene: $scene) { id } }`,
    { entryId, story, scene }
  );
  await gqlAs(request, token, `mutation($entryId: ID!) { stopReflectEntry(entryId: $entryId) { id } }`, { entryId });
  return entryId;
}

// B6: Past entries (build plan §5 B6). Each walk signs up its own user, so what
// it leaves behind is nobody else's home, and the empty list is really empty.
for (const width of WIDTHS) {
  test.describe(`Past entries at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 120_000 });

    test("open a past entry, delete it, and land on the list", async ({ page, request }) => {
      const { token } = await signUpFreshUser(request);
      await closedEntry(request, token, "He turned away.", "The bus stop");
      await closedEntry(request, token, "The kitchen.", "Sunday lunch");

      await authenticateAs(page, token);
      await page.goto("/tools/reflect");
      await page.getByRole("link", { name: "Past entries" }).click();
      await expect(page).toHaveURL(/\/tools\/reflect\/past$/);
      await expect(page.getByRole("main").getByRole("listitem").getByRole("link")).toHaveCount(2);
      await expectReflow(page);

      await page.getByRole("link", { name: /The bus stop/ }).click();
      await expect(page).toHaveURL(/\/tools\/reflect\/past\/[\w-]+$/);
      await expect(page.getByText("He turned away.")).toBeVisible();
      await expect(page.getByText("Scene", { exact: true })).toBeVisible();
      await expect(page.getByText(/stopped|incomplete/i)).toHaveCount(0);
      await expectReflow(page);

      await button(page, "Delete").click();
      await expect(page.getByText("This can't be undone.")).toBeVisible();
      await button(page, "Delete").last().click();

      await expect(page).toHaveURL(/\/tools\/reflect\/past$/);
      await expect(page.getByRole("link", { name: /Sunday lunch/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /The bus stop/ })).toHaveCount(0);
      // Back can't return to the deleted entry: history was replaced.
      await page.goBack();
      await expect(page).not.toHaveURL(/\/tools\/reflect\/past\/[\w-]+$/);
    });

    test("delete the last entry: the empty line, and the home has no Past entries link", async ({ page, request }) => {
      const { token } = await signUpFreshUser(request);
      const id = await closedEntry(request, token, "Only one.");

      await authenticateAs(page, token);
      await page.goto(`/tools/reflect/past/${id}`);
      await expect(page.getByText("Only one.")).toBeVisible();
      await button(page, "Delete").click();
      await button(page, "Delete").last().click();

      await expect(page).toHaveURL(/\/tools\/reflect\/past$/);
      await expect(page.getByText("Nothing here yet.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Reflect" })).toBeVisible();
      await expectReflow(page);

      await page.getByRole("link", { name: "Back to Reflect" }).click();
      await expect(page).toHaveURL(/\/tools\/reflect$/);
      await expect(page.getByRole("button", { name: "Start an entry" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Past entries" })).toHaveCount(0);
    });

    test("a deleted id and a stranger's id show the same not-found line", async ({ page, request }) => {
      const mine = await signUpFreshUser(request);
      const theirs = await signUpFreshUser(request);
      const strangers = await closedEntry(request, theirs.token, "Not yours.");

      await authenticateAs(page, mine.token);
      await page.goto(`/tools/reflect/past/${strangers}`);
      await expect(page.getByText("That entry isn't here.")).toBeVisible();
      await expect(page.getByText("Not yours.")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Back to Reflect" })).toBeVisible();
      await expectReflow(page);

      await page.goto("/tools/reflect/past/does-not-exist");
      await expect(page.getByText("That entry isn't here.")).toBeVisible();
    });
  });
}
