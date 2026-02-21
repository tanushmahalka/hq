export const TASK_STATUSES = [
  "todo",
  "doing",
  "stuck",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  doing: "Doing",
  stuck: "Stuck",
  done: "Done",
};
