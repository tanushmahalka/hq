type TaskLike = {
  title?: string | null;
};

export function formatTaskNotification(
  action: "created" | "updated" | "deleted" | "commented",
  task: TaskLike,
) {
  const title = task.title?.trim() || "Untitled task";
  return `${title} ${action}`;
}

export function useTaskNotify() {
  return (_assignee: string, _taskId: string, _message: string) => {
    // Notifications are temporarily disabled during the API migration.
  };
}
