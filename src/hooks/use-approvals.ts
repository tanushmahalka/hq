import { createContext, useContext } from "react";
import type { TaskStatus } from "@shared/types";
import type {
  TaskWorkflowMode,
  TaskWorkflowSummary,
} from "@shared/task-workflow";

export type ApprovalDecision = "approve" | "deny";

export type PendingApproval = {
  id: string;
  request: {
    title: string;
    body: string;
    sessionKey: string;
    agentId?: string | null;
  };
  createdAtMs: number;
  resolvedAtMs?: number;
  decision?: ApprovalDecision;
  feedback?: string | null;
  resolvedBy?: string | null;
};

export type BoardApprovalSummary = {
  count: number;
  latestCreatedAtMs: number;
  approvals: PendingApproval[];
  latestApproval: PendingApproval;
};

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  workflowMode?: TaskWorkflowMode;
  workflowSummary?: TaskWorkflowSummary | null;
  assignee: string | null;
  dueDate: Date | string | null;
  urgent: boolean;
  important: boolean;
  campaignId?: number | null;
  createdAt?: Date | string | null;
};

export type TaskBoardItem = {
  kind: "task";
  id: string;
  task: BoardTask;
  displayStatus: TaskStatus;
  approvalSummary?: BoardApprovalSummary;
};

export type StandaloneApprovalBoardItem = {
  kind: "standalone-approval";
  id: string;
  approval: PendingApproval;
  displayStatus: "stuck";
};

export type TaskBoardItemUnion = TaskBoardItem | StandaloneApprovalBoardItem;

export type ApprovalsContextValue = {
  approvals: PendingApproval[];
  pendingCount: number;
  approvalsOpen: boolean;
  setApprovalsOpen: (open: boolean) => void;
  toggleApprovals: () => void;
  resolveApproval: (input: {
    id: string;
    decision: ApprovalDecision;
    feedback?: string;
  }) => Promise<void>;
  isResolving: (id: string) => boolean;
};

export const ApprovalsContext = createContext<ApprovalsContextValue | null>(null);

export function parseTaskIdFromApprovalSession(sessionKey: string): string | null {
  const match = sessionKey.match(/:task:([^:]+)/);
  return match?.[1] ?? null;
}

export function approvalBelongsToTask(
  approval: PendingApproval,
  task: Pick<BoardTask, "id" | "workflowMode" | "workflowSummary">,
): boolean {
  if (
    task.workflowMode === "complex" &&
    task.workflowSummary?.sessionKeys?.includes(approval.request.sessionKey)
  ) {
    return true;
  }

  return parseTaskIdFromApprovalSession(approval.request.sessionKey) === task.id;
}

export function buildApprovalSummary(approvals: PendingApproval[]): BoardApprovalSummary | null {
  if (approvals.length === 0) {
    return null;
  }
  const sorted = [...approvals].sort((a, b) => b.createdAtMs - a.createdAtMs);
  return {
    count: sorted.length,
    latestCreatedAtMs: sorted[0].createdAtMs,
    approvals: sorted,
    latestApproval: sorted[0],
  };
}

export function useApprovals() {
  const context = useContext(ApprovalsContext);
  if (!context) {
    throw new Error("useApprovals must be used within ApprovalProvider");
  }
  return context;
}
