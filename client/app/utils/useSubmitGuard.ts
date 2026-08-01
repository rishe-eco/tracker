import { useCallback, useRef, useState } from "react";

/**
 * Guards a mutation-firing handler against double submission.
 *
 * The `submitting` flag drives the button's spinner/disabled state, but state
 * updates are async — a fast double-click can dispatch two events before React
 * re-renders. The ref is the actual lock; the state is only for the UI.
 */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T> | T): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, run };
}

/**
 * Same guard, but tracks which item is in flight — for lists where each row has
 * its own button and only the clicked row should show a spinner.
 */
export function useKeyedSubmitGuard() {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T> | T): Promise<T | undefined> => {
      if (inFlight.current !== null) return undefined;
      inFlight.current = key;
      setSubmittingKey(key);
      try {
        return await fn();
      } finally {
        inFlight.current = null;
        setSubmittingKey(null);
      }
    },
    []
  );

  const isSubmitting = useCallback(
    (key: string) => submittingKey === key,
    [submittingKey]
  );

  return { submittingKey, isSubmitting, run, busy: submittingKey !== null };
}
