import { useMemo } from "react";
import { TASK_STATUSES, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";
import {
  buildApprovalSummary,
  parseTaskIdFromApprovalSession,
  useApprovals,
  type BoardTask,
  type PendingApproval,
  type TaskBoardItemUnion,
} from "./use-approvals";

type TaskBucket = Record<TaskStatus, TaskBoardItemUnion[]>;

function createEmptyBuckets(): TaskBucket {
  return TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as TaskBucket,
  );
}

function getDateValue(value: Date | string | null | undefined): number {
  if (!value) {
    return 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortStuckItems(items: TaskBoardItemUnion[]): TaskBoardItemUnion[] {
  return [...items].sort((left, right) => {
    const leftGroup =
      left.kind === "task" && left.approvalSummary
        ? 0
        : left.kind === "standalone-approval"
          ? 1
          : 2;
    const rightGroup =
      right.kind === "task" && right.approvalSummary
        ? 0
        : right.kind === "standalone-approval"
          ? 1
          : 2;
    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    const leftTs =
      left.kind === "standalone-approval"
        ? left.approval.createdAtMs
        : left.approvalSummary?.latestCreatedAtMs ?? getDateValue(left.task.createdAt);
    const rightTs =
      right.kind === "standalone-approval"
        ? right.approval.createdAtMs
        : right.approvalSummary?.latestCreatedAtMs ?? getDateValue(right.task.createdAt);
    return rightTs - leftTs;
  });
}

function sortDefaultItems(items: TaskBoardItemUnion[]): TaskBoardItemUnion[] {
  return [...items].sort((left, right) => {
    if (left.kind !== "task" || right.kind !== "task") {
      return 0;
    }
    return getDateValue(right.task.createdAt) - getDateValue(left.task.createdAt);
  });
}

export function useTaskBoardItems() {
  const { approvals } = useApprovals();
  const { data: tasks, isLoading } = trpc.task.list.useQuery();

  const itemsByStatus = useMemo(() => {
    const buckets = createEmptyBuckets();
    const taskList = (tasks ?? []) as BoardTask[];
    const taskIds = new Set(taskList.map((task) => task.id));
    const workflowTaskBySessionKey = new Map<string, string>();
    const approvalsByTaskId = new Map<string, PendingApproval[]>();
    const standaloneApprovals: PendingApproval[] = [];

    for (const task of taskList) {
      if (task.workflowMode !== "complex") {
        continue;
      }
      for (const sessionKey of task.workflowSummary?.sessionKeys ?? []) {
        workflowTaskBySessionKey.set(sessionKey, task.id);
      }
    }

    for (const approval of approvals) {
      const taskId =
        workflowTaskBySessionKey.get(approval.request.sessionKey) ??
        parseTaskIdFromApprovalSession(approval.request.sessionKey);
      if (!taskId || !taskIds.has(taskId)) {
        standaloneApprovals.push(approval);
        continue;
      }
      const current = approvalsByTaskId.get(taskId) ?? [];
      current.push(approval);
      approvalsByTaskId.set(taskId, current);
    }

    for (const task of taskList) {
      const taskApprovals = approvalsByTaskId.get(task.id) ?? [];
      const approvalSummary = buildApprovalSummary(taskApprovals) ?? undefined;
      const displayStatus = approvalSummary ? "stuck" : task.status;
      buckets[displayStatus].push({
        kind: "task",
        id: task.id,
        task,
        displayStatus,
        approvalSummary,
      });
    }

    for (const approval of standaloneApprovals) {
      buckets.stuck.push({
        kind: "standalone-approval",
        id: approval.id,
        approval,
        displayStatus: "stuck",
      });
    }

    for (const status of TASK_STATUSES) {
      buckets[status] =
        status === "stuck" ? sortStuckItems(buckets[status]) : sortDefaultItems(buckets[status]);
    }

    return buckets;
  }, [approvals, tasks]);

  return {
    itemsByStatus,
    isLoading,
  };
}
