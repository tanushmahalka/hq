import { useEffect, useState, useRef } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { trpc } from "@/lib/trpc";
import type { EventFrame } from "@/lib/gateway-client";
import { Circle, CheckCircle2, Users, Zap, Terminal, Radio } from "lucide-react";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function useActiveAgentCount() {
  const { subscribe } = useGateway();
  const activeRef = useRef(new Set<string>());
  const [count, setCount] = useState(0);

  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey) return;

      const parts = payload.sessionKey.split(":");
      const agentId = parts[0] === "agent" ? parts[1] : null;
      if (!agentId) return;

      if (payload.state === "delta") {
        activeRef.current.add(agentId);
      } else if (
        payload.state === "final" ||
        payload.state === "aborted" ||
        payload.state === "error"
      ) {
        activeRef.current.delete(agentId);
      }
      setCount(activeRef.current.size);
    });
  }, [subscribe]);

  return count;
}

export function StatusBar({
  logsOpen,
  onToggleLogs,
  eventsOpen,
  onToggleEvents,
}: {
  logsOpen: boolean;
  onToggleLogs: () => void;
  eventsOpen: boolean;
  onToggleEvents: () => void;
}) {
  const { agents, connected } = useGateway();
  const { data: tasks } = trpc.task.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const now = useClock();
  const activeCount = useActiveAgentCount();

  const doneCount = tasks?.filter((t) => t.status === "done").length ?? 0;

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="h-7 border-t border-border/30 px-4 flex items-center gap-6 shrink-0 text-[11px] text-muted-foreground/60">
      {/* Logs toggle */}
      <button
        onClick={onToggleLogs}
        className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
          logsOpen ? "text-foreground" : ""
        }`}
      >
        <Terminal className="size-3" />
        <span className="font-mono">logs</span>
      </button>

      {/* Events toggle */}
      <button
        onClick={onToggleEvents}
        className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
          eventsOpen ? "text-foreground" : ""
        }`}
      >
        <Radio className="size-3" />
        <span className="font-mono">events</span>
      </button>

      <div className="h-3 w-px bg-border/30" />

      {/* Connection */}
      <div className="flex items-center gap-1.5">
        <Circle
          className="size-1.5"
          fill={connected ? "oklch(0.75 0.14 165)" : "oklch(0.65 0.2 25)"}
          stroke="none"
        />
        <span className="font-mono">
          {connected ? "connected" : "disconnected"}
        </span>
      </div>

      <div className="h-3 w-px bg-border/30" />

      {/* Clock */}
      <span className="font-mono tabular-nums">{time}</span>

      <div className="h-3 w-px bg-border/30" />

      {/* Tasks done */}
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="size-3 text-muted-foreground/40" />
        <span className="font-mono tabular-nums">{doneCount}</span>
        <span>done</span>
      </div>

      <div className="h-3 w-px bg-border/30" />

      {/* Total agents */}
      <div className="flex items-center gap-1.5">
        <Users className="size-3 text-muted-foreground/40" />
        <span className="font-mono tabular-nums">{agents.length}</span>
        <span>agents</span>
      </div>

      <div className="h-3 w-px bg-border/30" />

      {/* Active agents */}
      <div className="flex items-center gap-1.5">
        <Zap
          className="size-3"
          style={{
            color: activeCount > 0 ? "var(--swarm-violet, oklch(0.65 0.18 280))" : undefined,
          }}
        />
        <span
          className="font-mono tabular-nums"
          style={{
            color: activeCount > 0 ? "var(--swarm-violet, oklch(0.65 0.18 280))" : undefined,
          }}
        >
          {activeCount}
        </span>
        <span>active</span>
      </div>
    </div>
  );
}
