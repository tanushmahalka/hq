import { Calendar, CircleAlert, Link2, ShieldAlert, Star, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useTaskActive } from "@/hooks/use-task-active";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { TASK_CATEGORY_LABELS, type TaskCategory, type TaskStatus } from "@shared/types";
import type { TaskWorkflowSummary } from "@shared/task-workflow";
import type { BoardApprovalSummary } from "@/hooks/use-approvals";

function formatApprovalTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWorkflowBadge(summary?: TaskWorkflowSummary | null): string | null {
  if (!summary || summary.mode !== "complex") {
    return null;
  }

  switch (summary.status) {
    case "pending_assignment":
      return "Awaiting assignee";
    case "planning":
      return "Planning";
    case "executing":
      return summary.totalSubtasks > 0
        ? `${summary.completedSubtasks}/${summary.totalSubtasks} done`
        : "Preparing subtasks";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Workflow complete";
    default:
      return "Complex";
  }
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    category?: TaskCategory | null;
    workflowMode?: "simple" | "complex";
    workflowSummary?: TaskWorkflowSummary | null;
    assignee: string | null;
    dueDate: Date | string | null;
    urgent: boolean;
    important: boolean;
    campaignId?: number | null;
  };
  onClick: () => void;
  approvalSummary?: BoardApprovalSummary;
}

export function TaskCard({ task, onClick, approvalSummary }: TaskCardProps) {
  const utils = trpc.useUtils();
  const active = useTaskActive(task.id, task.workflowSummary?.sessionKeys);
  const notifyTask = useTaskNotify();
  const workflowBadge = formatWorkflowBadge(task.workflowSummary);

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (updated) => {
      utils.task.list.invalidate();
      if (updated?.workflowMode !== "complex" && updated?.assignee) {
        notifyTask(updated.assignee, updated.id, formatTaskNotification("updated", updated));
      }
    },
  });

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ id: task.id, status });
  };

  const hasPriority = task.urgent || task.important;
  const isDoing = task.status === "doing";
  const isWaitingOnApproval = Boolean(approvalSummary);

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 swarm-card ${
        isWaitingOnApproval
          ? "border-amber-500/25 bg-amber-500/10 hover:border-amber-500/35"
          : isDoing
          ? "border-[var(--swarm-violet)]/30 bg-[var(--swarm-violet-dim)]"
          : "border-border hover:border-border dark:border-border/60 dark:hover:border-border"
      }`}
      onClick={onClick}
    >
      {/* Shimmer — violet for active, subtle for doing */}
      {(active || isDoing) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
              opacity: active ? 0.6 : 0.25,
              animation: active
                ? "swarm-shimmer 2s ease-in-out infinite"
                : "swarm-shimmer 4s linear infinite",
            }}
          />
        </div>
      )}

      {/* Title + priority */}
      <div className="flex items-start gap-2">
        {isDoing && (
          <div className="mt-1.5 shrink-0">
            <div className="relative flex size-2">
              <div className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "var(--swarm-violet)" }} />
              <div className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: "var(--swarm-violet)" }} />
            </div>
          </div>
        )}
        <h3 className="flex-1 text-sm font-medium leading-snug">{task.title}</h3>
        {hasPriority && (
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {task.urgent && (
              <CircleAlert className="size-3.5 text-red-400" />
            )}
            {task.important && (
              <Star className="size-3.5 text-amber-400 fill-amber-400" />
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      {task.category ? (
        <div className="mt-3">
          <Badge
            variant="secondary"
            className="bg-[var(--swarm-violet-dim)] text-[10px] text-[var(--swarm-violet)]"
          >
            {TASK_CATEGORY_LABELS[task.category]}
          </Badge>
        </div>
      ) : null}

      {approvalSummary ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <ShieldAlert className="size-3.5" />
              Waiting for approval
            </span>
            <Badge variant="secondary" className="bg-amber-500/15 text-[10px] text-amber-800 dark:text-amber-200">
              {approvalSummary.count} pending
            </Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {approvalSummary.latestApproval.request.title}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            Latest request {formatApprovalTimestamp(approvalSummary.latestCreatedAtMs)}
          </p>
        </div>
      ) : null}

      {workflowBadge ? (
        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              task.workflowSummary?.status === "blocked"
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : task.workflowSummary?.status === "planning"
                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  : "bg-[var(--swarm-violet-dim)] text-[var(--swarm-violet)]"
            }`}
          >
            {workflowBadge}
          </Badge>
          {task.workflowSummary?.rootAgentId ? (
            <span className="text-[11px] text-muted-foreground/60">
              root {task.workflowSummary.rootAgentId}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Campaign link */}
      {task.campaignId && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <Link2 className="size-3 shrink-0" />
          <span className="truncate">#{task.campaignId}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 min-w-0">
          {task.assignee && (
            <span className="flex items-center gap-1.5 truncate">
              <User className="size-3 shrink-0" />
              <span className="truncate">{task.assignee}</span>
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1.5 shrink-0">
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
          disabled={task.workflowMode === "complex"}
        />
      </div>
    </div>
  );
}
