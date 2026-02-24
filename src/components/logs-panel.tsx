import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogs, type LogEntry } from "@/hooks/use-logs";

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400",
  fatal: "text-red-400",
  warn: "text-amber-400",
  warning: "text-amber-400",
  info: "text-[var(--swarm-blue,oklch(0.68_0.15_245))]",
  debug: "text-muted-foreground/40",
  trace: "text-muted-foreground/25",
};

const SUBSYSTEM_COLORS: Record<string, string> = {
  "gateway/ws": "text-[var(--swarm-violet,oklch(0.65_0.18_280))]",
  cron: "text-amber-400/70",
  agents: "text-[var(--swarm-mint,oklch(0.75_0.14_165))]",
  chat: "text-[var(--swarm-blue,oklch(0.68_0.15_245))]",
};

function getLevelColor(level: string) {
  return LEVEL_COLORS[level] ?? "text-muted-foreground/50";
}

function getSubsystemColor(subsystem: string) {
  return SUBSYSTEM_COLORS[subsystem] ?? "text-muted-foreground/35";
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.slice(0, 12);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts.slice(0, 12);
  }
}

// Short level labels for clean display
function levelLabel(level: string): string {
  const map: Record<string, string> = {
    debug: "DBG",
    info: "INF",
    warn: "WRN",
    warning: "WRN",
    error: "ERR",
    fatal: "FTL",
    trace: "TRC",
  };
  return map[level] ?? level.slice(0, 3).toUpperCase();
}

export function LogsPanel({ onClose }: { onClose: () => void }) {
  const { entries, error, loading, clear } = useLogs({
    enabled: true,
    limit: 500,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  const filtered = filter
    ? entries.filter(
        (e) =>
          e.message.toLowerCase().includes(filter.toLowerCase()) ||
          e.subsystem.toLowerCase().includes(filter.toLowerCase()) ||
          e.level.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  return (
    <div className="flex flex-col h-[320px] border-t border-border/30 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
            Gateway Logs
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
            {filtered.length}
          </span>
          {loading && (
            <span className="text-[10px] text-muted-foreground/40 animate-pulse">
              loading...
            </span>
          )}
        </div>

        {/* Filter */}
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter..."
          className="flex-1 max-w-[200px] text-[11px] font-mono bg-transparent border border-border/20 rounded px-2 py-0.5 outline-none placeholder:text-muted-foreground/25 focus:border-border/40"
        />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground/30 hover:text-foreground"
            onClick={clear}
            title="Clear logs"
          >
            <Trash2 className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground/30 hover:text-foreground"
            onClick={onClose}
            title="Close"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-[1.65] scrollbar-hide"
      >
        {error && <div className="text-red-400 py-2">Error: {error}</div>}

        {!loading && entries.length === 0 && !error && (
          <div className="text-muted-foreground/30 py-4 text-center text-xs font-sans">
            No log entries yet. Waiting for gateway events...
          </div>
        )}

        {filtered.map((entry, i) => (
          <LogLine key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const levelColor = entry.level
    ? getLevelColor(entry.level)
    : "text-muted-foreground/40";
  const subsystemColor = entry.subsystem
    ? getSubsystemColor(entry.subsystem)
    : "";

  return (
    <div className="flex gap-3 py-[1px] hover:bg-white/[0.02] -mx-1 px-1 rounded">
      {/* Timestamp */}
      <span className="text-muted-foreground/25 shrink-0 tabular-nums w-[58px]">
        {formatTimestamp(entry.timestamp)}
      </span>

      {/* Level */}
      <span className={`shrink-0 w-[28px] ${levelColor}`}>
        {entry.level ? levelLabel(entry.level) : ""}
      </span>

      {/* Subsystem */}
      {entry.subsystem && (
        <span
          className={`shrink-0 w-[100px] truncate ${subsystemColor}`}
        >
          {entry.subsystem}
        </span>
      )}

      {/* Message */}
      <span className="text-muted-foreground/70 min-w-0 break-all">
        {entry.message}
      </span>
    </div>
  );
}
