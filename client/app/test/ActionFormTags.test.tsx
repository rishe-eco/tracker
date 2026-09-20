import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ActionForm from "~/components/actions/ActionForm";

// ── mocks ────────────────────────────────────────────────────────────────────

const GATHERED_ACTION = {
  id: "a-gathered",
  title: "Write engine internals doc",
  tbd: null,
  done: false,
  estimatedTimeMinutes: 30,
  startTimeOfDay: "08:30",
  isGathered: true,
  sourceType: "interval",
  project: null,
  tags: [{ id: "t1", name: "deep-work", color: "indigo" }],
};

const STANDALONE_ACTION = {
  id: "a-standalone",
  title: "Call the accountant",
  tbd: null,
  done: false,
  estimatedTimeMinutes: 15,
  startTimeOfDay: null,
  isGathered: false,
  sourceType: null,
  project: null,
  tags: [{ id: "t3", name: "admin", color: "slate" }],
};

const AVAILABLE_TAGS = [
  { id: "t1", name: "deep-work", color: "indigo" },
  { id: "t2", name: "creative", color: "amber" },
  { id: "t3", name: "admin", color: "slate" },
];

let currentAction: any = GATHERED_ACTION;

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("GetAction(")) return { action: currentAction };
  if (q.includes("GetTags")) return { tags: AVAILABLE_TAGS };
  if (q.includes("GetProjects")) return { projects: [] };
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en", dir: () => "ltr" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: currentAction.id }),
  useLocation: () => ({ state: null }),
  useSearchParams: () => [new URLSearchParams(""), () => {}],
  Link: ({ to, children }: any) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
}));

vi.mock("~/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
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
});

describe("ActionForm — Time Themes tag lock (time-themes.md §3.1)", () => {
  it("renders a gathered action's tags read-only (locked)", async () => {
    currentAction = GATHERED_ACTION;
    render(<ActionForm />);
    await waitFor(() => expect(screen.getByText("deep-work")).toBeInTheDocument());
    // Locked: no remove (×) control and no "+ tag" add control.
    expect(screen.queryByLabelText(/tags.removeTag/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("tags.addTag")).not.toBeInTheDocument();
    expect(screen.getByText("tags.lockedFromInterval")).toBeInTheDocument();
  });

  it("renders a standalone action's tags editable", async () => {
    currentAction = STANDALONE_ACTION;
    render(<ActionForm />);
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    // Editable: the add control is present since not every tag is selected.
    expect(screen.getByLabelText("tags.addTag")).toBeInTheDocument();
    expect(screen.getByLabelText(/tags.removeTag/)).toBeInTheDocument();
  });
});
