import { requireAuth } from "../auth";
import { getTodayActions, getPreDayStatus, getNotDoneActionsForDate } from "../../services/todayPreDayAfterDay";
import { intervalOccursOnDate } from "../../services/actionGathering";
import { getModules, getProgress } from "../../services/skills/evidenceSession";
import { getClarityModules, getClarityProgress } from "../../services/skills/clarity/claritySession";
import { getDecompositionModules, getDecompositionProgress } from "../../services/skills/decomposition/decompositionSession";
import { getVerificationModules, getVerificationProgress } from "../../services/skills/verification/verificationSession";
import { getDelegationModules, getDelegationProgress } from "../../services/skills/delegation/delegationSession";
import { getMonitoringModules, getMonitoringProgress } from "../../services/skills/monitoring/monitoringSession";
import { getSkillsOverview } from "../../services/skills/overview";
import { getPlan } from "../../services/skills/planning";
import { exportSkillData, getDueSkillProbes, getSkillProbe } from "../../services/skills/probes";
import { getFeelingsNeedsState } from "../../services/feelingsNeeds/state";
import { getActiveSitting, getContent, getHistory } from "../../services/feelingsNeeds/session";
import { getNoticingState } from "../../services/noticing/state";
import { getContent as getNoticingContent, getActiveSitting as getActiveNoticingSitting } from "../../services/noticing/session";

/**
 * Clarity Lab has its own fields (`clarityModules`, `clarityProgress`) rather
 * than sharing these. The two tools measure different things, so a shared type
 * would have to make every field on both sides nullable. Passing `clarity` here
 * is therefore a caller error, and failing loudly beats returning an empty
 * Evidence Lab under a clarity label.
 */
function assertEvidence(skillKey: string) {
  if (skillKey !== "evidence") {
    throw new Error(`Skill "${skillKey}" is not built yet. Evidence Lab ships first — see 06-specs §14.`);
  }
}

const INTERVAL_DATES_SELECT = {
  select: { id: true, createdAt: true, endTime: true, status: true },
} as const;

const PROJECT_WITH_DATES_INCLUDE = {
  include: {
    actions: true,
    intervals: INTERVAL_DATES_SELECT,
  },
} as const;

export const queryResolvers = {
  actions: requireAuth((_, __, ctx) =>
    ctx.prisma.action.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    })
  ),
  action: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.action.findFirst({
      where: { id, userId: ctx.user.id },
    })
  ),
  projects: requireAuth((_, __, ctx) =>
    ctx.prisma.project.findMany({
      where: { userId: ctx.user.id },
      include: { actions: true, goal: true, milestone: true, intervals: INTERVAL_DATES_SELECT },
      orderBy: { createdAt: "desc" },
    })
  ),
  project: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.project.findFirst({
      where: { id, userId: ctx.user.id },
      include: { actions: true, goal: true, milestone: true, intervals: INTERVAL_DATES_SELECT },
    })
  ),
  goals: requireAuth((_, args: any, ctx) => {
    const where: any = { userId: ctx.user.id };
    if (args.includeAll === true) {
      return ctx.prisma.goal.findMany({
        where,
        include: {
          milestones: {
            include: {
              projects: PROJECT_WITH_DATES_INCLUDE,
              childGoals: { select: { id: true, title: true, isGoalGroup: true } },
            },
            orderBy: [{ isLast: "asc" }, { order: "asc" }],
          },
          projects: PROJECT_WITH_DATES_INCLUDE,
          childGoals: { select: { id: true, title: true, isGoalGroup: true } },
          intervals: INTERVAL_DATES_SELECT,
        },
        orderBy: { createdAt: "desc" },
      });
    }
    const hasParent = args.parentGoalId !== undefined || args.parentMilestoneId !== undefined;
    if (hasParent) {
      if (args.parentGoalId != null && args.parentMilestoneId != null) throw new Error("Use only one of parentGoalId or parentMilestoneId.");
      if (args.parentGoalId != null) where.parentGoalId = args.parentGoalId;
      else if (args.parentMilestoneId != null) where.parentMilestoneId = args.parentMilestoneId;
      else { where.parentGoalId = null; where.parentMilestoneId = null; }
    } else {
      where.parentGoalId = null;
      where.parentMilestoneId = null;
    }
    return ctx.prisma.goal.findMany({
      where,
      include: {
        milestones: {
          include: {
            projects: PROJECT_WITH_DATES_INCLUDE,
            childGoals: { select: { id: true, title: true, isGoalGroup: true } },
          },
          orderBy: [{ isLast: "asc" }, { order: "asc" }],
        },
        projects: PROJECT_WITH_DATES_INCLUDE,
        childGoals: { select: { id: true, title: true, isGoalGroup: true } },
        intervals: INTERVAL_DATES_SELECT,
      },
      orderBy: { createdAt: "desc" },
    });
  }),
  goal: requireAuth((_, args: any, ctx) =>
    ctx.prisma.goal.findFirst({
      where: { id: args.id, userId: ctx.user.id },
      include: {
        milestones: {
          include: {
            projects: {
              include: {
                actions: { select: { id: true, title: true, tbd: true, done: true } },
                intervals: INTERVAL_DATES_SELECT,
              },
            },
            childGoals: { select: { id: true, title: true, isGoalGroup: true } },
            intervals: { include: { steps: { orderBy: { order: "asc" } } } },
          },
          orderBy: [{ isLast: "asc" }, { order: "asc" }],
        },
        projects: {
          include: {
            actions: { select: { id: true, title: true, tbd: true, done: true } },
            intervals: INTERVAL_DATES_SELECT,
          },
        },
        childGoals: { select: { id: true, title: true, isGoalGroup: true } },
        intervals: { include: { steps: { orderBy: { order: "asc" } } } },
        parentGoal: { select: { id: true, title: true, isGoalGroup: true } },
        parentMilestone: { select: { id: true, title: true, goal: { select: { id: true, title: true } } } },
      },
    })
  ),
  intervals: requireAuth((_, __, ctx) =>
    ctx.prisma.interval.findMany({
      where: { userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
      orderBy: { createdAt: "desc" },
    })
  ),
  interval: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.interval.findFirst({
      where: { id, userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    })
  ),
  routines: requireAuth((_, __, ctx) =>
    ctx.prisma.routine.findMany({
      where: { userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    })
  ),
  routine: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.routine.findFirst({
      where: { id, userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
    })
  ),
  linkedActions: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.action.findMany({
      where: {
        userId: ctx.user.id,
        tbd: new Date(date),
        projectId: { not: null },
      },
      include: { project: true },
    })
  ),
  standaloneActions: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.action.findMany({
      where: {
        userId: ctx.user.id,
        tbd: new Date(date),
        projectId: null,
      },
    })
  ),
  dayState: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.dayState.findUnique({
      where: {
        userId_dateKey: { userId: ctx.user.id, dateKey: date },
      },
    })
  ),
  todayActions: requireAuth((_, { date }: any, ctx) =>
    getTodayActions(ctx.prisma, ctx.user.id, date)
  ),
  preDayStatus: requireAuth((_, { date }: any, ctx) =>
    getPreDayStatus(ctx.prisma, ctx.user.id, date)
  ),
  notDoneActionsForDate: requireAuth((_, { date }: any, ctx) =>
    getNotDoneActionsForDate(ctx.prisma, ctx.user.id, date)
  ),
  me: requireAuth((_, __, ctx) =>
    ctx.prisma.user.findUnique({ where: { id: ctx.user.id } })
  ),
  notes: requireAuth((_, { entityType, entityId }: any, ctx) =>
    ctx.prisma.note.findMany({
      where: { entityType, entityId, userId: ctx.user.id },
      orderBy: { createdAt: "asc" },
    })
  ),
  onboardingProgress: requireAuth((_, __, ctx) =>
    ctx.prisma.onboardingProgress.findUnique({ where: { userId: ctx.user.id } })
  ),
  moduleIntroViewed: requireAuth(async (_, { moduleKey }: any, ctx) => {
    const record = await ctx.prisma.moduleIntroViewed.findUnique({
      where: { userId_moduleKey: { userId: ctx.user.id, moduleKey } },
    });
    return !!record;
  }),

  journals: requireAuth(async (_, { includeArchived }: any, ctx) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
    if (!user) throw new Error("Unauthorized");
    return ctx.prisma.journal.findMany({
      where: {
        accessList: { some: { userEmail: user.email } },
        ...(!includeArchived && { isArchived: false }),
      },
      include: {
        accessList: true,
        goal: true,
        project: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  journal: requireAuth(async (_, { id }: any, ctx) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
    if (!user) throw new Error("Unauthorized");
    const journal = await ctx.prisma.journal.findUnique({
      where: { id },
      include: {
        accessList: true,
        goal: true,
        project: true,
        _count: { select: { entries: true } },
      },
    });
    if (!journal) return null;
    if (!journal.accessList.some((a: any) => a.userEmail === user.email)) return null;
    return journal;
  }),

  journalEntries: requireAuth(async (_, { journalId, includeArchived, dateFrom, dateTo, search }: any, ctx) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
    if (!user) throw new Error("Unauthorized");
    const journal = await ctx.prisma.journal.findUnique({
      where: { id: journalId },
      include: { accessList: true },
    });
    if (!journal || !journal.accessList.some((a: any) => a.userEmail === user.email)) throw new Error("Not found");

    const where: any = { journalId, ...(!includeArchived && { isArchived: false }) };
    if (dateFrom && dateTo) where.createdAt = { gte: new Date(dateFrom), lte: new Date(dateTo) };
    else if (dateFrom) where.createdAt = { gte: new Date(dateFrom) };
    else if (dateTo) where.createdAt = { lte: new Date(dateTo) };
    if (search) where.body = { contains: search };

    return ctx.prisma.journalEntry.findMany({ where, orderBy: { createdAt: "asc" } });
  }),

  apiTokens: requireAuth((_, __, ctx) =>
    ctx.prisma.apiToken.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    })
  ),

  tags: requireAuth((_, __, ctx) =>
    ctx.prisma.tag.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "asc" },
    })
  ),

  timeThemes: requireAuth((_, __, ctx) =>
    ctx.prisma.timeTheme.findMany({
      where: { userId: ctx.user.id },
      include: { tags: true },
      orderBy: { createdAt: "desc" },
    })
  ),

  timeTheme: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.timeTheme.findFirst({
      where: { id, userId: ctx.user.id },
      include: { tags: true },
    })
  ),

  // Soft surfacing (time-themes.md §2): resolved occurrences for one day, reusing
  // intervalOccursOnDate verbatim (build-plan.md §Phase 4) rather than forking it.
  // Only active themes are ever offered — inactive ones never fire, same as an
  // inactive Interval never gathers.
  timeThemesForDate: requireAuth(async (_, { dateKey }: any, ctx) => {
    const themes = await ctx.prisma.timeTheme.findMany({
      where: { userId: ctx.user.id, status: "active" },
      include: { tags: true },
    });
    return themes.filter((t: any) => intervalOccursOnDate(t, dateKey));
  }),

  skillModules: requireAuth(async (_, { skillKey }: any, ctx) => {
    assertEvidence(skillKey);
    return getModules(ctx.prisma, ctx.user.id, ctx.locale);
  }),

  skillProgress: requireAuth(async (_, { skillKey }: any, ctx) => {
    assertEvidence(skillKey);
    return getProgress(ctx.prisma, ctx.user.id, ctx.locale);
  }),

  // Union across every skill tool the user has modules for. `SkillModule`'s
  // fields (moduleKey, title, state, ...) are the same shape Clarity's and
  // Decomposition's modules already carry, so this is a plain merge, not a cast.
  skillDueReviews: requireAuth(async (_, __, ctx) => {
    const [evidenceModules, clarityModules, decompositionModules, verificationModules, delegationModules, monitoringModules] = await Promise.all([
      getModules(ctx.prisma, ctx.user.id, ctx.locale),
      getClarityModules(ctx.prisma, ctx.user.id, ctx.locale),
      getDecompositionModules(ctx.prisma, ctx.user.id, ctx.locale),
      getVerificationModules(ctx.prisma, ctx.user.id, ctx.locale),
      getDelegationModules(ctx.prisma, ctx.user.id, ctx.locale),
      getMonitoringModules(ctx.prisma, ctx.user.id, ctx.locale),
    ]);
    return [...evidenceModules, ...clarityModules, ...decompositionModules, ...verificationModules, ...delegationModules, ...monitoringModules].filter(
      (m: any) => m.state === "due_review"
    );
  }),

  // The AI Training Lab hub. One round trip for all six labs, four Prisma reads
  // for the whole page, and no metric service — the hub shows progress, never
  // performance (07-training-lab-hub.md §5a).
  skillsOverview: requireAuth((_, __, ctx) => getSkillsOverview(ctx.prisma, ctx.user.id, ctx.locale)),

  skillPlan: requireAuth(async (_, { skillKey }: any, ctx) => {
    assertEvidence(skillKey);
    return getPlan(ctx.prisma, ctx.user.id, "evidence");
  }),

  // Skill probes — not gated to evidence-only. Built after Clarity and
  // Decomposition already existed, so unlike the legacy fields above these
  // take every skillKey from day one.
  skillProbe: requireAuth((_, { skillKey, timepoint }: any, ctx) =>
    getSkillProbe(ctx.prisma, ctx.user.id, skillKey, timepoint, ctx.locale)
  ),

  dueSkillProbes: requireAuth((_, __, ctx) => getDueSkillProbes(ctx.prisma, ctx.user.id)),

  skillExport: requireAuth((_, { skillKey }: any, ctx) =>
    exportSkillData(ctx.prisma, ctx.user.id, skillKey, ctx.locale)
  ),

  clarityModules: requireAuth((_, __, ctx) => getClarityModules(ctx.prisma, ctx.user.id, ctx.locale)),

  clarityProgress: requireAuth((_, __, ctx) => getClarityProgress(ctx.prisma, ctx.user.id, ctx.locale)),

  decompositionModules: requireAuth((_, __, ctx) => getDecompositionModules(ctx.prisma, ctx.user.id, ctx.locale)),

  decompositionProgress: requireAuth((_, __, ctx) => getDecompositionProgress(ctx.prisma, ctx.user.id, ctx.locale)),

  verificationModules: requireAuth((_, __, ctx) => getVerificationModules(ctx.prisma, ctx.user.id, ctx.locale)),

  verificationProgress: requireAuth((_, __, ctx) => getVerificationProgress(ctx.prisma, ctx.user.id, ctx.locale)),

  delegationModules: requireAuth((_, __, ctx) => getDelegationModules(ctx.prisma, ctx.user.id, ctx.locale)),

  delegationProgress: requireAuth((_, __, ctx) => getDelegationProgress(ctx.prisma, ctx.user.id, ctx.locale)),

  monitoringModules: requireAuth((_, __, ctx) => getMonitoringModules(ctx.prisma, ctx.user.id, ctx.locale)),

  monitoringProgress: requireAuth((_, __, ctx) => getMonitoringProgress(ctx.prisma, ctx.user.id, ctx.locale)),

  // `ctx.locale` is the language the request arrived in (Accept-Language), which
  // is what the authored content is served in. Not stored per user: see
  // `graphql/requestLocale.ts`.
  feelingsNeedsState: requireAuth((_, __, ctx) =>
    getFeelingsNeedsState(ctx.prisma, ctx.user.id, ctx.locale)
  ),

  feelingsNeedsContent: requireAuth((_, __, ctx) =>
    getContent(ctx.prisma, ctx.user.id, ctx.locale)
  ),

  activeLoopSitting: requireAuth((_, __, ctx) => getActiveSitting(ctx.prisma, ctx.user.id)),

  loopHistory: requireAuth((_, { limit }: any, ctx) =>
    getHistory(ctx.prisma, ctx.user.id, limit ?? undefined)
  ),

  noticingState: requireAuth((_, __, ctx) => getNoticingState(ctx.prisma, ctx.user.id, ctx.locale)),

  noticingContent: requireAuth((_, __, ctx) => getNoticingContent(ctx.prisma, ctx.user.id, ctx.locale)),

  activeNoticingSitting: requireAuth((_, __, ctx) => getActiveNoticingSitting(ctx.prisma, ctx.user.id)),
};
