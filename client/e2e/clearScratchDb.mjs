// Deletes the e2e scratch database and its SQLite side files, before the
// e2e API's `prisma db push --force-reset` (playwright.config.ts).
//
// Why: the API runs SQLite in WAL mode, and Playwright kills it at the end of
// a run rather than closing it (it can't shut a server down gracefully on
// Windows), so the -wal and -shm files outlive it. --force-reset then
// truncates the .db but leaves them; the push reads the old schema through
// them, reports "in sync" and writes nothing, and the next run's API finds no
// tables ("The table `main.User` does not exist").
import fs from "node:fs";

const file = process.argv[2] ?? "";
if (!file.endsWith("e2e.db") || /dev\.db|test\.db|prod\.db/.test(file)) {
  console.error(`clearScratchDb refuses: "${file}" is not a scratch e2e.db`);
  process.exit(1);
}
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  fs.rmSync(file + suffix, { force: true });
}
