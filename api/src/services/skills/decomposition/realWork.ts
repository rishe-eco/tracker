/**
 * Real-work breakdown: the learner decomposes one of their own Goals or
 * Projects, then — only after reviewing it item by item — may export the
 * pieces into Tracker as real Projects/Actions.
 *
 * Two things set this apart from `decompositionSession.ts`:
 *
 * 1. **There is no authored item, so no key.** D1/D2 score exactly as they
 *    do everywhere else; D4 degrades to leaf-boundedness only (nothing can
 *    be marked atomic without a key); D3/D5/D6 can never be scored — not
 *    "unscored until a judge exists" the way a breakdown item's are, but
 *    permanently, by construction (`scoring.ts`'s `assembleRealWorkScore`).
 * 2. **This is the one place in the whole build that writes the learner's
 *    real data.** Every write is itemised, opt-in, reversible (an ordinary
 *    Project/Action the learner can delete like any other), and never
 *    automatic — nothing is written until `exportDecompositionBreakdown` is
 *    called with the exact node ids to write, and it rejects a second call
 *    for the same attempt outright rather than risk a duplicate write.
 *
 * The whole-lock and the live authoring events (`node_added` etc.) are
 * deliberately *not* reimplemented here — `lockDecompositionWhole` and the
 * generic `logSkillCheckEvent` mutation already work on any attempt of this
 * skill regardless of whether it has an authored item behind it, so a
 * real-work session calls them unchanged.
 *
 * Spec: 03-decomposition-lab.md §8, §9, §11; build plan §3 Phase 7.
 */

import type { PrismaClient } from "@prisma/client";
import { ensureProfile } from "../profile";
import type { Locale } from "../../../content/skills/decomposition/types";
import { RUBRIC_VERSION } from "../../../content/skills/decomposition/v1";
import { assembleRealWorkScore, type DecompositionScore, type DecompositionStructure, type SubmittedNode } from "./scoring";

const SKILL = "decomposition" as const;

export class RealWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealWorkError";
  }
}

export type RealWorkTargetType = "goal" | "project";

type TargetInfo = { title: string; dod: string };

async function loadTarget(
  prisma: PrismaClient,
  userId: string,
  targetType: RealWorkTargetType,
  targetId: string
): Promise<TargetInfo> {
  if (targetType === "goal") {
    const goal = await prisma.goal.findUnique({ where: { id: targetId } });
    if (!goal || goal.userId !== userId) throw new RealWorkError("Not found");
    return { title: goal.title, dod: goal.dod ?? "" };
  }
  const project = await prisma.project.findUnique({ where: { id: targetId } });
  if (!project || project.userId !== userId) throw new RealWorkError("Not found");
  return { title: project.title, dod: project.dod ?? "" };
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedRealWork = {
  attemptId: string;
  targetType: RealWorkTargetType;
  targetId: string;
  title: string;
  dod: string;
};

export async function startDecompositionRealWork(
  prisma: PrismaClient,
  userId: string,
  targetType: RealWorkTargetType,
  targetId: string,
  locale: Locale
): Promise<ServedRealWork> {
  const target = await loadTarget(prisma, userId, targetType, targetId);
  const profile = await ensureProfile(prisma, userId, locale, SKILL);

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: null,
      // Synthetic — real-work has no authored itemId, and the column is
      // required. Self-describing and namespaced so it can never collide
      // with an authored item id.
      itemId: `open-practice:${targetType}:${targetId}`,
      mode: "open_practice",
      // Stashed now so submit/export can recover the target without the
      // client re-asserting it — the server is the only source of truth for
      // where an export is allowed to write.
      responseStructure: JSON.stringify({ target: { type: targetType, id: targetId } }),
      scores: "{}",
      contentVersion: profile.contentVersion,
      rubricVersion: RUBRIC_VERSION,
      scoredBy: "detector",
    },
  });

  return { attemptId: attempt.id, targetType, targetId, title: target.title, dod: target.dod };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export type RealWorkSubmitResult = {
  attemptId: string;
  score: DecompositionScore;
};

export async function submitDecompositionRealWork(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: { structure: DecompositionStructure; timeZoneOffsetMinutes?: number },
  locale: Locale
): Promise<RealWorkSubmitResult> {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: { orderBy: { offsetMs: "asc" } } },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL || attempt.mode !== "open_practice") {
    throw new RealWorkError("Not found");
  }
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new RealWorkError("This attempt is already scored and cannot be changed.");
  }

  const stored = JSON.parse(attempt.responseStructure || "{}");
  const target = stored.target as { type: RealWorkTargetType; id: string } | undefined;
  if (!target) throw new RealWorkError("This attempt has no target.");

  const wholeEvent = attempt.checkEvents.find((e) => e.kind === "whole_stated");
  if (!wholeEvent) throw new RealWorkError("State the whole before asking for scores.");

  const addEventsInOrder = attempt.checkEvents
    .filter((e) => e.kind === "node_added")
    .map((e) => {
      const payload = JSON.parse(e.payload || "{}");
      return { nodeId: payload.nodeId as string, depth: (payload.depth === 2 ? 2 : 1) as 1 | 2 };
    });
  const firstNodeEvent = attempt.checkEvents.find((e) => e.kind === "node_added");
  const wholeStatedFirst = !firstNodeEvent || wholeEvent.offsetMs <= firstNodeEvent.offsetMs;

  // The target's own title + DoD stands in for an authored item's prompt —
  // the D1 near-copy check still means something: a whole that just restates
  // the goal's title back verbatim hasn't reframed anything.
  const targetInfo = await loadTarget(prisma, userId, target.type, target.id);

  const score = assembleRealWorkScore({
    structure: input.structure,
    addEventsInOrder,
    wholeStatedFirst,
    itemPrompt: `${targetInfo.title} ${targetInfo.dod}`.trim(),
    locale,
  });

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseStructure: JSON.stringify({ ...input.structure, target }),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({ latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()) }),
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      scoredBy: "detector",
    },
  });

  return { attemptId, score };
}

// ─── Export ─────────────────────────────────────────────────────────────────

export type ExportResult = {
  createdProjects: { id: string; title: string }[];
  createdActions: { id: string; title: string; projectId: string | null }[];
  /** Edges among the exported pieces that had nowhere to go — Tracker has no dependency model. */
  dependencyEdgesDropped: number;
};

/**
 * Write the selected pieces into Tracker. Containment maps onto the
 * hierarchy the app already has (spec §9): decomposing a **Goal** turns
 * depth-1 pieces into Projects under it and each one's depth-2 children into
 * Actions under *that* new Project; decomposing a **Project** turns every
 * selected piece, at either depth, into a flat Action under it — Tracker's
 * own Action model has no further nesting, so that flattening is not new
 * information loss, only dependency edges are. A piece's `doneWhen` survives
 * as an attached Note rather than being dropped, since nothing in Tracker's
 * schema holds a done condition on an Action or Project directly.
 */
export async function exportDecompositionBreakdown(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  nodeIds: string[]
): Promise<ExportResult> {
  const attempt = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL || attempt.mode !== "open_practice") {
    throw new RealWorkError("Not found");
  }
  if (!JSON.parse(attempt.scores || "{}").criteria) {
    throw new RealWorkError("Score this breakdown before exporting it.");
  }

  const behaviors = JSON.parse(attempt.behaviors || "{}");
  if (behaviors.exportedAt) {
    throw new RealWorkError(
      "This breakdown has already been exported. Delete what it created in Tracker directly if you want to redo it."
    );
  }

  const stored = JSON.parse(attempt.responseStructure || "{}");
  const target = stored.target as { type: RealWorkTargetType; id: string } | undefined;
  const nodes: SubmittedNode[] = stored.nodes ?? [];
  if (!target || nodes.length === 0) throw new RealWorkError("There is nothing to export.");

  // Re-verified now, not just trusted from serve time — the target cannot
  // have been deleted or handed to someone else in between without this
  // failing too.
  await loadTarget(prisma, userId, target.type, target.id);

  const selected = new Set(nodeIds.filter((id) => nodes.some((n) => n.id === id)));
  if (selected.size === 0) throw new RealWorkError("Select at least one piece to export.");

  const depth1Selected = nodes.filter((n) => n.parentId === null && selected.has(n.id));
  const depth2Selected = nodes.filter((n) => n.parentId !== null && selected.has(n.id));

  const createdProjects: { id: string; title: string }[] = [];
  const createdActions: { id: string; title: string; projectId: string | null }[] = [];
  const newProjectIdByNodeId = new Map<string, string>();

  async function attachDoneWhenNote(entityType: "project" | "action", entityId: string, doneWhen: string) {
    if (!doneWhen.trim()) return;
    await prisma.note.create({ data: { entityType, entityId, body: doneWhen.trim(), userId } });
  }

  if (target.type === "goal") {
    for (const node of depth1Selected) {
      const project = await prisma.project.create({
        data: { title: node.label, goalId: target.id, userId, type: "individual", priority: "P" },
      });
      newProjectIdByNodeId.set(node.id, project.id);
      createdProjects.push({ id: project.id, title: project.title });
      await attachDoneWhenNote("project", project.id, node.doneWhen);
    }
    for (const node of depth2Selected) {
      // If the parent wasn't also exported, the child still exports — as a
      // standalone action rather than an orphaned reference to a project
      // that doesn't exist.
      const projectId = node.parentId ? newProjectIdByNodeId.get(node.parentId) ?? null : null;
      const action = await prisma.action.create({
        data: { title: node.label, projectId: projectId ?? undefined, userId, priority: "P" },
      });
      createdActions.push({ id: action.id, title: action.title, projectId });
      await attachDoneWhenNote("action", action.id, node.doneWhen);
    }
  } else {
    for (const node of [...depth1Selected, ...depth2Selected]) {
      const action = await prisma.action.create({
        data: { title: node.label, projectId: target.id, userId, priority: "P" },
      });
      createdActions.push({ id: action.id, title: action.title, projectId: target.id });
      await attachDoneWhenNote("action", action.id, node.doneWhen);
    }
  }

  const dependencyEdgesDropped = nodes
    .filter((n) => selected.has(n.id))
    .reduce((sum, n) => sum + n.dependsOn.filter((dep) => selected.has(dep)).length, 0);

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      behaviors: JSON.stringify({
        ...behaviors,
        exportedAt: new Date().toISOString(),
        exportedNodeIds: [...selected],
      }),
    },
  });

  return { createdProjects, createdActions, dependencyEdgesDropped };
}
