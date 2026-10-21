/**
 * Reflect's fences (B1; AC-5's schema half, AC-28's browser half, AC-45).
 *
 * Like `noticingFences.unit.test.ts`, this reads the schema and the source as
 * plain TEXT and asks what a competent developer might add in good faith on a
 * Tuesday: an index on the story so it can be searched, a `count` for a
 * friendly "you've written 12", a link to the Journal, a model call to
 * "summarise" an entry. Each is refused here rather than in a doc.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const API_SRC = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(__dirname, "../../prisma/schema.prisma");
const CLIENT_APP = resolve(__dirname, "../../../client/app");

const REFLECT_START = "Reflect · the observer recount";
const NOTICING_START = "Impact · Noticing (Act 1)";
const MODELS = ["ReflectEntry", "ReflectMoment", "ReflectReading", "ReflectState"];

const schemaText = readFileSync(SCHEMA_PATH, "utf8");

/**
 * Reflect's block of `schema.prisma`: from its banner to Noticing's banner.
 * Noticing's fences slice from its own banner to the end of the file, so a
 * Reflect model placed after it would be judged by Noticing's rules. Both
 * markers must be there or this throws, as Noticing's slicer does.
 */
function reflectSchemaSection(text: string = schemaText): string {
  const start = text.indexOf(REFLECT_START);
  if (start === -1) throw new Error(`Could not find "${REFLECT_START}" in schema.prisma. Has it been renamed?`);
  const end = text.indexOf(NOTICING_START, start);
  if (end === -1) {
    throw new Error(
      `Could not find "${NOTICING_START}" after Reflect's block in schema.prisma. ` +
        `Reflect's models must sit before Noticing's banner.`
    );
  }
  return text.slice(start, end);
}

/** Every `.ts` / `.tsx` file under a folder, as [path, text]. A missing folder is empty. */
function sourceFiles(dir: string): Array<[string, string]> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name): Array<[string, string]> => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(name) ? [[p, readFileSync(p, "utf8")]] : [];
  });
}

const TEXT_FIELDS = ["scene", "story", "close", "whenText", "feeling", "need", "reading", "camera"];
const FORBIDDEN_RELATIONS = ["Journal", "Goal", "Project", "JournalAccess"];

/** Violations of the schema half, over a block of text. Empty when the block holds. */
function schemaViolations(section: string): string[] {
  const out: string[] = [];
  const lines = section.split("\n");

  // No index or unique key over a text column (AC-5). An attribute lists its columns in `[...]`.
  for (const l of lines) {
    const m = l.match(/@@(index|unique)\(\s*\[([^\]]*)\]/);
    if (!m) continue;
    const cols = m[2].split(",").map((c) => c.trim().replace(/\(.*$/, ""));
    for (const c of cols) if (TEXT_FIELDS.includes(c)) out.push(`@@${m[1]} on ${c}: ${l.trim()}`);
  }
  // A field-level @unique or @id on a text column, too.
  for (const l of lines) {
    const m = l.match(/^\s*(\w+)\s+\S+.*@(unique|id)\b/);
    if (m && TEXT_FIELDS.includes(m[1])) out.push(`@${m[2]} on ${m[1]}: ${l.trim()}`);
  }

  // Nothing is counted (AC-44's schema half): no count, streak, total or tally field.
  for (const l of lines) {
    if (/^\s*(count|streak|total|tally)\s+\S/.test(l)) out.push(`counting field: ${l.trim()}`);
  }

  // No relation to the pillars' own text (AC-5): a field whose type is one of them.
  for (const l of lines) {
    const m = l.match(/^\s*\w+\s+(\w+)(\[\]|\?)?(\s|$)/);
    if (m && FORBIDDEN_RELATIONS.includes(m[1])) out.push(`relation to ${m[1]}: ${l.trim()}`);
  }
  return out;
}

describe("the schema fence (AC-5, AC-44)", () => {
  const section = reflectSchemaSection();

  it("the block sits before Noticing's banner, so Noticing's fences never judge it (D-2)", () => {
    const start = schemaText.indexOf(REFLECT_START);
    const noticing = schemaText.indexOf(NOTICING_START);
    expect(start).toBeGreaterThan(-1);
    expect(noticing).toBeGreaterThan(start);
    // And no Reflect model appears after Noticing's banner.
    expect(schemaText.slice(noticing)).not.toMatch(/\bmodel\s+Reflect\w*\s*\{/);
  });

  it("holds all four models (a guard on the guard)", () => {
    for (const name of MODELS) expect(section).toMatch(new RegExp(`\\bmodel\\s+${name}\\s*\\{`));
  });

  it("has no index or unique key on a text column", () => {
    expect(schemaViolations(section).filter((v) => v.startsWith("@"))).toEqual([]);
  });

  it("has no field named count, streak, total or tally", () => {
    expect(schemaViolations(section).filter((v) => v.startsWith("counting"))).toEqual([]);
  });

  it("relates to none of Journal, Goal, Project or JournalAccess", () => {
    expect(schemaViolations(section).filter((v) => v.startsWith("relation"))).toEqual([]);
  });

  it("the scanner sees a planted violation of each kind", () => {
    // A fence that cannot fail is decoration: prove each rule bites on text.
    expect(schemaViolations("  count Int\n")).toHaveLength(1);
    expect(schemaViolations("  @@index([story])\n")).toHaveLength(1);
    expect(schemaViolations("  @@index([userId, scene])\n")).toHaveLength(1);
    expect(schemaViolations("  @@unique([entryId, position])\n")).toEqual([]);
    expect(schemaViolations("  @@index([userId, closedAt])\n")).toEqual([]);
    expect(schemaViolations("  story String? @unique\n")).toHaveLength(1);
    expect(schemaViolations("  journal Journal @relation(fields: [journalId], references: [id])\n")).toHaveLength(1);
    expect(schemaViolations("  goals Goal[]\n")).toHaveLength(1);
  });

  it("the slicer throws if either marker is missing", () => {
    expect(() => reflectSchemaSection("nothing here")).toThrow(/Could not find/);
    expect(() => reflectSchemaSection(`// ${REFLECT_START}\nmodel X {}\n`)).toThrow(/Noticing's banner/);
  });
});

describe("the imports fence (AC-45, AC-28)", () => {
  it("no Reflect service or content file imports the Anthropic SDK or reads its key", () => {
    const files = [
      ...sourceFiles(join(API_SRC, "services/reflect")),
      ...sourceFiles(join(API_SRC, "content/reflect")),
    ];
    // The content pack exists, so an empty list means the walk is broken.
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter(([, text]) => /@anthropic-ai\//.test(text) || /ANTHROPIC/.test(text))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it("no file under client/app imports Reflect's content pack (the lexicon never reaches a browser)", () => {
    const files = sourceFiles(CLIENT_APP);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter(([, text]) => /content\/reflect/.test(text)).map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});
