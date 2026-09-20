import bcrypt from "bcrypt";
import { ensureOwned, requireAuth, signToken, SALT_ROUNDS } from "../auth";
import { runActionGathering } from "../../services/actionGathering";
import { isValidTagColor } from "../../services/tags";
import { generateToken } from "../../services/apiTokens";
import {
  ensureProfile,
  logCheckEvent,
  serveItem,
  submitAttempt,
} from "../../services/skills/evidenceSession";
import {
  lockClarityDiagnosis,
  lockClarityPrediction,
  serveClarityItem,
  startClarityRevision,
  submitClarityAttempt,
} from "../../services/skills/clarity/claritySession";
import {
  lockDecompositionDiagnosis,
  lockDecompositionWhole,
  serveDecompositionItem,
  startDecompositionRevision,
  submitDecompositionAttempt,
} from "../../services/skills/decomposition/decompositionSession";
import {
  exportDecompositionBreakdown,
  startDecompositionRealWork,
  submitDecompositionRealWork,
} from "../../services/skills/decomposition/realWork";
import {
  commitVerificationVerdict,
  loadVerificationElements,
  nameVerificationOracle,
  revealVerificationCheck,
  serveVerificationItem,
  setVerificationLocalization,
  setVerificationRung,
} from "../../services/skills/verification/verificationSession";
import { startVerificationRealWork, submitVerificationRealWork } from "../../services/skills/verification/realWork";
import {
  commitDelegationEstimate,
  commitDelegationRevision,
  commitDelegationSplit,
  commitSequenceRound,
  selectDelegationCue,
  startDelegationItem,
} from "../../services/skills/delegation/delegationSession";
import { startDelegationRealWork, submitDelegationRealWork } from "../../services/skills/delegation/realWork";
import {
  commitMonitoringExplanation,
  commitMonitoringPrediction,
  commitMonitoringRating,
  markMonitoringCheckpoint,
  markMonitoringInfluence,
  selectMonitoringCountermeasure,
  selectMonitoringSteps,
  startMonitoringItem,
  submitMonitoringAnswer,
} from "../../services/skills/monitoring/monitoringSession";
import { startMonitoringSelfAudit, submitMonitoringSelfAudit } from "../../services/skills/monitoring/selfAudit";
import {
  applyPlan,
  clearPlan,
  DEFAULT_SESSIONS_PER_MODULE,
  DEFAULT_SESSIONS_PER_WEEK,
  DEFAULT_TIME_OF_DAY,
} from "../../services/skills/planning";
import { completeSkillProbe, startSkillProbe } from "../../services/skills/probes";
import {
  acknowledgeGraduation,
  addPass,
  finishSitting,
  setBreath,
  startSitting,
  updateEntry,
} from "../../services/feelingsNeeds/session";
import { completeFrame } from "../../services/feelingsNeeds/state";
import {
  addPass as addNoticingPass,
  finishSitting as finishNoticingSitting,
  startSitting as startNoticingSitting,
  updateEntry as updateNoticingEntry,
} from "../../services/noticing/session";

const MAX_ESTIMATED_MINUTES = 24 * 60; // 24 hours

/** Normalize to array of "HH:mm" strings for timeOfDayBlocks. */
function normalizeTimeOfDayBlocks(blocks: string[] | null | undefined): string[] {
  if (blocks == null || blocks.length === 0) return [];
  return blocks.map((s) => String(s).trim().slice(0, 5)).filter((s) => /^\d{2}:\d{2}$/.test(s));
}

function validateEstimatedMinutes(value: number | null | undefined, required: boolean, label: string): number | undefined {
  if (value == null) {
    if (required) throw new Error(`${label} estimatedTimeMinutes is required.`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_ESTIMATED_MINUTES) {
    throw new Error(`${label} estimatedTimeMinutes must be between 0 and ${MAX_ESTIMATED_MINUTES} (24 hours).`);
  }
  return n;
}

const mutations: Record<string, any> = {};

// ---- Actions ----
mutations.addAction = requireAuth(async (_, { title, tbd, projectId, priority, estimatedTimeMinutes, startTimeOfDay }: any, ctx) => {
  // Time Themes: a project action's tags are *initialised* from the project's
  // tags at create — a copy, not a live link (time-themes.md §3.1). Because
  // this action is project-origin (sourceType stays null), setActionTags
  // remains allowed on it afterward.
  let projectTagIds: string[] = [];
  if (projectId) {
    const project = await ctx.prisma.project.findUnique({
      where: { id: projectId },
      include: { tags: { select: { id: true } } },
    });
    ensureOwned(project, ctx);
    projectTagIds = project!.tags.map((t: { id: string }) => t.id);
  }
  const hasDueDate = Boolean(tbd);
  const est = validateEstimatedMinutes(estimatedTimeMinutes, hasDueDate, "Action");
  return ctx.prisma.action.create({
    data: {
      title,
      tbd: tbd ? new Date(tbd) : undefined,
      projectId,
      priority: priority ?? "P",
      estimatedTimeMinutes: est,
      startTimeOfDay: startTimeOfDay ?? undefined,
      userId: ctx.user.id,
      tags: { connect: projectTagIds.map((id) => ({ id })) },
    },
    include: { tags: true },
  });
});
mutations.updateAction = requireAuth(async (_, { id, title, tbd, done, priority, estimatedTimeMinutes, startTimeOfDay, actionFate, projectId }: any, ctx) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  if (projectId != null) {
    const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
    ensureOwned(project, ctx);
  }
  const effectiveTbd = tbd !== undefined ? (tbd ? new Date(tbd) : null) : existing!.tbd;
  const hasDueDate = Boolean(effectiveTbd);
  const est =
    estimatedTimeMinutes !== undefined
      ? validateEstimatedMinutes(estimatedTimeMinutes, hasDueDate, "Action")
      : undefined;
  return ctx.prisma.action.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(tbd !== undefined && { tbd: tbd ? new Date(tbd) : null }),
      ...(done !== undefined && { done }),
      ...(priority !== undefined && { priority }),
      ...(est !== undefined && { estimatedTimeMinutes: est }),
      ...(startTimeOfDay !== undefined && { startTimeOfDay: startTimeOfDay || null }),
      ...(actionFate !== undefined && { actionFate: actionFate ?? null }),
      ...(projectId !== undefined && { projectId: projectId ?? null }),
    },
  });
});
mutations.deleteAction = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.delete({ where: { id } });
});

// ---- Projects ----
mutations.addProject = requireAuth(
  async (_, { title, dod, type, actions, goalId, milestoneId, priority }: any, ctx) => {
    if (goalId != null && milestoneId != null) {
      throw new Error("Cannot set both goalId and milestoneId; use one or the other.");
    }
    if (goalId) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    return ctx.prisma.project.create({
      data: {
        title,
        dod,
        type: type || "individual",
        goalId: goalId ?? undefined,
        milestoneId: milestoneId ?? undefined,
        priority: priority ?? "P",
        userId: ctx.user.id,
        actions: {
          create:
            actions?.map((a: any) => {
              const hasDueDate = Boolean(a.tbd);
              const est = validateEstimatedMinutes(a.estimatedTimeMinutes, hasDueDate, "Action");
              return {
                title: a.title,
                tbd: a.tbd ? new Date(a.tbd) : undefined,
                priority: a.priority ?? "P",
                estimatedTimeMinutes: est,
                userId: ctx.user.id,
              };
            }) ?? [],
        },
      },
      include: { actions: true },
    });
  }
);
mutations.updateProject = requireAuth(
  async (_, { id, title, dod, type, goalId, milestoneId, priority }: any, ctx) => {
    if (goalId !== undefined && milestoneId !== undefined && goalId != null && milestoneId != null) {
      throw new Error("Cannot set both goalId and milestoneId; use one or the other.");
    }
    const existing = await ctx.prisma.project.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    if (goalId !== undefined && goalId != null) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId !== undefined && milestoneId != null) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    return ctx.prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(dod !== undefined && { dod }),
        ...(type !== undefined && { type }),
        ...(goalId !== undefined && { goalId }),
        ...(milestoneId !== undefined && { milestoneId }),
        ...(priority !== undefined && { priority }),
      },
      include: { actions: true },
    });
  }
);
mutations.deleteProject = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.project.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.project.delete({ where: { id } });
});

// ---- Goals ----
mutations.addGoal = requireAuth(async (_, args: any, ctx) => {
  if (args.parentGoalId != null && args.parentMilestoneId != null) {
    throw new Error("A goal cannot have both a parent goal and a parent milestone.");
  }
  if (args.parentGoalId != null) {
    const parent = await ctx.prisma.goal.findUnique({ where: { id: args.parentGoalId } });
    ensureOwned(parent, ctx);
  }
  if (args.parentMilestoneId != null) {
    const milestone = await ctx.prisma.milestone.findUnique({
      where: { id: args.parentMilestoneId },
      include: { goal: true },
    });
    ensureOwned(milestone?.goal ?? null, ctx);
  }
  return ctx.prisma.goal.create({
    data: {
      title: args.title,
      dod: args.dod,
      isGoalGroup: args.isGoalGroup === true,
      parentGoalId: args.parentGoalId ?? undefined,
      parentMilestoneId: args.parentMilestoneId ?? undefined,
      userId: ctx.user.id,
      ...(args.dodClarityStatus !== undefined && { dodClarityStatus: args.dodClarityStatus }),
      ...(args.dodFlaggedDimensions !== undefined && {
        dodFlaggedDimensions: JSON.stringify(args.dodFlaggedDimensions),
      }),
    },
  });
});
mutations.updateGoal = requireAuth(async (_, args: any, ctx) => {
  const existing = await ctx.prisma.goal.findUnique({ where: { id: args.id } });
  ensureOwned(existing, ctx);
  if (args.parentGoalId !== undefined && args.parentMilestoneId !== undefined && args.parentGoalId != null && args.parentMilestoneId != null) {
    throw new Error("A goal cannot have both a parent goal and a parent milestone.");
  }
  if (args.parentGoalId != null) {
    const parent = await ctx.prisma.goal.findUnique({ where: { id: args.parentGoalId } });
    ensureOwned(parent, ctx);
  }
  if (args.parentMilestoneId != null) {
    const milestone = await ctx.prisma.milestone.findUnique({
      where: { id: args.parentMilestoneId },
      include: { goal: true },
    });
    ensureOwned(milestone?.goal ?? null, ctx);
  }
  const data: any = {
    ...(args.title !== undefined && { title: args.title }),
    ...(args.dod !== undefined && { dod: args.dod }),
    ...(args.isGoalGroup !== undefined && { isGoalGroup: args.isGoalGroup }),
    ...(args.startDate !== undefined && { startDate: args.startDate ? new Date(args.startDate) : null }),
    ...(args.endDate !== undefined && { endDate: args.endDate ? new Date(args.endDate) : null }),
    ...(args.dodClarityStatus !== undefined && { dodClarityStatus: args.dodClarityStatus }),
    ...(args.dodFlaggedDimensions !== undefined && {
      dodFlaggedDimensions: JSON.stringify(args.dodFlaggedDimensions),
    }),
  };
  if (args.parentGoalId !== undefined) {
    data.parentGoalId = args.parentGoalId ?? null;
    data.parentMilestoneId = null;
  }
  if (args.parentMilestoneId !== undefined) {
    data.parentMilestoneId = args.parentMilestoneId ?? null;
    data.parentGoalId = null;
  }
  return ctx.prisma.goal.update({
    where: { id: args.id },
    data,
  });
});
mutations.saveDodClarity = requireAuth(async (_, args: any, ctx) => {
  const existing = await ctx.prisma.goal.findUnique({ where: { id: args.id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.goal.update({
    where: { id: args.id },
    data: {
      ...(args.dod !== undefined && { dod: args.dod }),
      dodClarityStatus: args.dodClarityStatus,
      dodFlaggedDimensions: JSON.stringify(args.dodFlaggedDimensions),
    },
  });
});
mutations.deleteGoal = requireAuth(async (_, args: any, ctx) => {
  const existing = await ctx.prisma.goal.findUnique({ where: { id: args.id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.goal.delete({ where: { id: args.id } });
});

// ---- Milestones ----
mutations.addMilestone = requireAuth(async (_, { goalId, title, doa, predictionDate, isLast: wantLast }: any, ctx) => {
  const goal = await ctx.prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      milestones: { orderBy: [{ isLast: "asc" }, { order: "asc" }] },
    },
  });
  ensureOwned(goal, ctx);
  const milestones = goal!.milestones;
  if (wantLast === true) {
    await ctx.prisma.milestone.updateMany({
      where: { goalId },
      data: { isLast: false },
    });
  }
  const lastMilestone = milestones.find((m: any) => m.isLast);
  let newOrder: number;
  if (lastMilestone && !wantLast) {
    newOrder = lastMilestone.order;
    await ctx.prisma.milestone.updateMany({
      where: { goalId, order: { gte: lastMilestone.order } },
      data: { order: { increment: 1 } },
    });
  } else {
    const maxOrder = milestones.length
      ? Math.max(...milestones.map((m: any) => m.order))
      : -1;
    newOrder = maxOrder + 1;
  }
  return ctx.prisma.milestone.create({
    data: {
      goalId,
      title,
      doa: doa ?? undefined,
      predictionDate: predictionDate ? new Date(predictionDate) : undefined,
      order: newOrder,
      isLast: wantLast === true,
    },
  });
});
mutations.updateMilestone = requireAuth(async (_, { id, title, doa, predictionDate, order, isLast, goalId: newGoalId }: any, ctx) => {
  const existing = await ctx.prisma.milestone.findUnique({
    where: { id },
    include: { goal: true },
  });
  ensureOwned(existing?.goal ?? null, ctx);
  if (newGoalId !== undefined && newGoalId != null) {
    const newGoal = await ctx.prisma.goal.findUnique({ where: { id: newGoalId } });
    ensureOwned(newGoal, ctx);
    const newGoalMilestones = await ctx.prisma.milestone.findMany({
      where: { goalId: newGoalId },
      orderBy: [{ isLast: "asc" }, { order: "asc" }],
    });
    const maxOrder = newGoalMilestones.length ? Math.max(...newGoalMilestones.map((m: any) => m.order)) : -1;
    await ctx.prisma.milestone.update({
      where: { id },
      data: { goalId: newGoalId, order: maxOrder + 1, isLast: false },
    });
    return ctx.prisma.milestone.findUniqueOrThrow({ where: { id } });
  }
  if (isLast === true) {
    await ctx.prisma.milestone.updateMany({
      where: { goalId: existing!.goalId, id: { not: id } },
      data: { isLast: false },
    });
  }
  return ctx.prisma.milestone.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(doa !== undefined && { doa }),
      ...(predictionDate !== undefined && {
        predictionDate: predictionDate ? new Date(predictionDate) : null,
      }),
      ...(order !== undefined && { order }),
      ...(isLast !== undefined && { isLast }),
    },
  });
});
mutations.deleteMilestone = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.milestone.findUnique({
    where: { id },
    include: { goal: true },
  });
  ensureOwned(existing?.goal ?? null, ctx);
  return ctx.prisma.milestone.delete({ where: { id } });
});

// ---- Intervals ----
function atMostOneScope(goalId: string | null, milestoneId: string | null, projectId: string | null) {
  const set = [goalId, milestoneId, projectId].filter((x) => x != null);
  if (set.length > 1) {
    throw new Error("Interval can be linked to at most one of goal, milestone, or project.");
  }
}

mutations.addInterval = requireAuth(
  async (
    _,
    {
      title,
      estimatedTimeMinutes,
      status,
      endTime,
      repeatValue,
      repeatUnit,
      customRepeatDates,
      customRepeatRule,
      predictedToDoTime,
      steps,
      goalId,
      milestoneId,
      projectId,
    }: any,
    ctx
  ) => {
    const est = validateEstimatedMinutes(estimatedTimeMinutes, true, "Interval");
    atMostOneScope(goalId ?? null, milestoneId ?? null, projectId ?? null);
    const toDoTime = predictedToDoTime != null ? String(predictedToDoTime).trim().slice(0, 5) : null;
    if (toDoTime !== null && toDoTime !== "" && !/^\d{2}:\d{2}$/.test(toDoTime)) {
      throw new Error("predictedToDoTime must be HH:mm");
    }
    if (goalId) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    if (projectId) {
      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      ensureOwned(project, ctx);
    }
    return ctx.prisma.interval.create({
      data: {
        title,
        estimatedTimeMinutes: est!,
        status: status ?? "active",
        endTime: endTime ? new Date(endTime) : undefined,
        repeatValue: repeatValue ?? 1,
        repeatUnit: repeatUnit ?? undefined,
        customRepeatDates:
          customRepeatDates != null && customRepeatDates.length > 0
            ? JSON.stringify(customRepeatDates)
            : undefined,
        customRepeatRule: customRepeatRule ?? undefined,
        predictedToDoTime: toDoTime && /^\d{2}:\d{2}$/.test(toDoTime) ? toDoTime : undefined,
        goalId: goalId ?? undefined,
        milestoneId: milestoneId ?? undefined,
        projectId: projectId ?? undefined,
        userId: ctx.user.id,
        steps: {
          create:
            steps?.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })) ?? [],
        },
      },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    });
  }
);

mutations.updateInterval = requireAuth(
  async (
    _,
    {
      id,
      title,
      estimatedTimeMinutes,
      status,
      endTime,
      repeatValue,
      repeatUnit,
      customRepeatDates,
      customRepeatRule,
      predictedToDoTime,
      steps,
      goalId,
      milestoneId,
      projectId,
    }: any,
    ctx
  ) => {
    const existing = await ctx.prisma.interval.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const toDoTime =
      predictedToDoTime !== undefined
        ? (predictedToDoTime != null ? String(predictedToDoTime).trim().slice(0, 5) : null)
        : undefined;
    if (toDoTime !== undefined && toDoTime !== null && toDoTime !== "" && !/^\d{2}:\d{2}$/.test(toDoTime)) {
      throw new Error("predictedToDoTime must be HH:mm");
    }
    const est =
      estimatedTimeMinutes !== undefined
        ? validateEstimatedMinutes(estimatedTimeMinutes, false, "Interval")
        : undefined;
    atMostOneScope(
      goalId !== undefined ? goalId : existing!.goalId,
      milestoneId !== undefined ? milestoneId : existing!.milestoneId,
      projectId !== undefined ? projectId : existing!.projectId
    );
    if (goalId !== undefined && goalId != null) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId !== undefined && milestoneId != null) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    if (projectId !== undefined && projectId != null) {
      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      ensureOwned(project, ctx);
    }
    const stepsPayload =
      steps !== undefined
        ? {
            deleteMany: {},
            create: steps.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })),
          }
        : undefined;
    return ctx.prisma.interval.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(est !== undefined && { estimatedTimeMinutes: est }),
        ...(status !== undefined && { status }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(repeatValue !== undefined && { repeatValue }),
        ...(repeatUnit !== undefined && { repeatUnit }),
        ...(customRepeatDates !== undefined && {
          customRepeatDates:
            customRepeatDates != null && customRepeatDates.length > 0
              ? JSON.stringify(customRepeatDates)
              : null,
        }),
        ...(customRepeatRule !== undefined && { customRepeatRule: customRepeatRule ?? null }),
        ...(toDoTime !== undefined && { predictedToDoTime: toDoTime }),
        ...(stepsPayload && { steps: stepsPayload }),
        ...(goalId !== undefined && { goalId: goalId ?? null }),
        ...(milestoneId !== undefined && { milestoneId: milestoneId ?? null }),
        ...(projectId !== undefined && { projectId: projectId ?? null }),
      },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    });
  }
);

mutations.deleteInterval = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.interval.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.interval.delete({
    where: { id },
    include: { steps: true, goal: true, milestone: true, project: true },
  });
});

// ---- Routines (no link to goal/milestone/project) ----
mutations.addRoutine = requireAuth(
  async (_, { title, estimatedTimeMinutes, status, endTime, timeOfDayBlocks, timerDurationMinutes, steps }: any, ctx) => {
    const est = validateEstimatedMinutes(estimatedTimeMinutes, true, "Routine");
    const blocks = normalizeTimeOfDayBlocks(timeOfDayBlocks);
    return ctx.prisma.routine.create({
      data: {
        title,
        estimatedTimeMinutes: est!,
        status: status ?? "active",
        endTime: endTime ? new Date(endTime) : undefined,
        timeOfDayBlocks: blocks.length > 0 ? JSON.stringify(blocks) : undefined,
        timerDurationMinutes: timerDurationMinutes ?? undefined,
        userId: ctx.user.id,
        steps: {
          create:
            steps?.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })) ?? [],
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }
);

mutations.updateRoutine = requireAuth(
  async (_, { id, title, estimatedTimeMinutes, status, endTime, timeOfDayBlocks, timerDurationMinutes, steps }: any, ctx) => {
    const existing = await ctx.prisma.routine.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const est =
      estimatedTimeMinutes !== undefined
        ? validateEstimatedMinutes(estimatedTimeMinutes, false, "Routine")
        : undefined;
    const blocks = timeOfDayBlocks !== undefined ? normalizeTimeOfDayBlocks(timeOfDayBlocks) : undefined;
    const stepsPayload =
      steps !== undefined
        ? {
            deleteMany: {},
            create: steps.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })),
          }
        : undefined;
    return ctx.prisma.routine.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(est !== undefined && { estimatedTimeMinutes: est }),
        ...(status !== undefined && { status }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(blocks !== undefined && { timeOfDayBlocks: blocks.length > 0 ? JSON.stringify(blocks) : null }),
        ...(timerDurationMinutes !== undefined && { timerDurationMinutes }),
        ...(stepsPayload && { steps: stepsPayload }),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }
);

mutations.deleteRoutine = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.routine.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.routine.delete({
    where: { id },
    include: { steps: true },
  });
});

// ---- Tags (Time Themes: shared vocabulary across Project/Interval/Routine/Action/TimeTheme) ----

/** Every tag id must exist and belong to the caller — foreign or unknown ids are rejected as "Not found". */
async function ensureOwnedTagIds(prisma: any, ctx: any, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const owned = await prisma.tag.count({ where: { id: { in: tagIds }, userId: ctx.user.id } });
  if (owned !== new Set(tagIds).size) {
    throw new Error("Not found");
  }
}

mutations.createTag = requireAuth(async (_, { name, color }: any, ctx) => {
  if (!isValidTagColor(color)) {
    throw new Error(`Unknown tag color "${color}".`);
  }
  const trimmed = String(name).trim();
  if (!trimmed) throw new Error("Tag name is required.");
  const existing = await ctx.prisma.tag.findUnique({
    where: { userId_name: { userId: ctx.user.id, name: trimmed } },
  });
  if (existing) throw new Error(`A tag named "${trimmed}" already exists.`);
  return ctx.prisma.tag.create({
    data: { name: trimmed, color, userId: ctx.user.id },
  });
});

mutations.renameTag = requireAuth(async (_, { id, name }: any, ctx) => {
  const existing = await ctx.prisma.tag.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  const trimmed = String(name).trim();
  if (!trimmed) throw new Error("Tag name is required.");
  const collision = await ctx.prisma.tag.findUnique({
    where: { userId_name: { userId: ctx.user.id, name: trimmed } },
  });
  if (collision && collision.id !== id) {
    throw new Error(`A tag named "${trimmed}" already exists.`);
  }
  return ctx.prisma.tag.update({ where: { id }, data: { name: trimmed } });
});

mutations.recolorTag = requireAuth(async (_, { id, color }: any, ctx) => {
  const existing = await ctx.prisma.tag.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  if (!isValidTagColor(color)) {
    throw new Error(`Unknown tag color "${color}".`);
  }
  return ctx.prisma.tag.update({ where: { id }, data: { color } });
});

mutations.deleteTag = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.tag.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  // Implicit m2m: deleting the Tag row drops its join rows automatically —
  // tagged entities simply lose the tag, no cascade to the entities themselves.
  await ctx.prisma.tag.delete({ where: { id } });
  return true;
});

mutations.setProjectTags = requireAuth(async (_, { projectId, tagIds }: any, ctx) => {
  const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
  ensureOwned(project, ctx);
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.project.update({
    where: { id: projectId },
    data: { tags: { set: tagIds.map((id: string) => ({ id })) } },
    include: { actions: true, goal: true, milestone: true, intervals: true, tags: true },
  });
});

mutations.setIntervalTags = requireAuth(async (_, { intervalId, tagIds }: any, ctx) => {
  const interval = await ctx.prisma.interval.findUnique({ where: { id: intervalId } });
  ensureOwned(interval, ctx);
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.interval.update({
    where: { id: intervalId },
    data: { tags: { set: tagIds.map((id: string) => ({ id })) } },
    include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true, tags: true },
  });
});

mutations.setRoutineTags = requireAuth(async (_, { routineId, tagIds }: any, ctx) => {
  const routine = await ctx.prisma.routine.findUnique({ where: { id: routineId } });
  ensureOwned(routine, ctx);
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.routine.update({
    where: { id: routineId },
    data: { tags: { set: tagIds.map((id: string) => ({ id })) } },
    include: { steps: { orderBy: { order: "asc" } }, tags: true },
  });
});

mutations.setActionTags = requireAuth(async (_, { actionId, tagIds }: any, ctx) => {
  const action = await ctx.prisma.action.findUnique({ where: { id: actionId } });
  ensureOwned(action, ctx);
  if (action!.sourceType != null) {
    throw new Error("This action's tags come from its interval or routine and can't be edited here.");
  }
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.action.update({
    where: { id: actionId },
    data: { tags: { set: tagIds.map((id: string) => ({ id })) } },
    include: { tags: true },
  });
});

// ---- Time Themes ----

/** "HH:mm", 00:00-23:59. */
function validateTimeOfDay(value: string, label: string): string {
  const trimmed = String(value).trim().slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    throw new Error(`${label} must be HH:mm.`);
  }
  return trimmed;
}

function buildTimeThemeData(input: any) {
  const startTimeOfDay = validateTimeOfDay(input.startTimeOfDay, "startTimeOfDay");
  const endTimeOfDay = validateTimeOfDay(input.endTimeOfDay, "endTimeOfDay");
  if (endTimeOfDay <= startTimeOfDay) {
    throw new Error("endTimeOfDay must be after startTimeOfDay.");
  }
  const title = String(input.title).trim();
  if (!title) throw new Error("Title is required.");
  return {
    title,
    startTimeOfDay,
    endTimeOfDay,
    repeatValue: input.repeatValue ?? 1,
    repeatUnit: input.repeatUnit ?? undefined,
    customRepeatDates:
      input.customRepeatDates != null && input.customRepeatDates.length > 0
        ? JSON.stringify(input.customRepeatDates)
        : undefined,
    customRepeatRule: input.customRepeatRule ?? undefined,
    endTime: input.endTime ? new Date(input.endTime) : undefined,
  };
}

mutations.createTimeTheme = requireAuth(async (_, { input }: any, ctx) => {
  const data = buildTimeThemeData(input);
  const tagIds: string[] = input.tagIds ?? [];
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.timeTheme.create({
    data: {
      ...data,
      userId: ctx.user.id,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
    include: { tags: true },
  });
});

mutations.updateTimeTheme = requireAuth(async (_, { id, input }: any, ctx) => {
  const existing = await ctx.prisma.timeTheme.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  // TimeThemeInput is a full-replace shape (the editor resubmits the whole
  // form on save, like createTimeTheme), not a sparse patch — so a field left
  // out of the input clears to its default here exactly as it would on
  // create, rather than being left alone.
  const data = buildTimeThemeData(input);
  const tagIds: string[] = input.tagIds ?? [];
  await ensureOwnedTagIds(ctx.prisma, ctx, tagIds);
  return ctx.prisma.timeTheme.update({
    where: { id },
    data: {
      ...data,
      repeatUnit: input.repeatUnit ?? null,
      customRepeatDates: data.customRepeatDates ?? null,
      customRepeatRule: data.customRepeatRule ?? null,
      endTime: data.endTime ?? null,
      tags: { set: tagIds.map((tid) => ({ id: tid })) },
    },
    include: { tags: true },
  });
});

mutations.setTimeThemeStatus = requireAuth(async (_, { id, status }: any, ctx) => {
  const existing = await ctx.prisma.timeTheme.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.timeTheme.update({ where: { id }, data: { status }, include: { tags: true } });
});

mutations.deleteTimeTheme = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.timeTheme.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  // Soft by design: deleting a theme has zero effect on actions — they were
  // never bound to it (time-themes.md §8).
  await ctx.prisma.timeTheme.delete({ where: { id } });
  return true;
});

mutations.toggleAction = requireAuth(async (_, { id }: any, ctx) => {
  const current = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(current, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { done: !current!.done },
  });
});

// ---- Auth ----
mutations.register = async (_: any, { email, password }: any, ctx: any) => {
  const existing = await ctx.prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await ctx.prisma.user.create({
    data: { email, password: hashed },
  });
  const token = signToken(user);
  return { token, user };
};
mutations.login = async (_: any, { email, password }: any, ctx: any) => {
  const user = await ctx.prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Incorrect password");
  const token = signToken(user);
  return { token, user };
};

mutations.runActionGathering = requireAuth(async (_: any, { todayDate }: { todayDate: string }, ctx: any) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    throw new Error("todayDate must be YYYY-MM-DD");
  }
  return runActionGathering(ctx.prisma, ctx.user.id, {
    todayDateKey: todayDate,
    skipCompletedDates: true,
  });
});

// ---- Pre-day / After-day ----
function validateDateKey(dateKey: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

mutations.setActionStartTime = requireAuth(async (_: any, { id, startTimeOfDay }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  const trimmed = String(startTimeOfDay).trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(trimmed)) throw new Error("startTimeOfDay must be HH:mm");
  return ctx.prisma.action.update({
    where: { id },
    data: { startTimeOfDay: trimmed },
  });
});

mutations.postponeAction = requireAuth(async (_: any, { id, newDate }: any, ctx: any) => {
  validateDateKey(newDate, "newDate");
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  const forDate = new Date(newDate + "T00:00:00.000Z");
  return ctx.prisma.action.update({
    where: { id },
    data: {
      ...(existing!.isGathered ? { forDate } : { tbd: forDate }),
      actionFate: null,
      // Clear assigned time so gathered actions re-enter the time-assignment flow on the new date
      ...(existing!.isGathered ? { startTimeOfDay: null } : {}),
    },
  });
});

mutations.outsourceAction = requireAuth(
  async (
    _: any,
    {
      id,
      doOutsourcingTitle,
      doOutsourcingDate,
      ensureDoneTitle,
      ensureDoneDate,
    }: any,
    ctx: any
  ) => {
    validateDateKey(doOutsourcingDate, "doOutsourcingDate");
    validateDateKey(ensureDoneDate, "ensureDoneDate");
    const existing = await ctx.prisma.action.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const userId = ctx.user.id;
    await ctx.prisma.action.createMany({
      data: [
        {
          userId,
          title: doOutsourcingTitle,
          tbd: new Date(doOutsourcingDate + "T00:00:00.000Z"),
          priority: "P",
        },
        {
          userId,
          title: ensureDoneTitle,
          tbd: new Date(ensureDoneDate + "T00:00:00.000Z"),
          priority: "P",
        },
      ],
    });
    return ctx.prisma.action.update({
      where: { id },
      data: { actionFate: "OutsourceWoo" },
    });
  }
);

mutations.setActionNotImportant = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "Backlog" },
  });
});

mutations.setActionIgnore = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "BucketList" },
  });
});

mutations.setActionPassedArchived = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "PassedArchived" },
  });
});

mutations.completeAfterDay = requireAuth(async (_: any, { date }: any, ctx: any) => {
  validateDateKey(date, "date");
  return ctx.prisma.dayState.upsert({
    where: { userId_dateKey: { userId: ctx.user.id, dateKey: date } },
    create: {
      userId: ctx.user.id,
      dateKey: date,
      afterDayCompletedAt: new Date(),
    },
    update: { afterDayCompletedAt: new Date() },
  });
});

mutations.completePreDay = requireAuth(async (_: any, { date }: any, ctx: any) => {
  validateDateKey(date, "date");
  return ctx.prisma.dayState.upsert({
    where: { userId_dateKey: { userId: ctx.user.id, dateKey: date } },
    create: {
      userId: ctx.user.id,
      dateKey: date,
      preDayCompletedAt: new Date(),
    },
    update: { preDayCompletedAt: new Date() },
  });
});

// ---- Notes ----
mutations.addNote = requireAuth(async (_, { entityType, entityId, body }: any, ctx) => {
  return ctx.prisma.note.create({
    data: { entityType, entityId, body: body.trim(), userId: ctx.user.id },
  });
});

mutations.updateNote = requireAuth(async (_, { id, body }: any, ctx) => {
  const existing = await ctx.prisma.note.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.note.update({ where: { id }, data: { body: body.trim() } });
});

mutations.deleteNote = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.note.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.note.delete({ where: { id } });
});

// ---- Onboarding ----
mutations.markSlideViewed = requireAuth(async (_, { slideIndex }: any, ctx) => {
  const isLast = slideIndex >= 6;
  return ctx.prisma.onboardingProgress.upsert({
    where: { userId: ctx.user.id },
    create: {
      userId: ctx.user.id,
      lastSlideViewed: slideIndex,
      completedAt: isLast ? new Date() : null,
    },
    update: {
      lastSlideViewed: slideIndex,
      ...(isLast && { completedAt: new Date() }),
    },
  });
});

mutations.markModuleIntroViewed = requireAuth(async (_, { moduleKey }: any, ctx) => {
  await ctx.prisma.moduleIntroViewed.upsert({
    where: { userId_moduleKey: { userId: ctx.user.id, moduleKey } },
    create: { userId: ctx.user.id, moduleKey },
    update: {},
  });
  return true;
});

// ---- Journals ----
const JOURNAL_INCLUDE = {
  accessList: true,
  goal: true,
  project: true,
  _count: { select: { entries: true } },
} as const;

async function getJournalWithAccess(journalId: string, ctx: any): Promise<{ journal: any; userEmail: string }> {
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
  if (!user) throw new Error("Unauthorized");
  const journal = await ctx.prisma.journal.findUnique({
    where: { id: journalId },
    include: { accessList: true },
  });
  if (!journal) throw new Error("Not found");
  if (!journal.accessList.some((a: any) => a.userEmail === user.email)) throw new Error("Not found");
  return { journal, userEmail: user.email };
}

mutations.createJournal = requireAuth(async (_, { title, description, linkedGoalId, linkedProjectId }: any, ctx) => {
  if (linkedGoalId && linkedProjectId) throw new Error("Cannot link to both a goal and a project.");
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
  if (!user) throw new Error("Unauthorized");
  const existingDefault = await ctx.prisma.journal.findFirst({ where: { defaultForUserId: ctx.user.id } });
  return ctx.prisma.journal.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? undefined,
      linkedGoalId: linkedGoalId ?? undefined,
      linkedProjectId: linkedProjectId ?? undefined,
      ...(!existingDefault && { defaultForUserId: ctx.user.id }),
      accessList: { create: [{ userEmail: user.email }] },
    },
    include: JOURNAL_INCLUDE,
  });
});

mutations.updateJournal = requireAuth(async (_, { id, title, description, linkedGoalId, linkedProjectId }: any, ctx) => {
  await getJournalWithAccess(id, ctx);
  if (linkedGoalId && linkedProjectId) throw new Error("Cannot link to both a goal and a project.");
  return ctx.prisma.journal.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() ?? null }),
      ...(linkedGoalId !== undefined && { linkedGoalId: linkedGoalId ?? null }),
      ...(linkedProjectId !== undefined && { linkedProjectId: linkedProjectId ?? null }),
    },
    include: JOURNAL_INCLUDE,
  });
});

mutations.archiveJournal = requireAuth(async (_, { id }: any, ctx) => {
  await getJournalWithAccess(id, ctx);
  return ctx.prisma.journal.update({
    where: { id },
    data: { isArchived: true },
    include: JOURNAL_INCLUDE,
  });
});

mutations.deleteJournal = requireAuth(async (_, { id }: any, ctx) => {
  const { journal } = await getJournalWithAccess(id, ctx);
  if (!journal.isArchived) throw new Error("Journal must be archived before it can be deleted.");
  return ctx.prisma.journal.delete({ where: { id } });
});

mutations.addJournalAccess = requireAuth(async (_, { journalId, email }: any, ctx) => {
  const { journal } = await getJournalWithAccess(journalId, ctx);
  const normalizedEmail = email.toLowerCase().trim();
  if (journal.accessList.some((a: any) => a.userEmail === normalizedEmail)) {
    return ctx.prisma.journal.findUnique({ where: { id: journalId }, include: JOURNAL_INCLUDE });
  }
  const targetUser = await ctx.prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, discoverableByEmail: true },
  });
  if (!targetUser || !targetUser.discoverableByEmail) {
    throw new Error("No user found with that email address.");
  }
  return ctx.prisma.journal.update({
    where: { id: journalId },
    data: { accessList: { create: { userEmail: normalizedEmail } } },
    include: JOURNAL_INCLUDE,
  });
});

mutations.removeJournalAccess = requireAuth(async (_, { journalId, email }: any, ctx) => {
  const { journal } = await getJournalWithAccess(journalId, ctx);
  if (journal.accessList.length <= 1) throw new Error("Cannot remove the last member.");
  const record = journal.accessList.find((a: any) => a.userEmail === email);
  if (!record) throw new Error("Email not in access list.");
  await ctx.prisma.journalAccess.delete({ where: { id: record.id } });
  return ctx.prisma.journal.findUnique({ where: { id: journalId }, include: JOURNAL_INCLUDE });
});

mutations.setDefaultJournal = requireAuth(async (_, { journalId }: any, ctx) => {
  await getJournalWithAccess(journalId, ctx);
  await ctx.prisma.journal.updateMany({
    where: { defaultForUserId: ctx.user.id },
    data: { defaultForUserId: null },
  });
  return ctx.prisma.journal.update({
    where: { id: journalId },
    data: { defaultForUserId: ctx.user.id },
    include: JOURNAL_INCLUDE,
  });
});

mutations.createEntry = requireAuth(async (_, { journalId, body }: any, ctx) => {
  await getJournalWithAccess(journalId, ctx);
  return ctx.prisma.journalEntry.create({ data: { journalId, body: body.trim() } });
});

mutations.updateEntry = requireAuth(async (_, { id, body, overrideTimestamp }: any, ctx) => {
  const entry = await ctx.prisma.journalEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Not found");
  await getJournalWithAccess(entry.journalId, ctx);
  return ctx.prisma.journalEntry.update({
    where: { id },
    data: {
      body: body.trim(),
      ...(overrideTimestamp === true && { createdAt: new Date(), timestampOverridden: true }),
    },
  });
});

mutations.archiveEntry = requireAuth(async (_, { id }: any, ctx) => {
  const entry = await ctx.prisma.journalEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Not found");
  await getJournalWithAccess(entry.journalId, ctx);
  return ctx.prisma.journalEntry.update({ where: { id }, data: { isArchived: true } });
});

mutations.addQuickEntry = requireAuth(async (_, { body, journalId }: any, ctx) => {
  let targetId = journalId;
  if (!targetId) {
    const def = await ctx.prisma.journal.findFirst({ where: { defaultForUserId: ctx.user.id } });
    if (!def) throw new Error("No default journal found.");
    targetId = def.id;
  }
  await getJournalWithAccess(targetId, ctx);
  return ctx.prisma.journalEntry.create({ data: { journalId: targetId, body: body.trim() } });
});

mutations.updateDiscoverability = requireAuth(async (_, { discoverableByEmail }: any, ctx) => {
  await ctx.prisma.user.update({ where: { id: ctx.user.id }, data: { discoverableByEmail } });
  return true;
});

// ---- API tokens ----

const MAX_TOKEN_NAME_LENGTH = 60;

/**
 * A token must never be able to mint or revoke another token: that would turn a
 * single leaked read token into permanent, self-renewing account access. Token
 * management stays behind a real sign-in.
 */
function requireSession(ctx: any) {
  if (ctx.auth?.kind === "apiToken") {
    throw new Error("API tokens cannot manage API tokens. Sign in to the app to do this.");
  }
}

mutations.createApiToken = requireAuth(async (_, { name, scope, expiresInDays }: any, ctx) => {
  requireSession(ctx);

  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("name is required");
  if (trimmed.length > MAX_TOKEN_NAME_LENGTH) {
    throw new Error(`name must be ${MAX_TOKEN_NAME_LENGTH} characters or fewer`);
  }
  if (scope !== "read" && scope !== "write") throw new Error("scope must be read or write");

  let expiresAt: Date | null = null;
  if (expiresInDays != null) {
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650) {
      throw new Error("expiresInDays must be between 1 and 3650");
    }
    expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  }

  const { token, tokenHash, prefix } = generateToken();
  const apiToken = await ctx.prisma.apiToken.create({
    data: { name: trimmed, tokenHash, prefix, scope, expiresAt, userId: ctx.user.id },
  });

  // The only time the plaintext exists outside the caller's hands.
  return { apiToken, token };
});

mutations.revokeApiToken = requireAuth(async (_, { id }: any, ctx) => {
  requireSession(ctx);
  const existing = await ctx.prisma.apiToken.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  if (existing!.revokedAt != null) return existing;
  return ctx.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
});

// ── Skill tools ─────────────────────────────────────────────────────────────

function assertEvidenceSkill(skillKey: string) {
  if (skillKey !== "evidence") {
    throw new Error(`Skill "${skillKey}" is not built yet. Evidence Lab ships first — see 06-specs §14.`);
  }
}

mutations.startSkillItem = requireAuth(async (_, { skillKey, mode, moduleKey, probeId }: any, ctx) => {
  assertEvidenceSkill(skillKey);
  return serveItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null);
});

mutations.logSkillCheckEvent = requireAuth(async (_, { attemptId, kind, payload }: any, ctx) =>
  logCheckEvent(ctx.prisma, ctx.user.id, attemptId, kind, payload ?? null)
);

mutations.submitSkillAttempt = requireAuth(
  async (_, { attemptId, verdict, confidence, faultTag, sources, timeZoneOffsetMinutes }: any, ctx) => {
    const n = Number(confidence);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error("confidence must be between 0 and 100.");
    }
    return submitAttempt(ctx.prisma, ctx.user.id, attemptId, {
      verdict,
      confidence: n,
      faultTag,
      sources: sources ?? [],
      timeZoneOffsetMinutes: timeZoneOffsetMinutes ?? 0,
    }, ctx.locale);
  }
);

// Not evidence-gated: skipping the baseline is the same no-op-if-nothing-to-
// invalidate operation for every skill (unlike startSkillItem, which is
// Evidence's own serving path), and building three copies of this later would
// be silly. Fixed in the same change: this previously called ensureProfile
// with no skillKey (defaulting to "evidence") and then hardcoded "evidence" in
// the update, so passing any other skillKey would have updated the wrong row.
mutations.skipSkillAssessment = requireAuth(async (_, { skillKey }: any, ctx) => {
  await ensureProfile(ctx.prisma, ctx.user.id, ctx.locale, skillKey);
  await ctx.prisma.skillProfile.update({
    where: { userId_skillKey: { userId: ctx.user.id, skillKey } },
    data: { assessmentSkipped: true },
  });
  return true;
});

// ── Clarity Lab ─────────────────────────────────────────────────────────────
//
// Validation lives at the resolver boundary (convention #4); the sequencing
// rules — prediction before reveal, diagnosis before scores — live in the
// service, because they are rules about the attempt rather than about the
// request.

mutations.startClarityItem = requireAuth(async (_, { mode, moduleKey, probeId }: any, ctx) =>
  serveClarityItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null)
);

mutations.lockClarityPrediction = requireAuth(async (_, { attemptId, prediction }: any, ctx) => {
  if (typeof prediction !== "string" || !prediction.trim()) {
    throw new Error("A prediction cannot be empty.");
  }
  await lockClarityPrediction(ctx.prisma, ctx.user.id, attemptId, prediction);
  return true;
});

mutations.lockClarityDiagnosis = requireAuth(async (_, { attemptId, criteria }: any, ctx) => {
  if (!Array.isArray(criteria)) throw new Error("criteria must be a list.");
  await lockClarityDiagnosis(ctx.prisma, ctx.user.id, attemptId, criteria);
  return true;
});

mutations.submitClarityAttempt = requireAuth(
  async (_, { attemptId, text, timeZoneOffsetMinutes }: any, ctx) => {
    if (typeof text !== "string") throw new Error("text is required.");
    return submitClarityAttempt(ctx.prisma, ctx.user.id, attemptId, {
      text,
      timeZoneOffsetMinutes: timeZoneOffsetMinutes ?? 0,
    }, ctx.locale);
  }
);

mutations.startClarityRevision = requireAuth(async (_, { attemptId }: any, ctx) =>
  startClarityRevision(ctx.prisma, ctx.user.id, attemptId, ctx.locale)
);

// ── Decomposition Lab ───────────────────────────────────────────────────────
//
// Same shape as Clarity's block above: validation at the resolver boundary
// (convention #4), sequencing rules in the service. The ordering rules here
// are stricter — whole-before-any-piece as well as diagnose-before-scores —
// because D1 and D2 are measured *from* that ordering, not just gated by it.

mutations.startDecompositionItem = requireAuth(async (_, { mode, moduleKey, probeId }: any, ctx) =>
  serveDecompositionItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null)
);

mutations.lockDecompositionWhole = requireAuth(async (_, { attemptId, statement, doneWhen }: any, ctx) => {
  if (typeof statement !== "string" || !statement.trim()) throw new Error("A whole cannot be empty.");
  if (typeof doneWhen !== "string") throw new Error("doneWhen must be a string.");
  await lockDecompositionWhole(ctx.prisma, ctx.user.id, attemptId, statement, doneWhen);
  return true;
});

mutations.lockDecompositionDiagnosis = requireAuth(async (_, { attemptId, tags }: any, ctx) => {
  if (!Array.isArray(tags)) throw new Error("tags must be a list.");
  await lockDecompositionDiagnosis(ctx.prisma, ctx.user.id, attemptId, tags);
  return true;
});

mutations.submitDecompositionAttempt = requireAuth(
  async (_, { attemptId, structure, timeZoneOffsetMinutes }: any, ctx) => {
    if (!structure || !structure.whole || !Array.isArray(structure.nodes)) {
      throw new Error("structure must include a whole and a node list.");
    }
    return submitDecompositionAttempt(
      ctx.prisma,
      ctx.user.id,
      attemptId,
      { structure, timeZoneOffsetMinutes: timeZoneOffsetMinutes ?? 0 },
      ctx.locale
    );
  }
);

mutations.startDecompositionRevision = requireAuth(async (_, { attemptId }: any, ctx) =>
  startDecompositionRevision(ctx.prisma, ctx.user.id, attemptId, ctx.locale)
);

// ── Decomposition Lab: real-work export ─────────────────────────────────────
// Handle with care: exportDecompositionBreakdown is the one mutation in this
// entire build that writes the learner's real Goal/Project data.

mutations.startDecompositionRealWork = requireAuth(async (_, { targetType, targetId }: any, ctx) =>
  startDecompositionRealWork(ctx.prisma, ctx.user.id, targetType, targetId, ctx.locale)
);

mutations.submitDecompositionRealWork = requireAuth(
  async (_, { attemptId, structure, timeZoneOffsetMinutes }: any, ctx) => {
    if (!structure || !structure.whole || !Array.isArray(structure.nodes)) {
      throw new Error("structure must include a whole and a node list.");
    }
    return submitDecompositionRealWork(
      ctx.prisma,
      ctx.user.id,
      attemptId,
      { structure, timeZoneOffsetMinutes: timeZoneOffsetMinutes ?? 0 },
      ctx.locale
    );
  }
);

mutations.exportDecompositionBreakdown = requireAuth(async (_, { attemptId, nodeIds }: any, ctx) => {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) throw new Error("nodeIds must be a non-empty list.");
  return exportDecompositionBreakdown(ctx.prisma, ctx.user.id, attemptId, nodeIds);
});

// ── Verification Lab ────────────────────────────────────────────────────────
// The bench-leak rule is enforced in the service, not here: a served item and
// a revealed check never carry more than their own type allows.

mutations.startVerificationItem = requireAuth(async (_, { mode, moduleKey, probeId }: any, ctx) =>
  serveVerificationItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null)
);

mutations.nameVerificationOracle = requireAuth(async (_, { attemptId, text, predictedCostSeconds }: any, ctx) => {
  if (typeof text !== "string" || !text.trim()) throw new Error("An oracle statement cannot be empty.");
  await nameVerificationOracle(ctx.prisma, ctx.user.id, attemptId, text, predictedCostSeconds ?? null);
  return true;
});

mutations.revealVerificationCheck = requireAuth(async (_, { attemptId, checkId }: any, ctx) =>
  revealVerificationCheck(ctx.prisma, ctx.user.id, attemptId, checkId, ctx.locale)
);

mutations.loadVerificationElements = requireAuth(async (_, { attemptId }: any, ctx) =>
  loadVerificationElements(ctx.prisma, ctx.user.id, attemptId, ctx.locale)
);

mutations.commitVerificationVerdict = requireAuth(
  async (_, { attemptId, verdict, confidence, residualRisk, elementId, elementFreeText, timeZoneOffsetMinutes }: any, ctx) => {
    const outcome = await commitVerificationVerdict(
      ctx.prisma,
      ctx.user.id,
      attemptId,
      { verdict, confidence, residualRisk, elementId: elementId ?? null, elementFreeText: elementFreeText ?? null },
      ctx.locale,
      timeZoneOffsetMinutes ?? 0
    );
    return outcome.stage === "scored"
      ? { stage: outcome.stage, elements: null, result: outcome.result }
      : { stage: outcome.stage, elements: outcome.elements, result: null };
  }
);

mutations.setVerificationLocalization = requireAuth(async (_, { attemptId, elementId, timeZoneOffsetMinutes }: any, ctx) =>
  setVerificationLocalization(ctx.prisma, ctx.user.id, attemptId, elementId, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.setVerificationRung = requireAuth(async (_, { moduleKey, rung }: any, ctx) => {
  const result = await setVerificationRung(ctx.prisma, ctx.user.id, moduleKey, rung);
  return result.rung;
});

mutations.startVerificationRealWork = requireAuth(async (_, { claim }: any, ctx) =>
  startVerificationRealWork(ctx.prisma, ctx.user.id, claim, ctx.locale)
);

mutations.submitVerificationRealWork = requireAuth(
  async (_, { attemptId, oracle, result, verdict, confidence, residualRisk }: any, ctx) =>
    submitVerificationRealWork(ctx.prisma, ctx.user.id, attemptId, { oracle, result, verdict, confidence, residualRisk })
);

mutations.startDelegationItem = requireAuth(async (_, { mode, moduleKey, probeId }: any, ctx) =>
  startDelegationItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null)
);

mutations.commitDelegationEstimate = requireAuth(async (_, { attemptId, value, confidence }: any, ctx) =>
  commitDelegationEstimate(ctx.prisma, ctx.user.id, attemptId, value, confidence, ctx.locale)
);

mutations.commitDelegationRevision = requireAuth(async (_, { attemptId, value, recoverabilityMove, timeZoneOffsetMinutes }: any, ctx) => {
  const outcome = await commitDelegationRevision(
    ctx.prisma,
    ctx.user.id,
    attemptId,
    value,
    recoverabilityMove ?? null,
    ctx.locale,
    timeZoneOffsetMinutes ?? 0
  );
  return outcome.stage === "scored"
    ? { stage: outcome.stage, cueOptions: null, result: outcome.result }
    : { stage: outcome.stage, cueOptions: outcome.cueOptions, result: null };
});

mutations.selectDelegationCue = requireAuth(async (_, { attemptId, cueId, timeZoneOffsetMinutes }: any, ctx) =>
  selectDelegationCue(ctx.prisma, ctx.user.id, attemptId, cueId, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.commitDelegationSplit = requireAuth(async (_, { attemptId, dispositions, timeZoneOffsetMinutes }: any, ctx) =>
  commitDelegationSplit(ctx.prisma, ctx.user.id, attemptId, dispositions, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.commitSequenceRound = requireAuth(
  async (_, { attemptId, roundIndex, value, phase, confidence, timeZoneOffsetMinutes }: any, ctx) => {
    const outcome = await commitSequenceRound(
      ctx.prisma,
      ctx.user.id,
      attemptId,
      roundIndex,
      value,
      phase,
      ctx.locale,
      confidence ?? null,
      timeZoneOffsetMinutes ?? 0
    );
    if (outcome.stage === "advice") return { stage: outcome.stage, advice: outcome.advice, result: null };
    if (outcome.stage === "scored") return { stage: outcome.stage, advice: null, result: outcome.result };
    return { stage: outcome.stage, advice: null, result: null };
  }
);

mutations.startDelegationRealWork = requireAuth(async (_, { handingOver, keeping, wouldTellMeWrong }: any, ctx) =>
  startDelegationRealWork(ctx.prisma, ctx.user.id, handingOver, keeping, wouldTellMeWrong, ctx.locale)
);

mutations.submitDelegationRealWork = requireAuth(async (_, { attemptId, whatActuallyHappened }: any, ctx) =>
  submitDelegationRealWork(ctx.prisma, ctx.user.id, attemptId, whatActuallyHappened)
);

mutations.startMonitoringItem = requireAuth(async (_, { mode, moduleKey, probeId }: any, ctx) =>
  startMonitoringItem(ctx.prisma, ctx.user.id, mode, moduleKey ?? null, ctx.locale, probeId ?? null)
);

mutations.commitMonitoringPrediction = requireAuth(async (_, { attemptId, level }: any, ctx) =>
  commitMonitoringPrediction(ctx.prisma, ctx.user.id, attemptId, level)
);

mutations.submitMonitoringAnswer = requireAuth(async (_, { attemptId, text, timeZoneOffsetMinutes }: any, ctx) =>
  submitMonitoringAnswer(ctx.prisma, ctx.user.id, attemptId, text, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.commitMonitoringRating = requireAuth(async (_, { attemptId, phase, value, timeZoneOffsetMinutes }: any, ctx) =>
  commitMonitoringRating(ctx.prisma, ctx.user.id, attemptId, phase, value, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.commitMonitoringExplanation = requireAuth(async (_, { attemptId, text }: any, ctx) =>
  commitMonitoringExplanation(ctx.prisma, ctx.user.id, attemptId, text, ctx.locale)
);

mutations.selectMonitoringSteps = requireAuth(async (_, { attemptId, stepIds, timeZoneOffsetMinutes }: any, ctx) =>
  selectMonitoringSteps(ctx.prisma, ctx.user.id, attemptId, stepIds, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.markMonitoringInfluence = requireAuth(async (_, { attemptId, marks, timeZoneOffsetMinutes }: any, ctx) =>
  markMonitoringInfluence(ctx.prisma, ctx.user.id, attemptId, marks, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.markMonitoringCheckpoint = requireAuth(async (_, { attemptId, checkpointId, checked }: any, ctx) =>
  markMonitoringCheckpoint(ctx.prisma, ctx.user.id, attemptId, checkpointId, checked)
);

mutations.selectMonitoringCountermeasure = requireAuth(async (_, { attemptId, optionId, timeZoneOffsetMinutes }: any, ctx) =>
  selectMonitoringCountermeasure(ctx.prisma, ctx.user.id, attemptId, optionId, ctx.locale, timeZoneOffsetMinutes ?? 0)
);

mutations.startMonitoringSelfAudit = requireAuth(async (_, __, ctx) => startMonitoringSelfAudit(ctx.prisma, ctx.user.id, ctx.locale));

mutations.submitMonitoringSelfAudit = requireAuth(async (_, { attemptId, answers }: any, ctx) => {
  const result = await submitMonitoringSelfAudit(ctx.prisma, ctx.user.id, attemptId, {
    flattery: answers.flattery,
    anchor: answers.anchor,
    smuggled_premise: answers.smuggledPremise,
    agreement_reversal: answers.agreementReversal,
  });
  return {
    attemptId: result.attemptId,
    record: {
      flattery: result.record.flattery,
      anchor: result.record.anchor,
      smuggledPremise: result.record.smuggled_premise,
      agreementReversal: result.record.agreement_reversal,
    },
  };
});

mutations.planSkillSchedule = requireAuth(
  async (_, { skillKey, startDate, sessionsPerWeek, timeOfDay, sessionsPerModule }: any, ctx) => {
    assertEvidenceSkill(skillKey);
    const perWeek = sessionsPerWeek ?? DEFAULT_SESSIONS_PER_WEEK;
    if (!Number.isInteger(perWeek) || perWeek < 1 || perWeek > 7) {
      throw new Error("sessionsPerWeek must be between 1 and 7.");
    }
    const perModule = sessionsPerModule ?? DEFAULT_SESSIONS_PER_MODULE;
    if (!Number.isInteger(perModule) || perModule < 1 || perModule > 5) {
      throw new Error("sessionsPerModule must be between 1 and 5.");
    }
    return applyPlan(ctx.prisma, ctx.user.id, "evidence", {
      startDateKey: startDate,
      sessionsPerWeek: perWeek,
      timeOfDay: timeOfDay ?? DEFAULT_TIME_OF_DAY,
      sessionsPerModule: perModule,
    }, ctx.locale);
  }
);

mutations.clearSkillSchedule = requireAuth(async (_, { skillKey }: any, ctx) => {
  assertEvidenceSkill(skillKey);
  return clearPlan(ctx.prisma, ctx.user.id, "evidence");
});

// ── Skill probes (baseline / post / delayed) ─────────────────────────────────
// Shared across all three tools — see probes.ts's header note. Unlike the
// legacy startSkillItem/skipSkillAssessment/planSkillSchedule/clearSkillSchedule
// above, these are not gated to evidence-only: they were built after Clarity
// and Decomposition already existed, so they take every skillKey from day one.

mutations.startSkillProbe = requireAuth(async (_, { skillKey, timepoint }: any, ctx) =>
  startSkillProbe(ctx.prisma, ctx.user.id, skillKey, timepoint, ctx.locale)
);

mutations.completeSkillProbe = requireAuth(async (_, { skillKey, timepoint, selfReport }: any, ctx) =>
  completeSkillProbe(ctx.prisma, ctx.user.id, skillKey, timepoint, selfReport, ctx.locale)
);

// ─── Feelings & Needs: the daily loop ────────────────────────────────────────
// Each step commits on its own (convention #8). Every one of these returns the
// whole sitting rather than the touched row, so the client always renders from
// one server-owned shape and never has to reconcile a partial update.

mutations.completeFeelingsNeedsFrame = requireAuth(async (_, __, ctx) =>
  completeFrame(ctx.prisma, ctx.user.id, ctx.locale)
);

mutations.startLoopSitting = requireAuth(async (_, { wasPrompted }: any, ctx) =>
  startSitting(ctx.prisma, ctx.user.id, { wasPrompted: wasPrompted ?? false })
);

mutations.setLoopBreath = requireAuth(async (_, { sittingId }: any, ctx) =>
  setBreath(ctx.prisma, ctx.user.id, sittingId)
);

mutations.updateLoopEntry = requireAuth(async (_, args: any, ctx) => {
  const { entryId, ...patch } = args;
  return updateEntry(ctx.prisma, ctx.user.id, entryId, patch, ctx.locale);
});

mutations.addLoopPass = requireAuth(async (_, { sittingId }: any, ctx) =>
  addPass(ctx.prisma, ctx.user.id, sittingId)
);

mutations.finishLoopSitting = requireAuth(async (_, { sittingId }: any, ctx) =>
  finishSitting(ctx.prisma, ctx.user.id, sittingId, ctx.locale)
);

mutations.acknowledgeGraduation = requireAuth(async (_, __: any, ctx) =>
  acknowledgeGraduation(ctx.prisma, ctx.user.id)
);

mutations.startNoticingSitting = requireAuth(async (_, { wasPrompted }: any, ctx) =>
  startNoticingSitting(ctx.prisma, ctx.user.id, { wasPrompted: wasPrompted ?? false })
);

mutations.updateNoticingEntry = requireAuth(async (_, args: any, ctx) => {
  const { entryId, ...patch } = args;
  return updateNoticingEntry(ctx.prisma, ctx.user.id, entryId, patch);
});

mutations.addNoticingPass = requireAuth(async (_, { sittingId }: any, ctx) =>
  addNoticingPass(ctx.prisma, ctx.user.id, sittingId)
);

mutations.finishNoticingSitting = requireAuth(async (_, { sittingId }: any, ctx) =>
  finishNoticingSitting(ctx.prisma, ctx.user.id, sittingId)
);

export const mutationResolvers = mutations;
