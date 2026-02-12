import { Calendar, CircleAlert, Star, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTaskNotify } from "@/hooks/use-task-notify";
import { useTaskActive } from "@/hooks/use-task-active";
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
  const { notify } = useTaskNotify();
  const active = useTaskActive(task.id);

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (data) => {
      utils.task.list.invalidate();
      notify("updated", data);
    },
  });

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ id: task.id, status });
  };

  const hasPriority = task.urgent || task.important;

  const isDoing = task.status === "doing";

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-background p-3 transition-all hover:border-foreground/20 hover:shadow-sm ${isDoing ? "border-blue-500/20 bg-blue-500/[0.02]" : ""}`}
      onClick={onClick}
    >
      {(active || isDoing) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              background: active 
                ? "linear-gradient(90deg, transparent 0%, var(--foreground) 50%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, oklch(0.585 0.233 277.117 / 0.3) 50%, transparent 100%)",
              opacity: active ? 0.35 : 1,
              animation: active 
                ? "shimmer-edge 2s ease-in-out infinite"
                : "shimmer-edge 4s linear infinite",
            }}
          />
        </div>
      )}
      {/* Title + priority indicators */}
      <div className="flex items-start gap-2">
        {task.status === "doing" && (
          <div className="mt-1.5 shrink-0">
            <div className="relative flex size-2">
              <div className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
              <div className="relative inline-flex size-2 rounded-full bg-blue-500"></div>
            </div>
          </div>
        )}
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
