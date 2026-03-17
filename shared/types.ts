export const TASK_STATUSES = [
  "todo",
  "doing",
  "stuck",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_CATEGORIES = ["seo", "marketing"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  doing: "Doing",
  stuck: "Stuck",
  done: "Done",
};

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  seo: "SEO",
  marketing: "Marketing",
};
