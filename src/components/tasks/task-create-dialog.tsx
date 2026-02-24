import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, CircleAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-[var(--swarm-violet)]",
  stuck: "bg-red-400",
  done: "bg-[var(--swarm-mint)]",
};
import { trpc } from "@/lib/trpc";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: TaskStatus;
  initialCampaignId?: string;
}

export function TaskCreateDialog({ open, onOpenChange, initialStatus = "todo", initialCampaignId }: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);

  useEffect(() => {
    if (open) setStatus(initialStatus);
  }, [open, initialStatus]);

  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  const utils = trpc.useUtils();
  const notifyTask = useTaskNotify();

  const createTask = trpc.task.create.useMutation({
    onSuccess: (task) => {
      utils.task.list.invalidate();
      if (task?.assignee) {
        notifyTask(task.assignee, task.id, formatTaskNotification("created", task));
      }
      resetForm();
      onOpenChange(false);
      toast.success("Task created");
    },
    onError: (err) => {
      toast.error("Failed to create task", { description: err.message });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setAssignor("");
    setAssignee("");
    setDueDate("");
    setUrgent(false);
    setImportant(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      assignor: assignor.trim() || undefined,
      assignee: assignee.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      urgent,
      important,
      campaignId: initialCampaignId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm">Status</label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${STATUS_DOT_COLORS[s]}`} />
                        {STATUS_LABELS[s]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm">Assignor</label>
              <Input
                value={assignor}
                onChange={(e) => setAssignor(e.target.value)}
                placeholder="Who assigned this"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Assignee</label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Who's doing this"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUrgent(!urgent)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                urgent
                  ? "border-red-300/40 bg-red-50 text-red-600 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300"
                  : "border-border/50 text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <CircleAlert className="size-3" />
              Urgent
            </button>
            <button
              type="button"
              onClick={() => setImportant(!important)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                important
                  ? "border-amber-300/40 bg-amber-50 text-amber-600 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border/50 text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <Star className="size-3" />
              Important
            </button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
