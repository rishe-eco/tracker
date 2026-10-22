import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReflectHomePage from "~/components/reflect/ReflectHomePage";

/**
 * Reflect's home: three states (nothing open, an entry open with a story, an
 * entry open without), the loading placeholder, and the banner. Thin by
 * design: the rules live in the API's integration tests.
 */

let lang = "en";
let home: any;
let pending: ((v: any) => void) | null = null;

const navigate = vi.fn();
const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("query ReflectHome")) {
    if (pending === undefined) return { reflectHome: home };
    return new Promise((resolve) => {
      pending = resolve;
    });
  }
  if (q.includes("mutation StartReflectEntry")) return { startReflectEntry: { id: "e-new" } };
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && Object.keys(opts).length ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: lang, dir: () => (lang === "fa" ? "rtl" : "ltr") },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, className }: any) => (
    <a href={typeof to === "string" ? to : "#"} className={className}>
      {children}
    </a>
  ),
}));

function homeWith(partial: Partial<any> = {}) {
  return {
    openEntry: null,
    hasPast: false,
    practiceLocale: "en",
    reviewStatus: "reviewed",
    ...partial,
  };
}

beforeEach(() => {
  lang = "en";
  home = homeWith();
  pending = undefined as any;
  navigate.mockClear();
  mockCall.mockClear();
});

describe("Reflect home", () => {
  it("holds the button's place until the server answers, with neither Start nor Continue (W5)", async () => {
    pending = null;
    render(<ReflectHomePage />);
    expect(screen.getByTestId("reflect-home-loading")).toBeTruthy();
    expect(screen.queryByText("reflect.home.start")).toBeNull();
    expect(screen.queryByText(/reflect\.home\.continue/)).toBeNull();

    pending!({ reflectHome: homeWith() });
    expect(await screen.findByText("reflect.home.start")).toBeTruthy();
    expect(screen.queryByTestId("reflect-home-loading")).toBeNull();
  });

  it("nothing open: Start an entry, no Continue, no Past entries link", async () => {
    render(<ReflectHomePage />);
    fireEvent.click(await screen.findByText("reflect.home.start"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect/entry"));
    const start = mockCall.mock.calls.find((c) => String(c[0]?.query).includes("StartReflectEntry"))!;
    expect(start[0].variables).toEqual({ replacing: null });
    expect(screen.queryByText(/reflect\.home\.continue/)).toBeNull();
    expect(screen.queryByText("reflect.home.past")).toBeNull();
  });

  it("an entry open with a story: Continue names the date, Start a new one says it is kept (G4)", async () => {
    home = homeWith({
      openEntry: { id: "e1", createdAt: "2031-03-04T10:00:00.000Z", hasStory: true },
      hasPast: true,
    });
    render(<ReflectHomePage />);
    expect(await screen.findByText(/reflect\.home\.continue/)).toBeTruthy();
    expect(screen.queryByText("reflect.home.start")).toBeNull();
    expect(screen.getByText("reflect.home.startNewKept")).toBeTruthy();
    expect(screen.queryByText("reflect.home.startNewEnds")).toBeNull();
    // The link is quiet and bare: no count beside it.
    expect(screen.getByText("reflect.home.past").textContent).toBe("reflect.home.past");

    fireEvent.click(screen.getByText("reflect.home.startNew"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect/entry"));
    const start = mockCall.mock.calls.find((c) => String(c[0]?.query).includes("StartReflectEntry"))!;
    expect(start[0].variables).toEqual({ replacing: "e1" });
  });

  it("an entry open with no story: the line says it simply ends", async () => {
    home = homeWith({ openEntry: { id: "e1", createdAt: "2031-03-04T10:00:00.000Z", hasStory: false } });
    render(<ReflectHomePage />);
    expect(await screen.findByText("reflect.home.startNewEnds")).toBeTruthy();
    expect(screen.queryByText("reflect.home.startNewKept")).toBeNull();
  });

  it("shows the banner, with no dismiss, when the interface language isn't the practice locale (W19)", async () => {
    lang = "fa";
    render(<ReflectHomePage />);
    const banner = await screen.findByTestId("reflect-banner");
    expect(banner.querySelector("button")).toBeNull();
  });

  it("shows the banner for a draft pack, and no banner for a reviewed one in the practice locale", async () => {
    home = homeWith({ reviewStatus: "draft" });
    const { unmount } = render(<ReflectHomePage />);
    expect(await screen.findByTestId("reflect-banner")).toBeTruthy();
    unmount();

    home = homeWith();
    render(<ReflectHomePage />);
    await screen.findByText("reflect.home.start");
    expect(screen.queryByTestId("reflect-banner")).toBeNull();
  });
});
