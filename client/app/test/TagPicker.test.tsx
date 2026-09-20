import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import TagPicker from "~/components/tags/TagPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => (opts?.name ? `${key}:${opts.name}` : key) }),
}));

// TagPicker renders a react-router <Link> ("manage tags"), so every render needs a router.
const renderPicker = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const TAGS = [
  { id: "t1", name: "deep-work", color: "indigo" },
  { id: "t2", name: "creative", color: "amber" },
  { id: "t3", name: "admin", color: "slate" },
];

describe("TagPicker — editable mode", () => {
  it("renders selected tags as chips, unselected tags only in the add dropdown", () => {
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={() => {}} />);
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    // "creative" is unselected — it appears once, as an <option>, not as a chip.
    const creativeMatches = screen.getAllByText("creative");
    expect(creativeMatches).toHaveLength(1);
    expect(creativeMatches[0].tagName).toBe("OPTION");
  });

  it("adds a tag via the dropdown", () => {
    const onChange = vi.fn();
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={onChange} />);
    const select = screen.getByLabelText("tags.addTag");
    fireEvent.change(select, { target: { value: "t2" } });
    expect(onChange).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("removes a tag via its × button", () => {
    const onChange = vi.fn();
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={["t1", "t2"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("tags.removeTag:deep-work"));
    expect(onChange).toHaveBeenCalledWith(["t2"]);
  });

  it("hides the add dropdown once every tag is selected", () => {
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={TAGS.map((t) => t.id)} onChange={() => {}} />);
    expect(screen.queryByLabelText("tags.addTag")).not.toBeInTheDocument();
  });

  it("always offers a link to the tag manager when editable", () => {
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={[]} onChange={() => {}} />);
    const link = screen.getByRole("link", { name: "tags.manageLink" });
    expect(link).toHaveAttribute("href", "/settings/tags");
  });
});

describe("TagPicker — empty vocabulary (the reported dead-end)", () => {
  it("still gives an affordance: inline create field + hint + manager link, not a blank void", () => {
    renderPicker(
      <TagPicker availableTags={[]} selectedTagIds={[]} onChange={() => {}} onCreateTag={vi.fn()} />
    );
    // The regression: with no tags there used to be no input at all.
    expect(screen.getByLabelText("tags.newTagLabel")).toBeInTheDocument();
    expect(screen.getByText("tags.emptyHint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "tags.manageLink" })).toBeInTheDocument();
  });

  it("shows no create field when onCreateTag isn't provided", () => {
    renderPicker(<TagPicker availableTags={[]} selectedTagIds={[]} onChange={() => {}} />);
    expect(screen.queryByLabelText("tags.newTagLabel")).not.toBeInTheDocument();
  });
});

describe("TagPicker — inline create", () => {
  it("creates a tag and attaches it (create-and-select)", async () => {
    const created = { id: "new1", name: "focus", color: "teal" };
    const onCreateTag = vi.fn(async () => created);
    const onChange = vi.fn();
    renderPicker(
      <TagPicker availableTags={[]} selectedTagIds={[]} onChange={onChange} onCreateTag={onCreateTag} />
    );
    fireEvent.change(screen.getByLabelText("tags.newTagLabel"), { target: { value: "  focus  " } });
    fireEvent.click(screen.getByRole("button", { name: /tags.createTag/ }));

    await waitFor(() => expect(onCreateTag).toHaveBeenCalledWith("focus", expect.any(String)));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["new1"]));
  });

  it("surfaces an error and does not attach when creation fails", async () => {
    const onCreateTag = vi.fn(async () => null);
    const onChange = vi.fn();
    renderPicker(
      <TagPicker availableTags={[]} selectedTagIds={[]} onChange={onChange} onCreateTag={onCreateTag} />
    );
    fireEvent.change(screen.getByLabelText("tags.newTagLabel"), { target: { value: "focus" } });
    fireEvent.click(screen.getByRole("button", { name: /tags.createTag/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("tags.errors.createFailed"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TagPicker — locked mode (gathered action)", () => {
  it("renders chips read-only: no ×, no add control, no create field, no manager link", () => {
    renderPicker(
      <TagPicker
        availableTags={TAGS}
        selectedTagIds={["t1"]}
        onCreateTag={vi.fn()}
        locked
        lockedNote="inherited from interval"
      />
    );
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    expect(screen.queryByLabelText(/tags.removeTag/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("tags.addTag")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("tags.newTagLabel")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "tags.manageLink" })).not.toBeInTheDocument();
    expect(screen.getByText("inherited from interval")).toBeInTheDocument();
  });

  it("never calls onChange in locked mode", () => {
    const onChange = vi.fn();
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={onChange} locked />);
    // No interactive control exists to fire onChange from — confirm the surface is inert.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the empty label when locked with no tags", () => {
    renderPicker(<TagPicker availableTags={TAGS} selectedTagIds={[]} locked />);
    expect(screen.getByText("tags.none")).toBeInTheDocument();
  });
});
