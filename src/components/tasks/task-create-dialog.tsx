import { useState, type FormEvent } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreateDialog({ open, onOpenChange }: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  const utils = trpc.useUtils();

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
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
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignor</label>
              <Input
                value={assignor}
                onChange={(e) => setAssignor(e.target.value)}
                placeholder="Who assigned this"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Who's doing this"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="rounded"
              />
              Urgent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="rounded"
              />
              Important
            </label>
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
