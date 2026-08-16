import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DecompositionSessionPage from "~/components/skills/DecompositionSessionPage";
import DecompositionRubricRail from "~/components/skills/DecompositionRubricRail";
import BreakdownCanvas from "~/components/skills/BreakdownCanvas";

// ── mocks ────────────────────────────────────────────────────────────────────

const BREAKDOWN_ITEM = {
  attemptId: "att-1",
  needsDiagnosis: false,
  draftStructure: null,
  item: {
    itemId: "dc-p5",
    moduleKey: "d1-frame",
    type: "breakdown",
    difficulty: 3,
    scenario: "Plan a two-week solo backpacking trip through three countries.",
    palette: null,
    suppliedTree: null,
    suppliedWhole: null,
  },
};

// D3/D5/D6 unscored — a breakdown item with no judge configured, exactly the
// case the "unscored is not zero" rule exists to protect.
const SCORED = {
  attemptId: "att-1",
  score: {
    criteria: [
      { id: "D1", level: 2, scoredBy: "detector", evidence: "Stated first, bounded." },
      { id: "D2", level: 2, scoredBy: "instrumentation", evidence: "Breadth-first index 1.00." },
      { id: "D3", level: null, scoredBy: "unscored", evidence: "Needs a judge." },
      { id: "D4", level: 2, scoredBy: "detector", evidence: "Every leaf bounded." },
      { id: "D5", level: null, scoredBy: "unscored", evidence: "Needs a judge." },
      { id: "D6", level: null, scoredBy: "unscored", evidence: "Needs a judge." },
    ],
    total: 6,
    scoredCount: 3,
    coverage: null,
    bfi: 1,
    overDecomposed: false,
    isVoid: false,
    isComplete: false,
  },
  diagnosisCorrect: null,
  delta: null,
  moduleState: "in_progress",
  masteryUnmet: [{ code: "rubricIncomplete" }],
  atCriterion: false,
  reveal: { pieces: [], overlapPairs: [], blockingEdges: [], independentPairs: [] },
};

const calls: string[] = [];
const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("startDecompositionItem")) {
    calls.push("start");
    return { startDecompositionItem: BREAKDOWN_ITEM };
  }
  if (q.includes("lockDecompositionWhole")) {
    calls.push("lockWhole");
    return { lockDecompositionWhole: true };
  }
  if (q.includes("logSkillCheckEvent")) {
    calls.push("logEvent");
    return { logSkillCheckEvent: true };
  }
  if (q.includes("submitDecompositionAttempt")) {
    calls.push("submit");
    return { submitDecompositionAttempt: SCORED };
  }
  return {};
});

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

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

beforeEach(() => {
  mockCall.mockClear();
  calls.length = 0;
});

// ── the rail ─────────────────────────────────────────────────────────────────

describe("DecompositionRubricRail", () => {
  it("draws an unscored criterion as unscored, never as an empty pip row", () => {
    const { container } = render(
      <DecompositionRubricRail
        scores={[
          { id: "D1", level: 0, scoredBy: "detector", evidence: "" },
          { id: "D2", level: null, scoredBy: "unscored", evidence: "" },
        ]}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("decomposition.unscored");
    // D1 scored zero still renders as a criterion row; D2 renders words instead
    // of an indistinguishable empty two-pip row.
    expect(container.querySelectorAll("li").length).toBe(6);
  });
});

// ── the whole-before-pieces gate ─────────────────────────────────────────────

describe("DecompositionSessionPage", () => {
  it("shows no canvas or piece affordance until the whole is locked", async () => {
    render(<DecompositionSessionPage />);
    await screen.findByText(BREAKDOWN_ITEM.item.scenario);

    // Stage 1: whole. No "add a piece" input exists yet — the ordering is the
    // measurement, so pieces genuinely cannot exist before this is locked.
    expect(screen.getByText("decomposition.wholeTitle")).toBeTruthy();
    expect(screen.queryByPlaceholderText("decomposition.canvas.addPiecePlaceholder")).toBeNull();

    const lock = screen.getByText("decomposition.lockWhole").closest("button")!;
    expect(lock.hasAttribute("disabled")).toBe(true);

    const [statementInput, doneWhenInput] = screen.getAllByPlaceholderText(/decomposition\.whole/);
    fireEvent.change(statementInput, { target: { value: "Fly to three countries without over-planning it." } });
    fireEvent.change(doneWhenInput, { target: { value: "Flights and first lodging booked by Friday." } });
    expect(lock.hasAttribute("disabled")).toBe(false);

    fireEvent.click(lock);
    await waitFor(() => expect(screen.getByPlaceholderText("decomposition.canvas.addPiecePlaceholder")).toBeTruthy());
    expect(calls).toContain("lockWhole");
    expect(calls).not.toContain("submit");
  });

  it("scores only after committing, and shows unscored criteria as unscored — never a silently weakened total", async () => {
    render(<DecompositionSessionPage />);
    await screen.findByText(BREAKDOWN_ITEM.item.scenario);

    const [statementInput, doneWhenInput] = screen.getAllByPlaceholderText(/decomposition\.whole/);
    fireEvent.change(statementInput, { target: { value: "Fly to three countries without over-planning it." } });
    fireEvent.change(doneWhenInput, { target: { value: "Flights and first lodging booked by Friday." } });
    fireEvent.click(screen.getByText("decomposition.lockWhole").closest("button")!);

    const addInput = await screen.findByPlaceholderText("decomposition.canvas.addPiecePlaceholder");
    fireEvent.change(addInput, { target: { value: "Book flights" } });
    fireEvent.click(screen.getByText("decomposition.canvas.addTopLevel").closest("button")!);

    fireEvent.click(screen.getByText("decomposition.commit").closest("button")!);

    await screen.findByText("decomposition.resultLabel");

    // The whole-lock strictly precedes the submission.
    expect(calls.indexOf("lockWhole")).toBeLessThan(calls.indexOf("submit"));

    // 6 / 6 — three criteria scored, each at level 2 — never a silently
    // weakened 6 / 12 as if all six had been assessed.
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect(screen.getAllByText("decomposition.unscored").length).toBeGreaterThan(0);
    expect(screen.queryByText("6 / 12")).toBeNull();
  });
});

// ── containment, sequence and dependency: three distinct notations ─────────

describe("BreakdownCanvas", () => {
  it("renders containment, sequence and dependency as three visually distinct notations, not one arrow type", () => {
    const nodes = [
      { id: "a", parentId: null, label: "Secure housing", doneWhen: "", dependsOn: [] },
      { id: "b", parentId: null, label: "Move the things", doneWhen: "", dependsOn: ["a"] },
      { id: "c", parentId: "a", label: "Decide what goes", doneWhen: "", dependsOn: [] },
    ];
    const { container } = render(
      <BreakdownCanvas
        nodes={nodes}
        freeAuthoring
        disabled={false}
        onAdd={() => {}}
        onRemove={() => {}}
        onRelabel={() => {}}
        onDoneWhenChange={() => {}}
        onReparent={() => {}}
        onDependsOnChange={() => {}}
      />
    );

    // Sequence: a numbered badge, one per node, distinct markup from the
    // dependency chip below.
    const seqBadges = Array.from(container.querySelectorAll("span.rounded-full.border")).filter((el) =>
      /^\d+$/.test(el.textContent ?? "")
    );
    expect(seqBadges.length).toBe(3);

    // Containment: node "c" (parentId "a") is nested under an indented
    // container distinct from the sequence badge and the dependency chip —
    // not expressed via either of those, but via its own DOM structure.
    const nestedWrapper = container.querySelector(".ms-6.border-s-2");
    expect(nestedWrapper).toBeTruthy();
    expect((nestedWrapper?.querySelector("input") as HTMLInputElement)?.value).toBe("Decide what goes");

    // Dependency: a dashed chip reading "blocked by 1", distinct from both
    // the plain numbered sequence badge and the indentation used for nesting.
    expect(screen.getByText("decomposition.canvas.blockedByCount")).toBeTruthy();
    const depChip = screen.getByText("decomposition.canvas.blockedByCount").closest("button")!;
    expect(depChip.className).toContain("rounded-full");
    expect(depChip.className).toContain("border-dashed");
  });
});
