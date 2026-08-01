#!/usr/bin/env node
/**
 * check-hardcoded-strings.mjs
 *
 * Finds user-facing strings written straight into JSX instead of going through
 * i18next. Every UI string is supposed to live in app/locales/{en,fa}/common.json
 * and reach the screen via t("…").
 *
 * Two kinds of hit are reported:
 *   1. JSX text nodes   — <p>Hello</p>
 *   2. JSX attributes   — <input placeholder="Hello" />, aria-label="Hello"
 *
 * The file is parsed with the TypeScript compiler rather than matched with a
 * regex: a regex over ">…<" cannot tell a text node from TS generic syntax
 * (`Set<string>`, `(id: string) => void`) and drowns real hits in false ones.
 *
 * Exit 1 if any hits are found; exit 0 if clean.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, extname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP_DIR = join(ROOT, "app");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vite"]);

/**
 * Directories under app/ that are not shipped UI:
 *   test    — fixtures and assertions deliberately use literal English
 *   welcome — unreferenced React Router starter scaffolding
 */
const SKIP_APP_DIRS = new Set(["test", "welcome"]);

/** Attributes whose string value is rendered or read aloud to the user. */
const USER_FACING_ATTRS = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
]);

/**
 * Text that is punctuation, an arrow, an ellipsis, an entity or a bare number
 * carries no language and never needs translating.
 */
function isTranslatable(text) {
  if (!/\p{Letter}/u.test(text)) return false;
  // Single stray letters ("x" separators, unit suffixes) are noise.
  if (text.replace(/[^\p{Letter}]/gu, "").length < 2) return false;
  return true;
}

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...collectFiles(join(dir, entry.name)));
    } else if (extname(entry.name) === ".tsx") {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** @returns {{file: string, line: number, kind: string, text: string}[]} */
function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const sourceFile = ts.createSourceFile(
    absPath,
    src,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );
  const file = relative(ROOT, absPath).split(sep).join("/");
  const hits = [];

  const report = (node, kind, text) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    hits.push({ file, line: line + 1, kind, text });
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim().replace(/\s+/g, " ");
      if (isTranslatable(text)) report(node, "text", text);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (USER_FACING_ATTRS.has(name)) {
        // placeholder="Hello" and placeholder={"Hello"} both count.
        const init = node.initializer;
        const literal = ts.isStringLiteral(init)
          ? init
          : ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)
            ? init.expression
            : null;
        if (literal && isTranslatable(literal.text)) {
          report(node, `attr ${name}`, literal.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return hits;
}

const hits = collectFiles(APP_DIR)
  .filter((f) => !SKIP_APP_DIRS.has(relative(APP_DIR, f).split(sep)[0]))
  .flatMap(scanFile);

if (hits.length > 0) {
  console.error(`\n❌  ${hits.length} hardcoded UI string(s) — these should go through t("…"):`);
  let current = null;
  for (const hit of hits) {
    if (hit.file !== current) {
      current = hit.file;
      console.error(`\n   ${current}`);
    }
    console.error(`     ${hit.line}: [${hit.kind}] ${JSON.stringify(hit.text)}`);
  }
  console.error("");
  process.exit(1);
} else {
  console.log("✅  No hardcoded UI strings found.");
}
