import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TagPicker from "~/components/tags/TagPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => (opts?.name ? `${key}:${opts.name}` : key) }),
}));

const TAGS = [
  { id: "t1", name: "deep-work", color: "indigo" },
  { id: "t2", name: "creative", color: "amber" },
  { id: "t3", name: "admin", color: "slate" },
];

describe("TagPicker — editable mode", () => {
  it("renders selected tags as chips, unselected tags only in the add dropdown", () => {
    render(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={() => {}} />);
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    // "creative" is unselected — it appears once, as an <option>, not as a chip.
    const creativeMatches = screen.getAllByText("creative");
    expect(creativeMatches).toHaveLength(1);
    expect(creativeMatches[0].tagName).toBe("OPTION");
  });

  it("adds a tag via the dropdown", () => {
    const onChange = vi.fn();
    render(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={onChange} />);
    const select = screen.getByLabelText("tags.addTag");
    fireEvent.change(select, { target: { value: "t2" } });
    expect(onChange).toHaveBeenCalledWith(["t1", "t2"]);
  });

  it("removes a tag via its × button", () => {
    const onChange = vi.fn();
    render(<TagPicker availableTags={TAGS} selectedTagIds={["t1", "t2"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("tags.removeTag:deep-work"));
    expect(onChange).toHaveBeenCalledWith(["t2"]);
  });

  it("hides the add dropdown once every tag is selected", () => {
    render(<TagPicker availableTags={TAGS} selectedTagIds={TAGS.map((t) => t.id)} onChange={() => {}} />);
    expect(screen.queryByLabelText("tags.addTag")).not.toBeInTheDocument();
  });
});

describe("TagPicker — locked mode (gathered action)", () => {
  it("renders chips read-only: no × and no add control", () => {
    render(
      <TagPicker
        availableTags={TAGS}
        selectedTagIds={["t1"]}
        locked
        lockedNote="inherited from interval"
      />
    );
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    expect(screen.queryByLabelText(/tags.removeTag/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("tags.addTag")).not.toBeInTheDocument();
    expect(screen.getByText("inherited from interval")).toBeInTheDocument();
  });

  it("never calls onChange in locked mode", () => {
    const onChange = vi.fn();
    render(<TagPicker availableTags={TAGS} selectedTagIds={["t1"]} onChange={onChange} locked />);
    // No interactive control exists to fire onChange from — confirm the surface is inert.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the empty label when locked with no tags", () => {
    render(<TagPicker availableTags={TAGS} selectedTagIds={[]} locked />);
    expect(screen.getByText("tags.none")).toBeInTheDocument();
  });
});
