export const TASK_WORKFLOW_MODES = ["simple", "complex"] as const;
export type TaskWorkflowMode = (typeof TASK_WORKFLOW_MODES)[number];

export const TASK_WORKFLOW_STATUSES = [
  "pending_assignment",
  "planning",
  "executing",
  "blocked",
  "completed",
] as const;
export type TaskWorkflowStatus = (typeof TASK_WORKFLOW_STATUSES)[number];

export const TASK_SUBTASK_STATUSES = [
  "pending",
  "running",
  "needs_revision",
  "done",
] as const;
export type TaskSubtaskStatus = (typeof TASK_SUBTASK_STATUSES)[number];

export const TASK_SESSION_ROLES = [
  "root",
  "planner",
  "worker",
  "validator",
] as const;
export type TaskSessionRole = (typeof TASK_SESSION_ROLES)[number];

export const TASK_WORKFLOW_STATUS_LABELS: Record<TaskWorkflowStatus, string> = {
  pending_assignment: "Pending Assignment",
  planning: "Planning",
  executing: "Executing",
  blocked: "Blocked",
  completed: "Completed",
};

export const TASK_SUBTASK_STATUS_LABELS: Record<TaskSubtaskStatus, string> = {
  pending: "Pending",
  running: "Running",
  needs_revision: "Needs Revision",
  done: "Done",
};

export type TaskWorkflowSummary = {
  mode: TaskWorkflowMode;
  status: TaskWorkflowStatus | null;
  planPath: string | null;
  planSummary: string | null;
  totalSubtasks: number;
  completedSubtasks: number;
  activeSubtaskId: number | null;
  blockedSubtaskId: number | null;
  rootAgentId: string | null;
  sessionKeys: string[];
};
