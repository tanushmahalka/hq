export const TASK_STATUSES = [
  "todo",
  "doing",
  "stuck",
  "in_review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  doing: "Doing",
  stuck: "Stuck",
  in_review: "In Review",
  done: "Done",
};
