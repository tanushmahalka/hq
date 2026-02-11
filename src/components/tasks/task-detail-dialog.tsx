import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TASK_STATUSES, STATUS_LABELS } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { TaskComments } from "./task-comments";
import { Trash2 } from "lucide-react";

interface TaskDetailDialogProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailDialog({ taskId, onClose }: TaskDetailDialogProps) {
  const utils = trpc.useUtils();

  const { data: task } = trpc.task.get.useQuery(
    { id: taskId! },
    { enabled: !!taskId }
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignor(task.assignor ?? "");
      setAssignee(task.assignee ?? "");
      setDueDate(
        task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : ""
      );
      setUrgent(task.urgent);
      setImportant(task.important);
    }
  }, [task]);

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId! });
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      onClose();
    },
  });

  const handleFieldBlur = (
    field: string,
    value: string | boolean | Date | null
  ) => {
    if (!taskId) return;
    updateTask.mutate({ id: taskId, [field]: value });
  };

  if (!taskId) return null;

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Task Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleFieldBlur("title", title)}
            className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
            placeholder="Task title"
          />

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              handleFieldBlur("description", description || null)
            }
            className="border-none shadow-none px-0 focus-visible:ring-0 min-h-20"
            placeholder="Add a description..."
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              {task && (
                <Select
                  value={task.status}
                  onValueChange={(v) =>
                    handleFieldBlur("status", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() =>
                  handleFieldBlur(
                    "dueDate",
                    dueDate ? new Date(dueDate) : null
                  )
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Assignor
              </label>
              <Input
                value={assignor}
                onChange={(e) => setAssignor(e.target.value)}
                onBlur={() =>
                  handleFieldBlur("assignor", assignor || null)
                }
                placeholder="Who assigned this"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Assignee
              </label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={() =>
                  handleFieldBlur("assignee", assignee || null)
                }
                placeholder="Who's doing this"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => {
                  setUrgent(e.target.checked);
                  handleFieldBlur("urgent", e.target.checked);
                }}
                className="rounded"
              />
              Urgent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => {
                  setImportant(e.target.checked);
                  handleFieldBlur("important", e.target.checked);
                }}
                className="rounded"
              />
              Important
            </label>
          </div>

          <Separator />

          {task && (
            <TaskComments taskId={task.id} comments={task.comments ?? []} />
          )}

          <Separator />

          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (taskId) deleteTask.mutate({ id: taskId });
              }}
              disabled={deleteTask.isPending}
            >
              <Trash2 className="size-4" />
              {deleteTask.isPending ? "Deleting..." : "Delete Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
