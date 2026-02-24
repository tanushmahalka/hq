import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
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

type TaskEntry = { id: string; title: string; status: string };

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
  tasks: TaskEntry[];
}

function TaskStatusDot({ status }: { status: string }) {
  if (status === "done") {
    return <div className="size-1.5 rounded-full shrink-0 bg-[var(--swarm-mint)]" />;
  }
  if (status === "doing") {
    return (
      <div className="relative flex size-1.5 shrink-0">
        <div
          className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: "var(--swarm-violet)" }}
        />
        <div
          className="relative inline-flex size-1.5 rounded-full"
          style={{ backgroundColor: "var(--swarm-violet)" }}
        />
      </div>
    );
  }
  if (status === "stuck") {
    return <div className="size-1.5 rounded-full shrink-0 bg-red-400" />;
  }
  return <div className="size-1.5 rounded-full shrink-0 bg-gray-400/50 border border-gray-400/40" />;
}

export function CampaignCard({ campaign, tasks }: CampaignCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(campaign.title);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

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

  const setStatus = (status: CampaignStatus) => {
    updateCampaign.mutate({ id: campaign.id, status });
  };

  const handleComplete = () => {
    const incompleteTasks = tasks.filter((t) => t.status !== "done");
    if (incompleteTasks.length > 0) {
      setConfirmComplete(true);
    } else {
      setStatus("completed");
    }
  };

  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const incompleteTaskCount = tasks.filter((t) => t.status !== "done").length;

  const isTerminal = campaign.status === "completed" || campaign.status === "failed";

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Collapsed trigger row */}
        <div className="group/campaign flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger
            className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>

          <div className={`size-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[campaign.status]}`} />

          {/* Title: plain span when collapsed, input when expanded */}
          {open ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== campaign.title) save("title", title.trim());
              }}
              className="flex-1 text-sm bg-transparent border-none outline-none min-w-0"
            />
          ) : (
            <span className="flex-1 text-sm truncate min-w-0">{title}</span>
          )}

          {/* Task progress */}
          {total > 0 ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--swarm-violet)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground/50 font-mono w-8 text-right">
                {done}/{total}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/30 shrink-0">no tasks</span>
          )}

          {/* Status badge */}
          <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 shrink-0">
            <span className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[campaign.status]}`} />
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </span>

          {/* Action buttons — only visible when expanded */}
          {open && !isTerminal && (
            <div className="flex items-center gap-0.5 shrink-0">
              {campaign.status === "planned" && (
                <button
                  onClick={() => setStatus("active")}
                  className="text-[11px] text-muted-foreground/35 hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Start
                </button>
              )}
              {campaign.status === "active" && (
                <button
                  onClick={() => setStatus("paused")}
                  className="text-[11px] text-muted-foreground/35 hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Pause
                </button>
              )}
              {campaign.status === "paused" && (
                <button
                  onClick={() => setStatus("active")}
                  className="text-[11px] text-muted-foreground/35 hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Resume
                </button>
              )}
              <button
                onClick={handleComplete}
                className="text-[11px] text-muted-foreground/35 hover:text-[var(--swarm-mint)] px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => setStatus("failed")}
                className="text-[11px] text-muted-foreground/35 hover:text-red-400 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
              >
                Fail
              </button>
            </div>
          )}

          {open && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 opacity-0 group-hover/campaign:opacity-100 transition-opacity text-muted-foreground/40 hover:text-foreground"
              onClick={() => setTaskDialogOpen(true)}
            >
              <Plus className="size-3" />
            </Button>
          )}

          {open && (
            <button
              onClick={() => deleteCampaign.mutate({ id: campaign.id })}
              className="opacity-0 group-hover/campaign:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>

        {/* Expanded content: task checklist */}
        <CollapsibleContent>
          {total > 0 ? (
            <div className="ml-4 mt-0.5 border-l border-border/25 pl-3 pb-1 space-y-0.5">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 py-0.5">
                  <TaskStatusDot status={task.status} />
                  <span
                    className={`text-[11px] leading-snug ${
                      task.status === "done"
                        ? "line-through text-muted-foreground/35"
                        : "text-muted-foreground/65"
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/30 py-1 ml-6">
              No tasks yet
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <TaskCreateDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        initialCampaignId={campaign.id}
      />

      {/* Confirm complete when tasks incomplete */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-normal">Mark campaign as complete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {incompleteTaskCount === 1
              ? "1 task is not yet done."
              : `${incompleteTaskCount} tasks are not yet done.`}{" "}
            Are you sure you want to mark this campaign as complete?
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmComplete(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmComplete(false);
                setStatus("completed");
              }}
            >
              Mark as Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
