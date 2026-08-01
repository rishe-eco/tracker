import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { Button } from "~/components/ui/button";
import { Spinner, LoadingBlock } from "~/components/ui/spinner";
import { useSubmitGuard, useKeyedSubmitGuard } from "~/utils/useSubmitGuard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ── Spinner ──────────────────────────────────────────────────────────────────

describe("Spinner", () => {
  it("exposes an accessible status label so the visible text can be dropped", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("common.loading");
  });

  it("accepts a custom label for context-specific loading states", () => {
    render(<LoadingBlock label="wizard.loadingAfterDay" />);
    expect(screen.getByRole("status")).toHaveTextContent("wizard.loadingAfterDay");
  });
});

// ── Button loading prop ──────────────────────────────────────────────────────

describe("Button loading state", () => {
  it("disables the button and shows a spinner while loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: /Save/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("cannot be clicked again once loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays clickable when not loading", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps an explicit disabled prop when not loading", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  });
});

// ── useSubmitGuard ───────────────────────────────────────────────────────────

describe("useSubmitGuard", () => {
  it("runs the handler and reports submitting while in flight", async () => {
    const { result } = renderHook(() => useSubmitGuard());
    expect(result.current.submitting).toBe(false);

    let release!: () => void;
    const pending = new Promise<void>((res) => (release = res));

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.run(() => pending);
    });
    await waitFor(() => expect(result.current.submitting).toBe(true));

    await act(async () => {
      release();
      await call;
    });
    expect(result.current.submitting).toBe(false);
  });

  it("ignores a second call fired before the first settles", async () => {
    const { result } = renderHook(() => useSubmitGuard());
    const fn = vi.fn().mockImplementation(() => new Promise((res) => setTimeout(res, 20)));

    await act(async () => {
      // Both dispatched synchronously — the state update has not landed yet, so
      // only the ref guard can prevent the double submit.
      await Promise.all([result.current.run(fn), result.current.run(fn)]);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("releases the lock even when the handler throws", async () => {
    const { result } = renderHook(() => useSubmitGuard());
    const boom = vi.fn().mockRejectedValue(new Error("nope"));

    await act(async () => {
      await result.current.run(boom).catch(() => {});
    });
    expect(result.current.submitting).toBe(false);

    const ok = vi.fn().mockResolvedValue("done");
    await act(async () => {
      await result.current.run(ok);
    });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

// ── useKeyedSubmitGuard ──────────────────────────────────────────────────────

describe("useKeyedSubmitGuard", () => {
  it("reports busy only for the key being submitted", async () => {
    const { result } = renderHook(() => useKeyedSubmitGuard());

    let release!: () => void;
    const pending = new Promise<void>((res) => (release = res));

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.run("row-1", () => pending);
    });
    await waitFor(() => expect(result.current.isSubmitting("row-1")).toBe(true));
    expect(result.current.isSubmitting("row-2")).toBe(false);

    await act(async () => {
      release();
      await call;
    });
    expect(result.current.isSubmitting("row-1")).toBe(false);
  });

  it("blocks a different key while one is in flight, since these refetch shared state", async () => {
    const { result } = renderHook(() => useKeyedSubmitGuard());
    const fn = vi.fn().mockImplementation(() => new Promise((res) => setTimeout(res, 20)));

    await act(async () => {
      await Promise.all([
        result.current.run("row-1", fn),
        result.current.run("row-2", fn),
      ]);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
