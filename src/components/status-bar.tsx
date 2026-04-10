import { useEffect, useState } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { useApprovals } from "@/hooks/use-approvals";
import { trpc } from "@/lib/trpc";
import { Circle, CheckCircle2, CircleAlert } from "lucide-react";

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

export function StatusBar() {
  const { agents } = useGateway();
  const { pendingCount, approvalsOpen, toggleApprovals } = useApprovals();
  const { data: tasks } = trpc.task.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const now = useClock();

  const doneCount = tasks?.filter((t) => t.status === "done").length ?? 0;
  const apiReady = agents.length > 0;

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="h-7 border-t border-border/30 px-4 flex items-center gap-6 shrink-0 text-[11px] text-muted-foreground/60">
      <button
        onClick={toggleApprovals}
        className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
          approvalsOpen ? "text-foreground" : ""
        }`}
      >
        <CircleAlert className="size-3" />
        <span className="font-mono tabular-nums">{pendingCount}</span>
        <span>approvals</span>
      </button>

      <div className="h-3 w-px bg-border/30" />

      {/* Runtime mode */}
      <div className="flex items-center gap-1.5">
        <Circle
          className="size-1.5"
          fill={apiReady ? "var(--swarm-mint, oklch(0.75 0.14 165))" : "var(--destructive, oklch(0.65 0.2 25))"}
          stroke="none"
        />
        <span className="font-mono">
          {apiReady ? "api" : "unavailable"}
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
    </div>
  );
}
