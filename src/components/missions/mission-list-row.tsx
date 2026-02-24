import { useMissionActive } from "@/hooks/use-mission-active";
import { parseAgentName } from "@/lib/mentions";
import type { MissionStatus, ObjectiveStatus } from "@shared/custom/types";

const STATUS_DOT_COLORS: Record<MissionStatus, string> = {
  active: "bg-[var(--swarm-violet)]",
  paused: "bg-gray-400",
  completed: "bg-[var(--swarm-mint)]",
  archived: "bg-gray-400",
};

const PROGRESS_BAR_COLORS: Record<MissionStatus, string> = {
  active: "var(--swarm-violet)",
  paused: "var(--border)",
  completed: "var(--swarm-mint)",
  archived: "var(--border)",
};

interface MissionListRowProps {
  mission: {
    id: string;
    agentId: string;
    title: string;
    description: string | null;
    status: MissionStatus;
    objectives: Array<{
      id: string;
      title: string;
      status: ObjectiveStatus;
      targetMetric: string | null;
      targetValue: string | null;
      currentValue: string | null;
    }>;
  };
  agent?: {
    id: string;
    name?: string;
    identity?: { name?: string; emoji?: string; role?: string };
  };
  selected: boolean;
  onClick: () => void;
}

export function MissionListRow({
  mission,
  agent,
  selected,
  onClick,
}: MissionListRowProps) {
  const active = useMissionActive(mission.agentId);

  const rawName = agent?.identity?.name ?? agent?.name ?? mission.agentId;
  const { name: agentName } = parseAgentName(rawName);

  const completedObjectives = mission.objectives.filter(
    (o) => o.status === "completed"
  ).length;
  const totalObjectives = mission.objectives.length;
  const progress =
    totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : 0;

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left px-5 py-3.5 transition-colors ${
        selected
          ? "bg-muted/40 border-l-[3px] border-l-[var(--swarm-violet)]"
          : "hover:bg-muted/20 border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Active shimmer */}
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

      {/* Line 1: Title + status dot */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex-1 text-sm truncate min-w-0">
          {mission.title}
        </span>
        <span
          className={`size-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[mission.status]}`}
        />
      </div>

      {/* Line 2: Agent + objective count */}
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-muted-foreground/50">{agentName}</span>
        {totalObjectives > 0 && (
          <>
            <span className="text-muted-foreground/25">&middot;</span>
            <span className="text-xs text-muted-foreground/50">
              {completedObjectives} of {totalObjectives} objectives
            </span>
          </>
        )}
      </div>

      {/* Progress bar — flush bottom, doubles as visual separator */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border/15">
        {totalObjectives > 0 && progress > 0 && (
          <div
            className="h-full rounded-r-full transition-all"
            style={{
              width: `${progress}%`,
              backgroundColor: PROGRESS_BAR_COLORS[mission.status],
              opacity: 0.6,
            }}
          />
        )}
      </div>
    </button>
  );
}
