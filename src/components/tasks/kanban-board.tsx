import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AutomationsColumn } from "./automations-column";
import { KanbanColumn } from "./kanban-column";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import { TASK_STATUSES, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";

export function KanbanBoard() {
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading } = trpc.task.list.useQuery();

  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = (tasks ?? []).filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, NonNullable<typeof tasks>>
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
                tasks={tasksByStatus[status]}
                onTaskClick={setSelectedTaskId}
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
    </div>
  );
}
