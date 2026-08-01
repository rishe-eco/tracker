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
    masteryUnmet: [String!]!
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

    register(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;
