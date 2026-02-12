import { Calendar, CircleAlert, Star, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TaskStatusDropdown } from "./task-status-dropdown";
import type { TaskStatus } from "@shared/types";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    assignee: string | null;
    dueDate: Date | null;
    urgent: boolean;
    important: boolean;
  };
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const utils = trpc.useUtils();

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ id: task.id, status });
  };

  const hasPriority = task.urgent || task.important;

  return (
    <div
      className="group cursor-pointer rounded-lg border bg-background p-3 transition-all hover:border-foreground/20 hover:shadow-sm"
      onClick={onClick}
    >
      {/* Title + priority indicators */}
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-sm font-medium leading-snug">{task.title}</h3>
        {hasPriority && (
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {task.urgent && (
              <CircleAlert className="size-3.5 text-red-500" />
            )}
            {task.important && (
              <Star className="size-3.5 text-amber-500 fill-amber-500" />
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
          {task.assignee && (
            <span className="flex items-center gap-1 truncate">
              <User className="size-3 shrink-0" />
              <span className="truncate">{task.assignee}</span>
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="size-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        <TaskStatusDropdown
          value={task.status}
          onValueChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
