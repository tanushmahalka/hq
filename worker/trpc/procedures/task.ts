import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  taskSessions,
  taskSubtasks,
  tasks,
  taskWorkflows,
} from "../../../drizzle/schema/core.ts";
import {
  TASK_CATEGORIES,
  type TaskCategory,
  TASK_STATUSES,
} from "../../../shared/types.ts";
import { TASK_WORKFLOW_MODES } from "../../../shared/task-workflow.ts";
import { generateTaskSlug } from "../../../shared/slug.ts";
import {
  buildComplexTaskRootPrompt,
  buildTaskRootSessionKey,
  closeTaskSessionsForRole,
  fetchTaskWorkflowBundles,
  linkTaskSession,
  summarizeWorkflow,
  syncTaskWithWorkflowStatus,
  upsertTaskWorkflow,
} from "../../lib/task-workflow.ts";
import { notifyAgent } from "../../lib/notify-agent.ts";
import {
  fetchMissionChain,
  formatMissionContext,
} from "../../lib/mission-chain.ts";
import { router, orgProcedure } from "../init.ts";

const taskCreateInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).nullable().optional(),
  workflowMode: z.enum(TASK_WORKFLOW_MODES).optional(),
  assignor: z.string().optional(),
  assignee: z.string().optional(),
  dueDate: z.date().optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  campaignId: z.number().int().positive().optional(),
  organizationId: z.string().optional(),
});

const taskUpdateInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).nullable().optional(),
  workflowMode: z.enum(TASK_WORKFLOW_MODES).optional(),
  assignor: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  campaignId: z.number().int().positive().nullable().optional(),
});

function normalizeAgentId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "Unknown") {
    return null;
  }
  return trimmed;
}

export function resolveSimpleTaskNotificationAgentId(params: {
  isAgent: boolean;
  assignee?: string | null;
  leadAgentId?: string | null;
}): string | null {
  const assignee = normalizeAgentId(params.assignee);
  const leadAgentId = normalizeAgentId(params.leadAgentId);

  if (params.isAgent && assignee) {
    return assignee;
  }

  return leadAgentId ?? assignee ?? null;
}

async function attachWorkflowSummaries<
  T extends {
    id: string;
    workflowMode: "simple" | "complex";
  },
>(ctx: { db: Parameters<typeof fetchTaskWorkflowBundles>[0] }, rows: T[]) {
  const bundles = await fetchTaskWorkflowBundles(
    ctx.db,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    workflowSummary: summarizeWorkflow(
      row.workflowMode,
      bundles.get(row.id) ?? { workflow: null, subtasks: [], sessions: [] },
    ),
  }));
}

async function kickoffComplexTask(params: {
  ctx: {
    db: Parameters<typeof fetchTaskWorkflowBundles>[0];
    waitUntil: (promise: Promise<unknown>) => void;
    hooksUrl?: string;
    hooksToken?: string;
  };
  task: {
    id: string;
    title: string;
    description: string | null;
    assignee: string | null;
    assignor: string | null;
    category?: TaskCategory | null;
    campaignId?: number | null;
  };
}) {
  const { ctx, task } = params;
  if (!task.assignee) {
    await upsertTaskWorkflow(ctx.db, {
      taskId: task.id,
      status: "pending_assignment",
      startedAt: null,
      completedAt: null,
    });
    await closeTaskSessionsForRole(ctx.db, {
      taskId: task.id,
      role: "root",
    });
    await syncTaskWithWorkflowStatus(ctx.db, {
      taskId: task.id,
      workflowStatus: "pending_assignment",
    });
    return;
  }

  const rootSessionKey = buildTaskRootSessionKey(task.id, task.assignee);
  await closeTaskSessionsForRole(ctx.db, {
    taskId: task.id,
    role: "root",
    exceptSessionKey: rootSessionKey,
  });
  await upsertTaskWorkflow(ctx.db, {
    taskId: task.id,
    status: "planning",
    startedAt: new Date(),
    completedAt: null,
  });
  await linkTaskSession(ctx.db, {
    taskId: task.id,
    sessionKey: rootSessionKey,
    role: "root",
    agentId: task.assignee,
    startedAt: new Date(),
    endedAt: null,
    completedAt: null,
  });
  await syncTaskWithWorkflowStatus(ctx.db, {
    taskId: task.id,
    workflowStatus: "planning",
  });

  ctx.waitUntil(
    notifyAgent(ctx, {
      agentId: task.assignee,
      sessionKey: rootSessionKey,
      message: buildComplexTaskRootPrompt(task),
    }),
  );
}

function buildSimpleTaskPayload(task: {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  category?: TaskCategory | null;
  urgent: boolean;
  important: boolean;
  assignor?: string | null;
  assignee?: string | null;
  campaignId?: number | null;
}) {
  return {
    type: "task.created",
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      category: task.category ?? null,
      urgent: task.urgent,
      important: task.important,
      assignor: task.assignor ?? null,
      assignee: task.assignee ?? null,
      campaignId: task.campaignId ?? null,
    },
  };
}

export const taskRouter = router({
  list: orgProcedure
    .input(
      z
        .object({
          status: z.enum(TASK_STATUSES).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(tasks.status, input.status));
      }
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(tasks.organizationId, ctx.organizationId));
      }

      const rows = await ctx.db.query.tasks.findMany({
        where:
          conditions.length > 1
            ? and(...conditions)
            : conditions[0] ?? undefined,
        with: { comments: true },
        orderBy: (taskTable, { desc }) => [desc(taskTable.createdAt)],
      });

      return await attachWorkflowSummaries(ctx, rows);
    }),

  get: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(tasks.id, input.id)];
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(tasks.organizationId, ctx.organizationId));
      }

      const task = await ctx.db.query.tasks.findFirst({
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
        with: { comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] } },
      });

      if (!task) {
        return null;
      }

      const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
      return withSummary;
    }),

  create: orgProcedure.input(taskCreateInput).mutation(async ({ ctx, input }) => {
    const id = generateTaskSlug(input.title);
    const workflowMode = input.workflowMode ?? "simple";
    const orgId = ctx.isAgent ? input.organizationId ?? null : ctx.organizationId;
    const assignor = input.assignor ?? (ctx.user?.name || "operator");
    const initialStatus =
      workflowMode === "complex"
        ? input.assignee
          ? "doing"
          : "todo"
        : input.status ?? "todo";

    const [task] = await ctx.db
      .insert(tasks)
      .values({
        id,
        title: input.title,
        description: input.description,
        status: initialStatus,
        category: input.category ?? null,
        workflowMode,
        assignor,
        assignee: input.assignee,
        dueDate: input.dueDate,
        urgent: input.urgent ?? false,
        important: input.important ?? false,
        campaignId: input.campaignId,
        organizationId: orgId,
      })
      .returning();

    if (workflowMode === "complex") {
      await kickoffComplexTask({
        ctx,
        task: {
          id: task.id,
          title: task.title,
          description: task.description ?? null,
          assignee: task.assignee ?? null,
          assignor: task.assignor ?? null,
          category: task.category ?? null,
          campaignId: task.campaignId ?? null,
        },
      });
      const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
      return withSummary;
    }

    const notificationAgentId = resolveSimpleTaskNotificationAgentId({
      isAgent: ctx.isAgent,
      assignee: task.assignee ?? null,
      leadAgentId: ctx.leadAgentId,
    });
    if (!notificationAgentId) {
      const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
      return withSummary;
    }

    const sessionKey = `agent:${notificationAgentId}:task:${id}`;
    const taskPayload: Record<string, unknown> = buildSimpleTaskPayload({
      ...task,
      category: input.category ?? null,
      campaignId: input.campaignId ?? null,
    });

    if (input.campaignId) {
      const chain = await fetchMissionChain(ctx.db, input.campaignId);
      if (chain) {
        taskPayload.missionContext = formatMissionContext(chain);
      }
    }

    ctx.waitUntil(
      notifyAgent(ctx, {
        agentId: notificationAgentId,
        message: JSON.stringify(taskPayload),
        sessionKey,
      }),
    );

    const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
    return withSummary;
  }),

  update: orgProcedure.input(taskUpdateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.query.tasks.findFirst({
      where: eq(tasks.id, input.id),
    });

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Task ${input.id} not found.`,
      });
    }

    const nextWorkflowMode = input.workflowMode ?? existing.workflowMode;
    const assigneeChanged = input.assignee !== undefined && input.assignee !== existing.assignee;
    const shouldKickoffComplexTask =
      nextWorkflowMode === "complex" &&
      (existing.workflowMode !== "complex" || assigneeChanged);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.assignor !== undefined) {
      updateData.assignor = input.assignor;
    }
    if (input.category !== undefined) {
      updateData.category = input.category;
    }
    if (input.assignee !== undefined) {
      updateData.assignee = input.assignee;
    }
    if (input.dueDate !== undefined) {
      updateData.dueDate = input.dueDate;
    }
    if (input.urgent !== undefined) {
      updateData.urgent = input.urgent;
    }
    if (input.important !== undefined) {
      updateData.important = input.important;
    }
    if (input.campaignId !== undefined) {
      updateData.campaignId = input.campaignId;
    }
    if (input.workflowMode !== undefined) {
      updateData.workflowMode = input.workflowMode;
    }
    if (input.status !== undefined && nextWorkflowMode === "simple") {
      updateData.status = input.status;
    }

    const [task] = await ctx.db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, input.id))
      .returning();

    if (shouldKickoffComplexTask) {
      await kickoffComplexTask({
        ctx,
        task: {
          id: task.id,
          title: task.title,
          description: task.description ?? null,
          assignee: task.assignee ?? null,
          assignor: task.assignor ?? null,
          category: task.category ?? null,
          campaignId: task.campaignId ?? null,
        },
      });
      const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
      return withSummary;
    }

    if (existing.workflowMode === "complex" && nextWorkflowMode === "simple") {
      await Promise.all([
        ctx.db.delete(taskSessions).where(eq(taskSessions.taskId, task.id)),
        ctx.db.delete(taskSubtasks).where(eq(taskSubtasks.taskId, task.id)),
        ctx.db.delete(taskWorkflows).where(eq(taskWorkflows.taskId, task.id)),
      ]);
    }

    if (task && assigneeChanged && task.assignee) {
      const sessionKey = `agent:${task.assignee}:task:${task.id}`;
      ctx.waitUntil(
        notifyAgent(ctx, {
          agentId: task.assignee,
          message: JSON.stringify({
            type: "task.assigned",
            task: {
              id: task.id,
              title: task.title,
              description: task.description ?? null,
              status: task.status,
              category: task.category ?? null,
              urgent: task.urgent,
              important: task.important,
              assignor: task.assignor,
              assignee: task.assignee,
            },
          }),
          sessionKey,
        }),
      );
    }

    const [withSummary] = await attachWorkflowSummaries(ctx, [task]);
    return withSummary;
  }),

  delete: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db.select().from(tasks).where(eq(tasks.id, input.id));

      if (task) {
        await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      }

      return { success: true };
    }),
});
