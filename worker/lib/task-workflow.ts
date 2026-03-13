import { and, asc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  taskSessions,
  taskSubtasks,
  tasks,
  taskWorkflows,
} from "../../shared/schema.ts";
import type {
  TaskSessionRole,
  TaskSubtaskStatus,
  TaskWorkflowMode,
  TaskWorkflowStatus,
  TaskWorkflowSummary,
} from "../../shared/task-workflow.ts";
import type { TaskStatus } from "../../shared/types.ts";
import type { Database } from "../db/client.ts";

export type TaskWorkflowRecord = InferSelectModel<typeof taskWorkflows>;
export type TaskSubtaskRecord = InferSelectModel<typeof taskSubtasks>;
export type TaskSessionRecord = InferSelectModel<typeof taskSessions>;
export type TaskRecord = InferSelectModel<typeof tasks>;

export type TaskWorkflowBundle = {
  workflow: TaskWorkflowRecord | null;
  subtasks: TaskSubtaskRecord[];
  sessions: TaskSessionRecord[];
};

export type TaskWorkflowDetail = TaskWorkflowBundle & {
  task: TaskRecord;
  summary: TaskWorkflowSummary;
};

export const COMPLEX_TASK_ARTIFACT_DIR = ".openclaw/tasks";

export function buildTaskRootSessionKey(taskId: string, agentId: string) {
  return `agent:${agentId}:task:${taskId}`;
}

export function buildTaskPlanPath(taskId: string) {
  return `${COMPLEX_TASK_ARTIFACT_DIR}/${taskId}/plan.md`;
}

export function resolveTaskStatusFromWorkflowStatus(
  status: TaskWorkflowStatus
): TaskStatus {
  switch (status) {
    case "pending_assignment":
      return "todo";
    case "planning":
    case "executing":
      return "doing";
    case "blocked":
      return "stuck";
    case "completed":
      return "done";
  }
}

export function summarizeWorkflow(
  mode: TaskWorkflowMode,
  bundle: TaskWorkflowBundle
): TaskWorkflowSummary {
  const completedSubtasks = bundle.subtasks.filter(
    (subtask) => subtask.status === "done"
  ).length;
  const activeSubtask =
    bundle.subtasks.find((subtask) => subtask.status === "running") ?? null;
  const blockedSubtask =
    bundle.subtasks.find((subtask) => subtask.status === "needs_revision") ??
    null;
  const rootSession =
    bundle.sessions.find(
      (session) => session.role === "root" && session.endedAt === null
    ) ??
    bundle.sessions.find((session) => session.role === "root") ??
    null;

  return {
    mode,
    status: bundle.workflow?.status ?? null,
    planPath: bundle.workflow?.planPath ?? null,
    planSummary: bundle.workflow?.planSummary ?? null,
    totalSubtasks: bundle.subtasks.length,
    completedSubtasks,
    activeSubtaskId: activeSubtask?.id ?? null,
    blockedSubtaskId: blockedSubtask?.id ?? null,
    rootAgentId: rootSession?.agentId ?? null,
    sessionKeys: bundle.sessions.map((session) => session.sessionKey),
  };
}

export async function fetchTaskWorkflowBundles(
  db: Database,
  taskIds: string[]
): Promise<Map<string, TaskWorkflowBundle>> {
  const next = new Map<string, TaskWorkflowBundle>();
  for (const taskId of taskIds) {
    next.set(taskId, {
      workflow: null,
      subtasks: [],
      sessions: [],
    });
  }

  if (taskIds.length === 0) {
    return next;
  }

  const [workflowRows, subtaskRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(taskWorkflows)
      .where(inArray(taskWorkflows.taskId, taskIds)),
    db
      .select()
      .from(taskSubtasks)
      .where(inArray(taskSubtasks.taskId, taskIds))
      .orderBy(asc(taskSubtasks.position), asc(taskSubtasks.id)),
    db
      .select()
      .from(taskSessions)
      .where(inArray(taskSessions.taskId, taskIds))
      .orderBy(asc(taskSessions.startedAt), asc(taskSessions.id)),
  ]);

  for (const workflow of workflowRows) {
    next.set(workflow.taskId, {
      ...(next.get(workflow.taskId) ?? { subtasks: [], sessions: [] }),
      workflow,
    });
  }

  for (const subtask of subtaskRows) {
    const current = next.get(subtask.taskId) ?? {
      workflow: null,
      subtasks: [],
      sessions: [],
    };
    current.subtasks.push(subtask);
    next.set(subtask.taskId, current);
  }

  for (const session of sessionRows) {
    const current = next.get(session.taskId) ?? {
      workflow: null,
      subtasks: [],
      sessions: [],
    };
    current.sessions.push(session);
    next.set(session.taskId, current);
  }

  return next;
}

export async function fetchTaskWorkflowDetail(
  db: Database,
  taskId: string
): Promise<TaskWorkflowBundle> {
  const bundles = await fetchTaskWorkflowBundles(db, [taskId]);
  return (
    bundles.get(taskId) ?? {
      workflow: null,
      subtasks: [],
      sessions: [],
    }
  );
}

export async function findTaskWorkflowDetailBySessionKey(
  db: Database,
  sessionKey: string
): Promise<TaskWorkflowDetail | null> {
  const [session] = await db
    .select()
    .from(taskSessions)
    .where(eq(taskSessions.sessionKey, sessionKey))
    .limit(1);

  if (!session) {
    return null;
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, session.taskId),
  });

  if (!task) {
    return null;
  }

  const bundle = await fetchTaskWorkflowDetail(db, task.id);
  return {
    task,
    ...bundle,
    summary: summarizeWorkflow(task.workflowMode, bundle),
  };
}

export async function upsertTaskWorkflow(
  db: Database,
  params: {
    taskId: string;
    status: TaskWorkflowStatus;
    planPath?: string | null;
    planSummary?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
): Promise<TaskWorkflowRecord> {
  const existing = await db.query.taskWorkflows.findFirst({
    where: eq(taskWorkflows.taskId, params.taskId),
  });

  if (existing) {
    const [updated] = await db
      .update(taskWorkflows)
      .set({
        status: params.status,
        planPath: params.planPath ?? existing.planPath ?? null,
        planSummary: params.planSummary ?? existing.planSummary ?? null,
        startedAt: params.startedAt ?? existing.startedAt ?? null,
        completedAt: params.completedAt ?? existing.completedAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(taskWorkflows.taskId, params.taskId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(taskWorkflows)
    .values({
      taskId: params.taskId,
      status: params.status,
      planPath: params.planPath ?? null,
      planSummary: params.planSummary ?? null,
      startedAt: params.startedAt ?? null,
      completedAt: params.completedAt ?? null,
    })
    .returning();
  return created;
}

export async function linkTaskSession(
  db: Database,
  params: {
    taskId: string;
    sessionKey: string;
    role: TaskSessionRole;
    agentId?: string | null;
    subtaskId?: number | null;
    parentSessionKey?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    endedAt?: Date | null;
  }
): Promise<TaskSessionRecord> {
  const existing = await db.query.taskSessions.findFirst({
    where: eq(taskSessions.sessionKey, params.sessionKey),
  });

  if (existing) {
    const [updated] = await db
      .update(taskSessions)
      .set({
        taskId: params.taskId,
        subtaskId: params.subtaskId ?? existing.subtaskId ?? null,
        role: params.role,
        agentId: params.agentId ?? existing.agentId ?? null,
        parentSessionKey:
          params.parentSessionKey ?? existing.parentSessionKey ?? null,
        startedAt: params.startedAt ?? existing.startedAt,
        completedAt: params.completedAt ?? existing.completedAt ?? null,
        endedAt: params.endedAt ?? existing.endedAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(taskSessions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(taskSessions)
    .values({
      taskId: params.taskId,
      subtaskId: params.subtaskId ?? null,
      sessionKey: params.sessionKey,
      role: params.role,
      agentId: params.agentId ?? null,
      parentSessionKey: params.parentSessionKey ?? null,
      startedAt: params.startedAt ?? new Date(),
      completedAt: params.completedAt ?? null,
      endedAt: params.endedAt ?? null,
    })
    .returning();
  return created;
}

export async function closeTaskSessionsForRole(
  db: Database,
  params: {
    taskId: string;
    role: TaskSessionRole;
    exceptSessionKey?: string;
  }
) {
  const sessions = await db.query.taskSessions.findMany({
    where: and(
      eq(taskSessions.taskId, params.taskId),
      eq(taskSessions.role, params.role)
    ),
  });

  const updates = sessions
    .filter((session) => session.sessionKey !== params.exceptSessionKey)
    .map((session) =>
      db
        .update(taskSessions)
        .set({
          endedAt: session.endedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(taskSessions.id, session.id))
    );

  await Promise.all(updates);
}

export async function syncTaskWithWorkflowStatus(
  db: Database,
  params: {
    taskId: string;
    workflowStatus: TaskWorkflowStatus;
  }
) {
  const taskStatus = resolveTaskStatusFromWorkflowStatus(params.workflowStatus);
  const [task] = await db
    .update(tasks)
    .set({
      status: taskStatus,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, params.taskId))
    .returning();
  return task;
}

export function buildComplexTaskRootPrompt(task: {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  assignor: string | null;
  campaignId?: number | null;
}) {
  const lines = [
    "HQ complex task assigned.",
    `Task ID: ${task.id}`,
    `Title: ${task.title}`,
    task.description ? `Description:\n${task.description}` : null,
    task.assignor ? `Assignor: ${task.assignor}` : null,
    task.assignee ? `Assignee: ${task.assignee}` : null,
    task.campaignId ? `Campaign ID: ${task.campaignId}` : null,
    "",
    "Use the HQ complex task workflow contract for this session.",
    `1. Plan first and write ${buildTaskPlanPath(task.id)}.`,
    "2. Record the plan and subtask list in HQ before execution.",
    "3. Execute subtasks one by one with worker and validator subagents.",
    "4. Complete the workflow in HQ when every subtask is finished.",
  ].filter(Boolean);

  return lines.join("\n");
}

export function resolveWorkflowStatusFromSubtasks(
  subtasks: Pick<TaskSubtaskRecord, "status">[]
): TaskWorkflowStatus {
  if (subtasks.some((subtask) => subtask.status === "needs_revision")) {
    return "blocked";
  }
  if (subtasks.some((subtask) => subtask.status === "running")) {
    return "executing";
  }
  if (subtasks.length > 0) {
    return "executing";
  }
  return "planning";
}

export function normalizeSubtaskStatusForCompletion(
  status: TaskSubtaskStatus
): { completedAt: Date | null } {
  if (status === "done") {
    return { completedAt: new Date() };
  }
  return { completedAt: null };
}
