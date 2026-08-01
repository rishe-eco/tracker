import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DodClarityWizard, {
  DIMENSION_KEYS,
  buildInitialAnswers,
  firstFlaggedStep,
  type ClarityResult,
  type DimensionKey,
} from "~/components/goals/DodClarityWizard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

function renderWizard(
  props: Partial<React.ComponentProps<typeof DodClarityWizard>> = {}
) {
  const onComplete = props.onComplete ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  return {
    onComplete,
    onClose,
    ...render(
      <DodClarityWizard
        initialDod={props.initialDod ?? "Ship the feature"}
        initialAnswers={props.initialAnswers}
        initialStep={props.initialStep}
        onAnswerChange={props.onAnswerChange}
        onComplete={onComplete}
        onClose={onClose}
      />
    ),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function passAll() {
  for (let i = 0; i < DIMENSION_KEYS.length; i++) {
    fireEvent.click(screen.getByText("dodClarity.pass"));
  }
}

// ── initial render ───────────────────────────────────────────────────────────

describe("initial render", () => {
  it("shows the wizard title", () => {
    renderWizard();
    expect(screen.getByText("dodClarity.wizardTitle")).toBeInTheDocument();
  });

  it("shows the initialDod in the textarea", () => {
    renderWizard({ initialDod: "My definition" });
    const textarea = screen.getByPlaceholderText(
      "dodClarity.dodPlaceholder"
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("My definition");
  });

  it("shows the first dimension question by default", () => {
    renderWizard();
    expect(
      screen.getByText("dodClarity.observabilityQuestion")
    ).toBeInTheDocument();
  });

  it("renders all five nav labels", () => {
    renderWizard();
    for (const key of DIMENSION_KEYS) {
      const label = `dodClarity.dimension${key[0].toUpperCase() + key.slice(1)}`;
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

// ── free navigation ──────────────────────────────────────────────────────────

describe("free navigation", () => {
  it("lets the user jump to any step via the nav without answering first", () => {
    renderWizard();
    // click on 'decomposability' nav item (index 4) from step 0
    const navBtn = screen.getByTitle(
      "dodClarity.dimensionDecomposability"
    );
    fireEvent.click(navBtn);
    expect(
      screen.getByText("dodClarity.decomposabilityQuestion")
    ).toBeInTheDocument();
  });

  it("lets the user navigate backward after answering", () => {
    renderWizard();
    fireEvent.click(screen.getByText("dodClarity.pass")); // answer step 0
    const navBtn = screen.getByTitle("dodClarity.dimensionObservability");
    fireEvent.click(navBtn);
    expect(
      screen.getByText("dodClarity.observabilityQuestion")
    ).toBeInTheDocument();
  });
});

// ── auto-advance ─────────────────────────────────────────────────────────────

describe("auto-advance on answer", () => {
  it("advances to next unanswered step after Pass", () => {
    renderWizard();
    fireEvent.click(screen.getByText("dodClarity.pass"));
    expect(
      screen.getByText("dodClarity.controlQuestion")
    ).toBeInTheDocument();
  });

  it("advances to next unanswered step after Flag", () => {
    renderWizard();
    fireEvent.click(screen.getByText("dodClarity.flag"));
    expect(
      screen.getByText("dodClarity.controlQuestion")
    ).toBeInTheDocument();
  });

  it("when on last unanswered step, calls onComplete after answering", () => {
    const onComplete = vi.fn();
    renderWizard({ onComplete });
    passAll();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("skips already-answered steps when auto-advancing", () => {
    // jump to step 2, answer it, then answer step 0 — should advance to 1
    renderWizard();
    fireEvent.click(screen.getByTitle("dodClarity.dimensionBinary"));
    fireEvent.click(screen.getByText("dodClarity.pass")); // answer step 2
    // now back at step 3 (next unanswered after 2) — navigate to step 0
    fireEvent.click(screen.getByTitle("dodClarity.dimensionObservability"));
    fireEvent.click(screen.getByText("dodClarity.pass")); // answer step 0
    // next unanswered is step 1
    expect(
      screen.getByText("dodClarity.controlQuestion")
    ).toBeInTheDocument();
  });
});

// ── onComplete result ────────────────────────────────────────────────────────

describe("onComplete result", () => {
  it("returns status=green when all passed", () => {
    const onComplete = vi.fn();
    renderWizard({ onComplete });
    passAll();
    const result: ClarityResult = onComplete.mock.calls[0][0];
    expect(result.status).toBe("green");
    expect(result.flaggedDimensions).toHaveLength(0);
  });

  it("returns status=amber and correct flaggedDimensions", () => {
    const onComplete = vi.fn();
    renderWizard({ onComplete });
    fireEvent.click(screen.getByText("dodClarity.flag")); // observability
    for (let i = 1; i < DIMENSION_KEYS.length; i++) {
      fireEvent.click(screen.getByText("dodClarity.pass"));
    }
    const result: ClarityResult = onComplete.mock.calls[0][0];
    expect(result.status).toBe("amber");
    expect(result.flaggedDimensions).toEqual(["observability"]);
  });

  it("includes the edited dod in the result", () => {
    const onComplete = vi.fn();
    renderWizard({ initialDod: "original", onComplete });
    const textarea = screen.getByPlaceholderText("dodClarity.dodPlaceholder");
    fireEvent.change(textarea, { target: { value: "updated" } });
    passAll();
    expect(onComplete.mock.calls[0][0].dod).toBe("updated");
  });
});

// ── restored state ───────────────────────────────────────────────────────────

describe("restored state (re-run)", () => {
  it("shows pass/flag indicators from initialAnswers in nav", () => {
    const answers = buildInitialAnswers("amber", ["control", "ownership"]);
    renderWizard({ initialAnswers: answers, initialStep: 1 });
    // step 1 is 'control', which was flagged
    expect(
      screen.getByText("dodClarity.controlQuestion")
    ).toBeInTheDocument();
  });

  it("starts at initialStep", () => {
    renderWizard({ initialStep: 3 });
    expect(
      screen.getByText("dodClarity.ownershipQuestion")
    ).toBeInTheDocument();
  });

  it("completes without re-answering already-answered steps when all filled", () => {
    const onComplete = vi.fn();
    const answers = buildInitialAnswers("green", [])!;
    // All steps pre-answered as 'pass' — answering just one more should trigger completion
    renderWizard({ initialAnswers: answers, initialStep: 0, onComplete });
    // answering step 0 again should call onComplete since all others already answered
    fireEvent.click(screen.getByText("dodClarity.pass"));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

// ── buildInitialAnswers helper ───────────────────────────────────────────────

describe("buildInitialAnswers", () => {
  it("returns undefined when no status", () => {
    expect(buildInitialAnswers(null, [])).toBeUndefined();
    expect(buildInitialAnswers(undefined, [])).toBeUndefined();
  });

  it("marks flagged dimensions as flag and rest as pass", () => {
    const result = buildInitialAnswers("amber", ["binary", "ownership"])!;
    expect(result.binary).toBe("flag");
    expect(result.ownership).toBe("flag");
    expect(result.observability).toBe("pass");
    expect(result.control).toBe("pass");
    expect(result.decomposability).toBe("pass");
  });
});

// ── firstFlaggedStep helper ──────────────────────────────────────────────────

describe("firstFlaggedStep", () => {
  it("returns 0 when no flagged dimensions", () => {
    expect(firstFlaggedStep([])).toBe(0);
  });

  it("returns correct index for first flagged", () => {
    expect(firstFlaggedStep(["control"])).toBe(1);
    expect(firstFlaggedStep(["decomposability", "ownership"])).toBe(3);
  });
});

// ── onAnswerChange ───────────────────────────────────────────────────────────

describe("onAnswerChange", () => {
  it("fires after every pass with the current answer record", () => {
    const onAnswerChange = vi.fn();
    renderWizard({ onAnswerChange });
    fireEvent.click(screen.getByText("dodClarity.pass"));
    expect(onAnswerChange).toHaveBeenCalledOnce();
    const answers = onAnswerChange.mock.calls[0][0];
    expect(answers.observability).toBe("pass");
    // remaining are still null
    expect(answers.control).toBeNull();
  });

  it("fires after every flag with the current answer record", () => {
    const onAnswerChange = vi.fn();
    renderWizard({ onAnswerChange });
    fireEvent.click(screen.getByText("dodClarity.flag"));
    const answers = onAnswerChange.mock.calls[0][0];
    expect(answers.observability).toBe("flag");
  });

  it("accumulates answers across multiple steps", () => {
    const onAnswerChange = vi.fn();
    renderWizard({ onAnswerChange });
    fireEvent.click(screen.getByText("dodClarity.pass"));  // step 0
    fireEvent.click(screen.getByText("dodClarity.flag"));  // step 1
    const latestAnswers = onAnswerChange.mock.calls[1][0];
    expect(latestAnswers.observability).toBe("pass");
    expect(latestAnswers.control).toBe("flag");
    expect(latestAnswers.binary).toBeNull();
  });
});

// ── tips accordion ───────────────────────────────────────────────────────────

describe("tips accordion", () => {
  it("is collapsed by default", () => {
    renderWizard();
    expect(
      screen.queryByText("dodClarity.observabilityTip1")
    ).not.toBeInTheDocument();
  });

  it("expands on click and collapses after answering", () => {
    renderWizard();
    fireEvent.click(screen.getByText("dodClarity.tipsToggle"));
    expect(
      screen.getByText("dodClarity.observabilityTip1")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("dodClarity.pass"));
    expect(
      screen.queryByText("dodClarity.controlTip1")
    ).not.toBeInTheDocument();
  });
});

// ── close button ─────────────────────────────────────────────────────────────

describe("close button", () => {
  it("calls onClose when X is clicked", () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    fireEvent.click(screen.getByLabelText("tools.close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
