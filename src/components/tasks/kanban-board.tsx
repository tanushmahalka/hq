import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AutomationsColumn } from "./automations-column";
import { KanbanColumn } from "./kanban-column";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import { StandaloneApprovalSheet } from "./standalone-approval-sheet";
import { TASK_STATUSES, type TaskStatus } from "@shared/types";
import { useApprovals } from "@/hooks/use-approvals";
import { useTaskBoardItems } from "@/hooks/use-task-board-items";

export function KanbanBoard() {
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const { approvals } = useApprovals();
  const { itemsByStatus, isLoading } = useTaskBoardItems();
  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedApprovalId) ?? null,
    [approvals, selectedApprovalId],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-12 pt-10 pb-6">
        <h1 className="font-display text-5xl font-normal text-foreground">Tasks</h1>
      </div>

      <div className="flex-1 overflow-x-auto px-12 pb-8">
        {isLoading ? (
          <div className="flex gap-4">
            {TASK_STATUSES.map((s) => (
              <div key={s} className="min-w-[280px] w-[280px] space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 min-h-0 h-full">
            <AutomationsColumn />
            {TASK_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                items={itemsByStatus[status]}
                onTaskClick={setSelectedTaskId}
                onApprovalClick={setSelectedApprovalId}
                onAdd={() => setCreateStatus(status)}
              />
            ))}
          </div>
        )}
      </div>

      <TaskCreateDialog
        open={createStatus !== null}
        onOpenChange={(open) => { if (!open) setCreateStatus(null); }}
        initialStatus={createStatus ?? "todo"}
      />
      <TaskDetailSheet
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
      <StandaloneApprovalSheet
        approval={selectedApproval}
        onClose={() => setSelectedApprovalId(null)}
      />
    </div>
  );
}
