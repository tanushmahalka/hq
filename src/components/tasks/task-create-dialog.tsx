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
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  type TaskCategory,
  type TaskStatus,
} from "@shared/types";
import {
  TASK_WORKFLOW_MODES,
  type TaskWorkflowMode,
} from "@shared/task-workflow";
import { trpc } from "@/lib/trpc";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";
import { useGateway } from "@/hooks/use-gateway";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-[var(--swarm-violet)]",
  stuck: "bg-red-400",
  done: "bg-[var(--swarm-mint)]",
};

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: TaskStatus;
  initialCategory?: TaskCategory | null;
  initialCampaignId?: number;
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  initialStatus = "todo",
  initialCategory = null,
  initialCampaignId,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [category, setCategory] = useState<TaskCategory | null>(initialCategory);
  const [workflowMode, setWorkflowMode] = useState<TaskWorkflowMode>("simple");

  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  const utils = trpc.useUtils();
  const notifyTask = useTaskNotify();
  const { agents } = useGateway();

  const createTask = trpc.task.create.useMutation({
    onSuccess: (task) => {
      utils.task.list.invalidate();
      if (task?.workflowMode !== "complex" && task?.assignee) {
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
    setCategory(null);
    setWorkflowMode("simple");
    setAssignor("");
    setAssignee("");
    setDueDate("");
    setUrgent(false);
    setImportant(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setStatus(initialStatus);
    setCategory(initialCategory);
    setWorkflowMode("simple");
    setAssignor("");
    setAssignee("");
    setDueDate("");
    setUrgent(false);
    setImportant(false);
  }, [open, initialCategory, initialStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status: workflowMode === "simple" ? status : undefined,
      category,
      workflowMode,
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
              <label className="text-sm">Workflow</label>
              <Select
                value={workflowMode}
                onValueChange={(value) => setWorkflowMode(value as TaskWorkflowMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_WORKFLOW_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode === "complex" ? "Complex workflow" : "Simple task"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Category</label>
              <Select
                value={category ?? "__uncategorized__"}
                onValueChange={(value) =>
                  setCategory(
                    value === "__uncategorized__" ? null : (value as TaskCategory),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__uncategorized__">Uncategorised</SelectItem>
                  {TASK_CATEGORIES.map((taskCategory) => (
                    <SelectItem key={taskCategory} value={taskCategory}>
                      {TASK_CATEGORY_LABELS[taskCategory]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm">
                {workflowMode === "complex" ? "Initial Lane" : "Status"}
              </label>
              {workflowMode === "simple" ? (
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
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Starts in <span className="font-medium text-foreground">Doing</span> when assigned, otherwise <span className="font-medium text-foreground">To Do</span>.
                </div>
              )}
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
              {workflowMode === "complex" ? (
                <Select
                  value={assignee || "__unassigned__"}
                  onValueChange={(value) =>
                    setAssignee(value === "__unassigned__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.identity?.name ?? agent.name ?? agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Who's doing this"
                />
              )}
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
