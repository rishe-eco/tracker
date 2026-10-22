import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The reflow rule (design checklist §4): at a narrow width every control sits
 * inside the content column, and nothing scrolls sideways. Measured after
 * `document.fonts.ready`, because the page's text widths are those of the
 * loaded fonts, not the fallback's. The column is the layout's content box
 * (`main`'s scroll area, less its padding); the nav is outside it.
 */
export async function expectReflow(page: Page) {
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const col = document.querySelector("main > div:last-child") as HTMLElement | null;
    if (!col) return { error: "no content column" };
    const cs = getComputedStyle(col);
    const box = col.getBoundingClientRect();
    const left = box.left + parseFloat(cs.paddingLeft);
    const right = box.right - parseFloat(cs.paddingRight);
    const outside: string[] = [];
    col.querySelectorAll("button, a[href], input, textarea, select, [role='button']").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return; // not rendered
      if (r.left < left - 1 || r.right > right + 1) {
        const label = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40);
        outside.push(`${label} [${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(left)}..${Math.round(right)}]`);
      }
    });
    return {
      outside,
      columnScrolls: col.scrollWidth > col.clientWidth + 1,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  expect(result, "the reflow check found a content column").not.toHaveProperty("error");
  expect((result as any).outside, "controls outside the content column").toEqual([]);
  expect((result as any).columnScrolls, "the content column scrolls sideways").toBe(false);
  expect((result as any).pageScrolls, "the page scrolls sideways").toBe(false);
}
