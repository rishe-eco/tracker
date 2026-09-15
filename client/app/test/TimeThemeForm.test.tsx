import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TimeThemeForm from "~/components/timeThemes/TimeThemeForm";

const AVAILABLE_TAGS = [
  { id: "t1", name: "deep-work", color: "indigo" },
  { id: "t2", name: "creative", color: "amber" },
];

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("GetTags")) return { tags: AVAILABLE_TAGS };
  if (q.includes("CreateTimeTheme")) {
    return { createTimeTheme: { id: "theme-1", ...opts.variables.input } };
  }
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en", dir: () => "ltr" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: undefined }),
}));

vi.mock("~/components/ui/confirm-dialog", () => ({ ConfirmDialog: () => null }));
// Radix's Switch needs a ResizeObserver jsdom doesn't provide; this form's
// status toggle isn't under test here, so a plain stand-in avoids polyfilling
// a browser API just to mount the page.
vi.mock("~/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));
vi.mock("~/layout/InternalPageLayout", () => ({
  default: ({ children, title }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

beforeEach(() => {
  mockCall.mockClear();
  mockNavigate.mockClear();
});

describe("TimeThemeForm — happy path create (build-plan.md Phase 6)", () => {
  it("creates a theme with a title, tag, and time span", async () => {
    render(<TimeThemeForm />);
    await waitFor(() => expect(screen.getByText("deep-work")).not.toBeNull());

    fireEvent.change(screen.getByPlaceholderText("timeThemes.namePlaceholder"), {
      target: { value: "Deep-work morning" },
    });

    // Add the "deep-work" tag via TagPicker's dropdown.
    const tagSelect = screen.getByLabelText("tags.addTag");
    fireEvent.change(tagSelect, { target: { value: "t1" } });

    fireEvent.submit(screen.getByRole("button", { name: "intervals.save" }).closest("form")!);

    await waitFor(() => {
      const createCall = mockCall.mock.calls.find(([opts]) => String(opts?.query).includes("CreateTimeTheme"));
      expect(createCall).toBeTruthy();
      const input = createCall![0].variables.input;
      expect(input.title).toBe("Deep-work morning");
      expect(input.tagIds).toEqual(["t1"]);
      expect(input.startTimeOfDay).toBe("08:00");
      expect(input.endTimeOfDay).toBe("09:00");
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/activities/timeThemes"));
  });

  it("rejects endTimeOfDay <= startTimeOfDay without calling the API", async () => {
    render(<TimeThemeForm />);
    await waitFor(() => expect(screen.getByText("deep-work")).not.toBeNull());

    fireEvent.change(screen.getByPlaceholderText("timeThemes.namePlaceholder"), {
      target: { value: "Backwards theme" },
    });
    fireEvent.change(screen.getByLabelText("timeThemes.fromLabel"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByLabelText("timeThemes.toLabel"), { target: { value: "08:00" } });

    fireEvent.submit(screen.getByRole("button", { name: "intervals.save" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("timeThemes.errors.endAfterStart")).toBeInTheDocument());
    expect(mockCall.mock.calls.some(([opts]) => String(opts?.query).includes("CreateTimeTheme"))).toBe(false);
  });
});
