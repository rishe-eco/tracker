import { gql } from "apollo-server-express";

export const typeDefs = gql`
  "P = Primary (high urgency, high importance), S = Secondary (low urgency, high importance), O = Outsource (high urgency, low importance), B = BucketList (low urgency, low importance)"
  enum Priority {
    P
    S
    O
    B
  }

  "How often an interval repeats: minute, hour, day, week, month, year"
  enum RepeatUnit {
    minute
    hour
    day
    week
    month
    year
  }

  "Interval status: active or inactive"
  enum IntervalStatus {
    active
    inactive
  }

  "How action was disposed in After-day wizard (null = still scheduled or done)"
  enum ActionFate {
    Postponed
    OutsourceWoo
    Backlog
    BucketList
    PassedArchived
  }

  "Source of gathered actions; null = user-created"
  enum ActionSourceType {
    interval
    routine
  }

  type Action {
    id: ID!
    title: String!
    tbd: String
    done: Boolean!
    priority: Priority!
    estimatedTimeMinutes: Int
    startTimeOfDay: String
    createdAt: String!
    project: Project
    sourceType: ActionSourceType
    sourceId: String
    forDate: String
    isGathered: Boolean!
    actionFate: ActionFate
    "Time Themes: locked (snapshot from the interval/routine) when sourceType != null; editable otherwise."
    tags: [Tag!]!
  }

  type DayState {
    id: ID!
    dateKey: String!
    afterDayCompletedAt: String
    actionGatheringCompletedAt: String
    preDayCompletedAt: String
  }

  "Action with overlap info for Pre-day overview (overlapIds = other action ids that overlap in time)."
  type ActionWithOverlap {
    action: Action!
    overlapIds: [ID!]!
  }

  "Pre-day status for a given date (today)."
  type PreDayStatus {
    afterDayRequired: Boolean!
    canAccessToday: Boolean!
    actionsWithoutTime: [Action!]!
    todayActionsWithOverlap: [ActionWithOverlap!]!
  }

  "Not-done actions for After-day wizard, grouped by how they are handled."
  type NotDoneActionsForDate {
    nonLinkedGathered: [Action!]!
    linkedGathered: [Action!]!
    "Project-linked actions the user created by hand (never interval- or routine-sourced)."
    linkedManual: [Action!]!
    standalone: [Action!]!
  }

  type Project {
    id: ID!
    title: String!
    dod: String
    type: String!
    priority: Priority!
    actions: [Action!]!
    intervals: [Interval!]!
    startDate: String
    endDate: String
    goal: Goal
    milestone: Milestone
    "Time Themes: seeds tags onto actions created under this project (copy at create, then independent)."
    tags: [Tag!]!
  }

  type Goal {
    id: ID!
    title: String!
    dod: String
    isGoalGroup: Boolean!
    startDate: String
    endDate: String
    createdAt: String!
    parentGoalId: ID
    parentMilestoneId: ID
    parentGoal: Goal
    parentMilestone: Milestone
    childGoals: [Goal!]!
    milestones: [Milestone!]!
    projects: [Project!]!
    intervals: [Interval!]!
    dodClarityStatus: String
    dodFlaggedDimensions: [String!]!
  }

  type Milestone {
    id: ID!
    title: String!
    doa: String
    goalId: ID!
    goal: Goal!
    childGoals: [Goal!]!
    projects: [Project!]!
    intervals: [Interval!]!
    predictionDate: String
    order: Int!
    isLast: Boolean!
  }

  type IntervalStep {
    id: ID!
    title: String!
    order: Int!
    createdAt: String!
  }

  type Interval {
    id: ID!
    title: String!
    status: IntervalStatus!
    estimatedTimeMinutes: Int!
    endTime: String
    repeatValue: Int!
    repeatUnit: RepeatUnit
    customRepeatDates: [String!]!
    customRepeatRule: String
    predictedToDoTime: String
    steps: [IntervalStep!]!
    goal: Goal
    milestone: Milestone
    project: Project
    createdAt: String!
    updatedAt: String!
    "Time Themes: snapshot-copied onto every action this interval gathers (locked on the occurrence)."
    tags: [Tag!]!
  }

  type RoutineStep {
    id: ID!
    title: String!
    order: Int!
    createdAt: String!
  }

  type Routine {
    id: ID!
    title: String!
    status: IntervalStatus!
    estimatedTimeMinutes: Int!
    endTime: String
    timeOfDayBlocks: [String!]!
    timerDurationMinutes: Int
    steps: [RoutineStep!]!
    createdAt: String!
    updatedAt: String!
    "Time Themes: snapshot-copied onto every action this routine gathers (locked on the occurrence)."
    tags: [Tag!]!
  }

  """
  Time Themes: a shared, user-scoped tag vocabulary (name + colour) attaching
  to Project, Interval, Routine, Action, and TimeTheme. Renaming/recolouring
  propagates everywhere the tag is used, because everything references it by
  id, not by spelling.
  """
  type Tag {
    id: ID!
    name: String!
    color: String!
    "Sum of how many Projects/Intervals/Routines/Actions/TimeThemes carry this tag."
    usageCount: Int!
    createdAt: String!
  }

  """
  A recurring, tag-bearing span of time. Soft/suggestion only — a Time Theme
  never blocks, gates, or filters anything; its only effects are re-ranking
  matching actions to the top of a themed slot and drawing a coloured band on
  the timeline. Recurrence fields mirror Interval's exactly (see
  intervalOccursOnDate in services/actionGathering.ts, reused verbatim to
  resolve which dates a theme fires on).
  """
  type TimeTheme {
    id: ID!
    title: String!
    status: IntervalStatus!
    startTimeOfDay: String!
    endTimeOfDay: String!
    repeatValue: Int!
    repeatUnit: RepeatUnit
    customRepeatDates: [String!]!
    customRepeatRule: String
    endTime: String
    tags: [Tag!]!
    createdAt: String!
    updatedAt: String!
  }

  input TimeThemeInput {
    title: String!
    startTimeOfDay: String!
    endTimeOfDay: String!
    repeatValue: Int
    repeatUnit: RepeatUnit
    customRepeatDates: [String!]
    customRepeatRule: String
    endTime: String
    tagIds: [ID!]!
  }

  type Note {
    id: ID!
    entityType: String!
    entityId: ID!
    body: String!
    createdAt: String!
    updatedAt: String!
  }

  type Journal {
    id: ID!
    title: String!
    description: String
    isArchived: Boolean!
    isDefault: Boolean!
    linkedGoalId: ID
    linkedProjectId: ID
    linkedGoal: Goal
    linkedProject: Project
    entryCount: Int!
    entries: [JournalEntry!]!
    accessList: [JournalAccess!]!
    createdAt: String!
    updatedAt: String!
  }

  type JournalAccess {
    id: ID!
    journalId: ID!
    userEmail: String!
    addedAt: String!
  }

  type JournalEntry {
    id: ID!
    journalId: ID!
    body: String!
    createdAt: String!
    updatedAt: String!
    isArchived: Boolean!
    timestampOverridden: Boolean!
  }

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String
    discoverableByEmail: Boolean!
    actions: [Action!]!
    projects: [Project!]!
    goals: [Goal!]!
    intervals: [Interval!]!
    routines: [Routine!]!
  }

  input ActionInput {
    title: String!
    tbd: String
    priority: Priority
    estimatedTimeMinutes: Int
  }

  input IntervalStepInput {
    title: String!
    order: Int
  }

  input RoutineStepInput {
    title: String!
    order: Int
  }

  type OnboardingProgress {
    lastSlideViewed: Int!
    completedAt: String
  }

  # ── Skill tools ───────────────────────────────────────────────────────────
  # Spec: tracker-canon/06-specs/. Note what is absent from SkillItem: the
  # answer key, the fault target, the independence rules and the reveal text all
  # stay server-side until a verdict is committed. A leaked key would not break
  # anything visibly — it would just make every score meaningless.

  enum SkillKey {
    clarity
    evidence
    decomposition
    verification
    delegation
    monitoring
  }

  enum SkillModuleState {
    not_started
    in_progress
    mastered
    tested_out
    due_review
  }

  enum SkillMode {
    assessment
    module
    review
    calibrated_practice
    open_practice
  }

  "Three timepoints per skill: baseline (form A), post (form B), delayed (form C) — offset per user so forms don't always land on the same timepoint for everyone."
  enum SkillTimepoint {
    baseline
    post
    delayed
  }

  "A fixed verdict set, shared by every item so the options never narrow the answer."
  enum SkillVerdict {
    supported
    unsupported
    misattributed
    outdated
    contested
    cant_tell
  }

  "Which element of a claim failed. One shared set — per-item options would leak the key."
  enum SkillFaultTag {
    citation
    quote
    claim_support
    recency
    framing
    existence
    figure
    none
  }

  type SkillModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    state: SkillModuleState!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
  }

  type SkillSnapshotResult {
    title: String!
    url: String!
    snippet: String!
  }

  "A frozen search, shipped with the item so a scored probe needs no network and every learner meets the same evidence."
  type SkillSnapshotQuery {
    query: String!
    results: [SkillSnapshotResult!]!
  }

  type SkillItem {
    itemId: String!
    moduleKey: String!
    difficulty: Int!
    prompt: String!
    answer: String!
    "Present only in assessment, where checks run against frozen results."
    snapshotQueries: [SkillSnapshotQuery!]
  }

  type SkillServedItem {
    attemptId: ID!
    item: SkillItem!
  }

  input SkillSourceInput {
    url: String!
    snippet: String
  }

  type SkillAttemptResult {
    attemptId: ID!
    "1 when a check was opened and a source returned *before* the verdict was committed."
    lateral: Int!
    "1 when the returned source is not the answer's own citation or a mirror of it."
    independence: Int!
    accuracy: Int!
    "0–2: how precisely the failing element was located."
    traceQuality: Int!
    "lateral AND independence AND accuracy — the headline measure."
    strict: Int!
    brier: Float!
    timeToFirstCheckMs: Int
    "True when a true claim was flagged as faulty — the failure that looks like diligence."
    falseAlarm: Boolean!
    overTrust: Boolean!
    correctVerdict: SkillVerdict!
    reveal: String!
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
  }

  """
  A module sitting written into the calendar as an ordinary scheduled action, so
  practice competes for time in the same place as everything else.
  """
  type SkillPlannedSession {
    actionId: ID!
    moduleKey: String!
    title: String!
    tbd: String!
    done: Boolean!
  }

  type SkillPlanResult {
    created: Int!
    "Future, not-yet-done sessions replaced by this plan. Past and completed sessions are never touched."
    removed: Int!
    warnings: [String!]!
  }

  # ── Skill probes (baseline / post / delayed) ─────────────────────────────
  #
  # Shared across all three tools on purpose (build plan 03b §3 Phase 5):
  # Evidence and Clarity inherit this the same way Decomposition does. The
  # container (which form, whether it's complete, comparability, the delayed
  # schedule, self-report) is uniform; only a single item's own score keeps
  # its own per-tool type, unaffected by any of this.

  type SkillProbeStart {
    probeId: ID!
    timepoint: SkillTimepoint!
    "A, B, or C — assigned once per (user, skill, timepoint) and never reassigned."
    formId: String!
    "True when this probe was already open and is being resumed rather than started fresh."
    resuming: Boolean!
    "True when this timepoint was already completed — nothing more to do, no items served."
    alreadyCompleted: Boolean!
  }

  type SkillProbeCompleteResult {
    probeId: ID!
    timepoint: SkillTimepoint!
    formId: String!
    itemCount: Int!
    "JSON — shape differs by skill (behavioural composite for Evidence, per-criterion means for Clarity/Decomposition), parsed client-side like responseStructure."
    totals: String!
    completedAt: String!
  }

  type SkillProbeEntry {
    timepoint: SkillTimepoint!
    formId: String!
    scheduledFor: String
    startedAt: String
    completedAt: String
    contentVersion: String!
    rubricVersion: String
    "Null until completed. JSON, per-skill shape — see SkillProbeCompleteResult.totals."
    totals: String
    "JSON array of the 4 self-efficacy answers. Collected, never scored, never folded into totals."
    selfReport: String
    "False when this probe's content or rubric version differs from what the learner is currently pinned to — chart a break here, never pool across it."
    comparable: Boolean!
  }

  type SkillProbeDue {
    skillKey: SkillKey!
    timepoint: SkillTimepoint!
    "Delayed only — when it became due. Null for post, which is due as soon as it's eligible."
    scheduledFor: String
  }

  type SkillExportResult {
    "The learner's full attempt and probe history for this skill."
    json: String!
    "The same data, as a short human-readable summary."
    markdown: String!
  }

  # ── Clarity Lab ───────────────────────────────────────────────────────────
  #
  # Deliberately its own set of types rather than a widening of the Evidence
  # ones. The two tools measure different things — Evidence scores behaviour,
  # Clarity scores a product against a rubric — and a shared type would have to
  # make every field on both sides nullable to accommodate the other.

  type ClarityModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    "The rubric criterion this module trains. 1:1, so feedback and score share a vocabulary."
    criterion: String!
    state: String!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
  }

  "What the learner is allowed to see. No required slots, no seeded faults, no reveal."
  type ClarityItem {
    itemId: String!
    moduleKey: String!
    "elicitation | revision | repair"
    type: String!
    difficulty: Int!
    scenario: String!
    contextSheet: String
    weakText: String
    "Revision items ship the reader's misread up front — that *is* the stimulus."
    authoredMisread: String
  }

  type ClarityServedItem {
    attemptId: ID!
    item: ClarityItem!
    "Elicitation only: a prediction must be locked before scores are available."
    needsPrediction: Boolean!
    "Revision and elicitation. Repair drills collapse to write then score."
    needsDiagnosis: Boolean!
    "Set when this attempt revises another; the draft is shown alongside."
    draftText: String
  }

  type ClarityCriterionScore {
    criterion: String!
    "0-2, or null when nothing scored it. Null is not zero."
    level: Int
    "detector | judge | detector+judge | unscored"
    source: String!
    findings: [String!]!
    "The judge must quote the learner's own words to justify a level."
    evidenceQuote: String
  }

  type ClarityScore {
    criteria: [ClarityCriterionScore!]!
    "Sum over scored criteria only."
    total: Int!
    "12 with a reader, 6 without. Always shown beside the total, never implied."
    maxPossible: Int!
    scoredCount: Int!
    unscored: [String!]!
    isVoid: Boolean!
    isComplete: Boolean!
  }

  """
  One unmet mastery requirement, as a code and its numbers rather than a
  finished sentence. The panel that says how to finish a module is the last
  place that should be English-only, and the wording belongs with the rest of
  the UI copy — so the server states the rule and the client says it.
  """
  type MasteryGap {
    "Which requirement is unmet. The client turns this into a sentence."
    code: String!
    "Where the learner is now, when the requirement is a count."
    count: Int
    "What the requirement asks for. Float rather than Int: every other tool's thresholds are counts, but Delegation Lab's mastery gate (discrimination, anchoring, error rates) is fractional."
    required: Float
    "Whole seconds, for the time-based gate. Null when not yet established."
    seconds: Int
    "Clarity's score bar, where the requirement is N attempts at M+/12."
    minTotal: Int
  }

  type ClarityDiagnosis {
    correct: [String!]!
    missed: [String!]!
    spurious: [String!]!
    """
    Tagged, but nothing assessed that criterion — so the tag is neither credited
    nor counted against. Non-empty mainly when no reader is configured.
    """
    unverifiable: [String!]!
  }

  type ClarityAttemptResult {
    attemptId: ID!
    score: ClarityScore!
    "Tagged criteria against what actually failed. Null on repair drills."
    diagnosis: ClarityDiagnosis
    "Repair drills only: did the fix clear the bar the drill sets?"
    repairPassed: Boolean
    "Revision total minus draft total. Null unless this attempt revises another."
    delta: Int
    reveal: String!
    """
    True when the reveal discusses the text the item shipped rather than what
    the learner wrote — it renders directly under their own per-criterion
    scores, where unlabelled it reads as being about their text.
    """
    revealIsAboutItemText: Boolean!
    "True when the diagnosis was marked against the text the item shipped rather than against what the learner wrote. On a revision item the diagnosis and the criteria beside it are about two different texts; the screen has to say which is which."
    diagnosisIsAboutItemText: Boolean!
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
    atCriterion: Boolean!
    "Criteria a judge levelled but which cannot count until calibration passes."
    feedbackOnly: [String!]!
  }

  type ClarityCriterionMean {
    criterion: String!
    mean: Float
    count: Int!
  }

  type ClarityProgress {
    contentVersion: String!
    rubricVersion: String!
    locale: String!
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    "False when no reader is configured: elicitation is unavailable and three criteria go unscored."
    readerAvailable: Boolean!
    "False until a calibration pass runs. Judge levels are shown but enter no probe total."
    anyCriterionCalibrated: Boolean!
    "Criteria scored without a model in this locale."
    detectorCriteria: [String!]!
    totalAttempts: Int!
    criterionMeans: [ClarityCriterionMean!]!
    revisionDeltas: [Int!]!
    meanDelta: Float
    "False until every probe item's key has been human-verified. startSkillProbe rejects until this is true."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  type SkillProgress {
    skillKey: SkillKey!
    contentVersion: String!
    locale: String!
    "draft = machine-drafted, awaiting native review. Surfaced, never hidden."
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    "False until every probe item's key has been human-verified and its results frozen."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "True when module sittings and due reviews are being written into the calendar."
    calendarPlanningEnabled: Boolean!
    totalAttempts: Int!
    itemCount: Int!
    strictCount: Int!
    strictComposite: Float!
    hitRate: Float!
    falseAlarmRate: Float!
    "Hit rate minus false-alarm rate. Shown beside the composite, never alone: a learner who has merely become distrustful has not learned the skill."
    discrimination: Float!
    meanBrier: Float!
    medianTimeToFirstCheckMs: Int
    overTrustRate: Float!
    accuracyRate: Float!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  # ── Decomposition Lab ────────────────────────────────────────────────────
  #
  # Own set of types, per the Clarity precedent: the artifact is a tree, not
  # prose, and widening either existing skill's types would force every field
  # on three tools to be nullable. Note what never appears anywhere below: an
  # answer key, a required-element set, an atomic marker, an overlap pair or a
  # blocking edge, before the attempt is scored. DecompositionAttemptResult
  # is the first place any of that appears, because it cannot exist before
  # scoring already happened.

  type DecompositionModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    "The rubric criterion this module trains. 1:1, so feedback and score share a vocabulary."
    criterion: String!
    state: String!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
  }

  type DecompositionPalettePiece {
    id: String!
    label: String!
  }

  "Repair items only: the faulty tree the learner reads, diagnoses, and fixes."
  type DecompositionSuppliedNode {
    id: String!
    parentId: String
    depth: Int!
    label: String!
    dependsOn: [String!]!
  }

  type DecompositionSuppliedWhole {
    statement: String!
    doneWhen: String!
  }

  "What the learner may see before submission. No key, no decoy/atomic/intendedDepth flags, no seeded fault."
  type DecompositionItem {
    itemId: String!
    moduleKey: String!
    "arrangement | breakdown | repair | control"
    type: String!
    difficulty: Int!
    scenario: String!
    "Arrangement only: the candidate pieces."
    palette: [DecompositionPalettePiece!]
    "Repair only: the faulty tree to diagnose and fix."
    suppliedTree: [DecompositionSuppliedNode!]
    suppliedWhole: DecompositionSuppliedWhole
  }

  type DecompositionServedItem {
    attemptId: ID!
    item: DecompositionItem!
    "Repair items only: name the fault before fixing it."
    needsDiagnosis: Boolean!
    "Set when this attempt revises another; the draft structure is shown alongside, as JSON."
    draftStructure: String
  }

  input DecompositionWholeInput {
    statement: String!
    doneWhen: String!
  }

  input DecompositionNodeInput {
    id: String!
    parentId: String
    label: String!
    doneWhen: String!
    order: Int!
    dependsOn: [String!]!
  }

  input DecompositionStructureInput {
    whole: DecompositionWholeInput!
    nodes: [DecompositionNodeInput!]!
  }

  type DecompositionCriterionScore {
    "D1-D6"
    id: String!
    "0-2, or null when nothing scored it. Null is not zero."
    level: Int
    "detector | instrumentation | key | unscored"
    scoredBy: String!
    evidence: String!
  }

  type DecompositionCoverage {
    found: Int!
    required: Int!
  }

  type DecompositionScore {
    criteria: [DecompositionCriterionScore!]!
    "Sum over scored criteria only."
    total: Int!
    scoredCount: Int!
    coverage: DecompositionCoverage
    "Breadth-first index — null when fewer than two top-level pieces exist."
    bfi: Float
    "Control items only: more than one node when the correct response was to leave it whole."
    overDecomposed: Boolean!
    isVoid: Boolean!
    isComplete: Boolean!
  }

  type DecompositionRevealPiece {
    id: String!
    label: String!
    required: Boolean!
    atomic: Boolean!
  }

  type DecompositionPairing {
    a: String!
    b: String!
  }

  "The correct structure, revealed only after the attempt is scored — for self-diagnosis on whatever D3/D5/D6 came back unscored."
  type DecompositionReveal {
    pieces: [DecompositionRevealPiece!]!
    overlapPairs: [DecompositionPairing!]!
    blockingEdges: [DecompositionPairing!]!
    independentPairs: [DecompositionPairing!]!
  }

  type DecompositionAttemptResult {
    attemptId: ID!
    score: DecompositionScore!
    "Repair items only: did the named fault match the seeded one?"
    diagnosisCorrect: Boolean
    "Revision total minus draft total. Null unless this attempt revises another."
    delta: Int
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
    atCriterion: Boolean!
    reveal: DecompositionReveal!
  }

  type DecompositionCriterionMean {
    criterion: String!
    mean: Float
    count: Int!
  }

  type DecompositionProgress {
    contentVersion: String!
    rubricVersion: String!
    locale: String!
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    totalAttempts: Int!
    criterionMeans: [DecompositionCriterionMean!]!
    breadthFirstIndexTrend: [Float!]!
    "(D4 level-2 rate on decomposable items) minus (over-decomposition rate on control items). Null with no comparison yet."
    granularityDiscrimination: Float
    "False until every probe item's key has been human-verified. startSkillProbe rejects until this is true."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  # ── Decomposition Lab: real-work export ───────────────────────────────────
  #
  # The one flow in the whole build that writes the learner's real data
  # (spec 03-decomposition-lab.md §8, build plan Phase 7). No authored item,
  # no key: D3/D5/D6 can never be scored here, not "unscored until a judge
  # exists" — permanently, by construction. Never counts toward mastery or
  # probes (mode: open_practice).

  "Which of the learner's own Tracker entities they're decomposing."
  enum DecompositionRealWorkTargetType {
    goal
    project
  }

  type DecompositionRealWorkServedItem {
    attemptId: ID!
    targetType: DecompositionRealWorkTargetType!
    targetId: ID!
    "The target's own title, shown as the read-only material being decomposed."
    title: String!
    "The target's own DoD, if it has one."
    dod: String!
  }

  type DecompositionRealWorkResult {
    attemptId: ID!
    "D3, D5 and D6 are always null here — there is no key for real material."
    score: DecompositionScore!
  }

  type DecompositionExportedProject {
    id: ID!
    title: String!
  }

  type DecompositionExportedAction {
    id: ID!
    title: String!
    projectId: ID
  }

  "What actually got written into Tracker, and what didn't survive the trip."
  type DecompositionExportResult {
    createdProjects: [DecompositionExportedProject!]!
    createdActions: [DecompositionExportedAction!]!
    "Dependency edges among the exported pieces that had nowhere to go — Tracker models containment and sequence, not dependency."
    dependencyEdgesDropped: Int!
  }

  # ── Verification Lab ──────────────────────────────────────────────────────
  #
  # Own set of types, per the Clarity/Decomposition precedent. The bench-leak
  # rule shapes the served item and the reveal flow: no bench entry's
  # independent/discriminating tag, no outcome, no element decoy flag, and no
  # failingElementId ever appears before the corresponding check is run or
  # the verdict is committed. VerificationSubmitResult is the first place any
  # of that appears, because it cannot exist before scoring already happened.

  enum VerificationVerdict {
    supported
    unsupported
    outdated
    cannot_verify
  }

  "assisted (hard cost ceiling) or unassisted (none) — two different instruments, never pooled (spec §4a)."
  enum VerificationRung {
    assisted
    unassisted
  }

  type VerificationModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    rung: VerificationRung!
    state: String!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
    "Assisted rung only: true once >=4 of the last 6 attempts are strict with no control false alarm. Offered, never forced."
    promotionOffered: Boolean!
  }

  "One candidate check as the client may see it before it's run — cost and label only, never the outcome."
  type VerificationBenchEntry {
    checkId: String!
    label: String!
    costSeconds: Int!
  }

  "What the learner may see before submission. No independent/discriminating tags, no outcomes, no keyVerdict."
  type VerificationItem {
    itemId: String!
    moduleKey: String!
    difficulty: Int!
    ask: String!
    answer: String!
    bench: [VerificationBenchEntry!]!
  }

  type VerificationServedItem {
    attemptId: ID!
    item: VerificationItem!
    rung: VerificationRung!
    "Seconds, only on the assisted rung — the hard ceiling, visible from the start."
    assistedCeilingSeconds: Int
  }

  "One check's outcome, revealed only once it is selected — never shipped as part of the bench."
  type VerificationCheckOutcome {
    checkId: String!
    outcome: String!
    costSeconds: Int!
    cumulativeSpent: Int!
    ceilingSeconds: Int
  }

  type VerificationLocalisationElement {
    elementId: String!
    label: String!
  }

  """
  Two shapes in one type rather than a union, matching this schema's existing
  style: on the unassisted rung a commit returns the withheld element list
  (stage "awaitingLocalisation") instead of a score, because nothing is
  revealed before setVerificationLocalization runs.
  """
  type VerificationCommitResult {
    "scored | awaitingLocalisation"
    stage: String!
    "Unassisted rung only, before localisation — absent from the DOM otherwise, not merely hidden."
    elements: [VerificationLocalisationElement!]
    result: VerificationSubmitResult
  }

  type VerificationCriterionScore {
    "V1-V6"
    id: String!
    "0-2, or null when nothing scored it (unscored on this rung, or inapplicable on a control item). Null is not zero."
    level: Int
    "detector | instrumentation | key | key+instrumentation | unscored"
    scoredBy: String!
    evidence: String!
  }

  type VerificationScore {
    criteria: [VerificationCriterionScore!]!
    "Sum over scored criteria only."
    total: Int!
    scoredCount: Int!
    "V1 x V3 x verdict-match — the headline number."
    strict: Boolean!
    "none-run | none-could-fail | some-could-fail | all-could-fail. Only none-could-fail counts toward the ritual rate."
    ritualState: String!
    costSpent: Int!
    "Spend divided by the key's cheapest sufficient check. Null when nothing discriminates (a NO_ORACLE item)."
    costRatio: Float
    rung: VerificationRung!
    isVoid: Boolean!
    isComplete: Boolean!
  }

  "Only ever populated after scoring — the cheapest sufficient check and the ideal cost, never shown before commit."
  type VerificationReveal {
    failingElementLabel: String
    cheapestCheckId: String
    cheapestCostSeconds: Int
  }

  type VerificationSubmitResult {
    attemptId: ID!
    score: VerificationScore!
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
    "Assisted rung only: offered, never forced — the learner still chooses via setVerificationRung."
    promotionOffered: Boolean!
    reveal: VerificationReveal!
  }

  type VerificationCriterionMean {
    criterion: String!
    mean: Float
    count: Int!
  }

  type VerificationProgress {
    contentVersion: String!
    rubricVersion: String!
    locale: String!
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    totalAttempts: Int!
    criterionMeans: [VerificationCriterionMean!]!
    strictComposite: Float
    "The metric unique to this tool: the share of attempts where every check run was pass-either-way."
    ritualRate: Float
    "Hit rate on faulty items minus false-alarm rate on CORRECT controls."
    discrimination: Float
    meanCostRatio: Float
    "Correct 'cannot verify' on NO_ORACLE items."
    correctUnverifiedCount: Int!
    "Incorrect 'cannot verify' on a verifiable item — reported beside the correct count, or the tool would reward giving up."
    falseUnverifiedCount: Int!
    "False until every probe item's key has been human-verified. startSkillProbe rejects until this is true."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  # ── Verification Lab: real-work verification record ─────────────────────
  #
  # The learner brings a real AI output, names an oracle in free text (no
  # bench — inventing one is the point), checks it outside the app, and
  # pastes back what they found. Nothing here is scored or written into
  # Tracker directly — the record is saved through the existing addQuickEntry
  # / addNote mutations, the same way any other working note would be.

  type VerificationRealWorkServedItem {
    attemptId: ID!
    claim: String!
  }

  type VerificationRealWorkRecord {
    claim: String!
    oracle: String!
    result: String!
    verdict: VerificationVerdict!
    residualRisk: String!
  }

  type VerificationRealWorkResult {
    attemptId: ID!
    record: VerificationRealWorkRecord!
  }

  # ── Delegation Lab ─────────────────────────────────────────────────────────
  #
  # No rung (the two-rung scaffold is specific to Verification's cost bench).
  # The ordering rule this tool rests on: DelegationItem never carries advice
  # or truth, and DelegationAdvice — returned only by commitDelegationEstimate
  # — is the first place either ever appears. A single attempt scores only the
  # one criterion its own module trains; the other five DelegationCriterionScore
  # slots come back as scoredBy "unscored", same convention as a null level
  # elsewhere in this engine.

  type DelegationModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    state: String!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
  }

  type DelegationCueOption {
    cueId: String!
    label: String!
  }

  type DelegationSplitPieceOption {
    pieceId: String!
    label: String!
  }

  "What the learner may see before any commit. No truth, no advice, no split key, no round data beyond what's already committed."
  type DelegationItem {
    itemId: String!
    moduleKey: String!
    difficulty: Int!
    "estimate | cue | split | stakes | sequence"
    kind: String!
    ask: String!
    unitLabel: String
    plausibleRange: [Float!]
    "cue items only."
    cueOptions: [DelegationCueOption!]
    "split items only."
    splitPieces: [DelegationSplitPieceOption!]
    "stakes items only — both halves of a pair share this id."
    stakesPairId: String
    "sequence items only."
    roundIndex: Int
    totalRounds: Int
  }

  type DelegationServedItem {
    attemptId: ID!
    item: DelegationItem!
  }

  "Returned only once estimate_committed is stamped — absent from every payload before that (build plan §3)."
  type DelegationAdvice {
    advice: Float!
    unitLabel: String
  }

  type DelegationCriterionScore {
    "G1-G6"
    id: String!
    "0-2, or null when this item's module doesn't train this criterion. Null is not zero."
    level: Int
    "computed | key | key+computed | unscored"
    scoredBy: String!
    evidence: String!
  }

  type DelegationScore {
    criteria: [DelegationCriterionScore!]!
    total: Int!
    scoredCount: Int!
    "Retained for export even when clamped for scoring. Null on split/sequence-in-progress items and when advice equalled the initial estimate."
    woaRaw: Float
    woaClamped: Float
    benchmark: Float
    "over | under | ok — never shown live, only at the reveal."
    direction: String!
    netGain: Float
    "good | bad | tie | null — whether advice beat the learner's own initial estimate on this item, for this learner."
    adviceQuality: String
    "The initial estimate fell outside plausibleRange — void, not wrong, never averaged in as a zero."
    isVoid: Boolean!
    "g5-stakes only: true until the sibling half of the pair has also committed."
    pendingPair: Boolean!
    "The authored truth — present only here, on an already-scored attempt, never on the served item. Null on split and sequence items."
    truth: Float
  }

  type DelegationSubmitResult {
    attemptId: ID!
    score: DelegationScore!
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
  }

  "cue items only: returned after the revision commits, before the cue is picked."
  type DelegationCueChoice {
    "needsCue | scored"
    stage: String!
    cueOptions: [DelegationCueOption!]
    result: DelegationSubmitResult
  }

  type DelegationSequenceRoundResult {
    "advice | recorded | scored"
    stage: String!
    "Present only when stage is 'advice' — this round's advice, absent before its own estimate is committed."
    advice: Float
    result: DelegationSubmitResult
  }

  type DelegationCriterionMean {
    criterion: String!
    mean: Float
    count: Int!
  }

  type DelegationProgress {
    contentVersion: String!
    rubricVersion: String!
    locale: String!
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    totalAttempts: Int!
    criterionMeans: [DelegationCriterionMean!]!
    "The headline (spec §6): mean WOA on trust-cued items minus mean WOA on keep-cued items."
    relianceDiscrimination: Float
    "Always shown beside underReliance, in one bordered pair, and never summed anywhere."
    overReliance: Float
    underReliance: Float
    netGainFromAdvice: Float
    "Mean |WOA - 0.5| on uncued items. Should be small — confident deviation with no grounds."
    anchoringOnUncuedItems: Float
    "Brier score over stated confidence against own initial accuracy — the component the literature says is trainable."
    selfAssessmentCalibration: Float
    "Withheld (null) until the baseline probe completes, or 12 scored items if it was skipped — an anchor delivered early cannot be withdrawn."
    populationMeanWoa: Float
    ownMeanWoa: Float
    "False until every probe item's key has been human-verified. startSkillProbe rejects until this is true."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  input DelegationDispositionInput {
    pieceId: String!
    "give | keep"
    disposition: String!
  }

  # ── Delegation Lab: real-work delegation record ─────────────────────────
  #
  # The only mode in this engine that spans two sittings: logged before a
  # real decision, revisited after the outcome is known. Nothing here is
  # scored or written into Tracker directly — the record is saved through
  # the existing addQuickEntry / addNote mutations, same as Verification's
  # real-work record.

  type DelegationRealWorkServedItem {
    attemptId: ID!
    handingOver: String!
    keeping: String!
    wouldTellMeWrong: String!
  }

  type DelegationRealWorkRecord {
    handingOver: String!
    keeping: String!
    wouldTellMeWrong: String!
    whatActuallyHappened: String!
  }

  type DelegationRealWorkResult {
    attemptId: ID!
    record: DelegationRealWorkRecord!
  }

  # ── Monitoring Lab ─────────────────────────────────────────────────────────
  #
  # No rung, no new tables (build plan §9). The artifact is a prediction: every
  # item collects a claim the learner makes about themselves, then measures it.
  # S1 and S3 never get a per-attempt level at all (unlike every other tool's
  # "one criterion per attempt" — here two criteria are window-level patterns,
  # not a property of one item), so a recall/pair-unassisted MonitoringScore
  # carries a predictionSample instead, aggregated in MonitoringProgress.
  # Resolution never renders without performance beside it (spec §2, §10) —
  # enforced in the client, asserted in its test suite, not in this schema.

  type MonitoringModule {
    moduleKey: String!
    title: String!
    concept: String!
    model: String!
    state: String!
    currentStep: Int!
    masteredAt: String
    nextReviewAt: String
  }

  type MonitoringTurn {
    turnId: String!
    role: String!
    text: String!
  }

  type MonitoringCheckpoint {
    checkpointId: String!
    text: String!
  }

  type MonitoringCountermeasureOption {
    optionId: String!
    label: String!
  }

  "What the learner may see before any commit. Never answerVariants, never causalSteps, never a planted-influence tag, never a checkpoint's claimCorrect, never a countermeasure's attentionDependent flag."
  type MonitoringItem {
    itemId: String!
    moduleKey: String!
    difficulty: Int!
    "recall | pair | explain | transcript | longset"
    kind: String!
    question: String
    explainPrompt: String
    "Assisted pair half only, shown before any rating."
    authoredExplanation: String
    pairId: String
    "assisted | unassisted"
    pairHalf: String
    turns: [MonitoringTurn!]
    checkpoints: [MonitoringCheckpoint!]
    countermeasureOptions: [MonitoringCountermeasureOption!]
  }

  type MonitoringServedItem {
    attemptId: ID!
    item: MonitoringItem!
  }

  type MonitoringOk {
    ok: Boolean!
  }

  type MonitoringCriterionScore {
    "S1-S6"
    id: String!
    "0-2, or null when this item's module doesn't train this criterion, or when the criterion is window-level (S1, S3) rather than per-attempt. Null is not zero."
    level: Int
    "computed | key | unscored"
    scoredBy: String!
    evidence: String!
  }

  type MonitoringPredictionSample {
    "no_idea | probably_not | probably | confident"
    prediction: String!
    outcome: Int!
  }

  type MonitoringRatingSample {
    pairId: String!
    "assisted | unassisted"
    pairHalf: String!
    rating: Int!
  }

  type MonitoringDeflation {
    before: Int!
    after: Int!
  }

  type MonitoringInfluenceResult {
    hits: Int!
    falseAlarms: Int!
    plantedTotal: Int!
    misses: Int!
    "The answer key: which turns carried a planted influence, what kind each was, and whether this learner marked it. Present only on a scored attempt — never on the served item, where it would destroy the instrument. Empty on a clean control."
    plantedTurns: [MonitoringPlantedTurn!]!
  }

  type MonitoringPlantedTurn {
    turnId: String!
    "flattery | anchor | smuggled_premise | agreement_reversal — a closed enum, so the client names it in either locale without authored prose crossing the wire."
    type: String!
    found: Boolean!
  }

  "Descriptive only, never scored (build plan §4.5) — never aggregated across sessions either."
  type MonitoringCheckRate {
    firstThird: Float!
    lastThird: Float!
    decay: Float
  }

  type MonitoringScore {
    criteria: [MonitoringCriterionScore!]!
    total: Int!
    scoredCount: Int!
    "recall (s3), and the unassisted half of a pair (s1) — feeds window-level gamma/bias, never scored per-attempt."
    predictionSample: MonitoringPredictionSample
    "pair only — feeds window-level post-AI inflation."
    ratingSample: MonitoringRatingSample
    "explain only — descriptive, never scored."
    deflation: MonitoringDeflation
    "transcript only."
    influenceResult: MonitoringInfluenceResult
    "longset only — descriptive, never scored."
    checkRate: MonitoringCheckRate
    "recall (s3) and the answered half of a pair (s1) — the outcome, not a score. S1/S3 are window-level and carry no per-attempt level, so this is the only thing a single sitting has to reveal. Never present on a served item."
    answerOutcome: MonitoringAnswerOutcome
  }

  type MonitoringAnswerOutcome {
    "Exactly what the learner typed."
    yourAnswer: String!
    correct: Boolean!
    "The canonical accepted answer — revealed here and nowhere earlier."
    acceptedAnswer: String!
  }

  type MonitoringSubmitResult {
    attemptId: ID!
    score: MonitoringScore!
    moduleState: String!
    masteryUnmet: [MasteryGap!]!
  }

  "recall, and the unassisted half of a pair: submitMonitoringAnswer scores immediately, except on the unassisted pair half, which still needs its rating."
  type MonitoringAnswerResult {
    "scored | needsRating"
    stage: String!
    result: MonitoringSubmitResult
  }

  "pair items score on this call; explain items only record the rating (before or after) and score later, on selectMonitoringSteps."
  type MonitoringRatingResult {
    "recorded | scored"
    stage: String!
    result: MonitoringSubmitResult
  }

  type MonitoringCausalStep {
    stepId: String!
    label: String!
  }

  "Returned by commitMonitoringExplanation. The re-rating (commitMonitoringRating, phase 'after') must land before selectMonitoringSteps will accept a selection, so the learner is never rating against a list they've already acted on (spec §10; D-45)."
  type MonitoringExplanationResult {
    steps: [MonitoringCausalStep!]!
  }

  type MonitoringCriterionMean {
    criterion: String!
    mean: Float
    count: Int!
  }

  type MonitoringProgress {
    contentVersion: String!
    rubricVersion: String!
    locale: String!
    reviewStatus: String!
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    totalAttempts: Int!
    criterionMeans: [MonitoringCriterionMean!]!
    resolutionSampleCount: Int!
    "Gamma over s3-resolution items only. Null renders as 'not measurable from this set,' never as zero (build plan §4.1: all-correct, all-identical predictions, and <4 items are all null, not 0). Never shown without performance beside it."
    resolution: Float
    "Fraction correct on s3-resolution items — always shown beside resolution, never alone."
    performance: Float
    "mean(predicted probability) - accuracy on s3-resolution items, signed so direction is legible."
    bias: Float
    "selfRating(assisted) - selfRating(unassisted), averaged per completed pair. The §1.1 AI-literacy finding is withheld until this number exists (postAiInflationReady), then shown attached to it — including when it's near zero."
    postAiInflation: Float
    postAiInflationReady: Boolean!
    "hitRate - falseAlarmRate across every scored transcript."
    influenceDiscrimination: Float
    "False until every probe item's key has been human-verified. startSkillProbe rejects until this is true."
    probeReady: Boolean!
    probeBlockers: [String!]!
    "Baseline/post/delayed, whichever have been started. Empty until the first startSkillProbe."
    probes: [SkillProbeEntry!]!
  }

  input MonitoringInfluenceMarkInput {
    turnId: String!
    movedWhat: String!
  }

  # ── Monitoring Lab: session self-audit (open practice) ────────────────────
  #
  # The retention feature: the learner reviews one of their own real AI
  # conversations against the four influence types this tool's transcripts
  # are built from, and writes a short note on each. mode: open_practice —
  # never scored into mastery or probes (build plan Phase 6). Nothing is
  # written into Tracker directly — save the returned record yourself via
  # addQuickEntry or addNote, mirroring Delegation's and Verification's
  # real-work records.

  type MonitoringSelfAuditServedItem {
    attemptId: ID!
    "flattery | anchor | smuggled_premise | agreement_reversal, in this fixed order every time."
    questionKeys: [String!]!
  }

  type MonitoringSelfAuditRecord {
    flattery: String!
    anchor: String!
    smuggledPremise: String!
    agreementReversal: String!
  }

  type MonitoringSelfAuditResult {
    attemptId: ID!
    record: MonitoringSelfAuditRecord!
  }

  input MonitoringSelfAuditAnswersInput {
    flattery: String!
    anchor: String!
    smuggledPremise: String!
    agreementReversal: String!
  }

  # ── Learn · Feelings & Needs (Module 1) ───────────────────────────────────
  # Plan: ecosystem/working/learn-build/00-module1-demo-plan.md. A Tracker-
  # namespaced tool. The tool home reads only enough state to route into the
  # Day-1 frame (once) or the daily loop. Nothing here is a count shown back to
  # the user — sittingCount routes, it does not streak (plan §10).
  type FeelingsNeedsState {
    contentVersion: String!
    """
    The locale of the *practice content* — the palettes, prompts and catch copy.
    Fixed to "en" for the demo (plan §2). Not the same thing as the interface
    language: a Persian user gets Persian chrome around English practice
    material, and the client is expected to compare these two and say so.
    """
    locale: String!
    "draft | reviewed — a draft locale is a known state, surfaced not hidden."
    reviewStatus: String!
    "Whether the Day-1 felt-not-told frame has been completed (gates the loop)."
    frameDone: Boolean!
    "The one-time capability moment has been shown. A door, not a score."
    graduationSurfaced: Boolean!
    "How far the app has withdrawn its own prompts (P7). Higher = fewer prompts."
    promptFadeLevel: Int!
    "Total sittings so far — for routing only, never surfaced as a streak."
    sittingCount: Int!
  }

  # The authored content pack. Note what is absent: the faux-feelings lexicon and
  # its catch templates. Detection runs server-side and the composed catch is
  # returned on a hit, so the trigger list has no reason to reach a browser.
  type FnPaletteEntry {
    id: String!
    label: String!
    """
    The form to use when the word is carried into the next prompt rather than
    put on a chip, authored together with the carry template it goes into.
    Null when the chip label works as-is.
    """
    carryLabel: String
    "early | broaden — feelings only; the pleasant/met-need weighting (P1, P3)."
    tier: String
  }

  type FnFrameBeat {
    prompt: String!
    helper: String!
  }

  type FnFrameIntro {
    title: String!
    body: String!
    begin: String!
  }

  type FnFrameRecall {
    prompt: String!
    helper: String!
    ready: String!
  }

  type FnFramePlace {
    prompt: String!
    helper: String!
    locationIds: [String!]!
  }

  type FnFrameTexture {
    prompt: String!
    helper: String!
    textureIds: [String!]!
  }

  type FnFrameName {
    prompt: String!
    helper: String!
    feelingIds: [String!]!
  }

  type FnFramePayoff {
    line: String!
    body: String!
    close: String!
  }

  type FnFrame {
    intro: FnFrameIntro!
    recall: FnFrameRecall!
    place: FnFramePlace!
    texture: FnFrameTexture!
    name: FnFrameName!
    payoff: FnFramePayoff!
  }

  type FnLoopCopy {
    breathePrompt: String!
    "Null once the scaffold has faded (P7) — the app simply stops saying it."
    breatheHint: String
    breatheSkip: String!
    "Where it sits. Already faded to its terse form when the fade level calls for it."
    placePrompt: String!
    "Null once the scaffold has faded."
    placeHelper: String
    "Carries the chosen place onto the texture step, via a {{place}} placeholder."
    textureCarry: String!
    texturePrompt: String!
    "Null once the scaffold has faded."
    textureHelper: String
    nameCarry: String!
    namePrompt: String!
    nameOther: String!
    nameOwnPlaceholder: String!
    needCarry: String!
    needPrompt: String!
    needSkip: String!
    smallStepPrompt: String!
    smallStepPlaceholder: String!
    smallStepSkip: String!
    done: String!
    addAnother: String!
    addAnotherAsk: String!
    addAnotherCapped: String!
    finish: String!
    recapHeading: String!
    recapLead: String!
    recapNotRelated: String!
    repeatLead: String!
    repeatPrompt: String!
  }

  type FnGraduation {
    line: String!
    body: String!
    close: String!
  }

  "Which palette words to put on screen now. The pool is wide; the screen is small."
  type FnDisplaySelection {
    locationIds: [String!]!
    textureIds: [String!]!
    feelingIds: [String!]!
    needIds: [String!]!
  }

  type FeelingsNeedsContent {
    contentVersion: String!
    locale: String!
    reviewStatus: String!
    "The full authored pools — the client resolves stored ids to labels from these."
    locations: [FnPaletteEntry!]!
    textures: [FnPaletteEntry!]!
    feelings: [FnPaletteEntry!]!
    needs: [FnPaletteEntry!]!
    display: FnDisplaySelection!
    frame: FnFrame!
    loop: FnLoopCopy!
    graduation: FnGraduation!
    "Soft cap on passes per sitting, so the UI retires 'add another' rather than failing on it."
    repeatSoftCap: Int!
    breathSkippable: Boolean!
  }

  # One pass of the loop. Passes within a sitting are parallel and are never
  # cross-referenced — relating them is storytelling (tier 4), deliberately
  # deferred, so there is no field here that points at another pass.
  type FnLoopEntry {
    id: ID!
    passIndex: Int!
    "Where in the body. The hard_to_place value is a real answer, not a missing one."
    bodyLocation: String
    bodyTexture: String
    feelingWord: String
    "palette | own — 'own' is the 'other → type it' escape."
    feelingSource: String
    need: String
    needSource: String
    smallAction: String
    distinctionCaught: Boolean!
  }

  type FnLoopSitting {
    id: ID!
    breathTaken: Boolean!
    wasPrompted: Boolean!
    completedAt: String
    createdAt: String!
    entries: [FnLoopEntry!]!
  }

  """
  A distinction catch (P5), composed server-side when the person names a
  faux-feeling. Offered on their own material, in the moment they produce it —
  that timing is the mechanism. Everything here is an offer: the hints are
  phrased as questions, and dismiss is how the person keeps their own word.
  """
  type FnCatch {
    conceptId: String!
    "The gentle line, with the person's own word already substituted in."
    line: String!
    "Candidate feelings underneath, as questions. Never assertions."
    feelingHints: [String!]!
    "Candidate needs underneath, as questions."
    needHints: [String!]!
    feelingHintsLabel: String!
    needHintsLabel: String!
    "How to wave it off. A catch you cannot decline is a quiz."
    dismiss: String!
    note: String!
  }

  """
  The result of committing one step. Carries a catch only when naming a feeling
  actually triggered one, which is rare by design — the touches are distributed,
  and none fire until the loop is established.
  """
  type FnLoopResult {
    sitting: FnLoopSitting!
    catch: FnCatch
  }

  """
  Closing a sitting, plus the one-time capability moment when it is due. A door,
  not a score: it is offered once, carries no number, and cannot be lost again.
  """
  type FnFinishResult {
    sitting: FnLoopSitting!
    graduation: FnGraduation
  }

  # ── Impact · Noticing (Act 1) ────────────────────────────────────────────
  # Spec: ecosystem/working/impact-build/01-noticing-spec.md.
  # Build plan: ecosystem/working/impact-build/04-build-plan.md §7.
  #
  # A Tracker-namespaced tool, same staging arrangement as Feelings & Needs
  # (Learn Module 1, above) but sharing no code with it — Noticing authors its
  # own needs palette (build plan §4). Phase 3 lands the spine: the content
  # pack, the active-sitting query, and the loop mutations. Phase 4 adds the
  # day-one frame's own progress query and mutations (NtcFrame,
  # updateNoticingFrame, completeNoticingFrame) — the frame does not gate the
  # loop and the loop does not gate the frame; see NoticingState.frameDone.
  # Phase 5 adds the catch payload (NtcCatch, on NtcEntryResult.catch) — the
  # three lexicons themselves never reach this schema at all, only the one
  # composed line a match actually produces. The graduation door (phase 7)
  # is still deliberately absent from NtcFinishResult, landing later as an
  # additive field, which is why that result type exists already rather than
  # the mutation returning NtcSitting directly.
  """
  The tool home's state: enough to route into the frame or the loop, no more.
  Deliberately has no sitting count and no field named count, streak, total or
  tally — the fences suite (build plan §9.4) holds this SDL block to that.
  """
  type NoticingState {
    contentVersion: String!
    "The locale of the practice content — see FeelingsNeedsState.locale for the same distinction."
    locale: String!
    "draft | reviewed — a draft locale is a known state, surfaced not hidden."
    reviewStatus: String!
    "Whether the day-one frame has been done. Does NOT gate the loop (spec §4.1, build plan §5)."
    frameDone: Boolean!
    "The one-time capability moment has been shown. A door, not a score."
    graduationSurfaced: Boolean!
    "How far the app has withdrawn its prompts (build plan §6). Derived, capped, never shown."
    promptFadeLevel: Int!
  }

  "One place, one cue, or one need — the label the person sees. Ids are stable; labels can be edited freely."
  type NtcPaletteEntry {
    id: String!
    label: String!
  }

  type NtcFrameIntro {
    title: String!
    body: String!
    begin: String!
  }

  type NtcFrameMoment {
    prompt: String!
    helper: String
    "Offered beside the prompt, not after a failed attempt — the reroute is a first-class path, not a fallback."
    reroutePrompt: String!
    rerouteLabel: String!
    "Shown once the reroute is taken. A different question, not prompt reworded — it asks about a wish, not a memory."
    wishedPrompt: String!
  }

  type NtcFrameUnsaidNeed {
    prompt: String!
    helper: String
    otherLabel: String!
  }

  type NtcFrameVisibleCues {
    prompt: String!
    helper: String
    otherLabel: String!
  }

  """
  No question — the juxtaposition itself, reporting what the person just
  wrote rather than asserting a lesson. wishedLine is the mandatory variant
  for the wishedInstead reroute: line's wording claims someone actually made
  the connection, which is true on the ordinary path and false by
  construction on the reroute path.
  """
  type NtcFrameTurn {
    line: String!
    wishedLine: String!
  }

  type NtcFrameReverse {
    prompt: String!
    knowLabel: String!
    noIdeaLabel: String!
    knowResponse: String!
    noIdeaResponse: String!
  }

  type NtcFrameBeatOne {
    moment: NtcFrameMoment!
    unsaidNeed: NtcFrameUnsaidNeed!
    visibleCues: NtcFrameVisibleCues!
    turn: NtcFrameTurn!
    reverse: NtcFrameReverse!
  }

  type NtcFrameOption {
    id: String!
    label: String!
  }

  """
  Keyed on the guess, not one line for everyone (phase-2 review correction):
  the research finding is that people underestimate, so a single line told
  whoever guessed "very" that they were wrong about the one thing they got
  right. "body" is the finding itself and holds regardless of the guess.
  """
  type NtcFrameCorrectionLines {
    notVery: String!
    somewhat: String!
    very: String!
  }

  type NtcFrameCorrection {
    lineByGuess: NtcFrameCorrectionLines!
    body: String!
  }

  type NtcFrameBeatTwo {
    prompt: String!
    options: [NtcFrameOption!]!
    correction: NtcFrameCorrection!
  }

  type NtcFrameCopy {
    intro: NtcFrameIntro!
    beatOne: NtcFrameBeatOne!
    beatTwo: NtcFrameBeatTwo!
  }

  """
  The day-one frame's own progress row (tier 1, once). Committed step by
  step, the same convention as NtcSitting — a null field is simply not
  answered yet, not a missing row. completedAt is set only at the very end of
  beat 2 by completeNoticingFrame; NoticingState.frameDone reads this
  timestamp, not row existence (a phase-1 bug, fixed in phase 2 — see
  notes/noticing-build-log.md). Null overall means the frame has never been
  started, which is why the query that returns this is nullable.
  """
  type NtcFrame {
    moment: String
    unsaidNeed: String
    "JSON string: cue chip ids plus any free text."
    visibleCues: String
    "Took the a-time-you-wished-someone-had reroute at step 1. A path, not a failure flag."
    wishedInstead: Boolean!
    welcomeGuess: String
    completedAt: String
  }

  """
  The loop's step prompts, already resolved to the person's current fade
  level (build plan §6) — there is no separate "terse" field to choose
  between, because the server has already chosen. Withdrawing the scaffold
  is the mechanism; a client that saw both forms and picked one would be a
  second, silent copy of the dial.
  """
  type NtcLoopCopy {
    placePrompt: String!
    placeOtherLabel: String!
    personPrompt: String!
    "Persistent, under the person field — not a modal, not dismissible-forever."
    personThirdPartyWarning: String!
    observationPrompt: String!
    needPrompt: String!
    needOtherLabel: String!
    needNotSure: String!
    smallThingPrompt: String!
    smallThingSkip: String!
    "Asked only when a small thing was written — the whole of the capacity accretion (phase 6)."
    capacityPrompt: String!
    capacityOtherLabel: String!
    "The one-line close: '✓ noticed', already formed."
    close: String!
    addAnotherAsk: String!
    "Shown once the soft cap is reached — closes warmly, never as a rule."
    addAnotherCapped: String!
    finish: String!
    recapHeading: String!
    recapNotRelated: String!
  }

  "Head / hands / heart — accreted from what the person HAD, never who they helped (phase 6)."
  type NtcCapacityCopy {
    prompt: String!
    headChips: [NtcPaletteEntry!]!
    handsChips: [NtcPaletteEntry!]!
    heartChips: [NtcPaletteEntry!]!
    otherLabel: String!
  }

  "A door, not an award. No count anywhere in this type or what it carries."
  type NtcGraduationCopy {
    line: String!
    body: String!
    close: String!
  }

  "Which of the needs pool to show now. Places and cues are shown whole; the needs pool (20) is wider than the screen (6)."
  type NtcDisplaySelection {
    needIds: [String!]!
  }

  """
  The authored content pack, already localized and fade-resolved. Note what
  is absent: no lexicon field of any kind — the three catch lexicons never
  reach a browser (build plan §9.4's public-content fence).
  """
  type NoticingContent {
    contentVersion: String!
    locale: String!
    reviewStatus: String!
    places: [NtcPaletteEntry!]!
    cues: [NtcPaletteEntry!]!
    needs: [NtcPaletteEntry!]!
    display: NtcDisplaySelection!
    capacity: NtcCapacityCopy!
    frame: NtcFrameCopy!
    loop: NtcLoopCopy!
    graduation: NtcGraduationCopy!
    thirdPartyWarning: String!
    "So the UI can retire the repeat prompt rather than fail on it."
    repeatSoftCap: Int!
  }

  """
  One pass. Passes within a sitting are parallel and are never
  cross-referenced — there is no field here that points at another pass, and
  none ever will (spec §4.2).
  """
  type NtcEntry {
    id: ID!
    passIndex: Int!
    place: String
    "Free text, deliberately un-indexed server-side — see the schema comment on NoticingEntry.person."
    person: String
    observation: String
    "Palette id or free text. Null is 'not sure' — a complete pass, not a missing answer."
    need: String
    smallThing: String
    "JSON string, head/hands/heart. Set only once a small thing exists (phase 6)."
    capacityTags: String
    "The Reflect handoff answer (phase 6). Nothing is computed from it."
    motiveNote: String
  }

  type NtcSitting {
    id: ID!
    completedAt: String
    createdAt: String!
    entries: [NtcEntry!]!
  }

  """
  A catch that just fired (N6, tier 3), composed server-side — the three
  lexicons never ship to a browser (see NoticingContent's own note). hints
  is empty for read and protective, which never offer one; protective's
  routeTo carries the Reflect handoff (unbuilt — a link-out stub for now,
  build plan §8).
  """
  type NtcCatch {
    type: String!
    line: String!
    hints: [String!]!
    dismiss: String!
    note: String!
    routeTo: String
  }

  "The result of committing one step. catch is null far more often than not — that's the point (build plan §5 phase 5)."
  type NtcEntryResult {
    sitting: NtcSitting!
    catch: NtcCatch
  }

  "Closing a sitting. graduation arrives in phase 7 as an additive field."
  type NtcFinishResult {
    sitting: NtcSitting!
  }

  """
  One skill's line on the AI Training Lab hub. Progress only — no headline
  metric appears here, because the six labs' metrics are on six different
  scales and a hub that compared them would be inventing a ranking
  (07-training-lab-hub.md §5a).
  """
  type SkillOverview {
    skillKey: SkillKey!
    moduleCount: Int!
    "Mastered or tested out, and not currently due for review."
    masteredCount: Int!
    "Started but not finished, plus anything a review has brought back."
    inProgressCount: Int!
    "Every attempt row, practice included: a has-this-been-touched signal, not the scored count each lab's own progress screen reports."
    totalAttempts: Int!
    lastAttemptAt: String
    hasBaseline: Boolean!
    assessmentSkipped: Boolean!
    "False when the pack's probe items are not human-verified. The hub's probe recommendation requires it, because dueSkillProbes does not check it and the lab page would refuse to start one."
    probeReady: Boolean!
    "draft = machine-drafted, awaiting native review. Surfaced per card, never as six stacked banners."
    reviewStatus: String!
    "Derived, never stored: nextReviewAt <= now. Empty when nothing is due."
    dueModules: [SkillOverviewModule!]!
    "post or delayed, by the same rule dueSkillProbes applies. Never baseline — that is the lab page's own offer."
    dueProbe: SkillTimepoint
  }

  type SkillOverviewModule {
    moduleKey: String!
    title: String!
  }

  type Query {
    actions: [Action!]!
    action(id: ID!): Action
    projects: [Project!]!
    project(id: ID!): Project
    goals(parentGoalId: ID, parentMilestoneId: ID, includeAll: Boolean): [Goal!]!
    goal(id: ID!): Goal
    intervals: [Interval!]!
    interval(id: ID!): Interval
    routines: [Routine!]!
    routine(id: ID!): Routine
    linkedActions(date: String!): [Action!]!
    standaloneActions(date: String!): [Action!]!
    dayState(date: String!): DayState
    "All actions for a day (linked + standalone + gathered for that date). Gathered for future dates are hidden."
    todayActions(date: String!): [Action!]!
    "Pre-day status: whether after-day is required for yesterday, and actions needing start time + overlap info."
    preDayStatus(date: String!): PreDayStatus!
    "Not-done actions for date, grouped for After-day wizard (non-linked gathered, linked gathered, standalone)."
    notDoneActionsForDate(date: String!): NotDoneActionsForDate!
    me: User
    notes(entityType: String!, entityId: ID!): [Note!]!
    onboardingProgress: OnboardingProgress
    moduleIntroViewed(moduleKey: String!): Boolean
    journals(includeArchived: Boolean): [Journal!]!
    journal(id: ID!): Journal
    journalEntries(journalId: ID!, includeArchived: Boolean, dateFrom: String, dateTo: String, search: String): [JournalEntry!]!
    "Personal access tokens for this account. The secrets themselves are never returned."
    apiTokens: [ApiToken!]!

    "Time Themes: the shared tag vocabulary, this user's."
    tags: [Tag!]!
    "Time Themes: every theme this user has defined, regardless of date."
    timeThemes: [TimeTheme!]!
    "Time Themes: a single theme by id, for the editor (mirrors interval(id)/project(id))."
    timeTheme(id: ID!): TimeTheme
    "Time Themes: active themes whose recurrence resolves an occurrence on dateKey (YYYY-MM-DD)."
    timeThemesForDate(dateKey: String!): [TimeTheme!]!

    "Evidence Lab: the six modules with this learner's state on each."
    skillModules(skillKey: SkillKey!): [SkillModule!]!
    "Evidence Lab: scores, behaviour metrics, and content-readiness for the progress surface."
    skillProgress(skillKey: SkillKey!): SkillProgress!
    "Modules whose spaced review has come due."
    skillDueReviews: [SkillModule!]!
    """
    AI Training Lab hub: every skill, always six entries, in canonical order.
    One round trip for the whole page — the per-lab queries would be twelve,
    and five of them are gated to Evidence.
    """
    skillsOverview: [SkillOverview!]!
    "Module sittings currently on the calendar, past and future."
    skillPlan(skillKey: SkillKey!): [SkillPlannedSession!]!

    "A single timepoint's probe, if it has been started. Null before the first startSkillProbe for it."
    skillProbe(skillKey: SkillKey!, timepoint: SkillTimepoint!): SkillProbeEntry
    """
    Probes ready to be started or resumed right now, across every skill tool:
    a post probe once all six modules are mastered/tested-out, or a delayed
    probe whose 7-day schedule has come due. Never a not-yet-due delayed probe
    — that stays invisible the same way an undue review does.
    """
    dueSkillProbes: [SkillProbeDue!]!
    "The learner's full attempt/probe history for one skill, as JSON and as a markdown summary."
    skillExport(skillKey: SkillKey!): SkillExportResult!

    "Clarity Lab: the six modules, each with the rubric criterion it trains."
    clarityModules: [ClarityModule!]!
    "Clarity Lab: per-criterion trend, revision deltas, and what is scoreable in this install."
    clarityProgress: ClarityProgress!

    "Decomposition Lab: the six modules, each with the rubric criterion it trains."
    decompositionModules: [DecompositionModule!]!
    "Decomposition Lab: per-criterion trend, breadth-first index trend, granularity discrimination."
    decompositionProgress: DecompositionProgress!

    "Verification Lab: the six modules, each with its current rung."
    verificationModules: [VerificationModule!]!
    "Verification Lab: per-criterion trend, strict composite, ritual rate, discrimination, cost ratio."
    verificationProgress: VerificationProgress!

    "Delegation Lab: the six modules with this learner's state on each. No rung — this tool has none."
    delegationModules: [DelegationModule!]!
    "Delegation Lab: reliance discrimination, over/under reliance (never summed), net gain, anchoring, self-assessment calibration."
    delegationProgress: DelegationProgress!

    "Monitoring Lab: the six modules with this learner's state on each. No rung — this tool has none."
    monitoringModules: [MonitoringModule!]!
    "Monitoring Lab: resolution beside performance, bias, post-AI inflation (gated), influence discrimination."
    monitoringProgress: MonitoringProgress!

    "Feelings & Needs: the tool home's state — enough to route into the frame or the loop."
    feelingsNeedsState: FeelingsNeedsState!
    "Feelings & Needs: the authored content pack plus the palette selection to show now."
    feelingsNeedsContent: FeelingsNeedsContent!
    "Today's still-open sitting, if there is one. Null means start fresh."
    activeLoopSitting: FnLoopSitting
    """
    Finished sittings, newest first — the person's own record of their own
    material. A record and nothing more: no totals, no gaps marked, and no
    pattern-recognition across entries, which plan §2 puts out of scope. Days
    are grouped client-side because a day is a local-timezone concept.
    """
    loopHistory(limit: Int): [FnLoopSitting!]!

    "Noticing: the tool home's state — enough to route into the frame or the loop."
    noticingState: NoticingState!

    "Noticing: the authored content pack, localized and fade-resolved."
    noticingContent: NoticingContent!

    "Noticing: today's still-open sitting, if there is one. Null means start fresh."
    activeNoticingSitting: NtcSitting

    "Noticing: the day-one frame's own progress, for resuming mid-frame. Null means it has never been started."
    noticingFrame: NtcFrame
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type RunActionGatheringResult {
    dateKeysProcessed: [String!]!
    actionsCreated: Int!
  }

  enum ApiTokenScope {
    "Queries only."
    read
    "Queries and mutations."
    write
  }

  type ApiToken {
    id: ID!
    name: String!
    "Leading characters of the token, so a listed token can be told apart from the others."
    prefix: String!
    scope: ApiTokenScope!
    lastUsedAt: String
    expiresAt: String
    revokedAt: String
    createdAt: String!
  }

  type CreatedApiToken {
    apiToken: ApiToken!
    "The full token. Returned once, at creation, and never retrievable again."
    token: String!
  }

  type Mutation {
    addAction(title: String!, tbd: String, projectId: String, priority: Priority, estimatedTimeMinutes: Int, startTimeOfDay: String): Action!
    updateAction(id: ID!, title: String, tbd: String, done: Boolean, priority: Priority, estimatedTimeMinutes: Int, startTimeOfDay: String, actionFate: ActionFate, projectId: ID): Action!
    deleteAction(id: ID!): Action!

    addProject(
      title: String!
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
      priority: Priority
      actions: [ActionInput!]
    ): Project!
    updateProject(
      id: ID!
      title: String
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
      priority: Priority
    ): Project!
    deleteProject(id: ID!): Project!

    addGoal(title: String!, dod: String, isGoalGroup: Boolean, parentGoalId: ID, parentMilestoneId: ID, dodClarityStatus: String, dodFlaggedDimensions: [String!]): Goal!
    updateGoal(id: ID!, title: String, dod: String, isGoalGroup: Boolean, startDate: String, endDate: String, parentGoalId: ID, parentMilestoneId: ID, dodClarityStatus: String, dodFlaggedDimensions: [String!]): Goal!
    "Save DoD clarity check results for a goal. Accepts the (possibly edited) dod alongside clarity data."
    saveDodClarity(id: ID!, dod: String, dodClarityStatus: String!, dodFlaggedDimensions: [String!]!): Goal!
    deleteGoal(id: ID!): Goal!

    addMilestone(goalId: ID!, title: String!, doa: String, predictionDate: String, isLast: Boolean): Milestone!
    updateMilestone(id: ID!, title: String, doa: String, predictionDate: String, order: Int, isLast: Boolean, goalId: ID): Milestone!
    deleteMilestone(id: ID!): Milestone!

    addInterval(
      title: String!
      estimatedTimeMinutes: Int!
      status: IntervalStatus
      endTime: String
      repeatValue: Int
      repeatUnit: RepeatUnit
      customRepeatDates: [String!]
      customRepeatRule: String
      predictedToDoTime: String
      steps: [IntervalStepInput!]
      goalId: ID
      milestoneId: ID
      projectId: ID
    ): Interval!
    updateInterval(
      id: ID!
      title: String
      estimatedTimeMinutes: Int
      status: IntervalStatus
      endTime: String
      repeatValue: Int
      repeatUnit: RepeatUnit
      customRepeatDates: [String!]
      customRepeatRule: String
      predictedToDoTime: String
      steps: [IntervalStepInput!]
      goalId: ID
      milestoneId: ID
      projectId: ID
    ): Interval!
    deleteInterval(id: ID!): Interval!

    addRoutine(
      title: String!
      estimatedTimeMinutes: Int!
      status: IntervalStatus
      endTime: String
      timeOfDayBlocks: [String!]
      timerDurationMinutes: Int
      steps: [RoutineStepInput!]
    ): Routine!
    updateRoutine(
      id: ID!
      title: String
      estimatedTimeMinutes: Int
      status: IntervalStatus
      endTime: String
      timeOfDayBlocks: [String!]
      timerDurationMinutes: Int
      steps: [RoutineStepInput!]
    ): Routine!
    deleteRoutine(id: ID!): Routine!

    toggleAction(id: ID!): Action!

    "Run action gathering for today, today+1, today+2 (skips dates already gathered). todayDate = local date YYYY-MM-DD."
    runActionGathering(todayDate: String!): RunActionGatheringResult!

    "Set action start time (Pre-day wizard)."
    setActionStartTime(id: ID!, startTimeOfDay: String!): Action!
    "Postpone action to a new date (After-day wizard)."
    postponeAction(id: ID!, newDate: String!): Action!
    "Outsource: create two actions (do outsourcing, ensure done) and mark original WOO."
    outsourceAction(id: ID!, doOutsourcingTitle: String!, doOutsourcingDate: String!, ensureDoneTitle: String!, ensureDoneDate: String!): Action!
    "Mark action as not important → Backlog (After-day, linked)."
    setActionNotImportant(id: ID!): Action!
    "Mark action as ignore → Bucket list (After-day, standalone)."
    setActionIgnore(id: ID!): Action!
    "Mark non-linked gathered action as passed/archived (After-day, auto or bulk)."
    setActionPassedArchived(id: ID!): Action!
    "Mark after-day as completed for date (sets afterDayCompletedAt)."
    completeAfterDay(date: String!): DayState!
    "Mark pre-day as completed for date (sets preDayCompletedAt); Today becomes accessible."
    completePreDay(date: String!): DayState!

    markSlideViewed(slideIndex: Int!): OnboardingProgress!
    markModuleIntroViewed(moduleKey: String!): Boolean!

    addNote(entityType: String!, entityId: ID!, body: String!): Note!
    updateNote(id: ID!, body: String!): Note!
    deleteNote(id: ID!): Note!

    createJournal(title: String!, description: String, linkedGoalId: ID, linkedProjectId: ID): Journal!
    updateJournal(id: ID!, title: String, description: String, linkedGoalId: ID, linkedProjectId: ID): Journal!
    archiveJournal(id: ID!): Journal!
    deleteJournal(id: ID!): Journal!
    addJournalAccess(journalId: ID!, email: String!): Journal!
    removeJournalAccess(journalId: ID!, email: String!): Journal!
    setDefaultJournal(journalId: ID!): Journal!
    createEntry(journalId: ID!, body: String!): JournalEntry!
    updateEntry(id: ID!, body: String!, overrideTimestamp: Boolean): JournalEntry!
    archiveEntry(id: ID!): JournalEntry!
    addQuickEntry(body: String!, journalId: ID): JournalEntry!
    updateDiscoverability(discoverableByEmail: Boolean!): Boolean!

    "Issue a personal access token. Only a signed-in session may do this — a request authenticated by a token cannot mint another."
    createApiToken(name: String!, scope: ApiTokenScope!, expiresInDays: Int): CreatedApiToken!
    "Revoke a token immediately. Also session-only."
    revokeApiToken(id: ID!): ApiToken!

    """
    Open an attempt and serve the next item. The attempt row is created *now*,
    not at submission, so check events can be timestamped by the server —
    the ordering of check-versus-verdict is the measurement and must not be a
    number the client asserts afterwards. Returns null when the pool is spent.
    """
    startSkillItem(skillKey: SkillKey!, mode: SkillMode!, moduleKey: String, probeId: ID): SkillServedItem

    "Record a check event against an open attempt. Offsets are measured server-side."
    logSkillCheckEvent(attemptId: ID!, kind: String!, payload: String): Boolean!

    "Commit a verdict and score the attempt. Only here is the key revealed."
    submitSkillAttempt(
      attemptId: ID!
      verdict: SkillVerdict!
      confidence: Int!
      faultTag: SkillFaultTag!
      sources: [SkillSourceInput!]
      timeZoneOffsetMinutes: Int
    ): SkillAttemptResult!

    "Skip the baseline. Allowed — but then later scores are comparable to nothing, and the progress surface says so."
    skipSkillAssessment(skillKey: SkillKey!): Boolean!

    """
    Clarity Lab: open an attempt and serve the next item. Elicitation items are
    withheld when no reader is configured — they cannot be completed without
    one, and serving an item that dead-ends at the reveal is worse than serving
    fewer. Returns null when the pool is spent.
    """
    startClarityItem(mode: SkillMode!, moduleKey: String, probeId: ID): ClarityServedItem

    """
    Commit what the learner expects the reader to produce, before seeing it.
    Elicitation only, and not editable afterwards — a prediction you can revise
    once you have the answer measures nothing.
    """
    lockClarityPrediction(attemptId: ID!, prediction: String!): Boolean!

    """
    Commit which criteria the learner believes failed, before any score is
    shown. Required on revision and elicitation items: submitting without it is
    rejected, because a diagnosis entered after the levels is a recollection.
    """
    lockClarityDiagnosis(attemptId: ID!, criteria: [String!]!): Boolean!

    "Score the artifact. Only here are the reveal and the levels returned."
    submitClarityAttempt(attemptId: ID!, text: String!, timeZoneOffsetMinutes: Int): ClarityAttemptResult!

    """
    Open a revision of a scored attempt. A new attempt row rather than an edit,
    so the draft survives and the delta compares two scored artifacts. Revisions
    never count toward mastery — the learner has just been told what failed.
    """
    startClarityRevision(attemptId: ID!): ClarityServedItem!

    """
    Decomposition Lab: open an attempt and serve the next item. Every item
    type completes with no credential configured — unlike Clarity's
    elicitation items, nothing here is withheld for running offline. Returns
    null when the pool is spent.
    """
    startDecompositionItem(mode: SkillMode!, moduleKey: String, probeId: ID): DecompositionServedItem

    """
    Commit the whole, before any piece exists. Rejected if a piece already
    does — D1 is unscoreable if pieces can precede it, and that order is what
    D1 measures, so it is server-stamped and cannot be reconstructed after
    the fact.
    """
    lockDecompositionWhole(attemptId: ID!, statement: String!, doneWhen: String!): Boolean!

    "Repair items only: name the fault before fixing it. Rejected on any other item type."
    lockDecompositionDiagnosis(attemptId: ID!, tags: [String!]!): Boolean!

    "Score the structure. Only here are the key-derived reveal and the levels returned."
    submitDecompositionAttempt(attemptId: ID!, structure: DecompositionStructureInput!, timeZoneOffsetMinutes: Int): DecompositionAttemptResult!

    """
    Open a revision of a scored attempt. A new attempt row rather than an
    edit, so the draft survives and the delta compares two scored artifacts.
    Revisions never count toward mastery.
    """
    startDecompositionRevision(attemptId: ID!): DecompositionServedItem!

    """
    Real-work practice: open an attempt against one of the learner's own
    Goals or Projects. mode: open_practice — never scored into mastery or
    probes.
    """
    startDecompositionRealWork(targetType: DecompositionRealWorkTargetType!, targetId: ID!): DecompositionRealWorkServedItem!

    "Score a real-work breakdown. D3, D5 and D6 are always null — there is no key for real material."
    submitDecompositionRealWork(attemptId: ID!, structure: DecompositionStructureInput!, timeZoneOffsetMinutes: Int): DecompositionRealWorkResult!

    """
    Write the selected pieces into Tracker as real Projects/Actions.
    Itemised, opt-in, reversible (ordinary rows the learner can delete like
    any other), and never automatic. Rejects a second call for the same
    attempt outright.
    """
    exportDecompositionBreakdown(attemptId: ID!, nodeIds: [String!]!): DecompositionExportResult!

    """
    Verification Lab: open an attempt and serve the next item. The rung
    comes from the module's current SkillModuleProgress, except in
    assessment mode where it is always unassisted regardless of the
    learner's practice rung. Returns null when the pool is spent.
    """
    startVerificationItem(mode: SkillMode!, moduleKey: String, probeId: ID): VerificationServedItem

    """
    Name the oracle before the bench opens. Rejected once any check has
    already been selected — the order is what V1 measures, so it is
    server-stamped rather than reconstructed afterwards.
    """
    nameVerificationOracle(attemptId: ID!, text: String!, predictedCostSeconds: Int): Boolean!

    """
    Spend one check and see its outcome — never the whole bench at once.
    Rejected before an oracle is named, on a repeat of an already-revealed
    check, or on the assisted rung if it would exceed the hard ceiling.
    """
    revealVerificationCheck(attemptId: ID!, checkId: String!): VerificationCheckOutcome!

    """
    Assisted rung only: fetch the labelled element list at the verdict step,
    right before commit. A dedicated call rather than shipping the list with
    the served item, so nothing holds it in memory during check selection —
    not merely unrendered, absent.
    """
    loadVerificationElements(attemptId: ID!): [VerificationLocalisationElement!]!

    """
    Commit verdict, confidence and residual risk. On the assisted rung,
    elementId arrives here and scoring runs immediately. On the unassisted
    rung, elementFreeText is required instead and the response withholds
    the score, returning the element list for setVerificationLocalization
    to score against — nothing is revealed before that call.
    """
    commitVerificationVerdict(
      attemptId: ID!
      verdict: VerificationVerdict!
      confidence: Int!
      residualRisk: String!
      elementId: String
      elementFreeText: String
      timeZoneOffsetMinutes: Int
    ): VerificationCommitResult!

    "Unassisted rung only: the pick that is actually scored, after the free-text commit."
    setVerificationLocalization(attemptId: ID!, elementId: String!, timeZoneOffsetMinutes: Int): VerificationSubmitResult!

    """
    The only way a module's rung changes. Always a learner action — a
    promotion is offered, never forced, and there is no automatic demotion.
    """
    setVerificationRung(moduleKey: String!, rung: VerificationRung!): VerificationRung!

    """
    Real-work verification: open a record against a real AI claim.
    mode: open_practice — never scored into mastery or probes.
    """
    startVerificationRealWork(claim: String!): VerificationRealWorkServedItem!

    """
    Complete the record with the oracle used, what was found outside the
    app, the verdict and residual risk. Nothing is written into Tracker by
    this call — save the returned record yourself via addQuickEntry or
    addNote.
    """
    submitVerificationRealWork(
      attemptId: ID!
      oracle: String!
      result: String!
      verdict: VerificationVerdict!
      confidence: Int!
      residualRisk: String!
    ): VerificationRealWorkResult!

    """
    Delegation Lab: open an attempt and serve the next item. No rung — every
    item practises the same way regardless of module. Returns null when the
    pool is spent.
    """
    startDelegationItem(mode: SkillMode!, moduleKey: String, probeId: ID): DelegationServedItem

    """
    Commit the initial estimate and confidence together, server-stamped, and
    receive the advice in return — the one call where it first exists on the
    client. Rejected if this attempt already has one, or if the item is a
    split or sequence kind that doesn't take a plain estimate.
    """
    commitDelegationEstimate(attemptId: ID!, value: Float!, confidence: Int!): DelegationAdvice!

    """
    Commit the revised estimate. The initial value is not sent back — the
    client already has it, and this call never needs to reveal it again.
    Scores immediately except on a cue item, which returns "needsCue" and
    waits for selectDelegationCue. recoverabilityMove only matters on a
    stakes item's high-stakes half; harmless elsewhere.
    """
    commitDelegationRevision(
      attemptId: ID!
      value: Float!
      recoverabilityMove: Boolean
      timeZoneOffsetMinutes: Int
    ): DelegationCueChoice!

    "cue items only: which cue the learner used, after the revision. Scores the attempt."
    selectDelegationCue(attemptId: ID!, cueId: String!, timeZoneOffsetMinutes: Int): DelegationSubmitResult!

    "split items only: which piece to hand over and which to keep. Scores the attempt — no estimate step precedes this."
    commitDelegationSplit(
      attemptId: ID!
      dispositions: [DelegationDispositionInput!]!
      timeZoneOffsetMinutes: Int
    ): DelegationSubmitResult!

    """
    g6-drift only: one round of the sequence. phase "estimate" returns that
    round's advice; phase "revision" scores the whole sequence once round
    G6_ROUNDS-1 lands, and otherwise just records the round.
    """
    commitSequenceRound(
      attemptId: ID!
      roundIndex: Int!
      value: Float!
      phase: String!
      confidence: Int
      timeZoneOffsetMinutes: Int
    ): DelegationSequenceRoundResult!

    """
    Real-work delegation: log a real decision before making it — what you're
    handing over, what you're keeping, what would tell you the split was
    wrong. mode: open_practice — never scored into mastery or probes.
    """
    startDelegationRealWork(handingOver: String!, keeping: String!, wouldTellMeWrong: String!): DelegationRealWorkServedItem!

    """
    Complete the record with what actually happened. Nothing is written into
    Tracker by this call — save the returned record yourself via
    addQuickEntry or addNote.
    """
    submitDelegationRealWork(attemptId: ID!, whatActuallyHappened: String!): DelegationRealWorkResult!

    """
    Monitoring Lab: open an attempt and serve the next item. No rung — every
    item practises the same way regardless of module. Returns null when the
    pool is spent.
    """
    startMonitoringItem(mode: SkillMode!, moduleKey: String, probeId: ID): MonitoringServedItem

    "recall, and the unassisted half of a pair: commit the prediction before the answer field exists anywhere in the payload."
    commitMonitoringPrediction(attemptId: ID!, level: String!): MonitoringOk!

    """
    Score against the authored key. On the unassisted half of a pair, this
    does not finalize the attempt yet — the pair's unit is
    (prediction, outcome, rating) together, so it waits for
    commitMonitoringRating.
    """
    submitMonitoringAnswer(attemptId: ID!, text: String!, timeZoneOffsetMinutes: Int): MonitoringAnswerResult!

    """
    phase "before" | "after". On a pair item, always phase "after" (a half
    never rates twice) and scores immediately. On an explain item, "before"
    must precede commitMonitoringExplanation and "after" must follow it
    (and must land before selectMonitoringSteps — D-45); neither phase
    scores the attempt by itself.
    """
    commitMonitoringRating(attemptId: ID!, phase: String!, value: Int!, timeZoneOffsetMinutes: Int): MonitoringRatingResult!

    "explain items only: free-text explanation, returns the causal step list. Requires a 'before' rating first."
    commitMonitoringExplanation(attemptId: ID!, text: String!): MonitoringExplanationResult!

    "explain items only: which authored causal steps the explanation covered. Scores the attempt. Requires an 'after' rating first (D-45)."
    selectMonitoringSteps(attemptId: ID!, stepIds: [String!]!, timeZoneOffsetMinutes: Int): MonitoringSubmitResult!

    "transcript items only: which turns moved the learner, and what each one moved. Scores the attempt."
    markMonitoringInfluence(attemptId: ID!, marks: [MonitoringInfluenceMarkInput!]!, timeZoneOffsetMinutes: Int): MonitoringSubmitResult!

    "longset items only: mark one checkpoint reviewed or skipped. Instruments check-rate decay; never scored itself."
    markMonitoringCheckpoint(attemptId: ID!, checkpointId: String!, checked: Boolean!): MonitoringOk!

    "longset items only: which countermeasure the learner would use next time. Scores the attempt."
    selectMonitoringCountermeasure(attemptId: ID!, optionId: String!, timeZoneOffsetMinutes: Int): MonitoringSubmitResult!

    """
    Session self-audit: open an attempt for reviewing one of the learner's own
    real AI conversations. mode: open_practice — never scored.
    """
    startMonitoringSelfAudit: MonitoringSelfAuditServedItem!

    "Complete the self-audit with a short note on each of the four influence types."
    submitMonitoringSelfAudit(attemptId: ID!, answers: MonitoringSelfAuditAnswersInput!): MonitoringSelfAuditResult!

    """
    Write module sittings into the calendar. Re-runnable: it replaces the future
    plan rather than stacking a second one on top. Defaults to two sittings per
    module, because mastery requires attempts on two distinct calendar days and a
    one-sitting plan would look complete while going nowhere.
    """
    planSkillSchedule(
      skillKey: SkillKey!
      startDate: String!
      sessionsPerWeek: Int
      timeOfDay: String
      sessionsPerModule: Int
    ): SkillPlanResult!

    "Remove future planned sittings and stop generating them. Completed ones stay."
    clearSkillSchedule(skillKey: SkillKey!): Int!

    """
    Open (or resume) a probe for one timepoint. The delayed timepoint cannot be
    started directly — it is scheduled automatically when the post probe
    completes, and this rejects with a sequence error until then.
    """
    startSkillProbe(skillKey: SkillKey!, timepoint: SkillTimepoint!): SkillProbeStart!

    """
    Close out a probe: stamps totals and the self-report, and — for post
    only — schedules the delayed probe 7 days out. Rejects a second
    completion, and rejects completing before every one of the form's items
    has been answered. selfReport is exactly 4 values, 0-100, collected and
    never scored.
    """
    completeSkillProbe(skillKey: SkillKey!, timepoint: SkillTimepoint!, selfReport: [Int!]!): SkillProbeCompleteResult!

    # ── Feelings & Needs: the daily loop ──────────────────────────────────────
    # The wizard commits every step as it goes (convention #8); there is
    # deliberately no "submit the loop" mutation. Partial state is valid state,
    # which is what makes a sitting resumable.

    """
    Record the Day-1 frame as done. Idempotent — the frame happens once, and a
    double submit is a double-click, not a second frame. Completing it is what
    opens the daily loop.
    """
    completeFeelingsNeedsFrame: FeelingsNeedsState!

    """
    Open a sitting and its first pass. Returns the still-open sitting instead if
    one exists, so a reload cannot split one practice across two rows.
    wasPrompted records whether the app cued this — input to prompt-fade
    inference (P7), never a metric.
    """
    startLoopSitting(wasPrompted: Boolean): FnLoopSitting!

    "Mark the settling breath taken. No duration, and no way to fail it."
    setLoopBreath(sittingId: ID!): FnLoopSitting!

    """
    Commit one step of one pass. Every field is optional; omitted fields are
    left alone. Naming a feeling may surface a distinction catch alongside the
    updated sitting — see FnLoopResult.
    """
    updateLoopEntry(
      entryId: ID!
      bodyLocation: String
      bodyTexture: String
      feelingWord: String
      feelingSource: String
      need: String
      needSource: String
      smallAction: String
    ): FnLoopResult!

    """
    Add a pass for another distinct feeling. Refuses past the soft cap — the
    bound is what keeps a plural sitting from becoming an emotional inventory.
    """
    addLoopPass(sittingId: ID!): FnLoopSitting!

    """
    Close the sitting. Drops a trailing pass left completely blank, and returns
    the capability moment if this run is the one that earned it.
    """
    finishLoopSitting(sittingId: ID!): FnFinishResult!

    """
    Mark the capability moment seen. Explicit rather than marked on display, so
    closing the tab mid-moment does not silently spend the only time it is
    offered. Idempotent; nothing is incremented behind it.
    """
    acknowledgeGraduation: Boolean!

    # ── Impact · Noticing: the day-one frame ──────────────────────────────
    # Commits step by step, same convention as the loop below. completedAt is
    # written only by completeNoticingFrame, and only at the very end of beat
    # 2 — see NtcFrame's own docstring for why that separation is load-bearing.

    """
    Commit one step of the day-one frame. Creates the row on first call.
    Every argument is optional and independently settable, mirroring
    updateNoticingEntry — an omitted argument is left alone, and wishedInstead
    is only ever set true, never toggled back off.
    """
    updateNoticingFrame(moment: String, unsaidNeed: String, visibleCues: String,
                        wishedInstead: Boolean, welcomeGuess: String): NtcFrame!

    """
    Mark the day-one frame complete — the only mutation that sets
    completedAt. Idempotent: a double submit is a double-click, not a second
    frame. Returns NoticingState so the client can route onward with
    frameDone already true.
    """
    completeNoticingFrame: NoticingState!

    # ── Impact · Noticing: the loop ───────────────────────────────────────
    # The wizard commits every step as it goes; there is deliberately no
    # "submit the loop" mutation. Partial state is valid state — see
    # services/noticing/session.ts's docblock. Not gated on the day-one
    # frame — see NoticingState.frameDone's note.

    """
    Open a sitting and its first pass. Returns the still-open sitting instead
    if one exists, so a reload cannot split one practice across two rows.
    wasPrompted records whether the app cued this — input to the fade-level
    inference (phase 7), never a metric.
    """
    startNoticingSitting(wasPrompted: Boolean): NtcSitting!

    """
    Commit one step of one pass. Every field is optional; an omitted field is
    left alone, and an explicit null clears it — which is how "not sure" is
    recorded for need: a complete pass, not a missing answer.
    """
    updateNoticingEntry(
      entryId: ID!
      place: String
      person: String
      observation: String
      need: String
      smallThing: String
    ): NtcEntryResult!

    """
    Add a pass for another distinct person. Refuses past the soft cap — the
    bound is what keeps a plural sitting from becoming an inventory of
    people rather than a distributed noticing practice.
    """
    addNoticingPass(sittingId: ID!): NtcSitting!

    "Close the sitting. Drops a trailing pass left completely blank."
    finishNoticingSitting(sittingId: ID!): NtcFinishResult!

    "Time Themes: create a tag. Rejects a duplicate name for this user; color must be an allowed palette key."
    createTag(name: String!, color: String!): Tag!
    renameTag(id: ID!, name: String!): Tag!
    recolorTag(id: ID!, color: String!): Tag!
    "Drops the tag off every Project/Interval/Routine/Action/TimeTheme it was on. No cascade beyond that — tagged entities simply lose that tag."
    deleteTag(id: ID!): Boolean!
    setProjectTags(projectId: ID!, tagIds: [ID!]!): Project!
    setIntervalTags(intervalId: ID!, tagIds: [ID!]!): Interval!
    setRoutineTags(routineId: ID!, tagIds: [ID!]!): Routine!
    "Rejected when the action is gathered (sourceType != null) — its tags are locked to the source template."
    setActionTags(actionId: ID!, tagIds: [ID!]!): Action!

    createTimeTheme(input: TimeThemeInput!): TimeTheme!
    updateTimeTheme(id: ID!, input: TimeThemeInput!): TimeTheme!
    setTimeThemeStatus(id: ID!, status: IntervalStatus!): TimeTheme!
    deleteTimeTheme(id: ID!): Boolean!

    register(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;
