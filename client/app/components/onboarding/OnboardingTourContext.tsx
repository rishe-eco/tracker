import { createContext, useContext, useState } from "react";

/**
 * Both the welcome tour and the per-module intros are `fixed inset-0 z-50`, so
 * two of them on screen at once stack and the later one in DOM order swallows
 * clicks meant for the other. They are sequenced instead: the welcome tour is
 * the app-wide orientation and goes first, module intros wait their turn.
 *
 * - "pending" — the tour hasn't reported yet (its progress fetch is in flight).
 *   Module intros hold off, or they'd flash up and then get covered.
 * - "visible" — the tour is on screen.
 * - "hidden"  — the tour is done, closed for the session, or not in play.
 */
export type OnboardingTourStatus = "pending" | "visible" | "hidden";

type OnboardingTourContextType = {
  status: OnboardingTourStatus;
  setStatus: (status: OnboardingTourStatus) => void;
};

// Default is "hidden" so a module intro rendered outside the provider (tests,
// or any tree without the tour) still shows.
const OnboardingTourContext = createContext<OnboardingTourContextType>({
  status: "hidden",
  setStatus: () => {},
});

export function OnboardingTourProvider({
  /** When there's no tour in play (signed out), nothing gates the module intros. */
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<OnboardingTourStatus>("pending");

  return (
    <OnboardingTourContext.Provider value={{ status: enabled ? status : "hidden", setStatus }}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  return useContext(OnboardingTourContext);
}
