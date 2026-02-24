import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MISSION_STATUS_LABELS,
  type MissionStatus,
  type ObjectiveStatus,
  type CampaignStatus,
} from "@shared/custom/types";
import { ObjectiveCard } from "./objective-card";
import { ObjectiveCreateDialog } from "./objective-create-dialog";
import { useMissionSync } from "@/hooks/use-mission-sync";
import { useMissionActive } from "@/hooks/use-mission-active";
import { parseAgentName } from "@/lib/mentions";

const STATUS_DOT_COLORS: Record<MissionStatus, string> = {
  active: "bg-[var(--swarm-violet)]",
  paused: "bg-gray-400",
  completed: "bg-[var(--swarm-mint)]",
  archived: "bg-gray-400",
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

interface Objective {
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
}

interface MissionCardProps {
  mission: {
    id: string;
    agentId: string;
    title: string;
    description: string | null;
    status: MissionStatus;
    objectives: Objective[];
  };
  agent?: {
    id: string;
    name?: string;
    identity?: { name?: string; emoji?: string; role?: string };
  };
  tasksByCampaign: Record<string, { done: number; total: number; tasks: Array<{ id: string; title: string; status: string }> }>;
}

export function MissionCard({
  mission,
  agent,
  tasksByCampaign,
}: MissionCardProps) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const { sync, status: syncStatus } = useMissionSync();
  const active = useMissionActive(mission.agentId);

  const utils = trpc.useUtils();

  const updateMission = trpc.custom.mission.update.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
    onError: (err) =>
      toast.error("Update failed", { description: err.message }),
  });

  const deleteMission = trpc.custom.mission.delete.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
  });

  const save = (field: string, value: string | null) => {
    updateMission.mutate({ id: mission.id, [field]: value });
  };

  const setStatus = (status: MissionStatus) => {
    updateMission.mutate({ id: mission.id, status });
  };

  const handleComplete = () => {
    const incomplete = mission.objectives.filter((o) => o.status !== "completed");
    if (incomplete.length > 0) {
      setConfirmComplete(true);
    } else {
      setStatus("completed");
    }
  };

  const emoji = agent?.identity?.emoji ?? "🤖";
  const rawName = agent?.identity?.name ?? agent?.name ?? mission.agentId;
  const { name: agentName, role: parsedRole } = parseAgentName(rawName);
  const role = agent?.identity?.role ?? parsedRole;

  const completedObjectives = mission.objectives.filter((o) => o.status === "completed").length;
  const totalObjectives = mission.objectives.length;
  const objProgress = totalObjectives > 0 ? Math.round((completedObjectives / totalObjectives) * 100) : 0;
  const incompleteObjectives = totalObjectives - completedObjectives;

  // Gather objectives with measurable KPIs for collapsed summary
  const kpiObjectives = mission.objectives
    .filter((o) => {
      const t = parseFloat(o.targetValue ?? "") || 0;
      return t > 0;
    })
    .slice(0, 3); // show up to 3 KPIs

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="group/mission relative rounded-lg border border-border/40 bg-card swarm-card overflow-hidden">
          {/* Shimmer */}
          {active && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div
                className="h-full w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, var(--swarm-violet, oklch(0.65 0.18 280)) 50%, transparent 100%)",
                  opacity: 0.6,
                  animation: "swarm-shimmer 2s ease-in-out infinite",
                }}
              />
            </div>
          )}

          {/* Collapsed trigger row */}
          <div className="px-4 py-3 flex items-center gap-2.5">
            <CollapsibleTrigger
              className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={`size-4 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
              />
            </CollapsibleTrigger>

            {/* Agent identity */}
            <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5 shrink-0">
              <span>{emoji}</span>
              <span className="font-mono uppercase tracking-wide">{agentName}</span>
            </span>

            {/* Separator + title (collapsed only) */}
            {!open && (
              <>
                <span className="text-muted-foreground/20 shrink-0">·</span>
                <span className="flex-1 text-sm truncate min-w-0">{mission.title}</span>
              </>
            )}
            {open && <div className="flex-1" />}

            {/* KPI chips + objective count (collapsed only) */}
            {!open && (
              <div className="flex items-center gap-2 shrink-0">
                {/* KPI metric chips */}
                {kpiObjectives.map((o) => {
                  const cur = parseFloat(o.currentValue ?? "") || 0;
                  const tgt = parseFloat(o.targetValue ?? "") || 0;
                  const pct = tgt > 0 ? Math.min(Math.round((cur / tgt) * 100), 100) : 0;
                  const done = pct >= 100;
                  return (
                    <span
                      key={o.id}
                      className="flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        color: done ? "var(--swarm-mint)" : "var(--swarm-violet)",
                        backgroundColor: done
                          ? "var(--swarm-mint-dim, oklch(0.75 0.14 165 / 10%))"
                          : "var(--swarm-violet-dim, oklch(0.65 0.18 280 / 12%))",
                      }}
                    >
                      <span className="font-medium">{o.currentValue || "0"}/{o.targetValue}</span>
                      {o.targetMetric && <span style={{ opacity: 0.6 }} className="text-[10px]">{o.targetMetric}</span>}
                    </span>
                  );
                })}

                {/* Objective count */}
                {totalObjectives > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground/50 font-mono">
                      {completedObjectives}/{totalObjectives} obj
                    </span>
                    <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${objProgress}%`,
                          backgroundColor: objProgress >= 100 ? "var(--swarm-mint)" : "var(--swarm-violet)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status badge */}
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/60 shrink-0">
              <span className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[mission.status]}`} />
              {MISSION_STATUS_LABELS[mission.status]}
            </span>
          </div>

          {/* Expanded content */}
          <CollapsibleContent>
            {/* Action buttons row */}
            <div className="px-4 pb-2 flex items-center gap-1">
              {/* Role tag */}
              {role && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/60 mr-1">
                  {role}
                </span>
              )}

              <div className="flex-1" />

              {(mission.status === "active" || mission.status === "paused") && (
                <>
                  {mission.status === "active" ? (
                    <button
                      onClick={() => setStatus("paused")}
                      className="text-[11px] text-muted-foreground/40 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus("active")}
                      className="text-[11px] text-muted-foreground/40 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={handleComplete}
                    className="text-[11px] text-muted-foreground/40 hover:text-[var(--swarm-mint)] px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => setStatus("archived")}
                    className="text-[11px] text-muted-foreground/40 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    Archive
                  </button>
                </>
              )}
              {mission.status === "completed" && (
                <button
                  onClick={() => setStatus("archived")}
                  className="text-[11px] text-muted-foreground/40 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Archive
                </button>
              )}

              {/* Sync */}
              <button
                onClick={() => sync(mission.agentId)}
                disabled={syncStatus === "syncing"}
                className="opacity-0 group-hover/mission:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 relative"
                title="Sync mission briefing to agent"
              >
                <RefreshCw
                  className={`size-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
                />
                {syncStatus !== "idle" && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${
                      syncStatus === "syncing"
                        ? "bg-[var(--swarm-violet)] animate-pulse"
                        : syncStatus === "synced"
                        ? "bg-[var(--swarm-mint)]"
                        : "bg-destructive"
                    }`}
                  />
                )}
              </button>

              <button
                onClick={() => deleteMission.mutate({ id: mission.id })}
                className="opacity-0 group-hover/mission:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {/* Editable title + description */}
            <div className="px-5 pb-2 space-y-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim() && title !== mission.title)
                    save("title", title.trim());
                }}
                className="w-full text-base font-normal bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
                placeholder="Mission title"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  const val = description.trim() || null;
                  if (val !== (mission.description ?? null)) save("description", val);
                }}
                placeholder="Mission description..."
                rows={1}
                className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
              />
            </div>

            {/* Objectives */}
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-medium tracking-widest uppercase"
                  style={{ color: "var(--swarm-violet)" }}
                >
                  Objectives
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: "color-mix(in oklch, var(--swarm-violet) 20%, transparent)" }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground/40 hover:text-foreground px-1.5 -mr-1.5"
                  onClick={() => setObjectiveDialogOpen(true)}
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              <div className="space-y-0.5">
                {mission.objectives.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    tasksByCampaign={tasksByCampaign}
                  />
                ))}
              </div>

              {mission.objectives.length === 0 && (
                <p className="text-[11px] text-muted-foreground/30 py-2">
                  No objectives yet
                </p>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <ObjectiveCreateDialog
        open={objectiveDialogOpen}
        onOpenChange={setObjectiveDialogOpen}
        missionId={mission.id}
      />

      {/* Confirm complete when objectives incomplete */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-normal">Mark mission as complete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {incompleteObjectives === 1
              ? "1 objective is not yet completed."
              : `${incompleteObjectives} objectives are not yet completed.`}{" "}
            Are you sure you want to mark this mission as complete?
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
