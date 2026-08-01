import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotesModal from "~/components/notes/NotesModal";

// ── mocks ────────────────────────────────────────────────────────────────────

const mockCall = vi.fn();

vi.mock("~/api/useApi", () => ({
  useApi: () => ({ call: mockCall, getLastError: () => null }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const NOTE_1 = {
  id: "note-1",
  body: "First note",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};
const NOTE_2 = {
  id: "note-2",
  body: "Second note",
  createdAt: "2024-01-02T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function renderModal(
  props: Partial<React.ComponentProps<typeof NotesModal>> = {}
) {
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <NotesModal
        entityType={props.entityType ?? "goal"}
        entityId={props.entityId ?? "goal-123"}
        entityTitle={props.entityTitle}
        onClose={onClose}
      />
    ),
  };
}

/** Wait for the initial GET_NOTES fetch to resolve and show the notes list. */
async function waitForLoaded() {
  await waitFor(() =>
    expect(screen.queryByText("…")).not.toBeInTheDocument()
  );
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── initial render ───────────────────────────────────────────────────────────

describe("initial render", () => {
  it("shows loading indicator before fetch resolves", () => {
    // never resolves — we check before the promise settles
    mockCall.mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state when no notes returned", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    await waitFor(() =>
      expect(screen.getByText("notes.emptyState")).toBeInTheDocument()
    );
  });

  it("renders all notes returned by API", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1, NOTE_2] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));
    expect(screen.getByText("Second note")).toBeInTheDocument();
  });

  it("shows entity title in header when provided", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal({ entityTitle: "My Goal" });
    expect(
      screen.getByText('notes.notesFor:{"title":"My Goal"}')
    ).toBeInTheDocument();
  });

  it("shows generic title when entityTitle omitted", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    expect(screen.getByText("notes.modalTitle")).toBeInTheDocument();
  });
});

// ── close button ─────────────────────────────────────────────────────────────

describe("close button", () => {
  it("calls onClose when X is clicked", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText("notes.close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── add note ─────────────────────────────────────────────────────────────────

describe("add note", () => {
  it("add button is disabled when input is empty", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    await waitForLoaded();
    const addBtn = screen.getByRole("button", { name: /notes\.addButton/ });
    expect(addBtn).toBeDisabled();
  });

  it("add button is enabled when input has text", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    await waitForLoaded();
    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "new note" } });
    const addBtn = screen.getByRole("button", { name: /notes\.addButton/ });
    expect(addBtn).not.toBeDisabled();
  });

  it("adds note and appends to list on Enter key", async () => {
    mockCall.mockResolvedValueOnce({ notes: [] });
    mockCall.mockResolvedValueOnce({ addNote: NOTE_1 });
    renderModal();
    await waitForLoaded();

    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "First note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByText("First note")).toBeInTheDocument()
    );
  });

  it("adds note on add button click", async () => {
    mockCall.mockResolvedValueOnce({ notes: [] });
    mockCall.mockResolvedValueOnce({ addNote: NOTE_1 });
    renderModal();
    await waitForLoaded();

    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "First note" } });
    fireEvent.click(screen.getByRole("button", { name: /notes\.addButton/ }));

    await waitFor(() =>
      expect(screen.getByText("First note")).toBeInTheDocument()
    );
  });

  it("clears input after successful add", async () => {
    mockCall.mockResolvedValueOnce({ notes: [] });
    mockCall.mockResolvedValueOnce({ addNote: NOTE_1 });
    renderModal();
    await waitForLoaded();

    const input = screen.getByPlaceholderText(
      "notes.addPlaceholder"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "First note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(input.value).toBe(""));
  });

  it("does not submit on Enter when input is whitespace-only", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    await waitForLoaded();

    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // only the initial GET_NOTES call, no mutation
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Shift+Enter", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal();
    await waitForLoaded();

    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "new note" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(mockCall).toHaveBeenCalledTimes(1);
  });
});

// ── delete note ───────────────────────────────────────────────────────────────

describe("delete note", () => {
  it("removes note from list after delete", async () => {
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1, NOTE_2] });
    mockCall.mockResolvedValueOnce({ deleteNote: { id: "note-1" } });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getAllByLabelText("notes.deleteNote")[0]);

    await waitFor(() =>
      expect(screen.queryByText("First note")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Second note")).toBeInTheDocument();
  });

  it("shows empty state after deleting last note", async () => {
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1] });
    mockCall.mockResolvedValueOnce({ deleteNote: { id: "note-1" } });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("notes.deleteNote"));

    await waitFor(() =>
      expect(screen.getByText("notes.emptyState")).toBeInTheDocument()
    );
  });
});

// ── edit note ─────────────────────────────────────────────────────────────────

describe("edit note", () => {
  it("shows edit textarea when pencil icon is clicked", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    expect(
      screen.getByPlaceholderText("notes.editPlaceholder")
    ).toBeInTheDocument();
  });

  it("edit textarea is pre-filled with existing note body", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    const textarea = screen.getByPlaceholderText(
      "notes.editPlaceholder"
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("First note");
  });

  it("saves edited note on Enter and updates list", async () => {
    const updated = { ...NOTE_1, body: "Updated note" };
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1] });
    mockCall.mockResolvedValueOnce({ updateNote: updated });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    const textarea = screen.getByPlaceholderText("notes.editPlaceholder");
    fireEvent.change(textarea, { target: { value: "Updated note" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByText("Updated note")).toBeInTheDocument()
    );
    expect(screen.queryByText("First note")).not.toBeInTheDocument();
  });

  it("saves edited note on save button click", async () => {
    const updated = { ...NOTE_1, body: "Updated note" };
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1] });
    mockCall.mockResolvedValueOnce({ updateNote: updated });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    const textarea = screen.getByPlaceholderText("notes.editPlaceholder");
    fireEvent.change(textarea, { target: { value: "Updated note" } });
    fireEvent.click(screen.getByLabelText("notes.saveNote"));

    await waitFor(() =>
      expect(screen.getByText("Updated note")).toBeInTheDocument()
    );
  });

  it("cancels edit on Escape key, preserving original text", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    const textarea = screen.getByPlaceholderText("notes.editPlaceholder");
    fireEvent.change(textarea, { target: { value: "typing..." } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(
      screen.queryByPlaceholderText("notes.editPlaceholder")
    ).not.toBeInTheDocument();
    expect(screen.getByText("First note")).toBeInTheDocument();
  });

  it("cancels edit on cancel button click", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    fireEvent.click(screen.getByText("common.cancel"));

    expect(
      screen.queryByPlaceholderText("notes.editPlaceholder")
    ).not.toBeInTheDocument();
  });

  it("save button is disabled when edit textarea is empty", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    const textarea = screen.getByPlaceholderText("notes.editPlaceholder");
    fireEvent.change(textarea, { target: { value: "" } });

    expect(screen.getByLabelText("notes.saveNote")).toBeDisabled();
  });

  it("clicking edit on a second note switches edit focus", async () => {
    mockCall.mockResolvedValue({ notes: [NOTE_1, NOTE_2] });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    // start editing note 1
    const editBtns = screen.getAllByLabelText("common.edit");
    fireEvent.click(editBtns[0]);
    expect(
      (screen.getByPlaceholderText("notes.editPlaceholder") as HTMLTextAreaElement).value
    ).toBe("First note");

    // start editing note 2 — note 1 returns to view mode
    fireEvent.click(screen.getByLabelText("common.edit")); // only note 2's btn is visible now
    expect(
      (screen.getByPlaceholderText("notes.editPlaceholder") as HTMLTextAreaElement).value
    ).toBe("Second note");
  });
});

// ── api call args ─────────────────────────────────────────────────────────────

describe("API call arguments", () => {
  it("fetches notes with correct entityType and entityId on mount", async () => {
    mockCall.mockResolvedValue({ notes: [] });
    renderModal({ entityType: "project", entityId: "proj-42" });
    await waitForLoaded();

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { entityType: "project", entityId: "proj-42" },
      })
    );
  });

  it("sends correct variables when adding a note", async () => {
    mockCall.mockResolvedValueOnce({ notes: [] });
    mockCall.mockResolvedValueOnce({ addNote: NOTE_1 });
    renderModal({ entityType: "milestone", entityId: "ms-7" });
    await waitForLoaded();

    const input = screen.getByPlaceholderText("notes.addPlaceholder");
    fireEvent.change(input, { target: { value: "A new note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2));
    expect(mockCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: {
          entityType: "milestone",
          entityId: "ms-7",
          body: "A new note",
        },
      })
    );
  });

  it("sends correct id when updating a note", async () => {
    const updated = { ...NOTE_1, body: "Changed" };
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1] });
    mockCall.mockResolvedValueOnce({ updateNote: updated });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("common.edit"));
    fireEvent.change(screen.getByPlaceholderText("notes.editPlaceholder"), {
      target: { value: "Changed" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("notes.editPlaceholder"), {
      key: "Enter",
    });

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2));
    expect(mockCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: { id: "note-1", body: "Changed" },
      })
    );
  });

  it("sends correct id when deleting a note", async () => {
    mockCall.mockResolvedValueOnce({ notes: [NOTE_1] });
    mockCall.mockResolvedValueOnce({ deleteNote: { id: "note-1" } });
    renderModal();
    await waitFor(() => screen.getByText("First note"));

    fireEvent.click(screen.getByLabelText("notes.deleteNote"));

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2));
    expect(mockCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { id: "note-1" } })
    );
  });
});
