import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClaritySessionPage from "~/components/skills/ClaritySessionPage";
import RubricRail from "~/components/skills/RubricRail";

// ── mocks ────────────────────────────────────────────────────────────────────

const REVISION_ITEM = {
  attemptId: "att-1",
  needsPrediction: false,
  needsDiagnosis: true,
  draftText: null,
  item: {
    itemId: "cl-p3",
    moduleKey: "c1-ask",
    type: "revision",
    difficulty: 2,
    scenario: "Diagnose which criteria it fails, then rewrite it.",
    contextSheet: null,
    weakText: "Anyway, thoughts?",
    authoredMisread: "Good weekend thanks — on the venues, Riverside does look nicer.",
  },
};

const SCORED = {
  attemptId: "att-1",
  score: {
    criteria: [
      { criterion: "R1", level: 1, source: "detector", findings: ["The request arrives last."], evidenceQuote: null },
      { criterion: "R2", level: null, source: "unscored", findings: [], evidenceQuote: null },
      { criterion: "R3", level: null, source: "unscored", findings: [], evidenceQuote: null },
      { criterion: "R4", level: 2, source: "detector", findings: [], evidenceQuote: null },
      { criterion: "R5", level: null, source: "unscored", findings: [], evidenceQuote: null },
      { criterion: "R6", level: 2, source: "detector", findings: [], evidenceQuote: null },
    ],
    total: 5,
    maxPossible: 6,
    scoredCount: 3,
    unscored: ["R2", "R3", "R5"],
    isVoid: false,
    isComplete: false,
  },
  // R5 was tagged but nothing scored it — with no reader it is neither right
  // nor wrong, and must not be reported as a false alarm.
  diagnosis: { correct: ["R1"], missed: ["R6"], spurious: [], unverifiable: ["R5"] },
  repairPassed: null,
  delta: null,
  reveal: "The ask is last, behind three sentences of hedging.",
  revealIsAboutItemText: true,
  moduleState: "in_progress",
  masteryUnmet: [{ code: "rubricIncomplete" }],
  atCriterion: false,
  feedbackOnly: [],
};

const calls: string[] = [];
const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("clarityProgress")) {
    calls.push("progress");
    return {
      clarityProgress: { detectorCriteria: ["R1", "R4", "R6"], readerAvailable: false },
    };
  }
  if (q.includes("startClarityItem")) {
    calls.push("start");
    return { startClarityItem: REVISION_ITEM };
  }
  if (q.includes("lockClarityDiagnosis")) {
    calls.push("lockDiagnosis");
    return { lockClarityDiagnosis: true };
  }
  if (q.includes("submitClarityAttempt")) {
    calls.push("submit");
    return { submitClarityAttempt: SCORED };
  }
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

// Referentially stable, or the page's load effect refetches forever.
const stableT = (key: string, opts?: any) =>
  opts && typeof opts === "object" && "defaultValue" in opts ? key : key;
const stableParams = new URLSearchParams("");
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: stableT }) }));
vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useSearchParams: () => [stableParams, () => {}],
}));
vi.mock("~/layout/InternalPageLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));


/** The rubric rail also renders "R1", so match the tag button specifically. */
const chip = (c: string) =>
  screen.getAllByRole("button").find((b) => b.textContent?.trim().startsWith(c))!;

beforeEach(() => {
  mockCall.mockClear();
  calls.length = 0;
});

// ── the rail ─────────────────────────────────────────────────────────────────

describe("RubricRail", () => {
  it("draws an unscored criterion as unscored, never as zero", () => {
    // The distinction the whole no-reader design rests on. If null rendered as
    // an empty two-pip row it would be indistinguishable from a level of 0,
    // which is the one thing the score must never imply.
    const { container } = render(
      <RubricRail
        scores={[
          { criterion: "R1", level: 0, source: "detector", findings: [], evidenceQuote: null },
          { criterion: "R2", level: null, source: "unscored", findings: [], evidenceQuote: null },
        ]}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("clarity.unscored");
    // R1 scored zero still renders pips; R2 renders the words instead.
    expect(container.querySelectorAll("li").length).toBe(6);
  });
});

// ── the sequence ─────────────────────────────────────────────────────────────

describe("ClaritySessionPage", () => {
  it("makes a revision item diagnose before it lets you rewrite", async () => {
    render(<ClaritySessionPage />);

    // Stage 1: study. The misread ships with the item, so it is visible up
    // front — it is the stimulus, not a reveal.
    await screen.findByText(REVISION_ITEM.item.weakText);
    expect(screen.getByText(REVISION_ITEM.item.authoredMisread)).toBeTruthy();
    expect(screen.queryByPlaceholderText("clarity.editorPlaceholder")).toBeNull();

    fireEvent.click(screen.getByText("clarity.diagnoseIt"));

    // Stage 2: diagnose. Locking is refused with nothing tagged.
    const lock = screen.getByText("clarity.lockDiagnosis").closest("button")!;
    expect(lock.hasAttribute("disabled")).toBe(true);

    fireEvent.click(chip("R1"));
    expect(lock.hasAttribute("disabled")).toBe(false);
    fireEvent.click(lock);

    // Stage 3: only now is there an editor.
    await waitFor(() => expect(screen.getByPlaceholderText("clarity.editorPlaceholder")).toBeTruthy());
    expect(calls).toContain("lockDiagnosis");
    expect(calls).not.toContain("submit");
  });

  it("scores only after the diagnosis call, and shows unscored criteria as unscored", async () => {
    render(<ClaritySessionPage />);
    await screen.findByText(REVISION_ITEM.item.weakText);
    fireEvent.click(screen.getByText("clarity.diagnoseIt"));
    fireEvent.click(chip("R1"));
    fireEvent.click(screen.getByText("clarity.lockDiagnosis").closest("button")!);

    const editor = await screen.findByPlaceholderText("clarity.editorPlaceholder");
    fireEvent.change(editor, { target: { value: "Pick a venue by Thursday. Deposit is due Friday." } });
    fireEvent.click(screen.getByText("clarity.getFeedback").closest("button")!);

    await screen.findByText("clarity.resultLabel");

    // The diagnosis lock strictly precedes the score request.
    expect(calls.indexOf("lockDiagnosis")).toBeLessThan(calls.indexOf("submit"));

    // 5 / 6 with three criteria unscored — never a silently weakened 5 / 12.
    expect(screen.getByText("5 / 6")).toBeTruthy();
    expect(screen.getAllByText("clarity.unscored").length).toBeGreaterThan(0);
    expect(screen.queryByText("5 / 12")).toBeNull();
  });
});
