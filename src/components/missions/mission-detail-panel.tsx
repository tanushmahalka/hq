import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw, Sparkles, User } from "lucide-react";
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
import { parseAgentName } from "@/lib/mentions";

const STATUS_DOT_COLORS: Record<MissionStatus, string> = {
  active: "bg-[var(--swarm-violet)]",
  paused: "bg-gray-400",
  completed: "bg-[var(--swarm-mint)]",
  archived: "bg-gray-400",
};

interface Campaign {
  id: number;
  title: string;
  hypothesis: string | null;
  learnings: string | null;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
}

interface Objective {
  id: number;
  missionId: number;
  title: string;
  description: string | null;
  targetMetric: string | null;
  targetValue: string | null;
  currentValue: string | null;
  status: ObjectiveStatus;
  dueDate: Date | null;
  campaigns: Campaign[];
}

interface MissionDetailPanelProps {
  mission: {
    id: number;
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
  tasksByCampaign: Record<
    number,
    {
      done: number;
      total: number;
      tasks: Array<{ id: string; title: string; status: string }>;
    }
  >;
  onDeleted: () => void;
}

export function MissionDetailPanel({
  mission,
  agent,
  tasksByCampaign,
  onDeleted,
}: MissionDetailPanelProps) {
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const { sync, status: syncStatus } = useMissionSync();
  const utils = trpc.useUtils();

  const updateMission = trpc.custom.mission.update.useMutation({
    onSuccess: () => utils.custom.mission.list.invalidate(),
    onError: (err) =>
      toast.error("Update failed", { description: err.message }),
  });

  const deleteMission = trpc.custom.mission.delete.useMutation({
    onSuccess: () => {
      utils.custom.mission.list.invalidate();
      onDeleted();
    },
  });

  const save = (field: string, value: string | null) => {
    updateMission.mutate({ id: mission.id, [field]: value });
  };

  const setStatus = (status: MissionStatus) => {
    updateMission.mutate({ id: mission.id, status });
  };

  const handleComplete = () => {
    const incomplete = mission.objectives.filter(
      (o) => o.status !== "completed"
    );
    if (incomplete.length > 0) {
      setConfirmComplete(true);
    } else {
      setStatus("completed");
    }
  };

  const rawName = agent?.identity?.name ?? agent?.name ?? mission.agentId;
  const { name: agentName, role: parsedRole } = parseAgentName(rawName);
  const role = agent?.identity?.role ?? parsedRole;

  const completedObjectives = mission.objectives.filter(
    (o) => o.status === "completed"
  ).length;
  const totalObjectives = mission.objectives.length;
  const objProgress =
    totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : 0;
  const incompleteObjectives = totalObjectives - completedObjectives;

  return (
    <>
      <div className="h-full overflow-y-auto px-10 py-8">
        {/* Title */}
        <div className="flex items-start gap-3">
          <textarea
            data-field="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== mission.title)
                save("title", title.trim());
            }}
            className="w-full flex-1 text-4xl font-display font-normal! bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50 wrap-break-word"
            placeholder="Mission title"
            rows={1}
            style={{ minHeight: "3.5rem", overflowWrap: "break-word" }}
          />

          {/* Hover-reveal actions */}
          <div className="flex items-center gap-1 shrink-0 mt-2">
            <button
              onClick={() => sync(mission.agentId)}
              disabled={syncStatus === "syncing"}
              className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 relative transition-colors"
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
              className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Properties */}
        <div className="mt-6 space-y-0">
          {/* Agent */}
          <PropertyRow icon={<User className="size-4" />} label="Agent">
            <div className="flex items-center gap-2 text-sm">
              <span>{agentName}</span>
              {role && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/60">
                  {role}
                </span>
              )}
            </div>
          </PropertyRow>

          {/* Status */}
          <PropertyRow icon={<Sparkles className="size-4" />} label="Status">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm">
                <span
                  className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[mission.status]}`}
                />
                {MISSION_STATUS_LABELS[mission.status]}
              </span>

              <div className="flex-1" />

              {(mission.status === "active" ||
                mission.status === "paused") && (
                <div className="flex items-center gap-0.5">
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
                </div>
              )}
              {mission.status === "completed" && (
                <button
                  onClick={() => setStatus("archived")}
                  className="text-[11px] text-muted-foreground/40 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  Archive
                </button>
              )}
            </div>
          </PropertyRow>

          {/* Progress */}
          {totalObjectives > 0 && (
            <PropertyRow
              icon={
                <div className="size-4 flex items-center justify-center">
                  <div className="size-3 rounded-full border-2 border-muted-foreground/40" />
                </div>
              }
              label="Progress"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-48">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${objProgress}%`,
                      backgroundColor:
                        objProgress >= 100
                          ? "var(--swarm-mint)"
                          : "var(--swarm-violet)",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground/60">
                  {completedObjectives}/{totalObjectives} objectives
                </span>
              </div>
            </PropertyRow>
          )}
        </div>

        {/* Description */}
        <div className="mt-6 bg-muted/30 rounded-lg px-5 py-4">
          <h4 className="text-sm font-normal text-muted-foreground mb-2">
            Description
          </h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const val = description.trim() || null;
              if (val !== (mission.description ?? null)) save("description", val);
            }}
            placeholder="Mission description..."
            rows={2}
            className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
          />
        </div>

        {/* Objectives */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-muted-foreground">
              Objectives
            </span>
            <div className="flex-1 h-px bg-border/50" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground/40 hover:text-foreground px-2"
              onClick={() => setObjectiveDialogOpen(true)}
            >
              <Plus className="size-3" />
              Add
            </Button>
          </div>

          <div className="space-y-4">
            {mission.objectives.map((objective) => (
              <div
                key={objective.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <ObjectiveCard
                  objective={objective}
                  tasksByCampaign={tasksByCampaign}
                />
              </div>
            ))}
          </div>

          {mission.objectives.length === 0 && (
            <p className="text-sm text-muted-foreground/40 text-center py-12">
              No objectives yet
            </p>
          )}
        </div>
      </div>

      <ObjectiveCreateDialog
        open={objectiveDialogOpen}
        onOpenChange={setObjectiveDialogOpen}
        missionId={mission.id}
      />

      {/* Confirm complete when objectives incomplete */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-normal">
              Mark mission as complete?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {incompleteObjectives === 1
              ? "1 objective is not yet completed."
              : `${incompleteObjectives} objectives are not yet completed.`}{" "}
            Are you sure you want to mark this mission as complete?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmComplete(false)}
            >
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

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
