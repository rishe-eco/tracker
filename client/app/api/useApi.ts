import { useState, useRef, useCallback } from "react";

type GraphQLResponse<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  call: (args?: {
    variables?: Record<string, any>;
    query?: string;
  }) => Promise<T | null>;
  /** Last error message from the API when call() returned null (e.g. GraphQL errors). Use this after await call() to show server error in forms. */
  getLastError: () => string | null;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/graphql";

export function useApi<T = any>(
  initialQuery?: string,
  defaultVariables?: Record<string, any>
): GraphQLResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const lastErrorRef = useRef<string | null>(null);
  const defaultVariablesRef = useRef(defaultVariables);
  defaultVariablesRef.current = defaultVariables;

  const call = useCallback(
    async ({
      variables = defaultVariablesRef.current,
      query = initialQuery,
    }: {
      variables?: Record<string, any>;
      query?: string;
    } = {}): Promise<T | null> => {
      setLoading(true);
      setError(null);
      lastErrorRef.current = null;

      try {
        const token = localStorage.getItem("token");

        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ query, variables }),
        });

        const json = await res.json();

        if (json.errors) {
          const message = json.errors[0]?.message || "Unknown error";
          setError(message);
          lastErrorRef.current = message;
          setLoading(false);
          return null;
        }

        setData(json.data);
        setLoading(false);
        return json.data;
      } catch (err: any) {
        const message = err.message || "Network error";
        setError(message);
        lastErrorRef.current = message;
        setLoading(false);
        return null;
      }
    },
    [initialQuery]
  );

  const getLastError = useCallback(() => lastErrorRef.current, []);

  return { data, error, loading, call, getLastError };
}
