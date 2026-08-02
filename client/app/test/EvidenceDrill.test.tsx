import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import RichText from "~/components/skills/RichText";
import EvidenceDrillPage from "~/components/skills/EvidenceDrillPage";

// ── mocks ────────────────────────────────────────────────────────────────────

const SERVED = {
  attemptId: "att-1",
  item: {
    itemId: "ev2-e4-6",
    moduleKey: "e4-trace",
    difficulty: 1,
    prompt: "How long did the Hundred Years' War last?",
    answer: "**One hundred years**, from **1337 to 1437** — which is where the name comes from.",
    snapshotQueries: null,
  },
};

const mockCall = vi.fn(async (opts?: any) => {
  if (String(opts?.query).includes("startSkillItem")) return { startSkillItem: SERVED };
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

// `t` and the search params must be referentially stable: the page's load effect
// depends on both, so a fresh identity per render re-fetches forever.
const stableT = (key: string) => key;
const stableParams = new URLSearchParams("");
const stableNavigate = () => {};

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: stableT }) }));
vi.mock("react-router", () => ({
  useNavigate: () => stableNavigate,
  useSearchParams: () => [stableParams, () => {}],
}));
vi.mock("~/layout/InternalPageLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

beforeEach(() => mockCall.mockClear());

// ── RichText ────────────────────────────────────────────────────────────────

describe("RichText", () => {
  it("renders emphasis rather than printing its own syntax", () => {
    // The whole point: answers are authored the way a real model answer reads,
    // and literal asterisks in front of the learner are a tell that has nothing
    // to do with the claim.
    const { container } = render(<RichText text="The default is **10**, not 12." />);
    expect(container.textContent).toBe("The default is 10, not 12.");
    expect(container.querySelector("strong")?.textContent).toBe("10");
  });

  it("keeps markdown syntax literal inside code spans", () => {
    const { container } = render(<RichText text="Call `arr.at(-1)` or `**x**`." />);
    const codes = Array.from(container.querySelectorAll("code")).map((c) => c.textContent);
    expect(codes).toEqual(["arr.at(-1)", "**x**"]);
  });

  it("renders bullet lists as lists", () => {
    const { container } = render(<RichText text={"Figures:\n\n- **Fat** — 9\n- **Alcohol** — 9"} />);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("emits elements, never raw markup", () => {
    const { container } = render(<RichText text={'<img src=x onerror="boom">'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img");
  });
});

// ── The question / answer split ─────────────────────────────────────────────

describe("EvidenceDrillPage stimulus", () => {
  it("labels the question and the answer as separate things", async () => {
    // The original layout put both in one card in near-identical type. A learner
    // who can't tell which half is the claim can't evaluate the claim, so the
    // separation is structural and asserted here rather than left to styling.
    render(<EvidenceDrillPage />);

    const questionLabel = await screen.findByText("skills.drill.questionLabel");
    const answerLabel = screen.getByText("skills.drill.answerLabel");

    const questionBox = questionLabel.closest("div")!;
    const answerBox = answerLabel.closest("div")!.parentElement!.parentElement!;

    expect(within(questionBox).getByText(SERVED.item.prompt)).toBeTruthy();
    expect(questionBox.contains(answerLabel)).toBe(false);
    expect(answerBox.textContent).toContain("One hundred years");
  });

  it("shows a reachable explanation of the drill on every item", async () => {
    // The intro overlay is shown once and then gone; this is the copy someone
    // wants on their third item, not their first.
    render(<EvidenceDrillPage />);
    await waitFor(() => expect(screen.getByText("skills.drill.howTitle")).toBeTruthy());
    expect(screen.getByText("skills.drill.stageRead")).toBeTruthy();
  });
});
