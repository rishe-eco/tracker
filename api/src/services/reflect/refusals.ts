/**
 * Reflect's refusal messages: stable strings, matched exactly by the tests
 * (build plan §6.2, PD-15). The client matches none of them. None of them
 * carries a field's text: an error message must not echo what a person wrote.
 *
 * Not here: `Unauthorized` (as-built `requireAuth`), the token refusal
 * (`graphql/auth.ts`), and `Not found` (`ensureOwned`).
 */
export const REFUSALS = {
  closed: "This entry is closed.",
  tooLong: "That is longer than a Reflect entry keeps.",
  atMostThree: "An entry holds at most three of those.",
  step: "That step can't be reached from here.",
  answer: "This entry's question can't be answered now.",
  notFound: "Not found",
} as const;
