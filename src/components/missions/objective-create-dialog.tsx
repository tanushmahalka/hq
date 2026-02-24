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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ObjectiveCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
}

export function ObjectiveCreateDialog({
  open,
  onOpenChange,
  missionId,
}: ObjectiveCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [dueDate, setDueDate] = useState("");

  const utils = trpc.useUtils();

  const createObjective = trpc.custom.objective.create.useMutation({
    onSuccess: () => {
      utils.custom.mission.list.invalidate();
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Failed to create objective", { description: err.message });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTargetMetric("");
    setTargetValue("");
    setDueDate("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createObjective.mutate({
      missionId,
      title: title.trim(),
      description: description.trim() || undefined,
      targetMetric: targetMetric.trim() || undefined,
      targetValue: targetValue.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Add Objective</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Objective title"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm">Target Metric</label>
              <Input
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                placeholder="e.g. organic visits/month"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Target Value</label>
              <Input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 10,000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createObjective.isPending}
            >
              {createObjective.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {createObjective.isPending ? "Creating..." : "Add Objective"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
