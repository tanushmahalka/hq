import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  taskSessions,
  taskSubtasks,
  tasks,
} from "../../../drizzle/schema/core.ts";
import {
  TASK_SESSION_ROLES,
  TASK_SUBTASK_STATUSES,
} from "../../../shared/task-workflow.ts";
import {
  fetchTaskWorkflowDetail,
  findTaskWorkflowDetailBySessionKey,
  linkTaskSession,
  normalizeSubtaskStatusForCompletion,
  resolveWorkflowStatusFromSubtasks,
  summarizeWorkflow,
  syncTaskWithWorkflowStatus,
  upsertTaskWorkflow,
} from "../../lib/task-workflow.ts";
import { router, orgProcedure } from "../init.ts";

const workflowLookupInput = z
  .object({
    taskId: z.string().min(1).optional(),
    sessionKey: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.taskId || value.sessionKey), {
    message: "taskId or sessionKey is required",
    path: ["taskId"],
  });

const taskSubtaskInput = z.object({
  title: z.string().min(1),
  instructions: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
});

async function resolveWorkflowTaskOrThrow(params: {
  ctx: {
    db: Parameters<typeof fetchTaskWorkflowDetail>[0];
    isAgent: boolean;
    organizationId: string | null;
  };
  taskId?: string;
  sessionKey?: string;
}) {
  if (params.sessionKey) {
    const detail = await findTaskWorkflowDetailBySessionKey(
      params.ctx.db,
      params.sessionKey,
    );
    if (!detail) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `No workflow session found for ${params.sessionKey}.`,
      });
    }
    if (
      !params.ctx.isAgent &&
      params.ctx.organizationId &&
      detail.task.organizationId !== params.ctx.organizationId
    ) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    if (detail.task.workflowMode !== "complex") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Task ${detail.task.id} is not a complex workflow task.`,
      });
    }
    return detail;
  }

  const task = await params.ctx.db.query.tasks.findFirst({
    where: eq(tasks.id, params.taskId!),
  });
  if (!task) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Task ${params.taskId} not found.`,
    });
  }
  if (
    !params.ctx.isAgent &&
    params.ctx.organizationId &&
    task.organizationId !== params.ctx.organizationId
  ) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (task.workflowMode !== "complex") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Task ${task.id} is not a complex workflow task.`,
    });
  }

  const bundle = await fetchTaskWorkflowDetail(params.ctx.db, task.id);
  return {
    task,
    ...bundle,
    summary: summarizeWorkflow(task.workflowMode, bundle),
  };
}

async function syncWorkflowFromSubtasks(params: {
  ctx: { db: Parameters<typeof fetchTaskWorkflowDetail>[0] };
  taskId: string;
}) {
  const bundle = await fetchTaskWorkflowDetail(params.ctx.db, params.taskId);
  const workflowStatus = resolveWorkflowStatusFromSubtasks(bundle.subtasks);
  await upsertTaskWorkflow(params.ctx.db, {
    taskId: params.taskId,
    status: workflowStatus,
    startedAt: bundle.workflow?.startedAt ?? new Date(),
    completedAt: workflowStatus === "completed" ? new Date() : null,
    planPath: bundle.workflow?.planPath ?? null,
    planSummary: bundle.workflow?.planSummary ?? null,
  });
  await syncTaskWithWorkflowStatus(params.ctx.db, {
    taskId: params.taskId,
    workflowStatus,
  });
  return workflowStatus;
}

export const workflowRouter = router({
  get: orgProcedure.input(workflowLookupInput).query(async ({ ctx, input }) => {
    return await resolveWorkflowTaskOrThrow({
      ctx,
      taskId: input.taskId,
      sessionKey: input.sessionKey,
    });
  }),

  recordPlan: orgProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        planPath: z.string().min(1),
        planSummary: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await resolveWorkflowTaskOrThrow({
        ctx,
        taskId: input.taskId,
      });
      const workflow = await upsertTaskWorkflow(ctx.db, {
        taskId: detail.task.id,
        status: "planning",
        planPath: input.planPath,
        planSummary: input.planSummary ?? null,
        startedAt: detail.workflow?.startedAt ?? new Date(),
        completedAt: null,
      });
      await syncTaskWithWorkflowStatus(ctx.db, {
        taskId: detail.task.id,
        workflowStatus: "planning",
      });
      return workflow;
    }),

  setSubtasks: orgProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        subtasks: z.array(taskSubtaskInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await resolveWorkflowTaskOrThrow({
        ctx,
        taskId: input.taskId,
      });

      if (detail.subtasks.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Subtasks have already been recorded for this workflow.",
        });
      }

      const inserted = await ctx.db
        .insert(taskSubtasks)
        .values(
          input.subtasks.map((subtask, index) => ({
            taskId: input.taskId,
            position: index + 1,
            title: subtask.title,
            instructions: subtask.instructions ?? null,
            acceptanceCriteria: subtask.acceptanceCriteria ?? null,
          })),
        )
        .returning();

      await upsertTaskWorkflow(ctx.db, {
        taskId: detail.task.id,
        status: "executing",
        planPath: detail.workflow?.planPath ?? null,
        planSummary: detail.workflow?.planSummary ?? null,
        startedAt: detail.workflow?.startedAt ?? new Date(),
        completedAt: null,
      });
      await syncTaskWithWorkflowStatus(ctx.db, {
        taskId: detail.task.id,
        workflowStatus: "executing",
      });

      return inserted;
    }),

  updateSubtask: orgProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        subtaskId: z.number().int().positive(),
        status: z.enum(TASK_SUBTASK_STATUSES).optional(),
        latestWorkerSummary: z.string().nullable().optional(),
        latestValidatorSummary: z.string().nullable().optional(),
        latestFeedback: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await resolveWorkflowTaskOrThrow({
        ctx,
        taskId: input.taskId,
      });
      const subtask = detail.subtasks.find((entry) => entry.id === input.subtaskId);
      if (!subtask) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Subtask ${input.subtaskId} not found.`,
        });
      }

      if (input.status === "running") {
        const otherRunning = detail.subtasks.find(
          (entry) => entry.id !== input.subtaskId && entry.status === "running",
        );
        if (otherRunning) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Subtask ${otherRunning.id} is already running.`,
          });
        }
      }

      const nextStatus = input.status ?? subtask.status;
      const [updated] = await ctx.db
        .update(taskSubtasks)
        .set({
          status: nextStatus,
          latestWorkerSummary:
            input.latestWorkerSummary !== undefined
              ? input.latestWorkerSummary
              : subtask.latestWorkerSummary,
          latestValidatorSummary:
            input.latestValidatorSummary !== undefined
              ? input.latestValidatorSummary
              : subtask.latestValidatorSummary,
          latestFeedback:
            input.latestFeedback !== undefined
              ? input.latestFeedback
              : subtask.latestFeedback,
          startedAt:
            nextStatus === "running"
              ? subtask.startedAt ?? new Date()
              : subtask.startedAt,
          completedAt:
            input.status !== undefined
              ? normalizeSubtaskStatusForCompletion(nextStatus).completedAt
              : subtask.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(taskSubtasks.id, input.subtaskId))
        .returning();

      await syncWorkflowFromSubtasks({
        ctx,
        taskId: input.taskId,
      });

      return updated;
    }),

  linkSession: orgProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        sessionKey: z.string().min(1),
        role: z.enum(TASK_SESSION_ROLES),
        subtaskId: z.number().int().positive().nullable().optional(),
        agentId: z.string().nullable().optional(),
        parentSessionKey: z.string().nullable().optional(),
        startedAt: z.date().optional(),
        completedAt: z.date().nullable().optional(),
        endedAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await resolveWorkflowTaskOrThrow({
        ctx,
        taskId: input.taskId,
      });

      if (
        input.subtaskId &&
        !detail.subtasks.some((subtask) => subtask.id === input.subtaskId)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Subtask ${input.subtaskId} not found.`,
        });
      }

      return await linkTaskSession(ctx.db, {
        taskId: input.taskId,
        sessionKey: input.sessionKey,
        role: input.role,
        subtaskId: input.subtaskId ?? null,
        agentId: input.agentId ?? null,
        parentSessionKey: input.parentSessionKey ?? null,
        startedAt: input.startedAt ?? new Date(),
        completedAt: input.completedAt ?? null,
        endedAt: input.endedAt ?? null,
      });
    }),

  complete: orgProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const detail = await resolveWorkflowTaskOrThrow({
        ctx,
        taskId: input.taskId,
      });

      if (detail.subtasks.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot complete a workflow before subtasks are recorded.",
        });
      }

      const unfinished = detail.subtasks.filter((subtask) => subtask.status !== "done");
      if (unfinished.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "All subtasks must be marked done before completing the workflow.",
        });
      }

      const workflow = await upsertTaskWorkflow(ctx.db, {
        taskId: input.taskId,
        status: "completed",
        planPath: detail.workflow?.planPath ?? null,
        planSummary: detail.workflow?.planSummary ?? null,
        startedAt: detail.workflow?.startedAt ?? new Date(),
        completedAt: new Date(),
      });
      await syncTaskWithWorkflowStatus(ctx.db, {
        taskId: input.taskId,
        workflowStatus: "completed",
      });

      for (const session of detail.sessions) {
        if (session.endedAt) {
          continue;
        }
        await ctx.db
          .update(taskSessions)
          .set({
            completedAt: session.completedAt ?? new Date(),
            endedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(taskSessions.id, session.id));
      }

      return workflow;
    }),
});
