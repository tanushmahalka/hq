import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskCard } from "./task-card";
import { StandaloneApprovalCard } from "./standalone-approval-card";
import { STATUS_LABELS, type TaskStatus } from "@shared/types";
import type { TaskBoardItemUnion } from "@/hooks/use-approvals";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "text-gray-400",
  doing: "text-[var(--swarm-violet)]",
  stuck: "text-red-400",
  done: "text-[var(--swarm-mint)]",
};

interface KanbanColumnProps {
  status: TaskStatus;
  items: TaskBoardItemUnion[];
  onTaskClick: (taskId: string) => void;
  onApprovalClick: (approvalId: string) => void;
  onAdd: () => void;
}

export function KanbanColumn({
  status,
  items,
  onTaskClick,
  onApprovalClick,
  onAdd,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[290px] flex-1 rounded-2xl border border-border bg-card/60 dark:bg-card/40">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className={`swarm-status-dot ${STATUS_DOT_COLORS[status]} ${status === "doing" ? "active" : ""}`} style={{ backgroundColor: "currentColor" }} />
        <h2 className="text-sm font-medium text-foreground">{STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted-foreground/50 tabular-nums">{items.length}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7 text-muted-foreground/40 hover:text-foreground"
          onClick={onAdd}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-2.5 pb-2.5 space-y-2">
        {items.map((item) =>
          item.kind === "task" ? (
            <TaskCard
              key={item.id}
              task={item.task}
              approvalSummary={item.approvalSummary}
              onClick={() => onTaskClick(item.task.id)}
            />
          ) : (
            <StandaloneApprovalCard
              key={item.id}
              approval={item.approval}
              onOpen={() => onApprovalClick(item.approval.id)}
            />
          ),
        )}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground/40 text-center py-12">
            {status === "stuck" ? "Nothing blocked right now" : "No tasks yet"}
          </p>
        )}
      </div>
    </div>
  );
}
