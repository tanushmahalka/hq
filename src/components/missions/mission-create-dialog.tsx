import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useGateway } from "@/hooks/use-gateway";
import {
  AUTONOMY_LEVELS,
  AUTONOMY_LEVEL_LABELS,
  type AutonomyLevel,
} from "@shared/custom/types";

interface MissionCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionCreateDialog({
  open,
  onOpenChange,
}: MissionCreateDialogProps) {
  const { agents } = useGateway();
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("suggest");

  const utils = trpc.useUtils();

  const createMission = trpc.custom.mission.create.useMutation({
    onSuccess: () => {
      utils.custom.mission.list.invalidate();
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Failed to create mission", { description: err.message });
    },
  });

  const resetForm = () => {
    setAgentId("");
    setTitle("");
    setDescription("");
    setAutonomyLevel("suggest");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!agentId || !title.trim()) return;
    createMission.mutate({
      agentId,
      title: title.trim(),
      description: description.trim() || undefined,
      autonomyLevel,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">Create Mission</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Agent *</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => {
                  const emoji = agent.identity?.emoji ?? "🤖";
                  const name = agent.identity?.name ?? agent.id;
                  return (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <span>{emoji}</span>
                        <span className="font-mono text-sm">{name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mission title"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this agent's overarching mission?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Autonomy Level</label>
            <Select
              value={autonomyLevel}
              onValueChange={(v) => setAutonomyLevel(v as AutonomyLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTONOMY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {AUTONOMY_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={!agentId || !title.trim() || createMission.isPending}
            >
              {createMission.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {createMission.isPending ? "Creating..." : "Create Mission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
