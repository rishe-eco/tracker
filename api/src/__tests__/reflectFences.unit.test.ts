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
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { queryResolvers } from "../graphql/resolvers/query";
import { mutationResolvers } from "../graphql/resolvers/mutations";

const API_SRC = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(__dirname, "../../prisma/schema.prisma");
const CLIENT_APP = resolve(__dirname, "../../../client/app");

const REFLECT_START = "Reflect · the observer recount";
const NOTICING_START = "Impact · Noticing (Act 1)";
const MODELS = ["ReflectEntry", "ReflectMoment", "ReflectReading", "ReflectState"];

const schemaText = readFileSync(SCHEMA_PATH, "utf8");
const TYPEDEFS_PATH = resolve(__dirname, "../graphql/schema/typeDefs.ts");
const typeDefsText = readFileSync(TYPEDEFS_PATH, "utf8");

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

/**
 * The files `roots` import, followed through relative imports to the end, roots
 * included. AC-45 is about a code path, and the app's one model call sits behind
 * a wrapper (`services/skills/clarity/anthropicJudge.ts`) whose import names
 * neither the SDK nor the key, so reading Reflect's own files is not enough.
 */
function importClosure(roots: Array<[string, string]>): Map<string, string> {
  const seen = new Map<string, string>(roots);
  const queue = roots.map(([p]) => p);
  const spec = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'](\.[^"']*)["']/g;
  while (queue.length) {
    const file = queue.shift()!;
    for (const m of seen.get(file)!.matchAll(spec)) {
      const base = resolve(dirname(file), m[1].replace(/\.js$/, ""));
      const hit = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
        .map((ext) => base + ext)
        .find((p) => existsSync(p) && statSync(p).isFile());
      if (hit && !seen.has(hit)) {
        seen.set(hit, readFileSync(hit, "utf8"));
        queue.push(hit);
      }
    }
  }
  return seen;
}

const TEXT_FIELDS =["scene", "story", "close", "whenText", "feeling", "need", "reading", "camera"];
const FORBIDDEN_RELATIONS = ["Journal", "Goal", "Project", "JournalAccess"];

/** Violations of the schema half, over a block of text. Empty when the block holds. */
function schemaViolations(section: string): string[] {
  const out: string[] = [];
  const lines = section.split("\n");

  // No index or unique key over a text column (AC-5). An attribute lists its columns in `[...]`,
  // positionally or as `fields: [...]`; a compound `@@id` is a unique key too.
  for (const l of lines) {
    const m = l.match(/@@(index|unique|id)\(\s*(?:fields\s*:\s*)?\[([^\]]*)\]/);
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
  // Nor the same link as a bare id column, with no relation line to give it away.
  for (const l of lines) {
    const m = l.match(/^\s*(\w+)Id\s+\S/);
    const target = m && FORBIDDEN_RELATIONS.find((r) => r.toLowerCase() === m[1].toLowerCase());
    if (target) out.push(`relation to ${target} (an id column): ${l.trim()}`);
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
    // Prisma's named-argument form is the same index, and a bare id column is
    // the same link without the relation line (both found at verify B1).
    expect(schemaViolations("  @@index(fields: [story])\n")).toHaveLength(1);
    expect(schemaViolations("  @@unique(fields: [entryId, reading], name: \"x\")\n")).toHaveLength(1);
    expect(schemaViolations("  @@id([scene])\n")).toHaveLength(1);
    expect(schemaViolations("  journalId String?\n")).toHaveLength(1);
    expect(schemaViolations("  goalId    String\n")).toHaveLength(1);
    expect(schemaViolations("  entryId   String\n")).toEqual([]);
  });

  it("the slicer throws if either marker is missing", () => {
    expect(() => reflectSchemaSection("nothing here")).toThrow(/Could not find/);
    expect(() => reflectSchemaSection(`// ${REFLECT_START}\nmodel X {}\n`)).toThrow(/Noticing's banner/);
  });
});

describe("the imports fence (AC-45, AC-28)", () => {
  it("no Reflect service or content file, nor any file it imports, uses the Anthropic SDK or reads its key", () => {
    const files = [
      ...sourceFiles(join(API_SRC, "services/reflect")),
      ...sourceFiles(join(API_SRC, "content/reflect")),
    ];
    // The content pack exists, so an empty list means the walk is broken.
    expect(files.length).toBeGreaterThan(0);
    // Every file a Reflect file reaches through its imports, not only its own.
    const offenders = [...importClosure(files)]
      .filter(([, text]) => /@anthropic-ai\//.test(text) || /ANTHROPIC/.test(text))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it("the import walk reaches a model call behind a wrapper (a guard on the guard)", () => {
    const session = join(API_SRC, "services/skills/clarity/claritySession.ts");
    const reached = [...importClosure([[session, readFileSync(session, "utf8")]]).keys()];
    expect(reached).toContain(join(API_SRC, "services/skills/clarity/anthropicJudge.ts"));
  });

  it("no file under client/app imports Reflect's content pack (the lexicon never reaches a browser)", () => {
    const files = sourceFiles(CLIENT_APP);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter(([, text]) => /content\/reflect/.test(text)).map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});

// ─── B2: the SDL half, the token refusal, the model-call half of the imports ──

const SDL_START = "# ── Reflect ──";
const FN_BANNER = "# ── Learn · Feelings & Needs (Module 1)";
const NOTICING_SDL_BANNER = "# ── Impact · Noticing (Act 1)";
const OPERATIONS = [
  "reflectHome", "reflectEntry", "reflectContent", "reflectPastEntries", "reflectPastEntry",
  "startReflectEntry", "saveReflectEntry", "saveReflectMoment", "saveReflectReading",
  "moveReflectEntry", "stopReflectEntry", "finishReflectEntry", "answerReflectEntry", "deleteReflectEntry",
];

/**
 * Reflect's block of `typeDefs.ts`: from its banner to the Feelings & Needs
 * banner. Noticing's fences slice from its own banner to `type SkillOverview {`,
 * so a Reflect type placed in that range would be judged by Noticing's rules (D-2).
 */
function reflectSdlSection(text: string = typeDefsText): string {
  const start = text.indexOf(SDL_START);
  if (start === -1) throw new Error(`Could not find "${SDL_START}" in typeDefs.ts. Has it been renamed?`);
  const end = text.indexOf(FN_BANNER, start);
  if (end === -1) throw new Error(`Could not find "${FN_BANNER}" after Reflect's block in typeDefs.ts.`);
  return text.slice(start, end);
}

/**
 * The type-system definitions in a text, `extend` ones included (they build into
 * the same schema). Bodies run to the next line holding only a closing brace.
 */
function definitions(text: string): Array<{ kind: string; name: string; body: string; at: number }> {
  const out: Array<{ kind: string; name: string; body: string; at: number }> = [];
  for (const m of text.matchAll(/^[ \t]*(?:extend\s+)?(type|enum|input|interface)\s+(\w+)[^{\n]*\{([\s\S]*?)^[ \t]*\}/gm)) {
    out.push({ kind: m[1], name: m[2], body: m[3], at: m.index! });
  }
  return out;
}

const HIDDEN_FIELD = /^(precheck\w*|afterAnswer|outcome|\w*SurfacedAt|lastCatchAt|lexicon)$/;
const FORBIDDEN_ARGS = ["search", "query", "filter", "name"];

/** Violations of the SDL half over a whole typeDefs text. Empty when it holds. */
function sdlViolations(text: string): string[] {
  const out: string[] = [];
  const start = text.indexOf(SDL_START);
  const end = text.indexOf(FN_BANNER, start);
  const defs = definitions(text);

  // No Reflect type outside its block, and nothing but Reflect types inside it.
  for (const d of defs) {
    const inside = start !== -1 && d.at >= start && d.at < end;
    if (d.name.startsWith("Reflect") && !inside) out.push(`type outside the block: ${d.name}`);
    if (!d.name.startsWith("Reflect") && inside) out.push(`non-Reflect type in the block: ${d.name}`);
  }

  // AC-3: no output type has a field for what is never shown back.
  for (const d of defs) {
    if (d.kind !== "type" || !d.name.startsWith("Reflect")) continue;
    for (const f of d.body.matchAll(/^[ \t]*(\w+)[ \t]*(?:\([^)]*\))?[ \t]*:/gm)) {
      if (HIDDEN_FIELD.test(f[1])) out.push(`${d.name}.${f[1]}`);
    }
  }

  // AC-5: no argument named search, query, filter or name on an operation with Reflect in its name.
  for (const root of ["Query", "Mutation"]) {
    for (const def of defs.filter((d) => d.name === root)) {
      for (const f of def.body.matchAll(/^[ \t]*(\w+)[ \t]*\(([^)]*)\)[ \t]*:/gm)) {
        if (!/reflect/i.test(f[1])) continue;
        for (const a of f[2].matchAll(/(\w+)\s*:/g)) {
          if (FORBIDDEN_ARGS.includes(a[1])) out.push(`${f[1]}(${a[1]})`);
        }
      }
    }
  }
  return out;
}

/**
 * AC-48: the type a past entry is returned as has no field for the step it
 * reached or its outcome, so nothing can show that an entry was stopped. Only
 * the open entry (`ReflectEntry`) carries its step, for resuming.
 */
function pastEntryViolations(text: string): string[] {
  const def = definitions(text).find((d) => d.name === "ReflectPastEntry");
  if (!def) return ["ReflectPastEntry is missing"];
  return [...def.body.matchAll(/^[ \t]*(\w+)[ \t]*(?:\([^)]*\))?[ \t]*:/gm)]
    .map((f) => f[1])
    .filter((f) => f === "step" || f === "outcome")
    .map((f) => `ReflectPastEntry.${f}`);
}

describe("the SDL fence (AC-3, AC-5, D-2)", () => {
  it("the block sits before the Feelings & Needs and Noticing banners", () => {
    const start = typeDefsText.indexOf(SDL_START);
    const fn = typeDefsText.indexOf(FN_BANNER);
    const noticing = typeDefsText.indexOf(NOTICING_SDL_BANNER);
    expect(start).toBeGreaterThan(-1);
    expect(fn).toBeGreaterThan(start);
    expect(noticing).toBeGreaterThan(fn);
  });

  it("holds the Reflect types (a guard on the guard)", () => {
    const names = definitions(reflectSdlSection()).map((d) => d.name);
    for (const n of ["ReflectEntry", "ReflectHome", "ReflectPastRow", "ReflectPastEntry", "ReflectContent", "ReflectMoveResult", "ReflectStep"]) {
      expect(names).toContain(n);
    }
  });

  it("no Reflect type is outside its block, no field returns a hidden value, no operation takes a search-like argument", () => {
    expect(sdlViolations(typeDefsText)).toEqual([]);
  });

  it("a past entry carries no step and no outcome (AC-48, G10)", () => {
    expect(pastEntryViolations(typeDefsText)).toEqual([]);
    // The fence sees each planted field, and an absent type (a guard on the guard).
    for (const field of ["step: ReflectStep!", "outcome: String"]) {
      const planted = typeDefsText.replace(/(type ReflectPastEntry \{\r?\n)/, "$1    " + field + "\n");
      expect(planted).not.toBe(typeDefsText);
      expect(pastEntryViolations(planted)).toHaveLength(1);
    }
    expect(pastEntryViolations("type ReflectEntry {\n  step: ReflectStep!\n}\n")).toEqual(["ReflectPastEntry is missing"]);
  });

  it("declares all 14 operations, each with Reflect in its name", () => {
    const defs = definitions(typeDefsText);
    const fields = (root: string) =>
      defs
        .filter((d) => d.name === root)
        .flatMap((d) => [...d.body.matchAll(/^[ \t]*(\w+)[ \t]*[(:]/gm)].map((m) => m[1]));
    const found = [...fields("Query"), ...fields("Mutation")].filter((f) => /reflect/i.test(f));
    expect([...found].sort()).toEqual([...OPERATIONS].sort());
  });

  it("the scanner sees a planted violation of each kind", () => {
    const withBlock = (inner: string, outside = "") => `  ${SDL_START}\n${inner}\n  ${FN_BANNER}\n${outside}`;
    const clean = "  type ReflectEntry {\n    id: ID!\n    step: String!\n  }\n";
    expect(sdlViolations(withBlock(clean))).toEqual([]);
    for (const field of [
      "precheckWhen: String", "precheckBefore: String", "afterAnswer: String", "outcome: String",
      "fauxSurfacedAt: String", "interpretationSurfacedAt: String", "lastCatchAt: String", "lexicon: [String!]!",
    ]) {
      expect(sdlViolations(withBlock(`  type ReflectEntry {\n    ${field}\n  }\n`))).toHaveLength(1);
    }
    // A Reflect type outside the block; another pillar's type inside it.
    expect(sdlViolations(withBlock(clean, "  type ReflectStray {\n    id: ID!\n  }\n"))).toHaveLength(1);
    expect(sdlViolations(withBlock("  type Stranger {\n    id: ID!\n  }\n"))).toHaveLength(1);
    // `extend type` builds into the same schema, so it is a definition too (found at verify B2):
    // a Reflect extension outside the block, carrying a hidden field, is two violations.
    expect(sdlViolations(withBlock(clean, "  extend type ReflectEntry {\n    outcome: String\n  }\n"))).toHaveLength(2);
    expect(sdlViolations(withBlock(clean, "  extend type Query {\n    reflectFind(search: String): Int\n  }\n"))).toHaveLength(1);
    // An operation argument named like a search.
    for (const arg of FORBIDDEN_ARGS) {
      const q = `  type Query {\n    reflectFind(${arg}: String): Int\n  }\n`;
      expect(sdlViolations(withBlock(clean, q))).toHaveLength(1);
    }
    // saveReflectEntry's own pre-check argument is allowed: field checks read output types only.
    const m = "  type Mutation {\n    saveReflectEntry(entryId: ID!, precheckWhen: String): Int\n  }\n";
    expect(sdlViolations(withBlock(clean, m))).toEqual([]);
    // Another pillar's operation with a `name` argument is not Reflect's business.
    expect(sdlViolations(withBlock(clean, "  type Query {\n    tagByName(name: String): Int\n  }\n"))).toEqual([]);
  });

  it("the slicer throws if a marker is missing", () => {
    expect(() => reflectSdlSection("nothing here")).toThrow(/Could not find/);
    expect(() => reflectSdlSection(`  ${SDL_START}\n`)).toThrow(/Could not find/);
  });
});

describe("tokens are refused on every Reflect operation (AC-4)", () => {
  const all: Record<string, any> = { ...queryResolvers, ...mutationResolvers };
  const names = Object.keys(all).filter((n) => /reflect/i.test(n));

  /** The operations that do not refuse a token context with the session-only message: empty when every one does. */
  async function unguarded(resolvers: Record<string, any>): Promise<string[]> {
    const out: string[] = [];
    for (const name of Object.keys(resolvers).filter((n) => /reflect/i.test(n))) {
      for (const scope of ["read", "write"]) {
        const ctx = { user: { id: "u" }, auth: { kind: "apiToken", tokenId: "t", scope }, prisma: {} };
        try {
          await resolvers[name](null, {}, ctx);
          out.push(name);
        } catch (e: any) {
          if (e?.message !== "Reflect is only available in the app, not to API tokens.") out.push(name);
        }
      }
    }
    return out;
  }

  it("finds all 14 operations (a guard on the guard)", () => {
    expect(names.length).toBeGreaterThan(0);
    expect([...names].sort()).toEqual([...OPERATIONS].sort());
  });

  it("each refuses a read-scope and a write-scope token with the session-only message, before touching anything", async () => {
    expect(await unguarded(all)).toEqual([]);
  });

  it("the check sees a planted resolver that is not guarded", async () => {
    expect(await unguarded({ ...all, reflectBare: async () => "leak" })).toEqual(["reflectBare", "reflectBare"]);
    // And one that refuses with the wrong words (convention 11: never "Unauthorized").
    const wrong = {
      reflectWrong: async () => {
        throw new Error("Unauthorized");
      },
    };
    expect(await unguarded(wrong)).toEqual(["reflectWrong", "reflectWrong"]);
  });
});

/**
 * Every model accessor on any client variable (`prisma`, `tx`, `ctx.prisma`) that names a model Reflect must not
 * touch, dotted or bracketed, and any raw query, which could reach any table.
 */
function modelCallViolations(text: string): string[] {
  const models = "(?:action|interval\\w*|goal|journal\\w*|loop\\w*|frameCompletion)";
  const patterns = [
    new RegExp(`\\b\\w+\\.${models}\\.\\w+\\(`, "g"),
    new RegExp(`\\b\\w+\\[\\s*["'\`]${models}["'\`]\\s*\\]`, "g"),
    /\$(?:query|execute)Raw\w*/g,
  ];
  return patterns.flatMap((p) => [...text.matchAll(p)].map((m) => m[0]));
}

describe("the model-call fence (AC-47, AC-26's table half)", () => {
  const files = sourceFiles(join(API_SRC, "services/reflect"));

  it("services/reflect names no action, interval, goal, journal, loop or frameCompletion model, and makes no raw query", () => {
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap(([p, text]) => modelCallViolations(text).map((v) => `${p}: ${v}`));
    expect(offenders).toEqual([]);
  });

  it("services/reflect has no console call", () => {
    const offenders = files.filter(([, text]) => /\bconsole\s*\./.test(text)).map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it("the check sees a planted violation of each kind", () => {
    expect(modelCallViolations("await prisma.action.create({})")).toHaveLength(1);
    expect(modelCallViolations("tx.interval.findMany()")).toHaveLength(1);
    expect(modelCallViolations("ctx.prisma.intervalStep.deleteMany()")).toHaveLength(1);
    expect(modelCallViolations("prisma.goal.count()")).toHaveLength(1);
    expect(modelCallViolations("prisma.journalEntry.create()")).toHaveLength(1);
    expect(modelCallViolations("prisma.loopSitting.count()")).toHaveLength(1);
    expect(modelCallViolations("prisma.frameCompletion.findFirst()")).toHaveLength(1);
    expect(modelCallViolations("prisma.reflectEntry.findFirst()")).toEqual([]);
    // Raw SQL and a bracketed accessor reach the same tables (found at verify B2).
    expect(modelCallViolations("prisma.$queryRaw`SELECT * FROM Action`")).toHaveLength(1);
    expect(modelCallViolations("tx.$executeRawUnsafe(sql)")).toHaveLength(1);
    expect(modelCallViolations('prisma["goal"].create()')).toHaveLength(1);
  });
});

// ─── B3: the import half of the catches (AC-26) ──────────────────────────────

const NOTICING_DIR = join(API_SRC, "services/noticing").replace(/\\/g, "/");
const DISTINCTIONS = join(API_SRC, "services/feelingsNeeds/distinctions").replace(/\\/g, "/");
const FN_DIR = join(API_SRC, "services/feelingsNeeds").replace(/\\/g, "/");
const BORROWED = ["detectFauxFeeling", "composeCatch"];

/** Every module specifier a text pulls in: static, re-exported, side-effect, dynamic or required, each with its clause. */
function specifiers(text: string): Array<{ spec: string; clause: string | null; typeOnly: boolean }> {
  const out: Array<{ spec: string; clause: string | null; typeOnly: boolean }> = [];
  for (const m of text.matchAll(/\b(import|export)\s+(type\s+)?([^;"']*?)\s*from\s*["']([^"']+)["']/g)) {
    out.push({ spec: m[4], clause: m[3], typeOnly: m[2] != null });
  }
  for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) out.push({ spec: m[1], clause: null, typeOnly: false });
  for (const m of text.matchAll(/\b(?:import|require)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    out.push({ spec: m[1], clause: null, typeOnly: false });
  }
  return out;
}

/** Violations of the catches' import rule in one file's text. Empty when it holds. */
function importViolations(file: string, text: string): string[] {
  const out: string[] = [];
  for (const { spec, clause, typeOnly } of specifiers(text)) {
    const bare = spec.replace(/\.js$/, "");
    const resolved = (bare.startsWith(".") ? resolve(dirname(file), bare) : join(API_SRC, bare)).replace(/\\/g, "/");
    if (resolved === NOTICING_DIR || resolved.startsWith(NOTICING_DIR + "/") || /noticing\/catches$/.test(bare)) {
      out.push(`imports Noticing: ${spec}`);
      continue;
    }
    // F&N's other service files read its tables and call its whole-decision function (AC-26, found at verify B3).
    if ((resolved === FN_DIR || resolved.startsWith(FN_DIR + "/")) && resolved !== DISTINCTIONS) {
      out.push(`imports Feelings & Needs' service: ${spec}`);
      continue;
    }
    if (resolved !== DISTINCTIONS) continue;
    // Only `detectFauxFeeling`, `composeCatch` and types may be borrowed from the faux-feeling file.
    if (typeOnly) continue;
    const named = clause?.match(/^\{([\s\S]*)\}$/);
    if (!named) {
      out.push(`imports all of ${spec}${clause ? ` (${clause.trim()})` : ""}`);
      continue;
    }
    for (const item of named[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      if (/^type\s/.test(item)) continue;
      const name = item.split(/\s+as\s+/)[0].trim();
      if (!BORROWED.includes(name)) out.push(`imports ${name} from ${spec}`);
    }
  }
  return out;
}

describe("the catches' imports fence (AC-26)", () => {
  const files = sourceFiles(join(API_SRC, "services/reflect"));

  it("services/reflect imports nothing from Noticing or F&N's other service files, and only detectFauxFeeling, composeCatch and types from distinctions", () => {
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap(([p, text]) => importViolations(p, text).map((v) => `${p}: ${v}`));
    expect(offenders).toEqual([]);
  });

  it("the catches file does borrow the two functions (a guard on the guard)", () => {
    const catches = files.find(([p]) => /services[\\/]reflect[\\/]catches\.ts$/.test(p));
    expect(catches).toBeDefined();
    const text = catches![1];
    expect(text).toMatch(/import\s*\{[^}]*\bdetectFauxFeeling\b[^}]*\}\s*from\s*["']\.\.\/feelingsNeeds\/distinctions["']/);
    expect(text).toMatch(/import\s*\{[^}]*\bcomposeCatch\b[^}]*\}\s*from\s*["']\.\.\/feelingsNeeds\/distinctions["']/);
  });

  it("the check sees a planted violation of each kind", () => {
    const f = join(API_SRC, "services/reflect/planted.ts");
    const d = '"../feelingsNeeds/distinctions"';
    // Allowed.
    expect(importViolations(f, `import { detectFauxFeeling, composeCatch } from ${d};`)).toEqual([]);
    expect(importViolations(f, `import { composeCatch, type SurfacedCatch } from ${d};`)).toEqual([]);
    expect(importViolations(f, `import type { SurfacedCatch } from ${d};`)).toEqual([]);
    expect(importViolations(f, `import { x } from "../noticingLike/other";`)).toEqual([]);
    // The two functions Reflect must never call, one planted each, also across lines and renamed.
    expect(importViolations(f, `import { maybeCatch } from ${d};`)).toHaveLength(1);
    expect(importViolations(f, `import { catchAllowed } from ${d};`)).toHaveLength(1);
    expect(importViolations(f, `import {\n  composeCatch,\n  maybeCatch as m,\n} from ${d};`)).toHaveLength(1);
    expect(importViolations(f, `import * as d from ${d};`)).toHaveLength(1);
    expect(importViolations(f, `export * from ${d};`)).toHaveLength(1);
    expect(importViolations(f, `const d = await import(${d});`)).toHaveLength(1);
    // Noticing, by relative path, by the app's root path, by its matcher, and by require.
    expect(importViolations(f, `import { detectCatch } from "../noticing/catches";`)).toHaveLength(1);
    expect(importViolations(f, `import { x } from "../noticing";`)).toHaveLength(1);
    expect(importViolations(f, `import { x } from "services/noticing/catches.js";`)).toHaveLength(1);
    expect(importViolations(f, `import type { SurfacedCatch } from "../noticing/catches";`)).toHaveLength(1);
    expect(importViolations(f, `const n = require("../noticing/state");`)).toHaveLength(1);
    // F&N's other service files reach its tables and its whole-decision function by another door (found at verify B3).
    expect(importViolations(f, `import { updateEntry } from "../feelingsNeeds/session";`)).toHaveLength(1);
    expect(importViolations(f, `import { ensureLoopState } from "../feelingsNeeds/state";`)).toHaveLength(1);
    expect(importViolations(f, `import { x } from "../feelingsNeeds";`)).toHaveLength(1);
  });
});
