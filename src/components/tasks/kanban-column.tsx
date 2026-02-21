import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskCard } from "./task-card";
import { STATUS_LABELS, type TaskStatus } from "@shared/types";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "text-gray-400",
  doing: "text-[var(--swarm-violet)]",
  stuck: "text-red-400",
  done: "text-[var(--swarm-mint)]",
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
    <div className="flex flex-col min-w-[280px] flex-1 rounded-xl border border-border/50 bg-card/50 dark:swarm-glass">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className={`swarm-status-dot ${STATUS_DOT_COLORS[status]} ${status === "doing" ? "active" : ""}`} style={{ backgroundColor: "currentColor" }} />
        <h2 className="text-sm font-normal text-foreground">{STATUS_LABELS[status]}</h2>
        <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">{tasks.length}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-6 text-muted-foreground/40 hover:text-foreground"
          onClick={onAdd}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}
