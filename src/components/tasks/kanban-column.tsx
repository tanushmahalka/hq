import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskCard } from "./task-card";
import { STATUS_LABELS, type TaskStatus } from "@shared/types";

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "border-t-gray-400",
  doing: "border-t-blue-500",
  stuck: "border-t-red-500",
  in_review: "border-t-yellow-500",
  done: "border-t-green-500",
};

const STATUS_BADGE_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  doing: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  stuck: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  in_review:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  dueDate: Date | null;
  urgent: boolean;
  important: boolean;
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onAdd: () => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onAdd }: KanbanColumnProps) {
  return (
    <div
      className={`flex flex-col min-w-[280px] flex-1 rounded-lg border border-t-4 ${STATUS_COLORS[status]} bg-muted/30`}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
        <Badge
          variant="secondary"
          className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE_COLORS[status]}`}
        >
          {tasks.length}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-6"
          onClick={onAdd}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}
