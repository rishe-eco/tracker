import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActionPreview from "~/components/actions/ActionPreview";
import type { Action } from "~/components/actions/ActionsListPage";

// ── mocks ────────────────────────────────────────────────────────────────────

const mockCall = vi.fn().mockResolvedValue({});

vi.mock("~/api/useApi", () => ({
  useApi: () => ({ call: mockCall }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/notes/NotesModal", () => ({
  default: () => null,
}));

vi.mock("~/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm }: any) =>
    open ? <button onClick={onConfirm}>confirm-delete</button> : null,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    title: "Buy milk",
    done: false,
    priority: "P",
    ...overrides,
  };
}

function renderAction(props: Partial<React.ComponentProps<typeof ActionPreview>> = {}) {
  return render(
    <ActionPreview
      action={makeAction(props.action as any)}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("ActionPreview rendering", () => {
  it("renders the action title", () => {
    renderAction({ action: makeAction({ title: "Do laundry" }) });
    expect(screen.getByText("Do laundry")).toBeInTheDocument();
  });

  it("renders a checked checkbox when action.done=true", () => {
    renderAction({ action: makeAction({ done: true }) });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.getAttribute("data-state")).toBe("checked");
  });

  it("renders an unchecked checkbox when action.done=false", () => {
    renderAction({ action: makeAction({ done: false }) });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
  });

  it("shows Backlog status when action has no tbd date", () => {
    renderAction({ action: makeAction({ done: false }) });
    expect(screen.getByText("goalManage.statusBacklog")).toBeInTheDocument();
  });

  it("shows Done status when action.done=true", () => {
    renderAction({ action: makeAction({ done: true }) });
    expect(screen.getByText("goalManage.statusDone")).toBeInTheDocument();
  });

  it("shows TBD status for a future tbd date", () => {
    renderAction({ action: makeAction({ done: false, tbd: FUTURE_DATE as any }) });
    expect(screen.getByText("goalManage.statusTbd")).toBeInTheDocument();
  });

  it("shows Ignored status for a past tbd date", () => {
    renderAction({ action: makeAction({ done: false, tbd: PAST_DATE as any }) });
    expect(screen.getByText("goalManage.statusIgnored")).toBeInTheDocument();
  });
});

describe("ActionPreview toggle", () => {
  it("calls TOGGLE_ACTION API when checkbox is clicked", async () => {
    renderAction({ action: makeAction({ done: false }) });
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    await waitFor(() => expect(mockCall).toHaveBeenCalledOnce());
  });

  it("calls onToggle prop with new done state", async () => {
    const onToggle = vi.fn();
    renderAction({ action: makeAction({ done: false }), onToggle });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("a1", true);
  });
});

describe("ActionPreview delete", () => {
  it("calls DELETE_ACTION and onDelete prop after confirmation", async () => {
    const onDelete = vi.fn();
    renderAction({ action: makeAction(), onDelete });

    // Click the Trash2 delete button (sr-only text = t("common.delete"))
    const deleteBtn = screen.getByRole("button", { name: "common.delete" });
    fireEvent.click(deleteBtn);

    // ConfirmDialog mock renders confirm button when open=true
    const confirmBtn = await screen.findByText("confirm-delete");
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(mockCall).toHaveBeenCalled());
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("a1"));
  });
});
