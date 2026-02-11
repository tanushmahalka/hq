import { Card } from "@/components/ui/card";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { Calendar, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
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

  return (
    <Card
      className="cursor-pointer gap-2 p-3 hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug">{task.title}</h3>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <TaskPriorityBadge urgent={task.urgent} important={task.important} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.assignee && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {task.assignee}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <TaskStatusDropdown
            value={task.status}
            onValueChange={handleStatusChange}
          />
        </div>
      </div>
    </Card>
  );
}
