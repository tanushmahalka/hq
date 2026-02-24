import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MISSION_STATUSES,
  MISSION_STATUS_LABELS,
  AUTONOMY_LEVELS,
  AUTONOMY_LEVEL_LABELS,
  type MissionStatus,
  type AutonomyLevel,
  type ObjectiveStatus,
  type CampaignStatus,
} from "@shared/custom/types";
import { AutonomyBadge } from "./autonomy-badge";
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
    autonomyLevel: AutonomyLevel;
    status: MissionStatus;
    objectives: Objective[];
  };
  agent?: {
    id: string;
    name?: string;
    identity?: { name?: string; emoji?: string; role?: string };
  };
  tasksByCampaign: Record<string, { done: number; total: number }>;
}

export function MissionCard({
  mission,
  agent,
  tasksByCampaign,
}: MissionCardProps) {
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description ?? "");
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);

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

  const emoji = agent?.identity?.emoji ?? "🤖";
  const rawName = agent?.identity?.name ?? agent?.name ?? mission.agentId;
  const { name: agentName, role: parsedRole } = parseAgentName(rawName);
  const role = agent?.identity?.role ?? parsedRole;

  return (
    <>
      <div className="group relative rounded-lg border border-border/40 bg-card swarm-card overflow-hidden">
        {/* Shimmer — active when agent is working on a mission-linked task */}
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

        {/* Top bar — controls + agent as quiet metadata */}
        <div className="px-5 pt-3.5 pb-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5 shrink-0">
            <span>{emoji}</span>
            <span className="font-mono uppercase tracking-wide">
              {agentName}
            </span>
            {role && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/60">
                {role}
              </span>
            )}
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            {/* Autonomy selector */}
            <Select
              value={mission.autonomyLevel}
              onValueChange={(v) => save("autonomyLevel", v)}
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-0 text-xs">
                <AutonomyBadge level={mission.autonomyLevel} />
              </SelectTrigger>
              <SelectContent>
                {AUTONOMY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {AUTONOMY_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status selector */}
            <Select
              value={mission.status}
              onValueChange={(v) => save("status", v)}
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full ${
                      STATUS_DOT_COLORS[mission.status]
                    }`}
                  />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {MISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-1.5">
                      {MISSION_STATUS_LABELS[s]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sync button */}
            <button
              onClick={() => sync(mission.agentId)}
              disabled={syncStatus === "syncing"}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 relative"
              title="Sync mission briefing to agent"
            >
              <RefreshCw
                className={`size-3.5 ${
                  syncStatus === "syncing" ? "animate-spin" : ""
                }`}
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
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Mission title + description */}
        <div className="px-5 pb-2 space-y-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== mission.title)
                save("title", title.trim());
            }}
            className="w-full text-base font-normal bg-transparent border-none outline-none"
            placeholder="Mission title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const val = description.trim() || null;
              if (val !== (mission.description ?? null))
                save("description", val);
            }}
            placeholder="Mission description..."
            rows={1}
            className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
          />
        </div>

        {/* Objectives */}
        <div className="px-5 pb-4">
          {/* Section divider */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] font-medium tracking-widest uppercase"
              style={{ color: "var(--swarm-violet)" }}
            >
              Objectives
            </span>
            <div
              className="flex-1 h-px"
              style={{
                backgroundColor:
                  "color-mix(in oklch, var(--swarm-violet) 20%, transparent)",
              }}
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

          <div className="space-y-3">
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
      </div>

      <ObjectiveCreateDialog
        open={objectiveDialogOpen}
        onOpenChange={setObjectiveDialogOpen}
        missionId={mission.id}
      />
    </>
  );
}
