import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { KanbanColumn } from "./kanban-column";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TASK_STATUSES, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";

export function KanbanBoard() {
  const [createOpen, setCreateOpen] = useState(false);
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
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Task
        </Button>
      </div>

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
              />
            ))}
          </div>
        )}
      </div>

      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDialog
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
