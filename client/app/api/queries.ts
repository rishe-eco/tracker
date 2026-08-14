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
    }
  }
`;

export const START_SKILL_ITEM = `
  mutation StartSkillItem($skillKey: SkillKey!, $mode: SkillMode!, $moduleKey: String) {
    startSkillItem(skillKey: $skillKey, mode: $mode, moduleKey: $moduleKey) {
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
  mutation StartClarityItem($mode: SkillMode!, $moduleKey: String) {
    startClarityItem(mode: $mode, moduleKey: $moduleKey) {
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
