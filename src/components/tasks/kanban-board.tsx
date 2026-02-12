import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumn } from "./kanban-column";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
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
      <div className="flex-1 overflow-x-auto p-4">
        {isLoading ? (
          <div className="flex gap-4">
            {TASK_STATUSES.map((s) => (
              <div key={s} className="min-w-[280px] w-[280px] space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 min-h-0 h-full">
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
      <TaskDetailDialog
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
