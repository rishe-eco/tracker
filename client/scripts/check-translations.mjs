#!/usr/bin/env node
/**
 * check-translations.mjs
 *
 * 1. Finds keys present in EN but missing from FA (and vice versa).
 * 2. Finds t("key") calls in source that don't exist in the EN locale.
 *
 * Exit 1 if any issues found; exit 0 if clean.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flatten(obj, prefix = "") {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(acc, flatten(val, full));
    } else {
      acc[full] = val;
    }
    return acc;
  }, {});
}

function loadLocale(lang) {
  const path = join(ROOT, "app", "locales", lang, "common.json");
  return flatten(JSON.parse(readFileSync(path, "utf8")));
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vite"]);

function collectFiles(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        out.push(...collectFiles(join(dir, entry.name), exts));
      }
    } else if (exts.includes(extname(entry.name))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** Extract all literal string arguments from t("…") calls. */
function extractTKeys(src) {
  const keys = new Set();
  // t("key"), t('key') — no template literals (those are dynamic, skip)
  for (const m of src.matchAll(/\bt\(["']([^"'\s]+)["']\)/g)) {
    keys.add(m[1]);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Load locales
// ---------------------------------------------------------------------------

const en = loadLocale("en");
const fa = loadLocale("fa");
const enKeys = new Set(Object.keys(en));
const faKeys = new Set(Object.keys(fa));

// ---------------------------------------------------------------------------
// 1. Cross-locale key diff
// ---------------------------------------------------------------------------

const missingInFa = [...enKeys].filter((k) => !faKeys.has(k)).sort();
const missingInEn = [...faKeys].filter((k) => !enKeys.has(k)).sort();

// ---------------------------------------------------------------------------
// 2. Keys used in source but absent from EN locale
// ---------------------------------------------------------------------------

const appDir = join(ROOT, "app");
const srcFiles = collectFiles(appDir, [".ts", ".tsx"]);

/** @type {Map<string, string[]>} key → file list */
const keyFiles = new Map();

for (const file of srcFiles) {
  const src = readFileSync(file, "utf8");
  for (const key of extractTKeys(src)) {
    if (!keyFiles.has(key)) keyFiles.set(key, []);
    keyFiles.get(key).push(file.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  }
}

const missingFromLocales = [...keyFiles.keys()]
  .filter((k) => !enKeys.has(k))
  .sort();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let hasIssues = false;

if (missingInFa.length > 0) {
  hasIssues = true;
  console.error(`\n❌  ${missingInFa.length} key(s) in EN missing from FA:`);
  for (const k of missingInFa) console.error(`     ${k}`);
}

if (missingInEn.length > 0) {
  hasIssues = true;
  console.error(`\n⚠️   ${missingInEn.length} key(s) in FA missing from EN:`);
  for (const k of missingInEn) console.error(`     ${k}`);
}

if (missingFromLocales.length > 0) {
  hasIssues = true;
  console.error(
    `\n🔍  ${missingFromLocales.length} key(s) used in source but absent from EN locale:`
  );
  for (const k of missingFromLocales) {
    console.error(`     ${k}`);
    for (const f of keyFiles.get(k)) console.error(`       └ ${f}`);
  }
}

if (!hasIssues) {
  console.log("✅  All translations look good!");
} else {
  process.exit(1);
}
