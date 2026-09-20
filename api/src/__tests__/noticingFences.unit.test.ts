/**
 * The dossier fence, as a red build rather than a rule someone has to
 * remember (build plan §9.4). `schema.unit.test.ts` already parses the SDL
 * to catch what TypeScript cannot see inside a template literal — this
 * suite reads `prisma/schema.prisma` and `typeDefs.ts` as plain TEXT and
 * asks a narrower, more dangerous question: not "does this compile" but
 * "does this still refuse the things spec §4.3 and §5 refuse."
 *
 * Every check here is something a competent developer adds in good faith on
 * a Tuesday. A search box above a list of text entries is the single most
 * natural thing in the world to reach for. Writing the refusal in a doc
 * makes it a thing to remember; writing it here makes it a failing test.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(__dirname, "../../prisma/schema.prisma");
const TYPEDEFS_PATH = resolve(__dirname, "../graphql/schema/typeDefs.ts");

const schemaText = readFileSync(SCHEMA_PATH, "utf8");
const typeDefsText = readFileSync(TYPEDEFS_PATH, "utf8");

/**
 * The Noticing block of `schema.prisma` is the last thing in the file (the
 * comment banner through to EOF) — sliced by its own section marker rather
 * than by listing every model name, so a model added later is covered
 * automatically instead of needing this test updated to notice it.
 */
function noticingSchemaSection(): string {
  const marker = "Impact · Noticing (Act 1)";
  const start = schemaText.indexOf(marker);
  if (start === -1) throw new Error(`Could not find "${marker}" in schema.prisma — has it been renamed?`);
  return schemaText.slice(start);
}

/**
 * The Noticing TYPE definitions in `typeDefs.ts` — from the section banner
 * through to the next pillar's first type (SkillOverview, today). Query and
 * Mutation FIELD additions live inside the app's one shared `type Query` /
 * `type Mutation` blocks, interleaved with every other pillar's fields, so
 * they're checked separately below by name rather than by slicing a range.
 */
function noticingTypeSection(): string {
  const marker = "Impact · Noticing (Act 1)";
  const start = typeDefsText.indexOf(marker);
  if (start === -1) throw new Error(`Could not find "${marker}" in typeDefs.ts — has it been renamed?`);
  const end = typeDefsText.indexOf("type SkillOverview {", start);
  if (end === -1) {
    throw new Error("Could not find the sentinel after the Noticing type block — did the file get reordered?");
  }
  return typeDefsText.slice(start, end);
}

/**
 * The app's one shared `type Query { ... }` and `type Mutation { ... }` —
 * every pillar's fields live inside these two, so "the Noticing part of the
 * Query block" has to be found by slicing between named sentinels rather
 * than by a Noticing-specific banner (there isn't one inside these blocks).
 */
function queryBlock(): string {
  const start = typeDefsText.indexOf("\n  type Query {");
  const end = typeDefsText.indexOf("\n  type AuthPayload {", start);
  if (start === -1 || end === -1) {
    throw new Error("Could not find the Query block's own start/end sentinels — did the schema get reordered?");
  }
  return typeDefsText.slice(start, end);
}

function mutationBlock(): string {
  const start = typeDefsText.indexOf("\n  type Mutation {");
  if (start === -1) throw new Error("Could not find the Mutation block's start sentinel.");
  return typeDefsText.slice(start);
}

/**
 * Every Noticing query/mutation FIELD within one block (Query or Mutation),
 * found by name rather than by line range: every one of them —
 * noticingState, noticingHistory, updateNoticingFrame, setNoticingCapacity,
 * addNoticingPass, and so on — has "Noticing" in its own name by
 * convention, which is what makes finding them this way both correct and
 * durable against the block's fields being reordered. Captures the field
 * name and its raw argument list (empty string for a field with none).
 *
 * Case-insensitive on the leading letter specifically, not the whole match:
 * a field whose OWN name starts the identifier is lowercase-first by GraphQL
 * convention (`noticingState`, `noticingHistory`), while one where "Noticing"
 * sits mid-word is capitalized there (`updateNoticingFrame`) — a plain
 * case-sensitive `Noticing` silently matches only the second shape and
 * misses every top-level Noticing query, which is exactly the bug a
 * deliberate-violation sanity check on this suite caught during phase 6b.
 *
 * This also matches "Noticing:" inside a few doc-comment sentences (e.g.
 * `"Noticing: the authored content pack..."`), which is harmless here: those
 * matches carry no argument list, so they never contribute a name to any
 * forbidden-argument check below.
 */
function noticingFieldsWithArgsIn(block: string): { field: string; args: string }[] {
  const re = /(\w*[Nn]oticing\w*)\s*(?:\(([^)]*)\))?\s*:/g;
  const out: { field: string; args: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.push({ field: m[1], args: m[2] ?? "" });
  }
  return out;
}

/** Argument names in a raw arg-list string, comma- or newline-separated — see the test below for why this can't just split on ",". */
function argNames(args: string): string[] {
  return [...args.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
}

describe("the dossier fence — prisma/schema.prisma", () => {
  const section = noticingSchemaSection();

  it("has no @@index mentioning person on any Noticing model", () => {
    const indexLines = section.split("\n").filter((l) => l.includes("@@index"));
    const offenders = indexLines.filter((l) => /person/i.test(l));
    expect(offenders).toEqual([]);
  });

  it("declares no model named Person", () => {
    expect(section).not.toMatch(/\bmodel\s+Person\b/);
  });

  it("has no field named count, streak, total or tally on any Noticing model", () => {
    // Prisma field declarations start the line (after whitespace) with the
    // field name, then whitespace, then the type — `count Int` or
    // `streak   Int?`, never `personCount` (a different identifier) or a
    // doc-comment mentioning the word in passing.
    const offenders = section
      .split("\n")
      .filter((l) => /^\s*(count|streak|total|tally)\s+\S/.test(l));
    expect(offenders).toEqual([]);
  });
});

describe("the dossier fence — graphql/schema/typeDefs.ts", () => {
  const typeSection = noticingTypeSection();

  it("has no field named count, streak, total or tally anywhere in the Noticing type block", () => {
    // SDL field declarations are `name: Type` or `name(args): Type` — never
    // a doc-comment mentioning the word, which is why this matches the
    // field-declaration shape specifically rather than the bare word.
    const offenders = typeSection
      .split("\n")
      .filter((l) => /^\s*(count|streak|total|tally)\s*(\(|:)/.test(l));
    expect(offenders).toEqual([]);
  });

  it("exposes no lexicon field on the public content type or anywhere else in the block", () => {
    expect(typeSection).not.toMatch(/^\s*lexicon\s*:/m);
  });

  it("declares no type named Person, and no Noticing type keyed by person", () => {
    expect(typeSection).not.toMatch(/\btype\s+\w*Person\w*\b/);
  });

  it("every Noticing QUERY field accepts no search, person, query or name argument", () => {
    // Scoped to Query, not Mutation: a query taking a "person" argument
    // would be a lookup — the shape a dossier is actually built out of. A
    // WRITE mutation legitimately has a `person` argument
    // (updateNoticingEntry(entryId, person: String, ...) — free text for
    // the pass being recorded, checked separately below with its own,
    // narrower forbidden set), and banning the word there would ban the
    // domain's own field name, not the fence spec §4.3/§9.4 actually means.
    const forbidden = /^(search|person|query|name)$/;
    const offenders: string[] = [];
    for (const { field, args } of noticingFieldsWithArgsIn(queryBlock())) {
      for (const name of argNames(args)) {
        if (forbidden.test(name)) offenders.push(`${field}(${name}: ...)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every Noticing MUTATION field accepts no search, query or name argument", () => {
    // "person" is deliberately not forbidden here — see the note above. What
    // IS still checked: no mutation takes a "search" or "query" argument
    // (there is no reason a write would ever need one), and no "name"
    // argument (nothing in this domain is looked up or filed by a name).
    const forbidden = /^(search|query|name)$/;
    const offenders: string[] = [];
    for (const { field, args } of noticingFieldsWithArgsIn(mutationBlock())) {
      for (const name of argNames(args)) {
        if (forbidden.test(name)) offenders.push(`${field}(${name}: ...)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("updateNoticingEntry's own person argument is exactly the one exemption, and nothing wider slipped in with it", () => {
    // Pins the exemption itself, so it can't quietly grow: exactly one
    // Noticing mutation may take `person`, and it must be this one.
    const withPerson = noticingFieldsWithArgsIn(mutationBlock()).filter((f) => argNames(f.args).includes("person"));
    expect(withPerson.map((f) => f.field)).toEqual(["updateNoticingEntry"]);
  });

  it("noticingHistory returns a list of sittings, never a person-keyed type", () => {
    const match = typeDefsText.match(/noticingHistory\s*\([^)]*\)\s*:\s*([^\n]+)/);
    expect(match).not.toBeNull();
    const returnType = match![1].trim();
    expect(returnType).toBe("[NtcSitting!]!");
    expect(returnType).not.toMatch(/person/i);
  });

  it("found at least the fields this suite means to hold, so a rename can't silently empty it", () => {
    // A guard on the guard: if every one of these disappeared (e.g. the
    // "Noticing" substring convention were abandoned, or the Query/Mutation
    // sentinel strings got renamed), the checks above would pass vacuously
    // on an empty list. Pinning a known-present subset keeps that failure
    // mode loud instead of silent. Both blocks are pinned separately since
    // they were, in fact, found two different ways (see the case-sensitivity
    // note on `noticingFieldsWithArgsIn`) and could regress independently.
    const mutationNames = new Set(noticingFieldsWithArgsIn(mutationBlock()).map((f) => f.field));
    for (const expected of [
      "updateNoticingFrame",
      "startNoticingSitting",
      "updateNoticingEntry",
      "setNoticingCapacity",
      "setNoticingMotive",
      "addNoticingPass",
      "finishNoticingSitting",
    ]) {
      expect(mutationNames.has(expected)).toBe(true);
    }

    const queryNames = new Set(noticingFieldsWithArgsIn(queryBlock()).map((f) => f.field));
    expect(queryNames.has("noticingHistory")).toBe(true);
  });
});
