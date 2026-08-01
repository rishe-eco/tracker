import { describe, it, expect } from "vitest";
import { replacePlaceholders } from "~/api/utils";

describe("replacePlaceholders", () => {
  it("replaces a single [1] placeholder", () => {
    expect(replacePlaceholders("Hello [1]!", ["World"])).toBe("Hello World!");
  });

  it("replaces multiple indexed placeholders", () => {
    expect(replacePlaceholders("[1] and [2]", ["foo", "bar"])).toBe("foo and bar");
  });

  it("leaves placeholder unchanged when value is missing", () => {
    expect(replacePlaceholders("[1] and [2]", ["only-one"])).toBe("only-one and [2]");
  });

  it("returns template unchanged when no placeholders", () => {
    expect(replacePlaceholders("no placeholders here", ["unused"])).toBe("no placeholders here");
  });

  it("replaces multiple occurrences of the same index", () => {
    expect(replacePlaceholders("[1] is [1]", ["cool"])).toBe("cool is cool");
  });
});
