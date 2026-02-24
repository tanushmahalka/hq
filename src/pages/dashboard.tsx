import { useMemo } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { useAllAgentActivity } from "@/hooks/use-agent-activity";
import { useSession } from "@/lib/auth-client";
import { parseAgentName } from "@/lib/mentions";
import { Activity } from "lucide-react";

const BAR_COUNT = 24;

/** Seed-based pseudo-random for stable bar heights per agent */
function seededHeights(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    hash = ((hash << 5) - hash + i) | 0;
    heights.push(60 + (Math.abs(hash) % 40));
  }
  return heights;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0];
}

export default function Dashboard() {
  const { agents, connected } = useGateway();
  const activityMap = useAllAgentActivity();
  const { data: session } = useSession();

  const greeting = getGreeting();
  const firstName = session?.user?.name ? getFirstName(session.user.name) : "";

  return (
    <div className="flex flex-col h-full p-12">
      {/* Greeting */}
      <div className="pt-4 pb-8">
        <h1 className="font-display text-6xl font-normal text-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      {/* Team section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-normal text-muted-foreground">
            Your team
          </h2>
          <span className="font-mono text-xs text-muted-foreground/50 tabular-nums">
            {agents.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`swarm-status-dot ${
              connected ? "text-[--swarm-mint]" : "text-red-400"
            } active`}
            style={{ backgroundColor: "currentColor" }}
          />
          <span className="text-xs text-muted-foreground/60">
            {connected ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 flex-1 content-start">
        {agents.map((agent) => {
          const raw = agent.identity?.name ?? agent.name ?? agent.id;
          const { name, role } = parseAgentName(raw);
          const emoji = agent.identity?.emoji;
          const activity = activityMap.get(agent.id);
          const bars = activity?.bars ?? new Array(24).fill(0);
          const isActive = activity?.active ?? false;

          return (
            <AgentCard
              key={agent.id}
              agentId={agent.id}
              name={name}
              role={role}
              emoji={emoji}
              bars={bars}
              active={isActive}
            />
          );
        })}

        {agents.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground/50">
            <Activity className="size-8 mb-3 opacity-50" />
            <p className="text-sm">No agents connected</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  agentId,
  name,
  role,
  emoji,
  bars,
  active,
}: {
  agentId: string;
  name: string;
  role?: string;
  emoji?: string;
  bars: number[];
  active: boolean;
}) {
  const hasActivity = bars.some((b) => b > 0);
  const activeHeights = useMemo(() => seededHeights(agentId), [agentId]);
  const idleHeights = useMemo(
    () => seededHeights(agentId + ":idle"),
    [agentId]
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-card p-4 swarm-card ${
        active ? "border-[var(--swarm-violet)]/20" : "border-border/40"
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
              opacity: 0.5,
              animation: "swarm-shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Header: emoji/avatar + name + status */}
      <div className="flex items-center gap-3 mb-3">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <span className="text-sm">{emoji ?? "🤖"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-normal truncate">
              {name.toUpperCase()}
            </span>
            {active && (
              <div className="relative flex size-1.5">
                <div
                  className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: "var(--swarm-violet)" }}
                />
                <div
                  className="relative inline-flex size-1.5 rounded-full"
                  style={{ backgroundColor: "var(--swarm-violet)" }}
                />
              </div>
            )}
          </div>
          {role && (
            <span className="text-[11px] text-muted-foreground/60">{role}</span>
          )}
        </div>
      </div>

      {/* Status label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
          Activity
        </span>
        {active && (
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--swarm-violet)" }}
          >
            streaming
          </span>
        )}
        {!active && hasActivity && (
          <span className="text-[10px] font-mono text-muted-foreground/40">
            idle
          </span>
        )}
      </div>

      {/* Activity bars */}
      <div className="flex items-end gap-[3px] h-[36px]">
        {bars.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-all duration-300"
            style={{
              height:
                value > 0
                  ? `${activeHeights[i]}%`
                  : `${8 + (idleHeights[i] % 12)}%`,
              backgroundColor:
                value > 0
                  ? "var(--swarm-violet, oklch(0.65 0.18 280))"
                  : "var(--border, oklch(1 0 0 / 8%))",
              opacity: value > 0 ? 0.85 : 0.4,
              boxShadow:
                value > 0
                  ? "0 0 6px var(--swarm-violet-dim, oklch(0.65 0.18 280 / 12%))"
                  : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
