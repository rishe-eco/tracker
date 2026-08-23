/** Delegation Lab `v1` — English surface. Reviewed (not machine-drafted). */

import type { CapabilityClaim, DelegationItemSurface, DelegationModuleSurface } from "../types";

function surface(
  itemId: string,
  ask: string,
  opts: { unitLabel?: string; cueLabels?: Record<string, string>; pieceLabels?: Record<string, string> } = {}
): DelegationItemSurface {
  return { itemId, ask, unitLabel: opts.unitLabel, cueLabels: opts.cueLabels, pieceLabels: opts.pieceLabels };
}

export const MODULES_EN: DelegationModuleSurface[] = [
  {
    moduleKey: "g1-own",
    title: "Know your own error rate",
    concept:
      "Before you can decide when to trust advice, you need to know how far off your own guesses typically run. This module never shows you the advice — it just asks you to estimate, and to say how confident you are. The prerequisite skill is calibration: does your stated confidence actually track your accuracy?",
    model:
      "Weak: saying \"90% confident\" on every guess, right or wrong. Strong: noticing your confidence is genuinely lower on the items where you're actually further off, and saying so.",
  },
  {
    moduleKey: "g2-instance",
    title: "The instance, not the category",
    concept:
      "\"AI is good at X, bad at Y\" is a snapshot of one model generation, and it goes stale fastest on the confident \"can't\" claims. The durable move is reading a cue about this specific task — does it have the facts to check this, is this something that changes yearly, is this arithmetic you could verify in one line — and weighing accordingly. Where no such cue exists, saying so is itself the correct answer.",
    model:
      "Weak: \"models are generally reliable at facts\" as your reason for a specific weighting decision. Strong: \"this is a straight-line distance it can compute from coordinates\" — a claim about this task, not about AI in general.",
    capabilityListDate: "18 months before this pack's authoring",
    capabilityList: [
      { claim: "Can't do arithmetic reliably", stillTrue: false },
      { claim: "Can't cite a real source", stillTrue: false },
      { claim: "Good at summarising", stillTrue: true },
      { claim: "Can't use external tools", stillTrue: false },
      { claim: "Weak on very recent events", stillTrue: true },
    ] as CapabilityClaim[],
  },
  {
    moduleKey: "g3-weigh",
    title: "Move the right amount",
    concept:
      "The population default is to move about 0.39 of the way toward advice — systematically underweighting it. When you have no cue either way, the rational move is to land near halfway: two judges of unknown but comparable accuracy average out better than either alone. Deviating from halfway is only justified by a cue, not by confidence in your own gut.",
    model:
      "Weak: moving the same small amount every time regardless of whether the advice looks earned. Strong: moving close to halfway on an uncued item, and further on an item where you have a real reason to trust the advice more.",
  },
  {
    moduleKey: "g4-split",
    title: "Delegate the part, not the whole",
    concept:
      "People will use an imperfect assistant if they can modify what it produces — handing over the whole task and taking it or leaving it is what makes one visible error fatal to using it at all. The skill is naming which piece of a task is safely delegable and which piece only you can judge, usually because it turns on context the assistant never saw.",
    model:
      "Weak: delegating an entire deliverable, or writing the entire thing yourself out of caution. Strong: handing over the piece that's mechanical, and keeping the piece that depends on something only you know.",
  },
  {
    moduleKey: "g5-stakes",
    title: "What does being wrong cost?",
    concept:
      "\"Higher stakes, trust it less\" is itself a category rule, and often the wrong one. The actual quantity that matters is expected cost — probability of error times the cost of being wrong — and a cheap check on the output collapses that second term. So under high stakes, either lever is defensible: reduce how much you rely on the advice, or keep relying on it and make being wrong recoverable by checking before you act.",
    model:
      "Weak: relying on advice exactly as much regardless of what's riding on it. Strong: under high stakes, either pulling back noticeably, or keeping your weighting and naming the check that would catch a mistake before it matters.",
  },
  {
    moduleKey: "g6-drift",
    title: "Update without overreacting",
    concept:
      "People abandon an assistant faster than they'd abandon a person after the exact same mistake — even having watched it outperform the person before. One visible error is one data point, not proof the advice is now worthless. The skill is adjusting your weighting down, but not to zero, and not so far that a single success would just as easily send it to one.",
    model:
      "Weak: trusting the advice fully in round 1, dropping to near-zero after round 2's visible error, and staying there. Strong: trusting it somewhat less after the error, but not abandoning it outright — one mistake is evidence, not a verdict.",
  },
];

export const ITEM_SURFACES_EN: DelegationItemSurface[] = [
  // g1-own — plain estimate + confidence, no cue shown
  surface("g1-p1", "What is the straight-line distance from Paris to Rome?", { unitLabel: "km" }),
  surface("g1-p2", "What is the current population of Portugal?", { unitLabel: "people" }),
  surface("g1-p3", "How tall is the Eiffel Tower, including its antenna?", { unitLabel: "m" }),
  surface("g1-p4", "What is the men's marathon world record, in minutes?", { unitLabel: "minutes" }),
  surface("g1-p5", "What does a decent secondhand bicycle typically cost?", { unitLabel: "USD" }),
  surface("g1-p6", "How much does a small car weigh, empty?", { unitLabel: "kg" }),
  surface("g1-fA", "How tall is the Burj Khalifa?", { unitLabel: "m" }),
  surface("g1-fB", "How tall are the Petronas Towers?", { unitLabel: "m" }),
  surface("g1-fC", "How tall is the Tokyo Skytree?", { unitLabel: "m" }),

  // g2-instance — estimate + which cue did you use
  surface("g2-p1", "What is the straight-line distance from Vienna to Prague?", {
    unitLabel: "km",
    cueLabels: { cCat: "Models are generally reliable on facts", cInst: "It has the coordinates; this is arithmetic it can't easily get wrong", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-p2", "What is the current population of Iceland?", {
    unitLabel: "people",
    cueLabels: { cCat: "AI knowledge is generally reliable for statistics", cInst: "This figure shifts yearly and the model's training may already be stale", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-p3", "How many steps does it take to climb to the top of the Eiffel Tower?", {
    unitLabel: "steps",
    cueLabels: { cCat: "AI usually knows obscure facts like this", cInst: "It sounds precise, but sounding precise isn't the same as being accurate", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-p4", "How many metres are in 3.5 miles?", {
    unitLabel: "m",
    cueLabels: { cCat: "Models can't do arithmetic reliably", cInst: "This is a fixed conversion it can compute exactly", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-p5", "How many litres does a typical sedan's fuel tank hold?", {
    unitLabel: "liters",
    cueLabels: { cCat: "Models rarely make unit mistakes", cInst: "Unit conversions are a classic place an answer quietly slips", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-p6", "How many languages are spoken in Papua New Guinea?", {
    unitLabel: "languages",
    cueLabels: { cCat: "AI is generally trustworthy on world facts", cInst: "It sounds like an oddly specific number", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-fA", "What is the current population of Estonia?", {
    unitLabel: "people",
    cueLabels: { cCat: "AI knowledge is generally reliable for statistics", cInst: "This figure shifts yearly and the model's training may already be stale", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-fB", "What is the current population of Slovenia?", {
    unitLabel: "people",
    cueLabels: { cCat: "AI knowledge is generally reliable for statistics", cInst: "This figure shifts yearly and the model's training may already be stale", cNone: "Nothing here tells me who's more likely to be right" },
  }),
  surface("g2-fC", "What is the current population of Latvia?", {
    unitLabel: "people",
    cueLabels: { cCat: "AI knowledge is generally reliable for statistics", cInst: "This figure shifts yearly and the model's training may already be stale", cNone: "Nothing here tells me who's more likely to be right" },
  }),

  // g3-weigh — plain estimate, weighting is the point
  surface("g3-p1", "How many minutes are in a day?", { unitLabel: "minutes" }),
  surface("g3-p2", "How tall is Mount Everest?", { unitLabel: "m" }),
  surface("g3-p3", "What is the average distance from the Earth to the Moon?", { unitLabel: "km" }),
  surface("g3-p4", "At roughly what age does a giant tortoise reach breeding maturity?", { unitLabel: "years" }),
  surface("g3-p5", "How many bones are in the adult human body?", { unitLabel: "bones" }),
  surface("g3-p6", "How many hours of sleep are recommended for an adult?", { unitLabel: "hours" }),
  surface("g3-fA", "What is the Earth's mean radius?", { unitLabel: "km" }),
  surface("g3-fB", "What is the Moon's diameter?", { unitLabel: "km" }),
  surface("g3-fC", "What is the Earth's mean diameter?", { unitLabel: "km" }),

  // g4-split — task descriptions + which piece to hand over
  surface("g4-p1", "\"Summarise our Q3 retro notes and recommend three priorities.\"", {
    pieceLabels: { p1: "Condense 40 pages of notes into themes", p2: "Decide which three matter, given what happened last year", p3: "Write it up" },
  }),
  surface("g4-p2", "\"Draft the data-migration script from this schema diff, and make sure it's safe to run.\"", {
    pieceLabels: { p1: "Draft the migration script from the schema diff", p2: "Judge whether the down-migration is safe on live data" },
  }),
  surface("g4-p3", "\"Reply to this support ticket and decide whether we owe the customer anything.\"", {
    pieceLabels: { p1: "Draft the reply text", p2: "Decide whether to offer a refund given this account's history", p3: "Format and send the reply" },
  }),
  surface("g4-p4", "\"Clean up this spreadsheet and remove the duplicate rows.\"", {
    pieceLabels: { p1: "Clean up the formatting", p2: "Decide which rows are true duplicates given internal context" },
  }),
  surface("g4-p5", "\"Draft interview questions for this role and tell me who to hire.\"", {
    pieceLabels: { p1: "Generate candidate interview questions", p2: "Judge a candidate's actual answers against team fit", p3: "Schedule the interviews" },
  }),
  surface("g4-p6", "\"Put together a first-pass project schedule and sign off on the plan.\"", {
    pieceLabels: { p1: "Produce a first-pass schedule", p2: "Decide which risk is acceptable given the client relationship" },
  }),
  surface("g4-fA", "\"Draft release notes from this diff and decide what's worth telling customers.\"", {
    pieceLabels: { p1: "Draft release notes from the diff", p2: "Decide which changes are worth flagging to customers" },
  }),
  surface("g4-fB", "\"Write onboarding docs from the codebase and decide what a new hire actually needs on day one.\"", {
    pieceLabels: { p1: "Draft onboarding docs from the codebase", p2: "Decide what a new hire actually needs on day one" },
  }),
  surface("g4-fC", "\"Summarise these customer feedback threads and tell me which complaint is the real signal.\"", {
    pieceLabels: { p1: "Summarise the feedback threads", p2: "Decide which complaint is the real signal" },
  }),

  // g5-stakes — same quantity, two framings
  surface("g5-p1-low", "You're settling an argument about a weekend road trip. Roughly how far is the drive?", { unitLabel: "km" }),
  surface("g5-p1-high", "You're filing a freight declaration for this exact route. How far is it?", { unitLabel: "km" }),
  surface("g5-p2-low", "You're making a casual bet with a friend about the crowd size tonight.", { unitLabel: "people" }),
  surface("g5-p2-high", "You're reporting expected attendance to the venue for a fire-safety capacity filing.", { unitLabel: "people" }),
  surface("g5-p3-low", "You're guessing whether the moving boxes will fit in a rented van for a casual move.", { unitLabel: "kg" }),
  surface("g5-p3-high", "You're confirming whether a work platform's rated load will safely hold the hoisted equipment.", { unitLabel: "kg" }),
  surface("g5-p4-low", "You're sizing up a same-day supply run between two branch offices.", { unitLabel: "km" }),
  surface("g5-p4-high", "You're scheduling a refrigerated delivery where being late spoils the load.", { unitLabel: "km" }),
  surface("g5-p5-low", "You're deciding how many responses to expect from an informal team pulse check.", { unitLabel: "responses" }),
  surface("g5-p5-high", "You're determining the sample size a published study will accept as statistically adequate.", { unitLabel: "responses" }),
  surface("g5-p6-low", "You're guessing how long leftovers will keep before a casual family dinner.", { unitLabel: "hours" }),
  surface("g5-p6-high", "You're setting the sell-by window a supplier prints on a shipped product's label.", { unitLabel: "hours" }),
  surface("g5-fA-low", "You're planning a casual charter trip and want a rough sense of the route length.", { unitLabel: "km" }),
  surface("g5-fA-high", "You're pricing a charter contract where the route length sets a penalty clause.", { unitLabel: "km" }),
  surface("g5-fB-low", "You're planning a casual regional trip and want a rough sense of the route length.", { unitLabel: "km" }),
  surface("g5-fB-high", "You're pricing a regional contract where the route length sets a penalty clause.", { unitLabel: "km" }),
  surface("g5-fC-low", "You're planning a casual coastal trip and want a rough sense of the route length.", { unitLabel: "km" }),
  surface("g5-fC-high", "You're pricing a coastal contract where the route length sets a penalty clause.", { unitLabel: "km" }),

  // g6-drift — a recurring question across 3 rounds
  surface("g6-p1", "How many open support tickets are in the queue right now?", { unitLabel: "tickets" }),
  surface("g6-p2", "How many people are currently through the door?", { unitLabel: "people" }),
  surface("g6-p3", "What's the current server-room temperature?", { unitLabel: "°C" }),
  surface("g6-p4", "How many units do we currently have in stock?", { unitLabel: "units" }),
  surface("g6-p5", "How many page views has the release post gotten so far today?", { unitLabel: "views" }),
  surface("g6-p6", "How many minutes until the delivery arrives?", { unitLabel: "minutes" }),
  surface("g6-fA", "How many open support tickets are in the queue right now?", { unitLabel: "tickets" }),
  surface("g6-fB", "How many open support tickets are in the queue right now?", { unitLabel: "tickets" }),
  surface("g6-fC", "How many open support tickets are in the queue right now?", { unitLabel: "tickets" }),
];
