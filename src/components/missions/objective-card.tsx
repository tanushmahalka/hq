import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  OBJECTIVE_STATUSES,
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

const STATUS_BORDER_COLORS: Record<ObjectiveStatus, string> = {
  active: "border-l-[var(--swarm-violet)]/40",
  paused: "border-l-border",
  completed: "border-l-[var(--swarm-mint)]/40",
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
  tasksByCampaign: Record<string, { done: number; total: number }>;
}

export function ObjectiveCard({
  objective,
  tasksByCampaign,
}: ObjectiveCardProps) {
  const [title, setTitle] = useState(objective.title);
  const [targetMetric, setTargetMetric] = useState(objective.targetMetric ?? "");
  const [targetValue, setTargetValue] = useState(objective.targetValue ?? "");
  const [currentValue, setCurrentValue] = useState(objective.currentValue ?? "");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

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

  // Calculate progress from current/target values
  const current = parseFloat(currentValue) || 0;
  const target = parseFloat(targetValue) || 0;
  const progress = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  return (
    <>
      <div
        className="group border-l-2 pl-4 py-2 space-y-2"
        style={{
          borderLeftColor: objective.status === "active"
            ? "color-mix(in oklch, var(--swarm-violet) 40%, transparent)"
            : objective.status === "completed"
              ? "color-mix(in oklch, var(--swarm-mint) 40%, transparent)"
              : "var(--border)",
        }}
      >
        {/* Header: title + metrics inline */}
        <div className="flex items-center gap-2 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== objective.title)
                save("title", title.trim());
            }}
            className="flex-1 text-sm bg-transparent border-none outline-none min-w-0"
          />

          {/* Inline metrics — scannable at a glance */}
          {target > 0 && (
            <span className="text-[11px] text-muted-foreground/60 font-mono shrink-0">
              {currentValue || "0"}/{targetValue}
              {targetMetric && <span className="ml-1 text-muted-foreground/40">{targetMetric}</span>}
            </span>
          )}

          {objective.dueDate && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50 font-mono shrink-0">
              <Calendar className="size-3" />
              {new Date(objective.dueDate).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}

          <Select
            value={objective.status}
            onValueChange={(v) => save("status", v)}
          >
            <SelectTrigger className="h-5 w-auto gap-1 border-none shadow-none px-1 text-[11px] font-mono text-muted-foreground/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[s]}`}
                    />
                    {OBJECTIVE_STATUS_LABELS[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={() => deleteObjective.mutate({ id: objective.id })}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </button>
        </div>

        {/* Inline metric editors — only show when no target set yet */}
        {target === 0 && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
            <input
              value={targetMetric}
              onChange={(e) => setTargetMetric(e.target.value)}
              onBlur={() => {
                const val = targetMetric.trim() || null;
                if (val !== (objective.targetMetric ?? null))
                  save("targetMetric", val);
              }}
              placeholder="metric"
              className="w-20 font-mono text-[11px] bg-transparent border-none outline-none placeholder:text-muted-foreground/30 placeholder:font-sans"
            />
            <input
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onBlur={() => {
                const val = currentValue.trim() || null;
                if (val !== (objective.currentValue ?? null))
                  save("currentValue", val);
              }}
              placeholder="current"
              className="w-14 font-mono text-[11px] bg-transparent border-none outline-none text-right placeholder:text-muted-foreground/30 placeholder:font-sans"
            />
            <span>/</span>
            <input
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              onBlur={() => {
                const val = targetValue.trim() || null;
                if (val !== (objective.targetValue ?? null))
                  save("targetValue", val);
              }}
              placeholder="target"
              className="w-14 font-mono text-[11px] bg-transparent border-none outline-none placeholder:text-muted-foreground/30 placeholder:font-sans"
            />
          </div>
        )}

        {/* Progress bar — only when target is set */}
        {target > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress >= 100
                    ? "var(--swarm-mint)"
                    : "var(--swarm-violet)",
                }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground/40 font-mono w-8 text-right">
              {progress}%
            </span>
          </div>
        )}

        {/* Campaigns section */}
        <div className="mt-1">
          {/* Section divider */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "color-mix(in oklch, var(--swarm-violet) 60%, var(--muted-foreground))" }}>
              Campaigns
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "color-mix(in oklch, var(--swarm-violet) 12%, transparent)" }} />
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
            <div>
              {objective.campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  taskCount={tasksByCampaign[campaign.id] ?? { done: 0, total: 0 }}
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

      <CampaignCreateDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        objectiveId={objective.id}
      />
    </>
  );
}
