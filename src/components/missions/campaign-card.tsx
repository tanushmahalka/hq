import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  type CampaignStatus,
} from "@shared/custom/types";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";

const STATUS_DOT_COLORS: Record<CampaignStatus, string> = {
  planned: "bg-gray-400",
  active: "bg-[var(--swarm-violet)]",
  paused: "bg-gray-400",
  completed: "bg-[var(--swarm-mint)]",
  failed: "bg-red-400",
};

interface CampaignCardProps {
  campaign: {
    id: string;
    title: string;
    hypothesis: string | null;
    learnings: string | null;
    status: CampaignStatus;
    startDate: Date | null;
    endDate: Date | null;
  };
  taskCount: { done: number; total: number };
}

export function CampaignCard({ campaign, taskCount }: CampaignCardProps) {
  const [title, setTitle] = useState(campaign.title);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const updateCampaign = trpc.custom.campaign.update.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });

  const deleteCampaign = trpc.custom.campaign.delete.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
  });

  const save = (field: string, value: string | null) => {
    updateCampaign.mutate({ id: campaign.id, [field]: value });
  };

  const progress =
    taskCount.total > 0
      ? Math.round((taskCount.done / taskCount.total) * 100)
      : 0;

  return (
    <>
      <div className="group/campaign flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-md hover:bg-muted/30 transition-colors">
        <div
          className={`size-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[campaign.status]}`}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== campaign.title)
              save("title", title.trim());
          }}
          className="flex-1 text-sm bg-transparent border-none outline-none min-w-0"
        />

        {/* Task progress — compact inline */}
        {taskCount.total > 0 ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-12 h-1 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--swarm-violet)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground/50 font-mono w-8 text-right">
              {taskCount.done}/{taskCount.total}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/30 shrink-0">
            no tasks
          </span>
        )}

        <Select
          value={campaign.status}
          onValueChange={(v) => save("status", v)}
        >
          <SelectTrigger className="h-5 w-auto gap-1 border-none shadow-none px-1 text-[11px] font-mono text-muted-foreground/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[s]}`}
                  />
                  {CAMPAIGN_STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="size-5 shrink-0 opacity-0 group-hover/campaign:opacity-100 transition-opacity text-muted-foreground/40 hover:text-foreground"
          onClick={() => setTaskDialogOpen(true)}
        >
          <Plus className="size-3" />
        </Button>

        <button
          onClick={() => deleteCampaign.mutate({ id: campaign.id })}
          className="opacity-0 group-hover/campaign:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <TaskCreateDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        initialCampaignId={campaign.id}
      />
    </>
  );
}
