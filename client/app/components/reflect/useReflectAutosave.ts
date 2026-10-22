import { useCallback, useEffect, useRef, useState } from "react";
import type { ReflectTextField } from "./types";

/** Build plan §6.4: a field is saved this long after the person stops typing. */
export const AUTOSAVE_PAUSE_MS = 800;

/** Sends one field. Resolves true when the server took it, false when it didn't. */
export type SaveFields = (fields: Partial<Record<ReflectTextField, string>>) => Promise<boolean>;

/**
 * Reflect's autosave (G1, G3, D-15, build plan PD-1).
 *
 * - `setField` records the latest text for a field and, 800 ms after the last
 *   keystroke in it, sends that field alone. Each field has its own pause.
 * - Sends go through one queue, in the order they were made, so two saves of the
 *   same field can't land out of order.
 * - `flush()` sends what is waiting and resolves once nothing is pending or in
 *   flight. It rejects if a save failed. Next and Stop here `await` it before
 *   they act, so the story the reality check reads is never a stale one and a
 *   save never lands on an entry the next call has just closed (D-15).
 * - A failed save keeps the text in `pending` (and in the page), sets `failed`,
 *   and the next `flush()` or `retry()` sends it again.
 *
 * Nothing here writes to localStorage or sessionStorage, ever: Reflect text
 * lives in the page and the database only (G3, R7).
 */
export function useReflectAutosave(save: SaveFields) {
  const saveRef = useRef(save);
  saveRef.current = save;

  const pending = useRef<Partial<Record<ReflectTextField, string>>>({});
  const timers = useRef<Partial<Record<ReflectTextField, ReturnType<typeof setTimeout>>>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failedFields = useRef<Set<ReflectTextField>>(new Set());
  const [failed, setFailed] = useState(false);

  const sendField = useCallback(async (name: ReflectTextField) => {
    if (!(name in pending.current)) return;
    const value = pending.current[name] as string;
    delete pending.current[name];
    let ok = false;
    try {
      ok = await saveRef.current({ [name]: value });
    } catch {
      ok = false;
    }
    if (ok) {
      failedFields.current.delete(name);
    } else {
      // Keep the text for the next try, unless the person has typed more since.
      if (!(name in pending.current)) pending.current[name] = value;
      failedFields.current.add(name);
    }
    setFailed(failedFields.current.size > 0);
  }, []);

  const enqueue = useCallback(
    (name: ReflectTextField) => {
      queue.current = queue.current.then(() => sendField(name));
      return queue.current;
    },
    [sendField]
  );

  const setField = useCallback(
    (name: ReflectTextField, value: string) => {
      pending.current[name] = value;
      const existing = timers.current[name];
      if (existing) clearTimeout(existing);
      timers.current[name] = setTimeout(() => {
        delete timers.current[name];
        void enqueue(name);
      }, AUTOSAVE_PAUSE_MS);
    },
    [enqueue]
  );

  const flush = useCallback(async () => {
    for (;;) {
      for (const name of Object.keys(timers.current) as ReflectTextField[]) {
        clearTimeout(timers.current[name]);
        delete timers.current[name];
      }
      const names = Object.keys(pending.current) as ReflectTextField[];
      names.forEach((n) => void enqueue(n));
      await queue.current;
      if (failedFields.current.size > 0) throw new Error("not saved");
      // More typing may have landed while the queue ran.
      if (Object.keys(pending.current).length === 0 && Object.keys(timers.current).length === 0) return;
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

  return { setField, flush, retry, failed };
}
