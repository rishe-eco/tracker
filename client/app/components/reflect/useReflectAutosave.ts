import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveValue } from "./types";

/** Build plan §6.4: a field is saved this long after the person stops typing. */
export const AUTOSAVE_PAUSE_MS = 800;

/**
 * Sends one key's value. Resolves true when the server took it, false when it
 * didn't. The page keeps one function and picks the mutation from the key's
 * kind: `scene`, `story` and `close` are the entry's, `moment:<i>:<field>` a
 * moment's, `reading:<i>:<field>` a reading's.
 */
export type SaveKey = (key: string, value: SaveValue) => Promise<boolean>;

/**
 * Reflect's autosave (G1, G3, D-15, build plan PD-1).
 *
 * - `setField` records the latest value for a key and, 800 ms after the last
 *   keystroke in it, sends that key alone. Each key has its own pause.
 * - `hold` records a value and sets no timer: it is sent by `commit`, by
 *   `flush` or by a later `setField`. An own feeling or need is held, so a
 *   half-typed word is never sent on a pause and can't surface the faux offer.
 * - `commit` sends a key now (a chip tap, a blur, Enter), in the same queue.
 * - Sends go through one queue, in the order they were made, so two saves of the
 *   same key can't land out of order, and a new card's first write lands before
 *   its second.
 * - `flush()` sends what is waiting, held values included, and resolves once
 *   nothing is pending or in flight. It rejects if a save failed. Next, Back,
 *   Finish and Stop here `await` it before they act, so the story the reality
 *   check reads is never a stale one and a save never lands on an entry the next
 *   call has just closed (D-15).
 * - A failed save keeps the value in `pending` (and in the page), sets `failed`,
 *   and the next `flush()` or `retry()` sends it again.
 *
 * Nothing here writes to localStorage or sessionStorage, ever: Reflect text
 * lives in the page and the database only (G3, R7).
 */
export function useReflectAutosave(save: SaveKey) {
  const saveRef = useRef(save);
  saveRef.current = save;

  const pending = useRef<Map<string, SaveValue>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failedKeys = useRef<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const sendKey = useCallback(async (key: string) => {
    if (!pending.current.has(key)) return;
    const value = pending.current.get(key) as SaveValue;
    pending.current.delete(key);
    let ok = false;
    try {
      ok = await saveRef.current(key, value);
    } catch {
      ok = false;
    }
    if (ok) {
      failedKeys.current.delete(key);
    } else {
      // Keep the value for the next try, unless the person has changed it since.
      if (!pending.current.has(key)) pending.current.set(key, value);
      failedKeys.current.add(key);
    }
    setFailed(failedKeys.current.size > 0);
  }, []);

  const enqueue = useCallback(
    (key: string) => {
      queue.current = queue.current.then(() => sendKey(key));
      return queue.current;
    },
    [sendKey]
  );

  const clearTimer = (key: string) => {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.delete(key);
  };

  const setField = useCallback(
    (key: string, value: SaveValue) => {
      pending.current.set(key, value);
      clearTimer(key);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          void enqueue(key);
        }, AUTOSAVE_PAUSE_MS)
      );
    },
    [enqueue]
  );

  const hold = useCallback((key: string, value: SaveValue) => {
    pending.current.set(key, value);
    clearTimer(key);
  }, []);

  const commit = useCallback(
    (key: string, value?: SaveValue) => {
      if (value !== undefined) pending.current.set(key, value);
      clearTimer(key);
      return enqueue(key);
    },
    [enqueue]
  );

  const flush = useCallback(async () => {
    for (;;) {
      for (const key of Array.from(timers.current.keys())) clearTimer(key);
      Array.from(pending.current.keys()).forEach((k) => void enqueue(k));
      await queue.current;
      if (failedKeys.current.size > 0) throw new Error("not saved");
      // More typing may have landed while the queue ran.
      if (pending.current.size === 0 && timers.current.size === 0) return;
    }
  }, [enqueue]);

  const retry = useCallback(async () => {
    try {
      await flush();
    } catch {
      /* still failing: `failed` stays true and the line stays up */
    }
  }, [flush]);

  // Leaving the page with text waiting still sends it, best effort.
  useEffect(
    () => () => {
      void flush().catch(() => {});
    },
    [flush]
  );

  return { setField, hold, commit, flush, retry, failed };
}
