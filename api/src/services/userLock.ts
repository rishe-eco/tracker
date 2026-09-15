/**
 * Per-key in-process serialization.
 *
 * Calls sharing a `key` run one at a time, in arrival order; different keys
 * never block each other. A single writer is the operative assumption (SQLite is
 * single-writer, so the API is single-process) — this guards non-atomic
 * read-then-write flows against racing themselves within the process, not across
 * instances.
 *
 * Extracted from `runActionGathering`'s per-user gather lock (D-55) so the same
 * guard can serialize other find-or-create flows — e.g. opening a
 * feelings-&-needs sitting, where two concurrent opens both read "no active
 * sitting" and both insert (D-57). Namespace the key (`gather:${userId}`,
 * `fn-sitting:${userId}`) so unrelated operations for one user don't serialize
 * against each other.
 */
const chains = new Map<string, Promise<void>>();

export async function withUserLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Gate on the prior holder for this key, swallowing its outcome so one failed
  // run can't break the chain for the next caller.
  const prior = chains.get(key) ?? Promise.resolve();
  const gate = prior.then(
    () => {},
    () => {}
  );
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Reserve our slot synchronously so a concurrent caller chains after us.
  const slot = gate.then(() => mine);
  chains.set(key, slot);

  await gate;
  try {
    return await fn();
  } finally {
    release();
    // Drop the entry once we're the tail, so the map doesn't grow per key.
    if (chains.get(key) === slot) {
      chains.delete(key);
    }
  }
}
