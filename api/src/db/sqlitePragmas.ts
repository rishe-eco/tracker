import type { PrismaClient } from "@prisma/client";

/**
 * Switch the database to WAL. SQLite's default journal_mode=delete makes a
 * commit fsync the journal, the database, and the containing directory; WAL
 * commits append to a single log instead, and readers no longer block behind
 * the writer.
 *
 * journal_mode is persisted in the database header, so this only has to run
 * once per file — but it is idempotent and cheap, so we apply it on every boot
 * to cover freshly created databases (notably the test DB, which
 * `prisma db push` recreates).
 *
 * Deliberately not setting `synchronous` here: unlike journal_mode it is
 * per-connection state, not stored in the file, so a single call at startup
 * would only affect whichever pooled connection happened to serve it and would
 * silently not apply to the rest. Leaving it at the default FULL means commits
 * still fsync the WAL, which is the durable choice and already far cheaper than
 * delete-mode. Lowering it to NORMAL would need `connection_limit=1` on the
 * datasource URL (or a per-connection hook) to be meaningful.
 */
export async function applySqlitePragmas(prisma: PrismaClient): Promise<void> {
  // journal_mode returns a row ("wal"), so it has to go through $queryRaw.
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
}
