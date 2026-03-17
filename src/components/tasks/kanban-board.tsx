import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutomationsColumn } from "./automations-column";
import { KanbanColumn } from "./kanban-column";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import { StandaloneApprovalSheet } from "./standalone-approval-sheet";
import { type TaskCategory, TASK_STATUSES, type TaskStatus } from "@shared/types";
import { useApprovals } from "@/hooks/use-approvals";
import { useTaskBoardItems } from "@/hooks/use-task-board-items";
import { groupBoardItemsByCategory } from "./task-board-grouping";

type BoardViewMode = "standard" | "grouped";

export function KanbanBoard() {
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [createCategory, setCreateCategory] = useState<TaskCategory | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<BoardViewMode>("standard");
  const { approvals } = useApprovals();
  const { itemsByStatus, isLoading } = useTaskBoardItems();
  const groupedSections = useMemo(
    () => groupBoardItemsByCategory(itemsByStatus),
    [itemsByStatus],
  );
  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedApprovalId) ?? null,
    [approvals, selectedApprovalId],
  );

  const handleOpenCreate = (status: TaskStatus, category: TaskCategory | null = null) => {
    setCreateStatus(status);
    setCreateCategory(category);
  };

  const handleCreateDialogChange = (open: boolean) => {
    if (open) {
      return;
    }
    setCreateStatus(null);
    setCreateCategory(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-12 pt-10 pb-6">
        <h1 className="font-display text-5xl font-normal text-foreground">Tasks</h1>
        <div className="inline-flex rounded-full border border-border/60 bg-card/80 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`rounded-full px-3 ${
              viewMode === "standard"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("standard")}
          >
            Standard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`rounded-full px-3 ${
              viewMode === "grouped"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("grouped")}
          >
            Grouped by category
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-12 pb-8">
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
        ) : viewMode === "grouped" ? (
          <div className="min-h-full space-y-8">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-2xl font-normal text-foreground">
                  Automations
                </h2>
              </div>
              <div className="max-w-[320px]">
                <AutomationsColumn />
              </div>
            </div>

            {groupedSections.map((section) => (
              <section key={section.key} className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl font-normal text-foreground">
                      {section.label}
                    </h2>
                    <p className="text-sm text-muted-foreground/60">
                      {section.totalItems} item{section.totalItems === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-4">
                    {TASK_STATUSES.map((status) => (
                      <KanbanColumn
                        key={`${section.key}-${status}`}
                        status={status}
                        items={section.itemsByStatus[status]}
                        onTaskClick={setSelectedTaskId}
                        onApprovalClick={setSelectedApprovalId}
                        onAdd={() =>
                          handleOpenCreate(
                            status,
                            section.key === "uncategorized" ? null : section.key,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              </section>
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
                onAdd={() => handleOpenCreate(status)}
              />
            ))}
          </div>
        )}
      </div>

      <TaskCreateDialog
        open={createStatus !== null}
        onOpenChange={handleCreateDialogChange}
        initialStatus={createStatus ?? "todo"}
        initialCategory={createCategory}
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
