import { describe, it, expect } from "vitest";
import { cn } from "~/lib/utils";

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, undefined, null as any, "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge: bg-blue-500 overrides bg-red-500
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("handles conditional objects (clsx syntax)", () => {
    expect(cn({ "font-bold": true, "font-normal": false })).toBe("font-bold");
  });
});
