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
import { ChevronRight, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  OBJECTIVE_STATUS_LABELS,
  type ObjectiveStatus,
  type CampaignStatus,
} from "@shared/custom/types";
import { CampaignCard } from "./campaign-card";
import { CampaignCreateDialog } from "./campaign-create-dialog";

const STATUS_DOT_COLORS: Record<ObjectiveStatus, string> = {
  active: "bg-[var(--swarm-violet)]",
  paused: "bg-gray-400",
  completed: "bg-[var(--swarm-mint)]",
};

interface Campaign {
  id: string;
  title: string;
  hypothesis: string | null;
  learnings: string | null;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
}

interface ObjectiveCardProps {
  objective: {
    id: string;
    missionId: string;
    title: string;
    description: string | null;
    targetMetric: string | null;
    targetValue: string | null;
    currentValue: string | null;
    status: ObjectiveStatus;
    dueDate: Date | null;
    campaigns: Campaign[];
  };
  tasksByCampaign: Record<string, { done: number; total: number; tasks: Array<{ id: string; title: string; status: string }> }>;
}

export function ObjectiveCard({
  objective,
  tasksByCampaign,
}: ObjectiveCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(objective.title);
  const [targetMetric, setTargetMetric] = useState(objective.targetMetric ?? "");
  const [targetValue, setTargetValue] = useState(objective.targetValue ?? "");
  const [currentValue, setCurrentValue] = useState(objective.currentValue ?? "");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const utils = trpc.useUtils();

  const updateObjective = trpc.custom.objective.update.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });

  const deleteObjective = trpc.custom.objective.delete.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
  });

  const save = (field: string, value: string | null) => {
    updateObjective.mutate({ id: objective.id, [field]: value });
  };

  const setStatus = (status: ObjectiveStatus) => {
    updateObjective.mutate({ id: objective.id, status });
  };

  const handleComplete = () => {
    const incomplete = objective.campaigns.filter((c) => c.status !== "completed");
    if (incomplete.length > 0) {
      setConfirmComplete(true);
    } else {
      setStatus("completed");
    }
  };

  const current = parseFloat(currentValue) || 0;
  const target = parseFloat(targetValue) || 0;
  const progress = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  const incompleteCampaigns = objective.campaigns.filter((c) => c.status !== "completed").length;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Collapsed trigger row */}
        <div className="group/objective flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger
            className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>

          {/* Title: plain span when collapsed, input when expanded */}
          {open ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== objective.title)
                  save("title", title.trim());
              }}
              className="flex-1 text-sm bg-transparent border-none outline-none min-w-0"
            />
          ) : (
            <span className="flex-1 text-sm truncate min-w-0">{title}</span>
          )}

          {/* Metric KPI badge — collapsed only */}
          {!open && target > 0 && (
            <span
              className="flex items-center gap-1.5 shrink-0 font-mono text-xs px-2 py-0.5 rounded-md"
              style={{
                color: progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)",
                backgroundColor: progress >= 100
                  ? "var(--swarm-mint-dim, oklch(0.75 0.14 165 / 10%))"
                  : "var(--swarm-violet-dim, oklch(0.65 0.18 280 / 12%))",
              }}
            >
              <span className="font-medium">{currentValue || "0"}</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span>{targetValue}</span>
              {targetMetric && (
                <span style={{ opacity: 0.6 }} className="text-[10px]">{targetMetric}</span>
              )}
              <div className="w-10 h-1 rounded-full overflow-hidden ml-0.5" style={{ backgroundColor: "oklch(1 0 0 / 12%)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: "currentColor",
                  }}
                />
              </div>
            </span>
          )}

          {/* Due date */}
          {objective.dueDate && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50 font-mono shrink-0">
              <Calendar className="size-3" />
              {new Date(objective.dueDate).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}

          {/* Status badge */}
          <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 shrink-0">
            <span className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[objective.status]}`} />
            {OBJECTIVE_STATUS_LABELS[objective.status]}
          </span>

          {/* Action buttons — only when expanded */}
          {open && (objective.status === "active" || objective.status === "paused") && (
            <div className="flex items-center gap-0.5 shrink-0">
              {objective.status === "active" ? (
                <button
                  onClick={() => setStatus("paused")}
                  className="text-[11px] text-muted-foreground/35 hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Pause
                </button>
              ) : (
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
            </div>
          )}

          {open && (
            <button
              onClick={() => deleteObjective.mutate({ id: objective.id })}
              className="opacity-0 group-hover/objective:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="ml-5 pl-2.5 border-l border-border/30 pb-2 space-y-2">
            {/* KPI metric section */}
            <div
              className="rounded-md px-3 py-2 mt-1"
              style={{
                backgroundColor: target > 0
                  ? (progress >= 100 ? "var(--swarm-mint-dim, oklch(0.75 0.14 165 / 10%))" : "var(--swarm-violet-dim, oklch(0.65 0.18 280 / 12%))")
                  : "var(--swarm-violet-dim, oklch(0.65 0.18 280 / 12%))",
                borderLeft: `2px solid ${target > 0 ? (progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)") : "var(--swarm-violet)"}`,
              }}
            >
              <input
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                onBlur={() => {
                  const val = targetMetric.trim() || null;
                  if (val !== (objective.targetMetric ?? null)) save("targetMetric", val);
                }}
                placeholder="metric name"
                className="w-full text-[11px] font-mono bg-transparent border-none outline-none placeholder:text-muted-foreground/30 placeholder:font-sans"
                style={{ color: target > 0 ? (progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)") : "var(--swarm-violet)", opacity: 0.8 }}
              />
              <div className="flex items-center gap-1 font-mono mt-0.5">
                <input
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  onBlur={() => {
                    const val = currentValue.trim() || null;
                    if (val !== (objective.currentValue ?? null)) save("currentValue", val);
                  }}
                  placeholder="0"
                  className="w-12 text-sm font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/30"
                  style={{ color: target > 0 ? (progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)") : "var(--muted-foreground)" }}
                />
                <span className="text-muted-foreground/40 text-xs">/</span>
                <input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  onBlur={() => {
                    const val = targetValue.trim() || null;
                    if (val !== (objective.targetValue ?? null)) save("targetValue", val);
                  }}
                  placeholder="target"
                  className="w-12 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/30 placeholder:font-sans"
                  style={{ color: "var(--muted-foreground)" }}
                />
              </div>
              {/* Progress bar */}
              {target > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(1 0 0 / 10%)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)",
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono font-medium w-10 text-right"
                    style={{ color: progress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)" }}
                  >
                    {progress}%
                  </span>
                </div>
              )}
            </div>

            {/* Campaigns section */}
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-medium tracking-widest uppercase"
                  style={{ color: "color-mix(in oklch, var(--swarm-violet) 60%, var(--muted-foreground))" }}
                >
                  Campaigns
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: "color-mix(in oklch, var(--swarm-violet) 12%, transparent)" }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground/40 hover:text-foreground px-1.5 -mr-1.5"
                  onClick={() => setCampaignDialogOpen(true)}
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              {objective.campaigns.length > 0 ? (
                <div className="border-l border-border/30 ml-0.5 pl-2.5 space-y-0.5">
                  {objective.campaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      tasks={tasksByCampaign[campaign.id]?.tasks ?? []}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/30 py-1">
                  No campaigns yet
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <CampaignCreateDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        objectiveId={objective.id}
      />

      {/* Confirm complete when campaigns incomplete */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-normal">Mark objective as complete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {incompleteCampaigns === 1
              ? "1 campaign is not yet completed."
              : `${incompleteCampaigns} campaigns are not yet completed.`}{" "}
            Are you sure you want to mark this objective as complete?
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
