export const GET_PROJECTS = `
  query GetProjects {
    projects {
      id
      title
      dod
      type
      priority
      startDate
      endDate
      actions {
        id
        title
        done
        tbd
        priority
      }
      goal {
        id
        title
      }
      milestone {
        id
        title
      }
    }
  }
`;

export const GET_PROJECT = `
  query GetProject($id: ID!) {
    project(id: $id) {
      id
      title
      dod
      type
      priority
      startDate
      endDate
      actions {
        id
        title
        done
        tbd
        priority
      }
      goal {
        id
        title
      }
      milestone {
        id
        title
      }
    }
  }
`;

export const UPDATE_PROJECT = `
  mutation UpdateProject($id: ID!, $title: String, $dod: String, $type: String, $goalId: ID, $milestoneId: ID, $priority: Priority) {
    updateProject(id: $id, title: $title, dod: $dod, type: $type, goalId: $goalId, milestoneId: $milestoneId, priority: $priority) {
      id
    }
  }
`;

export const ADD_PROJECT = `
  mutation AddProject($title: String!, $dod: String, $type: String, $goalId: ID, $milestoneId: ID, $priority: Priority, $actions: [ActionInput!]) {
    addProject(title: $title, dod: $dod, type: $type, goalId: $goalId, milestoneId: $milestoneId, priority: $priority, actions: $actions) {
      id
    }
  }
`;

export const ADD_GOAL_PROJECT = `
  mutation AddGoalProject($title: String!, $dod: String, $type: String, $goalId: ID!, $milestoneId: ID, $priority: Priority, $actions: [ActionInput!]) {
    addProject(title: $title, dod: $dod, type: $type, goalId: $goalId, milestoneId: $milestoneId, priority: $priority, actions: $actions) {
      id
    }
  }
`;


export const ADD_PROJECT_ACTION = `
  mutation AddAction($title: String!, $tbd: String, $projectId: String, $priority: Priority, $estimatedTimeMinutes: Int, $startTimeOfDay: String) {
    addAction(title: $title, tbd: $tbd, projectId: $projectId, priority: $priority, estimatedTimeMinutes: $estimatedTimeMinutes, startTimeOfDay: $startTimeOfDay) {
      id
    }
  }
`;

export const DELETE_ACTION = `
  mutation DeleteAction($id: ID!) {
    deleteAction(id: $id) {
      id
    }
  }
`;

export const UPDATE_ACTION = `
  mutation UpdateAction($id: ID!, $title: String, $tbd: String, $done: Boolean, $priority: Priority, $estimatedTimeMinutes: Int, $startTimeOfDay: String, $projectId: ID) {
    updateAction(id: $id, title: $title, tbd: $tbd, done: $done, priority: $priority, estimatedTimeMinutes: $estimatedTimeMinutes, startTimeOfDay: $startTimeOfDay, projectId: $projectId) {
      id
      title
      tbd
      done
      priority
      estimatedTimeMinutes
      startTimeOfDay
    }
  }
`;

export const ADD_ACTION = `
  mutation AddAction($title: String!, $tbd: String, $projectId: String, $priority: Priority, $estimatedTimeMinutes: Int, $startTimeOfDay: String) {
    addAction(title: $title, tbd: $tbd, projectId: $projectId, priority: $priority, estimatedTimeMinutes: $estimatedTimeMinutes, startTimeOfDay: $startTimeOfDay) {
      id
      title
      tbd
      done
      priority
      estimatedTimeMinutes
      startTimeOfDay
    }
  }
`;

export const TOGGLE_ACTION = `
mutation ToggleAction($id: ID!) {
  toggleAction(id: $id) {
    id
    done
  }
}
`

export const GET_ACTIONS = `
  query GetActions {
    actions {
      id
      title
      tbd
      done
      priority
      estimatedTimeMinutes
      startTimeOfDay
      createdAt
      project {
        id
        title
        goal { id title }
        milestone { id title }
      }
    }
  }
`;

export const GET_ACTION = `
  query GetAction($id: ID!) {
    action(id: $id) {
      id
      title
      tbd
      done
      estimatedTimeMinutes
      startTimeOfDay
      project {
        id
        title
        goal { id title }
        milestone { id title }
      }
    }
  }
`;

export const LOGIN_MUTATION = `
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      email
    }
  }
}
`;

export const REGISTER_MUTATION = `
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      token
      user {
        id
        email
      }
    }
  }
`;

export const ADD_GOAL = `
  mutation AddGoal($title: String!, $dod: String, $isGoalGroup: Boolean, $parentGoalId: ID, $parentMilestoneId: ID, $dodClarityStatus: String, $dodFlaggedDimensions: [String!]) {
    addGoal(title: $title, dod: $dod, isGoalGroup: $isGoalGroup, parentGoalId: $parentGoalId, parentMilestoneId: $parentMilestoneId, dodClarityStatus: $dodClarityStatus, dodFlaggedDimensions: $dodFlaggedDimensions) {
      id
    }
  }
`;

export const DELETE_GOAL = `
  mutation DeleteGoal($id: ID!) {
    deleteGoal(id: $id) {
      id
    }
  }
`;

export const GET_GOALS = `
  query GetGoals($parentGoalId: ID, $parentMilestoneId: ID) {
    goals(parentGoalId: $parentGoalId, parentMilestoneId: $parentMilestoneId) {
      id
      title
      dod
      isGoalGroup
      startDate
      endDate
      createdAt
      parentGoalId
      parentMilestoneId
      dodClarityStatus
      dodFlaggedDimensions
      milestones {
        id
        title
        doa
        predictionDate
        childGoals { id title isGoalGroup }
        projects {
          id
          title
          startDate
          endDate
          actions { done }
        }
      }
      childGoals { id title isGoalGroup }
      projects {
        id
        title
        startDate
        endDate
        actions { done }
      }
    }
  }
`;

export const GET_ALL_GOALS = `
  query GetAllGoals {
    goals(includeAll: true) {
      id
      title
      isGoalGroup
      milestones {
        id
        title
      }
    }
  }
`;

export const GET_GOAL = `
  query GetGoal($id: ID!) {
    goal(id: $id) {
      id
      title
      dod
      isGoalGroup
      startDate
      endDate
      createdAt
      parentGoalId
      parentMilestoneId
      dodClarityStatus
      dodFlaggedDimensions
      parentGoal { id title isGoalGroup }
      parentMilestone { id title goal { id title } }
      intervals {
        id
        title
        status
        endTime
        repeatValue
        repeatUnit
        customRepeatDates
        steps { id title order }
      }
      milestones {
        id
        title
        doa
        predictionDate
        order
        isLast
        childGoals { id title isGoalGroup }
        intervals {
          id
          title
          status
          endTime
          repeatValue
          repeatUnit
          customRepeatDates
          steps { id title order }
        }
        projects {
          id
          title
          startDate
          endDate
          actions {
            id
            title
            tbd
            done
          }
        }
      }
      childGoals { id title isGoalGroup }
      projects {
        id
        title
        startDate
        endDate
        actions {
          id
          title
          tbd
          done
        }
      }
    }
  }
`;

export const UPDATE_GOAL = `
  mutation UpdateGoal($id: ID!, $title: String, $dod: String, $isGoalGroup: Boolean, $startDate: String, $endDate: String, $parentGoalId: ID, $parentMilestoneId: ID) {
    updateGoal(id: $id, title: $title, dod: $dod, isGoalGroup: $isGoalGroup, startDate: $startDate, endDate: $endDate, parentGoalId: $parentGoalId, parentMilestoneId: $parentMilestoneId) {
      id
    }
  }
`;

export const ADD_MILESTONE = `
  mutation AddMilestone($goalId: ID!, $title: String!, $doa: String, $predictionDate: String, $isLast: Boolean) {
    addMilestone(goalId: $goalId, title: $title, doa: $doa, predictionDate: $predictionDate, isLast: $isLast) {
      id
      title
      doa
      predictionDate
      order
      isLast
    }
  }
`;

export const UPDATE_MILESTONE = `
  mutation UpdateMilestone($id: ID!, $title: String, $doa: String, $predictionDate: String, $order: Int, $isLast: Boolean, $goalId: ID) {
    updateMilestone(id: $id, title: $title, doa: $doa, predictionDate: $predictionDate, order: $order, isLast: $isLast, goalId: $goalId) {
      id
      title
      doa
      predictionDate
      order
      isLast
    }
  }
`;

export const DELETE_MILESTONE = `
  mutation DeleteMilestone($id: ID!) {
    deleteMilestone(id: $id) {
      id
    }
  }
`;

export const DELETE_PROJECT = `
mutation DeleteProject($id: ID!) {
  deleteProject(id: $id) { id }
}
`

export const GET_STANDALONE_ACTIONS = `
  query GetStandaloneActions($date: String!) {
    standaloneActions(date: $date) {
      id
      title
      tbd
      done
      priority
    }
  }
`;

export const GET_LINKED_ACTIONS = `
  query GetLinkedActions($date: String!) {
    linkedActions(date: $date) {
      id
      title
      tbd
      done
      priority
      project {
        id
        title
      }
    }
  }
`;

export const GET_INTERVALS = `
  query GetIntervals {
    intervals {
      id
      title
      status
      endTime
      repeatValue
      repeatUnit
      customRepeatDates
      customRepeatRule
      predictedToDoTime
      estimatedTimeMinutes
      createdAt
      steps {
        id
        title
        order
      }
      goal {
        id
        title
      }
      milestone {
        id
        title
      }
      project {
        id
        title
      }
    }
  }
`;

export const GET_INTERVAL = `
  query GetInterval($id: ID!) {
    interval(id: $id) {
      id
      title
      status
      endTime
      repeatValue
      repeatUnit
      customRepeatDates
      customRepeatRule
      predictedToDoTime
      estimatedTimeMinutes
      steps {
        id
        title
        order
      }
      goal { id title }
      milestone { id title }
      project { id title }
    }
  }
`;

export const ADD_INTERVAL = `
  mutation AddInterval(
    $title: String!
    $estimatedTimeMinutes: Int!
    $status: IntervalStatus
    $endTime: String
    $repeatValue: Int
    $repeatUnit: RepeatUnit
    $customRepeatDates: [String!]
    $customRepeatRule: String
    $predictedToDoTime: String
    $steps: [IntervalStepInput!]
    $goalId: ID
    $milestoneId: ID
    $projectId: ID
  ) {
    addInterval(
      title: $title
      estimatedTimeMinutes: $estimatedTimeMinutes
      status: $status
      endTime: $endTime
      repeatValue: $repeatValue
      repeatUnit: $repeatUnit
      customRepeatDates: $customRepeatDates
      customRepeatRule: $customRepeatRule
      predictedToDoTime: $predictedToDoTime
      steps: $steps
      goalId: $goalId
      milestoneId: $milestoneId
      projectId: $projectId
    ) {
      id
      title
      status
      endTime
      repeatValue
      repeatUnit
      customRepeatDates
      customRepeatRule
      steps { id title order }
    }
  }
`;

export const UPDATE_INTERVAL = `
  mutation UpdateInterval(
    $id: ID!
    $title: String
    $estimatedTimeMinutes: Int
    $status: IntervalStatus
    $endTime: String
    $repeatValue: Int
    $repeatUnit: RepeatUnit
    $customRepeatDates: [String!]
    $customRepeatRule: String
    $predictedToDoTime: String
    $steps: [IntervalStepInput!]
    $goalId: ID
    $milestoneId: ID
    $projectId: ID
  ) {
    updateInterval(
      id: $id
      title: $title
      estimatedTimeMinutes: $estimatedTimeMinutes
      status: $status
      endTime: $endTime
      repeatValue: $repeatValue
      repeatUnit: $repeatUnit
      customRepeatDates: $customRepeatDates
      customRepeatRule: $customRepeatRule
      predictedToDoTime: $predictedToDoTime
      steps: $steps
      goalId: $goalId
      milestoneId: $milestoneId
      projectId: $projectId
    ) {
      id
      title
      status
      endTime
      repeatValue
      repeatUnit
      customRepeatDates
      customRepeatRule
      steps { id title order }
    }
  }
`;

export const DELETE_INTERVAL = `
  mutation DeleteInterval($id: ID!) {
    deleteInterval(id: $id) {
      id
    }
  }
`;

export const GET_ROUTINES = `
  query GetRoutines {
    routines {
      id
      title
      status
      endTime
      timeOfDayBlocks
      timerDurationMinutes
      estimatedTimeMinutes
      steps {
        id
        title
        order
      }
    }
  }
`;

export const GET_ROUTINE = `
  query GetRoutine($id: ID!) {
    routine(id: $id) {
      id
      title
      status
      endTime
      timeOfDayBlocks
      timerDurationMinutes
      estimatedTimeMinutes
      steps {
        id
        title
        order
      }
    }
  }
`;

export const ADD_ROUTINE = `
  mutation AddRoutine(
    $title: String!
    $estimatedTimeMinutes: Int!
    $status: IntervalStatus
    $endTime: String
    $timeOfDayBlocks: [String!]
    $timerDurationMinutes: Int
    $steps: [RoutineStepInput!]
  ) {
    addRoutine(
      title: $title
      estimatedTimeMinutes: $estimatedTimeMinutes
      status: $status
      endTime: $endTime
      timeOfDayBlocks: $timeOfDayBlocks
      timerDurationMinutes: $timerDurationMinutes
      steps: $steps
    ) {
      id
      title
      status
      endTime
      timeOfDayBlocks
      timerDurationMinutes
      steps { id title order }
    }
  }
`;

export const UPDATE_ROUTINE = `
  mutation UpdateRoutine(
    $id: ID!
    $title: String
    $estimatedTimeMinutes: Int
    $status: IntervalStatus
    $endTime: String
    $timeOfDayBlocks: [String!]
    $timerDurationMinutes: Int
    $steps: [RoutineStepInput!]
  ) {
    updateRoutine(
      id: $id
      title: $title
      estimatedTimeMinutes: $estimatedTimeMinutes
      status: $status
      endTime: $endTime
      timeOfDayBlocks: $timeOfDayBlocks
      timerDurationMinutes: $timerDurationMinutes
      steps: $steps
    ) {
      id
      title
      status
      endTime
      timeOfDayBlocks
      timerDurationMinutes
      steps { id title order }
    }
  }
`;

export const DELETE_ROUTINE = `
  mutation DeleteRoutine($id: ID!) {
    deleteRoutine(id: $id) {
      id
    }
  }
`;

export const RUN_ACTION_GATHERING = `
  mutation RunActionGathering($todayDate: String!) {
    runActionGathering(todayDate: $todayDate) {
      dateKeysProcessed
      actionsCreated
    }
  }
`;

export const GET_DAY_STATE = `
  query GetDayState($date: String!) {
    dayState(date: $date) {
      id
      dateKey
      afterDayCompletedAt
      actionGatheringCompletedAt
      preDayCompletedAt
    }
  }
`;

export const GET_TODAY_ACTIONS = `
  query GetTodayActions($date: String!) {
    todayActions(date: $date) {
      id
      title
      tbd
      done
      priority
      estimatedTimeMinutes
      startTimeOfDay
      project { id title }
      sourceType
      sourceId
      forDate
      isGathered
      actionFate
    }
  }
`;

export const GET_PRE_DAY_STATUS = `
  query GetPreDayStatus($date: String!) {
    preDayStatus(date: $date) {
      afterDayRequired
      canAccessToday
      actionsWithoutTime {
        id
        title
        estimatedTimeMinutes
        startTimeOfDay
        project { id title }
        isGathered
        sourceType
        sourceId
      }
      todayActionsWithOverlap {
        action {
          id
          title
          startTimeOfDay
          estimatedTimeMinutes
          project { id title }
          isGathered
        }
        overlapIds
      }
    }
  }
`;

export const GET_NOT_DONE_ACTIONS_FOR_DATE = `
  query GetNotDoneActionsForDate($date: String!) {
    notDoneActionsForDate(date: $date) {
      nonLinkedGathered {
        id
        title
        sourceType
        sourceId
        estimatedTimeMinutes
      }
      linkedGathered {
        id
        title
        sourceType
        sourceId
        estimatedTimeMinutes
      }
      linkedManual {
        id
        title
        tbd
        estimatedTimeMinutes
        project {
          id
          title
        }
      }
      standalone {
        id
        title
        tbd
        estimatedTimeMinutes
      }
    }
  }
`;

export const GET_API_TOKENS = `
  query GetApiTokens {
    apiTokens {
      id
      name
      prefix
      scope
      lastUsedAt
      expiresAt
      revokedAt
      createdAt
    }
  }
`;

export const CREATE_API_TOKEN = `
  mutation CreateApiToken($name: String!, $scope: ApiTokenScope!, $expiresInDays: Int) {
    createApiToken(name: $name, scope: $scope, expiresInDays: $expiresInDays) {
      token
      apiToken {
        id
        name
        prefix
        scope
        lastUsedAt
        expiresAt
        revokedAt
        createdAt
      }
    }
  }
`;

export const REVOKE_API_TOKEN = `
  mutation RevokeApiToken($id: ID!) {
    revokeApiToken(id: $id) {
      id
      revokedAt
    }
  }
`;

export const SET_ACTION_START_TIME = `
  mutation SetActionStartTime($id: ID!, $startTimeOfDay: String!) {
    setActionStartTime(id: $id, startTimeOfDay: $startTimeOfDay) {
      id
      startTimeOfDay
    }
  }
`;

export const POSTPONE_ACTION = `
  mutation PostponeAction($id: ID!, $newDate: String!) {
    postponeAction(id: $id, newDate: $newDate) {
      id
      tbd
      forDate
      actionFate
    }
  }
`;

export const OUTSOURCE_ACTION = `
  mutation OutsourceAction(
    $id: ID!
    $doOutsourcingTitle: String!
    $doOutsourcingDate: String!
    $ensureDoneTitle: String!
    $ensureDoneDate: String!
  ) {
    outsourceAction(
      id: $id
      doOutsourcingTitle: $doOutsourcingTitle
      doOutsourcingDate: $doOutsourcingDate
      ensureDoneTitle: $ensureDoneTitle
      ensureDoneDate: $ensureDoneDate
    ) {
      id
      actionFate
    }
  }
`;

export const SET_ACTION_NOT_IMPORTANT = `
  mutation SetActionNotImportant($id: ID!) {
    setActionNotImportant(id: $id) {
      id
      actionFate
    }
  }
`;

export const SET_ACTION_IGNORE = `
  mutation SetActionIgnore($id: ID!) {
    setActionIgnore(id: $id) {
      id
      actionFate
    }
  }
`;

export const SET_ACTION_PASSED_ARCHIVED = `
  mutation SetActionPassedArchived($id: ID!) {
    setActionPassedArchived(id: $id) {
      id
      actionFate
    }
  }
`;

export const COMPLETE_AFTER_DAY = `
  mutation CompleteAfterDay($date: String!) {
    completeAfterDay(date: $date) {
      id
      dateKey
      afterDayCompletedAt
    }
  }
`;

export const COMPLETE_PRE_DAY = `
  mutation CompletePreDay($date: String!) {
    completePreDay(date: $date) {
      id
      dateKey
      preDayCompletedAt
    }
  }
`;

export const GET_ONBOARDING_PROGRESS = `
  query GetOnboardingProgress {
    onboardingProgress {
      lastSlideViewed
      completedAt
    }
  }
`;

export const MARK_SLIDE_VIEWED = `
  mutation MarkSlideViewed($slideIndex: Int!) {
    markSlideViewed(slideIndex: $slideIndex) {
      lastSlideViewed
      completedAt
    }
  }
`;

export const GET_MODULE_INTRO_VIEWED = `
  query GetModuleIntroViewed($moduleKey: String!) {
    moduleIntroViewed(moduleKey: $moduleKey)
  }
`;

export const MARK_MODULE_INTRO_VIEWED = `
  mutation MarkModuleIntroViewed($moduleKey: String!) {
    markModuleIntroViewed(moduleKey: $moduleKey)
  }
`;

export const SAVE_DOD_CLARITY = `
  mutation SaveDodClarity($id: ID!, $dod: String, $dodClarityStatus: String!, $dodFlaggedDimensions: [String!]!) {
    saveDodClarity(id: $id, dod: $dod, dodClarityStatus: $dodClarityStatus, dodFlaggedDimensions: $dodFlaggedDimensions) {
      id
      dod
      dodClarityStatus
      dodFlaggedDimensions
    }
  }
`;

export const GET_NOTES = `
  query GetNotes($entityType: String!, $entityId: ID!) {
    notes(entityType: $entityType, entityId: $entityId) {
      id
      entityType
      entityId
      body
      createdAt
      updatedAt
    }
  }
`;

export const ADD_NOTE = `
  mutation AddNote($entityType: String!, $entityId: ID!, $body: String!) {
    addNote(entityType: $entityType, entityId: $entityId, body: $body) {
      id
      entityType
      entityId
      body
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_NOTE = `
  mutation UpdateNote($id: ID!, $body: String!) {
    updateNote(id: $id, body: $body) {
      id
      body
      updatedAt
    }
  }
`;

export const GET_ME_DISCOVERABILITY = `
  query GetMeDiscoverability {
    me {
      id
      discoverableByEmail
    }
  }
`;

export const UPDATE_DISCOVERABILITY = `
  mutation UpdateDiscoverability($discoverableByEmail: Boolean!) {
    updateDiscoverability(discoverableByEmail: $discoverableByEmail)
  }
`;

export const GET_JOURNALS = `
  query GetJournals($includeArchived: Boolean) {
    journals(includeArchived: $includeArchived) {
      id
      title
      description
      isArchived
      isDefault
      linkedGoalId
      linkedProjectId
      linkedGoal { id title }
      linkedProject { id title }
      entryCount
      accessList { id userEmail }
      createdAt
      updatedAt
    }
  }
`;

export const GET_JOURNAL = `
  query GetJournal($id: ID!) {
    journal(id: $id) {
      id
      title
      description
      isArchived
      isDefault
      linkedGoalId
      linkedProjectId
      linkedGoal { id title }
      linkedProject { id title }
      entryCount
      accessList { id userEmail addedAt }
      createdAt
      updatedAt
    }
  }
`;

export const GET_JOURNAL_ENTRIES = `
  query GetJournalEntries($journalId: ID!, $includeArchived: Boolean, $dateFrom: String, $dateTo: String, $search: String) {
    journalEntries(journalId: $journalId, includeArchived: $includeArchived, dateFrom: $dateFrom, dateTo: $dateTo, search: $search) {
      id
      body
      createdAt
      updatedAt
      isArchived
      timestampOverridden
    }
  }
`;

export const CREATE_JOURNAL = `
  mutation CreateJournal($title: String!, $description: String, $linkedGoalId: ID, $linkedProjectId: ID) {
    createJournal(title: $title, description: $description, linkedGoalId: $linkedGoalId, linkedProjectId: $linkedProjectId) {
      id
      title
      isDefault
    }
  }
`;

export const UPDATE_JOURNAL = `
  mutation UpdateJournal($id: ID!, $title: String, $description: String, $linkedGoalId: ID, $linkedProjectId: ID) {
    updateJournal(id: $id, title: $title, description: $description, linkedGoalId: $linkedGoalId, linkedProjectId: $linkedProjectId) {
      id
      title
      description
      linkedGoalId
      linkedProjectId
      linkedGoal { id title }
      linkedProject { id title }
    }
  }
`;

export const ARCHIVE_JOURNAL = `
  mutation ArchiveJournal($id: ID!) {
    archiveJournal(id: $id) { id isArchived }
  }
`;

export const DELETE_JOURNAL = `
  mutation DeleteJournal($id: ID!) {
    deleteJournal(id: $id) { id }
  }
`;

export const ADD_JOURNAL_ACCESS = `
  mutation AddJournalAccess($journalId: ID!, $email: String!) {
    addJournalAccess(journalId: $journalId, email: $email) {
      id
      accessList { id userEmail }
    }
  }
`;

export const REMOVE_JOURNAL_ACCESS = `
  mutation RemoveJournalAccess($journalId: ID!, $email: String!) {
    removeJournalAccess(journalId: $journalId, email: $email) {
      id
      accessList { id userEmail }
    }
  }
`;

export const SET_DEFAULT_JOURNAL = `
  mutation SetDefaultJournal($journalId: ID!) {
    setDefaultJournal(journalId: $journalId) { id isDefault }
  }
`;

export const CREATE_ENTRY = `
  mutation CreateEntry($journalId: ID!, $body: String!) {
    createEntry(journalId: $journalId, body: $body) {
      id
      body
      createdAt
      updatedAt
      isArchived
      timestampOverridden
    }
  }
`;

export const UPDATE_ENTRY = `
  mutation UpdateEntry($id: ID!, $body: String!, $overrideTimestamp: Boolean) {
    updateEntry(id: $id, body: $body, overrideTimestamp: $overrideTimestamp) {
      id
      body
      createdAt
      updatedAt
      timestampOverridden
    }
  }
`;

export const ARCHIVE_ENTRY = `
  mutation ArchiveEntry($id: ID!) {
    archiveEntry(id: $id) { id isArchived }
  }
`;

export const ADD_QUICK_ENTRY = `
  mutation AddQuickEntry($body: String!, $journalId: ID) {
    addQuickEntry(body: $body, journalId: $journalId) {
      id
      body
      createdAt
    }
  }
`;

export const DELETE_NOTE = `
  mutation DeleteNote($id: ID!) {
    deleteNote(id: $id) {
      id
    }
  }
`;

// ─── Skill tools (Evidence Lab) ──────────────────────────────────────────────
// Note what these documents cannot ask for: there is no `key`, `faultTarget` or
// `reveal` field on SkillItem. The answer is only ever returned by
// submitSkillAttempt, after a verdict has been committed.

export const GET_SKILL_MODULES = `
  query SkillModules($skillKey: SkillKey!) {
    skillModules(skillKey: $skillKey) {
      moduleKey
      title
      concept
      model
      state
      currentStep
      masteredAt
      nextReviewAt
    }
  }
`;

export const GET_SKILL_PROGRESS = `
  query SkillProgress($skillKey: SkillKey!) {
    skillProgress(skillKey: $skillKey) {
      skillKey
      contentVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      probeReady
      probeBlockers
      calendarPlanningEnabled
      totalAttempts
      itemCount
      strictCount
      strictComposite
      hitRate
      falseAlarmRate
      discrimination
      meanBrier
      medianTimeToFirstCheckMs
      overTrustRate
      accuracyRate
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

export const GET_SKILL_DUE_REVIEWS = `
  query SkillDueReviews {
    skillDueReviews {
      moduleKey
      title
      state
    }
  }
`;

export const START_SKILL_ITEM = `
  mutation StartSkillItem($skillKey: SkillKey!, $mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startSkillItem(skillKey: $skillKey, mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      attemptId
      item {
        itemId
        moduleKey
        difficulty
        prompt
        answer
        snapshotQueries {
          query
          results {
            title
            url
            snippet
          }
        }
      }
    }
  }
`;

export const LOG_SKILL_CHECK_EVENT = `
  mutation LogSkillCheckEvent($attemptId: ID!, $kind: String!, $payload: String) {
    logSkillCheckEvent(attemptId: $attemptId, kind: $kind, payload: $payload)
  }
`;

export const SUBMIT_SKILL_ATTEMPT = `
  mutation SubmitSkillAttempt(
    $attemptId: ID!
    $verdict: SkillVerdict!
    $confidence: Int!
    $faultTag: SkillFaultTag!
    $sources: [SkillSourceInput!]
    $timeZoneOffsetMinutes: Int
  ) {
    submitSkillAttempt(
      attemptId: $attemptId
      verdict: $verdict
      confidence: $confidence
      faultTag: $faultTag
      sources: $sources
      timeZoneOffsetMinutes: $timeZoneOffsetMinutes
    ) {
      attemptId
      lateral
      independence
      accuracy
      traceQuality
      strict
      brier
      timeToFirstCheckMs
      falseAlarm
      overTrust
      correctVerdict
      reveal
      moduleState
      masteryUnmet {
        code
        count
        required
        seconds
      }
    }
  }
`;

export const SKIP_SKILL_ASSESSMENT = `
  mutation SkipSkillAssessment($skillKey: SkillKey!) {
    skipSkillAssessment(skillKey: $skillKey)
  }
`;

export const GET_SKILL_PLAN = `
  query SkillPlan($skillKey: SkillKey!) {
    skillPlan(skillKey: $skillKey) {
      actionId
      moduleKey
      title
      tbd
      done
    }
  }
`;

export const PLAN_SKILL_SCHEDULE = `
  mutation PlanSkillSchedule(
    $skillKey: SkillKey!
    $startDate: String!
    $sessionsPerWeek: Int
    $timeOfDay: String
    $sessionsPerModule: Int
  ) {
    planSkillSchedule(
      skillKey: $skillKey
      startDate: $startDate
      sessionsPerWeek: $sessionsPerWeek
      timeOfDay: $timeOfDay
      sessionsPerModule: $sessionsPerModule
    ) {
      created
      removed
      warnings
    }
  }
`;

export const CLEAR_SKILL_SCHEDULE = `
  mutation ClearSkillSchedule($skillKey: SkillKey!) {
    clearSkillSchedule(skillKey: $skillKey)
  }
`;

// ── Skill probes (baseline / post / delayed) ─────────────────────────────────
// Shared across all three tools — see api/src/services/skills/probes.ts.

export const GET_DUE_SKILL_PROBES = `
  query DueSkillProbes {
    dueSkillProbes {
      skillKey
      timepoint
      scheduledFor
    }
  }
`;

export const GET_SKILL_PROBE = `
  query SkillProbe($skillKey: SkillKey!, $timepoint: SkillTimepoint!) {
    skillProbe(skillKey: $skillKey, timepoint: $timepoint) {
      timepoint
      formId
      scheduledFor
      startedAt
      completedAt
      contentVersion
      rubricVersion
      totals
      selfReport
      comparable
    }
  }
`;

export const START_SKILL_PROBE = `
  mutation StartSkillProbe($skillKey: SkillKey!, $timepoint: SkillTimepoint!) {
    startSkillProbe(skillKey: $skillKey, timepoint: $timepoint) {
      probeId
      timepoint
      formId
      resuming
      alreadyCompleted
    }
  }
`;

export const COMPLETE_SKILL_PROBE = `
  mutation CompleteSkillProbe($skillKey: SkillKey!, $timepoint: SkillTimepoint!, $selfReport: [Int!]!) {
    completeSkillProbe(skillKey: $skillKey, timepoint: $timepoint, selfReport: $selfReport) {
      probeId
      timepoint
      formId
      itemCount
      totals
      completedAt
    }
  }
`;

export const GET_SKILL_EXPORT = `
  query SkillExport($skillKey: SkillKey!) {
    skillExport(skillKey: $skillKey) {
      json
      markdown
    }
  }
`;

// ── Clarity Lab ─────────────────────────────────────────────────────────────
//
// Its own field set rather than a widening of the Evidence queries: the two
// tools measure different things, and a shared shape would make every field on
// both sides nullable.

export const GET_CLARITY_MODULES = `
  query ClarityModules {
    clarityModules {
      moduleKey
      title
      concept
      model
      criterion
      state
      currentStep
      masteredAt
      nextReviewAt
    }
  }
`;

export const GET_CLARITY_PROGRESS = `
  query ClarityProgress {
    clarityProgress {
      contentVersion
      rubricVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      readerAvailable
      anyCriterionCalibrated
      detectorCriteria
      totalAttempts
      criterionMeans {
        criterion
        mean
        count
      }
      revisionDeltas
      meanDelta
      probeReady
      probeBlockers
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

const CLARITY_SERVED_FIELDS = `
  attemptId
  needsPrediction
  needsDiagnosis
  draftText
  item {
    itemId
    moduleKey
    type
    difficulty
    scenario
    contextSheet
    weakText
    authoredMisread
  }
`;

export const START_CLARITY_ITEM = `
  mutation StartClarityItem($mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startClarityItem(mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      ${CLARITY_SERVED_FIELDS}
    }
  }
`;

export const START_CLARITY_REVISION = `
  mutation StartClarityRevision($attemptId: ID!) {
    startClarityRevision(attemptId: $attemptId) {
      ${CLARITY_SERVED_FIELDS}
    }
  }
`;

export const LOCK_CLARITY_PREDICTION = `
  mutation LockClarityPrediction($attemptId: ID!, $prediction: String!) {
    lockClarityPrediction(attemptId: $attemptId, prediction: $prediction)
  }
`;

export const LOCK_CLARITY_DIAGNOSIS = `
  mutation LockClarityDiagnosis($attemptId: ID!, $criteria: [String!]!) {
    lockClarityDiagnosis(attemptId: $attemptId, criteria: $criteria)
  }
`;

export const SUBMIT_CLARITY_ATTEMPT = `
  mutation SubmitClarityAttempt($attemptId: ID!, $text: String!, $timeZoneOffsetMinutes: Int) {
    submitClarityAttempt(attemptId: $attemptId, text: $text, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      attemptId
      score {
        criteria {
          criterion
          level
          source
          findings
          evidenceQuote
        }
        total
        maxPossible
        scoredCount
        unscored
        isVoid
        isComplete
      }
      diagnosis {
        correct
        missed
        spurious
        unverifiable
      }
      repairPassed
      delta
      reveal
      revealIsAboutItemText
      diagnosisIsAboutItemText
      moduleState
      masteryUnmet {
        code
        count
        required
        minTotal
      }
      atCriterion
      feedbackOnly
    }
  }
`;

// ── Decomposition Lab ────────────────────────────────────────────────────────

export const GET_DECOMPOSITION_MODULES = `
  query DecompositionModules {
    decompositionModules {
      moduleKey
      title
      concept
      model
      criterion
      state
      currentStep
      masteredAt
      nextReviewAt
    }
  }
`;

export const GET_DECOMPOSITION_PROGRESS = `
  query DecompositionProgress {
    decompositionProgress {
      contentVersion
      rubricVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      totalAttempts
      criterionMeans {
        criterion
        mean
        count
      }
      breadthFirstIndexTrend
      granularityDiscrimination
      probeReady
      probeBlockers
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

const DECOMPOSITION_SERVED_FIELDS = `
  attemptId
  needsDiagnosis
  draftStructure
  item {
    itemId
    moduleKey
    type
    difficulty
    scenario
    palette {
      id
      label
    }
    suppliedTree {
      id
      parentId
      depth
      label
      dependsOn
    }
    suppliedWhole {
      statement
      doneWhen
    }
  }
`;

export const START_DECOMPOSITION_ITEM = `
  mutation StartDecompositionItem($mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startDecompositionItem(mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      ${DECOMPOSITION_SERVED_FIELDS}
    }
  }
`;

export const START_DECOMPOSITION_REVISION = `
  mutation StartDecompositionRevision($attemptId: ID!) {
    startDecompositionRevision(attemptId: $attemptId) {
      ${DECOMPOSITION_SERVED_FIELDS}
    }
  }
`;

export const LOCK_DECOMPOSITION_WHOLE = `
  mutation LockDecompositionWhole($attemptId: ID!, $statement: String!, $doneWhen: String!) {
    lockDecompositionWhole(attemptId: $attemptId, statement: $statement, doneWhen: $doneWhen)
  }
`;

export const LOCK_DECOMPOSITION_DIAGNOSIS = `
  mutation LockDecompositionDiagnosis($attemptId: ID!, $tags: [String!]!) {
    lockDecompositionDiagnosis(attemptId: $attemptId, tags: $tags)
  }
`;

export const SUBMIT_DECOMPOSITION_ATTEMPT = `
  mutation SubmitDecompositionAttempt($attemptId: ID!, $structure: DecompositionStructureInput!, $timeZoneOffsetMinutes: Int) {
    submitDecompositionAttempt(attemptId: $attemptId, structure: $structure, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      attemptId
      score {
        criteria {
          id
          level
          scoredBy
          evidence
        }
        total
        scoredCount
        coverage {
          found
          required
        }
        bfi
        overDecomposed
        isVoid
        isComplete
      }
      diagnosisCorrect
      delta
      moduleState
      masteryUnmet {
        code
        count
        required
        minTotal
      }
      atCriterion
      reveal {
        pieces {
          id
          label
          required
          atomic
        }
        overlapPairs {
          a
          b
        }
        blockingEdges {
          a
          b
        }
        independentPairs {
          a
          b
        }
      }
    }
  }
`;

// ── Decomposition Lab: real-work export ──────────────────────────────────────
// The one flow in the build that writes the learner's real data.

export const START_DECOMPOSITION_REAL_WORK = `
  mutation StartDecompositionRealWork($targetType: DecompositionRealWorkTargetType!, $targetId: ID!) {
    startDecompositionRealWork(targetType: $targetType, targetId: $targetId) {
      attemptId
      targetType
      targetId
      title
      dod
    }
  }
`;

export const SUBMIT_DECOMPOSITION_REAL_WORK = `
  mutation SubmitDecompositionRealWork($attemptId: ID!, $structure: DecompositionStructureInput!, $timeZoneOffsetMinutes: Int) {
    submitDecompositionRealWork(attemptId: $attemptId, structure: $structure, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      attemptId
      score {
        criteria {
          id
          level
          scoredBy
          evidence
        }
        total
        scoredCount
        isVoid
      }
    }
  }
`;

export const EXPORT_DECOMPOSITION_BREAKDOWN = `
  mutation ExportDecompositionBreakdown($attemptId: ID!, $nodeIds: [String!]!) {
    exportDecompositionBreakdown(attemptId: $attemptId, nodeIds: $nodeIds) {
      createdProjects {
        id
        title
      }
      createdActions {
        id
        title
        projectId
      }
      dependencyEdgesDropped
    }
  }
`;

// ── Verification Lab ──────────────────────────────────────────────────────────

export const GET_VERIFICATION_MODULES = `
  query VerificationModules {
    verificationModules {
      moduleKey
      title
      concept
      model
      rung
      state
      currentStep
      masteredAt
      nextReviewAt
      promotionOffered
    }
  }
`;

export const GET_VERIFICATION_PROGRESS = `
  query VerificationProgress {
    verificationProgress {
      contentVersion
      rubricVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      totalAttempts
      criterionMeans {
        criterion
        mean
        count
      }
      strictComposite
      ritualRate
      discrimination
      meanCostRatio
      correctUnverifiedCount
      falseUnverifiedCount
      probeReady
      probeBlockers
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

export const START_VERIFICATION_ITEM = `
  mutation StartVerificationItem($mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startVerificationItem(mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      attemptId
      rung
      assistedCeilingSeconds
      item {
        itemId
        moduleKey
        difficulty
        ask
        answer
        bench {
          checkId
          label
          costSeconds
        }
      }
    }
  }
`;

export const NAME_VERIFICATION_ORACLE = `
  mutation NameVerificationOracle($attemptId: ID!, $text: String!, $predictedCostSeconds: Int) {
    nameVerificationOracle(attemptId: $attemptId, text: $text, predictedCostSeconds: $predictedCostSeconds)
  }
`;

export const REVEAL_VERIFICATION_CHECK = `
  mutation RevealVerificationCheck($attemptId: ID!, $checkId: String!) {
    revealVerificationCheck(attemptId: $attemptId, checkId: $checkId) {
      checkId
      outcome
      costSeconds
      cumulativeSpent
      ceilingSeconds
    }
  }
`;

const VERIFICATION_SUBMIT_RESULT_FIELDS = `
  attemptId
  score {
    criteria {
      id
      level
      scoredBy
      evidence
    }
    total
    scoredCount
    strict
    ritualState
    costSpent
    costRatio
    rung
    isVoid
    isComplete
  }
  moduleState
  masteryUnmet {
    code
    count
    required
    minTotal
  }
  promotionOffered
  reveal {
    failingElementLabel
    cheapestCheckId
    cheapestCostSeconds
  }
`;

export const LOAD_VERIFICATION_ELEMENTS = `
  mutation LoadVerificationElements($attemptId: ID!) {
    loadVerificationElements(attemptId: $attemptId) {
      elementId
      label
    }
  }
`;

export const COMMIT_VERIFICATION_VERDICT = `
  mutation CommitVerificationVerdict(
    $attemptId: ID!
    $verdict: VerificationVerdict!
    $confidence: Int!
    $residualRisk: String!
    $elementId: String
    $elementFreeText: String
    $timeZoneOffsetMinutes: Int
  ) {
    commitVerificationVerdict(
      attemptId: $attemptId
      verdict: $verdict
      confidence: $confidence
      residualRisk: $residualRisk
      elementId: $elementId
      elementFreeText: $elementFreeText
      timeZoneOffsetMinutes: $timeZoneOffsetMinutes
    ) {
      stage
      elements {
        elementId
        label
      }
      result {
        ${VERIFICATION_SUBMIT_RESULT_FIELDS}
      }
    }
  }
`;

export const SET_VERIFICATION_LOCALIZATION = `
  mutation SetVerificationLocalization($attemptId: ID!, $elementId: String!, $timeZoneOffsetMinutes: Int) {
    setVerificationLocalization(attemptId: $attemptId, elementId: $elementId, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${VERIFICATION_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const SET_VERIFICATION_RUNG = `
  mutation SetVerificationRung($moduleKey: String!, $rung: VerificationRung!) {
    setVerificationRung(moduleKey: $moduleKey, rung: $rung)
  }
`;

export const START_VERIFICATION_REAL_WORK = `
  mutation StartVerificationRealWork($claim: String!) {
    startVerificationRealWork(claim: $claim) {
      attemptId
      claim
    }
  }
`;

export const SUBMIT_VERIFICATION_REAL_WORK = `
  mutation SubmitVerificationRealWork(
    $attemptId: ID!
    $oracle: String!
    $result: String!
    $verdict: VerificationVerdict!
    $confidence: Int!
    $residualRisk: String!
  ) {
    submitVerificationRealWork(
      attemptId: $attemptId
      oracle: $oracle
      result: $result
      verdict: $verdict
      confidence: $confidence
      residualRisk: $residualRisk
    ) {
      attemptId
      record {
        claim
        oracle
        result
        verdict
        residualRisk
      }
    }
  }
`;

// ── Delegation Lab ───────────────────────────────────────────────────────────

export const GET_DELEGATION_MODULES = `
  query DelegationModules {
    delegationModules {
      moduleKey
      title
      concept
      model
      state
      currentStep
      masteredAt
      nextReviewAt
    }
  }
`;

export const GET_DELEGATION_PROGRESS = `
  query DelegationProgress {
    delegationProgress {
      contentVersion
      rubricVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      totalAttempts
      criterionMeans {
        criterion
        mean
        count
      }
      relianceDiscrimination
      overReliance
      underReliance
      netGainFromAdvice
      anchoringOnUncuedItems
      selfAssessmentCalibration
      populationMeanWoa
      ownMeanWoa
      probeReady
      probeBlockers
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

export const START_DELEGATION_ITEM = `
  mutation StartDelegationItem($mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startDelegationItem(mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      attemptId
      item {
        itemId
        moduleKey
        difficulty
        kind
        ask
        unitLabel
        plausibleRange
        cueOptions {
          cueId
          label
        }
        splitPieces {
          pieceId
          label
        }
        stakesPairId
        roundIndex
        totalRounds
      }
    }
  }
`;

export const COMMIT_DELEGATION_ESTIMATE = `
  mutation CommitDelegationEstimate($attemptId: ID!, $value: Float!, $confidence: Int!) {
    commitDelegationEstimate(attemptId: $attemptId, value: $value, confidence: $confidence) {
      advice
      unitLabel
    }
  }
`;

const DELEGATION_SUBMIT_RESULT_FIELDS = `
  attemptId
  score {
    criteria {
      id
      level
      scoredBy
      evidence
    }
    total
    scoredCount
    woaRaw
    woaClamped
    benchmark
    direction
    netGain
    adviceQuality
    isVoid
    pendingPair
    truth
  }
  moduleState
  masteryUnmet {
    code
    count
    required
    minTotal
  }
`;

export const COMMIT_DELEGATION_REVISION = `
  mutation CommitDelegationRevision($attemptId: ID!, $value: Float!, $recoverabilityMove: Boolean, $timeZoneOffsetMinutes: Int) {
    commitDelegationRevision(
      attemptId: $attemptId
      value: $value
      recoverabilityMove: $recoverabilityMove
      timeZoneOffsetMinutes: $timeZoneOffsetMinutes
    ) {
      stage
      cueOptions {
        cueId
        label
      }
      result {
        ${DELEGATION_SUBMIT_RESULT_FIELDS}
      }
    }
  }
`;

export const SELECT_DELEGATION_CUE = `
  mutation SelectDelegationCue($attemptId: ID!, $cueId: String!, $timeZoneOffsetMinutes: Int) {
    selectDelegationCue(attemptId: $attemptId, cueId: $cueId, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${DELEGATION_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const COMMIT_DELEGATION_SPLIT = `
  mutation CommitDelegationSplit($attemptId: ID!, $dispositions: [DelegationDispositionInput!]!, $timeZoneOffsetMinutes: Int) {
    commitDelegationSplit(attemptId: $attemptId, dispositions: $dispositions, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${DELEGATION_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const COMMIT_SEQUENCE_ROUND = `
  mutation CommitSequenceRound(
    $attemptId: ID!
    $roundIndex: Int!
    $value: Float!
    $phase: String!
    $confidence: Int
    $timeZoneOffsetMinutes: Int
  ) {
    commitSequenceRound(
      attemptId: $attemptId
      roundIndex: $roundIndex
      value: $value
      phase: $phase
      confidence: $confidence
      timeZoneOffsetMinutes: $timeZoneOffsetMinutes
    ) {
      stage
      advice
      result {
        ${DELEGATION_SUBMIT_RESULT_FIELDS}
      }
    }
  }
`;

export const START_DELEGATION_REAL_WORK = `
  mutation StartDelegationRealWork($handingOver: String!, $keeping: String!, $wouldTellMeWrong: String!) {
    startDelegationRealWork(handingOver: $handingOver, keeping: $keeping, wouldTellMeWrong: $wouldTellMeWrong) {
      attemptId
      handingOver
      keeping
      wouldTellMeWrong
    }
  }
`;

export const SUBMIT_DELEGATION_REAL_WORK = `
  mutation SubmitDelegationRealWork($attemptId: ID!, $whatActuallyHappened: String!) {
    submitDelegationRealWork(attemptId: $attemptId, whatActuallyHappened: $whatActuallyHappened) {
      attemptId
      record {
        handingOver
        keeping
        wouldTellMeWrong
        whatActuallyHappened
      }
    }
  }
`;

export const GET_MONITORING_MODULES = `
  query MonitoringModules {
    monitoringModules {
      moduleKey
      title
      concept
      model
      state
      currentStep
      masteredAt
      nextReviewAt
    }
  }
`;

export const GET_MONITORING_PROGRESS = `
  query MonitoringProgress {
    monitoringProgress {
      contentVersion
      rubricVersion
      locale
      reviewStatus
      hasBaseline
      assessmentSkipped
      totalAttempts
      criterionMeans {
        criterion
        mean
        count
      }
      resolutionSampleCount
      resolution
      performance
      bias
      postAiInflation
      postAiInflationReady
      influenceDiscrimination
      probeReady
      probeBlockers
      probes {
        timepoint
        formId
        completedAt
        comparable
      }
    }
  }
`;

export const START_MONITORING_ITEM = `
  mutation StartMonitoringItem($mode: SkillMode!, $moduleKey: String, $probeId: ID) {
    startMonitoringItem(mode: $mode, moduleKey: $moduleKey, probeId: $probeId) {
      attemptId
      item {
        itemId
        moduleKey
        difficulty
        kind
        question
        explainPrompt
        authoredExplanation
        pairId
        pairHalf
        turns {
          turnId
          role
          text
        }
        checkpoints {
          checkpointId
          text
        }
        countermeasureOptions {
          optionId
          label
        }
      }
    }
  }
`;

export const COMMIT_MONITORING_PREDICTION = `
  mutation CommitMonitoringPrediction($attemptId: ID!, $level: String!) {
    commitMonitoringPrediction(attemptId: $attemptId, level: $level) {
      ok
    }
  }
`;

const MONITORING_SUBMIT_RESULT_FIELDS = `
  attemptId
  score {
    criteria {
      id
      level
      scoredBy
      evidence
    }
    total
    scoredCount
    predictionSample {
      prediction
      outcome
    }
    ratingSample {
      pairId
      pairHalf
      rating
    }
    deflation {
      before
      after
    }
    influenceResult {
      hits
      falseAlarms
      plantedTotal
      misses
      plantedTurns {
        turnId
        type
        found
      }
    }
    checkRate {
      firstThird
      lastThird
      decay
    }
    answerOutcome {
      yourAnswer
      correct
      acceptedAnswer
    }
  }
  moduleState
  masteryUnmet {
    code
    count
    required
    minTotal
  }
`;

export const SUBMIT_MONITORING_ANSWER = `
  mutation SubmitMonitoringAnswer($attemptId: ID!, $text: String!, $timeZoneOffsetMinutes: Int) {
    submitMonitoringAnswer(attemptId: $attemptId, text: $text, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      stage
      result {
        ${MONITORING_SUBMIT_RESULT_FIELDS}
      }
    }
  }
`;

export const COMMIT_MONITORING_RATING = `
  mutation CommitMonitoringRating($attemptId: ID!, $phase: String!, $value: Int!, $timeZoneOffsetMinutes: Int) {
    commitMonitoringRating(attemptId: $attemptId, phase: $phase, value: $value, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      stage
      result {
        ${MONITORING_SUBMIT_RESULT_FIELDS}
      }
    }
  }
`;

export const COMMIT_MONITORING_EXPLANATION = `
  mutation CommitMonitoringExplanation($attemptId: ID!, $text: String!) {
    commitMonitoringExplanation(attemptId: $attemptId, text: $text) {
      steps {
        stepId
        label
      }
    }
  }
`;

export const SELECT_MONITORING_STEPS = `
  mutation SelectMonitoringSteps($attemptId: ID!, $stepIds: [String!]!, $timeZoneOffsetMinutes: Int) {
    selectMonitoringSteps(attemptId: $attemptId, stepIds: $stepIds, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${MONITORING_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const MARK_MONITORING_INFLUENCE = `
  mutation MarkMonitoringInfluence($attemptId: ID!, $marks: [MonitoringInfluenceMarkInput!]!, $timeZoneOffsetMinutes: Int) {
    markMonitoringInfluence(attemptId: $attemptId, marks: $marks, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${MONITORING_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const MARK_MONITORING_CHECKPOINT = `
  mutation MarkMonitoringCheckpoint($attemptId: ID!, $checkpointId: String!, $checked: Boolean!) {
    markMonitoringCheckpoint(attemptId: $attemptId, checkpointId: $checkpointId, checked: $checked) {
      ok
    }
  }
`;

export const SELECT_MONITORING_COUNTERMEASURE = `
  mutation SelectMonitoringCountermeasure($attemptId: ID!, $optionId: String!, $timeZoneOffsetMinutes: Int) {
    selectMonitoringCountermeasure(attemptId: $attemptId, optionId: $optionId, timeZoneOffsetMinutes: $timeZoneOffsetMinutes) {
      ${MONITORING_SUBMIT_RESULT_FIELDS}
    }
  }
`;

export const START_MONITORING_SELF_AUDIT = `
  mutation StartMonitoringSelfAudit {
    startMonitoringSelfAudit {
      attemptId
      questionKeys
    }
  }
`;

export const SUBMIT_MONITORING_SELF_AUDIT = `
  mutation SubmitMonitoringSelfAudit($attemptId: ID!, $answers: MonitoringSelfAuditAnswersInput!) {
    submitMonitoringSelfAudit(attemptId: $attemptId, answers: $answers) {
      attemptId
      record {
        flattery
        anchor
        smuggledPremise
        agreementReversal
      }
    }
  }
`;

// ── Learn · Feelings & Needs (Module 1) ──────────────────────────────────────

export const GET_FEELINGS_NEEDS_STATE = `
  query FeelingsNeedsState {
    feelingsNeedsState {
      contentVersion
      locale
      reviewStatus
      frameDone
      graduationSurfaced
      promptFadeLevel
      sittingCount
    }
  }
`;

export const GET_FEELINGS_NEEDS_CONTENT = `
  query FeelingsNeedsContent {
    feelingsNeedsContent {
      contentVersion
      reviewStatus
      repeatSoftCap
      breathSkippable
      locations { id label carryLabel }
      textures { id label carryLabel }
      feelings { id label carryLabel tier }
      needs { id label }
      display { locationIds textureIds feelingIds needIds }
      frame {
        intro { title body begin }
        recall { prompt helper ready }
        place { prompt helper locationIds }
        texture { prompt helper textureIds }
        name { prompt helper feelingIds }
        payoff { line body close }
      }
      loop {
        breathePrompt breatheHint breatheSkip
        placePrompt placeHelper
        textureCarry texturePrompt textureHelper
        nameCarry namePrompt nameOther nameOwnPlaceholder
        needCarry needPrompt needSkip
        smallStepPrompt smallStepPlaceholder smallStepSkip
        done addAnother addAnotherAsk addAnotherCapped finish
        recapHeading recapLead recapNotRelated
        repeatLead repeatPrompt
      }
    }
  }
`;

/** Every loop mutation returns the whole sitting, so the client renders one shape. */
const LOOP_SITTING_FIELDS = `
  id
  breathTaken
  completedAt
  entries {
    id
    passIndex
    bodyLocation
    bodyTexture
    feelingWord
    feelingSource
    need
    needSource
    smallAction
  }
`;

export const COMPLETE_FEELINGS_NEEDS_FRAME = `
  mutation CompleteFeelingsNeedsFrame {
    completeFeelingsNeedsFrame {
      frameDone
      sittingCount
    }
  }
`;

export const GET_ACTIVE_LOOP_SITTING = `
  query ActiveLoopSitting {
    activeLoopSitting { ${LOOP_SITTING_FIELDS} }
  }
`;

export const GET_LOOP_HISTORY = `
  query LoopHistory($limit: Int) {
    loopHistory(limit: $limit) {
      id
      completedAt
      entries {
        id
        passIndex
        bodyLocation
        bodyTexture
        feelingWord
        need
        smallAction
      }
    }
  }
`;

export const START_LOOP_SITTING = `
  mutation StartLoopSitting($wasPrompted: Boolean) {
    startLoopSitting(wasPrompted: $wasPrompted) { ${LOOP_SITTING_FIELDS} }
  }
`;

export const SET_LOOP_BREATH = `
  mutation SetLoopBreath($sittingId: ID!) {
    setLoopBreath(sittingId: $sittingId) { ${LOOP_SITTING_FIELDS} }
  }
`;

export const UPDATE_LOOP_ENTRY = `
  mutation UpdateLoopEntry(
    $entryId: ID!
    $bodyLocation: String
    $bodyTexture: String
    $feelingWord: String
    $feelingSource: String
    $need: String
    $needSource: String
    $smallAction: String
  ) {
    updateLoopEntry(
      entryId: $entryId
      bodyLocation: $bodyLocation
      bodyTexture: $bodyTexture
      feelingWord: $feelingWord
      feelingSource: $feelingSource
      need: $need
      needSource: $needSource
      smallAction: $smallAction
    ) {
      sitting { ${LOOP_SITTING_FIELDS} }
      catch {
        conceptId
        line
        feelingHints
        needHints
        feelingHintsLabel
        needHintsLabel
        dismiss
        note
      }
    }
  }
`;

export const ADD_LOOP_PASS = `
  mutation AddLoopPass($sittingId: ID!) {
    addLoopPass(sittingId: $sittingId) { ${LOOP_SITTING_FIELDS} }
  }
`;

export const FINISH_LOOP_SITTING = `
  mutation FinishLoopSitting($sittingId: ID!) {
    finishLoopSitting(sittingId: $sittingId) {
      sitting { ${LOOP_SITTING_FIELDS} }
      graduation { line body close }
    }
  }
`;

export const ACKNOWLEDGE_GRADUATION = `
  mutation AcknowledgeGraduation {
    acknowledgeGraduation
  }
`;
