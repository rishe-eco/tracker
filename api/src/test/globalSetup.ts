import { execSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { applySqlitePragmas } from "../db/sqlitePragmas";

const TEST_DATABASE_URL = "file:./prisma/test.db";

export async function setup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, "../../"),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  // db push can recreate test.db, which resets journal_mode to the default, so
  // re-apply WAL here to match how the server runs.
  //
  // vitest's `test.env` config does not reach globalSetup — it applies to the
  // test workers. Without this assignment the client below would pick up
  // DATABASE_URL from .env and point at the *dev* database. Keep it as a
  // relative `file:` URL so Prisma resolves it against schema.prisma's
  // directory, exactly as the workers do.
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  const prisma = new PrismaClient();
  try {
    await applySqlitePragmas(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
