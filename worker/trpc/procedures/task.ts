import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  TASK_CATEGORIES,
  type TaskCategory,
  TASK_STATUSES,
} from "../../../shared/types.ts";
import { generateTaskSlug } from "../../../shared/slug.ts";
import { notifyAgent } from "../../lib/notify-agent.ts";
import {
  fetchMissionChain,
  formatMissionContext,
} from "../../lib/mission-chain.ts";
import { tasks } from "../../../drizzle/schema/core.ts";
import { router, orgProcedure } from "../init.ts";

const taskCreateInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).nullable().optional(),
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

function buildTaskPayload(params: {
  type: "task.created" | "task.assigned";
  task: {
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
  };
  missionContext?: string;
}) {
  return {
    type: params.type,
    task: {
      id: params.task.id,
      title: params.task.title,
      description: params.task.description ?? null,
      status: params.task.status,
      category: params.task.category ?? null,
      urgent: params.task.urgent,
      important: params.task.important,
      assignor: params.task.assignor ?? null,
      assignee: params.task.assignee ?? null,
      campaignId: params.task.campaignId ?? null,
    },
    ...(params.missionContext
      ? { missionContext: params.missionContext }
      : {}),
  };
}

async function buildMissionContext(
  db: Parameters<typeof fetchMissionChain>[0],
  campaignId?: number | null,
) {
  if (!campaignId) {
    return undefined;
  }

  const chain = await fetchMissionChain(db, campaignId);
  return chain ? formatMissionContext(chain) : undefined;
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

      return await ctx.db.query.tasks.findMany({
        where:
          conditions.length > 1
            ? and(...conditions)
            : conditions[0] ?? undefined,
        with: { comments: true },
        orderBy: (taskTable, { desc }) => [desc(taskTable.createdAt)],
      });
    }),

  get: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(tasks.id, input.id)];
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(tasks.organizationId, ctx.organizationId));
      }

      return (
        (await ctx.db.query.tasks.findFirst({
          where: conditions.length > 1 ? and(...conditions) : conditions[0],
          with: { comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] } },
        })) ?? null
      );
    }),

  create: orgProcedure.input(taskCreateInput).mutation(async ({ ctx, input }) => {
    const id = generateTaskSlug(input.title);
    const organizationId = ctx.isAgent
      ? input.organizationId ?? null
      : ctx.organizationId;
    const assignor = input.assignor ?? (ctx.user?.name || "operator");

    const [task] = await ctx.db
      .insert(tasks)
      .values({
        id,
        title: input.title,
        description: input.description,
        status: input.status ?? "todo",
        category: input.category ?? null,
        assignor,
        assignee: input.assignee,
        dueDate: input.dueDate,
        urgent: input.urgent ?? false,
        important: input.important ?? false,
        campaignId: input.campaignId,
        organizationId,
      })
      .returning();

    const notificationAgentId = resolveSimpleTaskNotificationAgentId({
      isAgent: ctx.isAgent,
      assignee: task.assignee ?? null,
      leadAgentId: ctx.leadAgentId,
    });

    if (notificationAgentId) {
      const missionContext = await buildMissionContext(ctx.db, task.campaignId);
      ctx.waitUntil(
        notifyAgent(ctx, {
          agentId: notificationAgentId,
          message: JSON.stringify(
            buildTaskPayload({
              type: "task.created",
              task,
              missionContext,
            }),
          ),
          sessionKey: `agent:${notificationAgentId}:task:${task.id}`,
        }),
      );
    }

    return task;
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.category !== undefined) {
      updateData.category = input.category;
    }
    if (input.assignor !== undefined) {
      updateData.assignor = input.assignor;
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

    const [task] = await ctx.db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, input.id))
      .returning();

    const assigneeChanged =
      input.assignee !== undefined && input.assignee !== existing.assignee;

    if (task && assigneeChanged && task.assignee) {
      const missionContext = await buildMissionContext(ctx.db, task.campaignId);
      ctx.waitUntil(
        notifyAgent(ctx, {
          agentId: task.assignee,
          message: JSON.stringify(
            buildTaskPayload({
              type: "task.assigned",
              task,
              missionContext,
            }),
          ),
          sessionKey: `agent:${task.assignee}:task:${task.id}`,
        }),
      );
    }

    return task;
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
