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
    "What the requirement asks for."
    required: Int
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

    "Evidence Lab: the six modules with this learner's state on each."
    skillModules(skillKey: SkillKey!): [SkillModule!]!
    "Evidence Lab: scores, behaviour metrics, and content-readiness for the progress surface."
    skillProgress(skillKey: SkillKey!): SkillProgress!
    "Modules whose spaced review has come due."
    skillDueReviews: [SkillModule!]!
    "Module sittings currently on the calendar, past and future."
    skillPlan(skillKey: SkillKey!): [SkillPlannedSession!]!

    "Clarity Lab: the six modules, each with the rubric criterion it trains."
    clarityModules: [ClarityModule!]!
    "Clarity Lab: per-criterion trend, revision deltas, and what is scoreable in this install."
    clarityProgress: ClarityProgress!

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
    startSkillItem(skillKey: SkillKey!, mode: SkillMode!, moduleKey: String): SkillServedItem

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
    startClarityItem(mode: SkillMode!, moduleKey: String): ClarityServedItem

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

    register(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;
