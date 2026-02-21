import { useEffect, useRef, useState, useCallback } from "react";
import { X, Trash2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/hooks/use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type EventEntry = {
  seq: number;
  time: string;
  event: string;
  payload: unknown;
};

const MAX_ENTRIES = 500;

const EVENT_COLORS: Record<string, string> = {
  chat: "text-[var(--swarm-violet,oklch(0.65_0.18_280))]",
  presence: "text-[var(--swarm-mint,oklch(0.75_0.14_165))]",
  tick: "text-muted-foreground/30",
  health: "text-[var(--swarm-blue,oklch(0.68_0.15_245))]",
  cron: "text-amber-400",
  "exec.approval.requested": "text-red-400",
  "exec.approval.resolved": "text-[var(--swarm-mint,oklch(0.75_0.14_165))]",
};

function getEventColor(event: string) {
  return EVENT_COLORS[event] ?? "text-muted-foreground/60";
}

function formatPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export function EventsPanel({ onClose }: { onClose: () => void }) {
  const { subscribe } = useGateway();
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const pausedRef = useRef(false);
  const bufferRef = useRef<EventEntry[]>([]);

  // Keep ref in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Subscribe to ALL gateway events
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      const entry: EventEntry = {
        seq: seqRef.current++,
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
          hour12: false,
        }),
        event: evt.event,
        payload: evt.payload,
      };

      if (pausedRef.current) {
        bufferRef.current.push(entry);
        if (bufferRef.current.length > MAX_ENTRIES) {
          bufferRef.current = bufferRef.current.slice(-MAX_ENTRIES);
        }
        return;
      }

      setEntries((prev) => [...prev, entry].slice(-MAX_ENTRIES));
    });
  }, [subscribe]);

  // Flush buffer when unpaused
  useEffect(() => {
    if (!paused && bufferRef.current.length > 0) {
      setEntries((prev) => [...prev, ...bufferRef.current].slice(-MAX_ENTRIES));
      bufferRef.current = [];
    }
  }, [paused]);

  // Auto-scroll
  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, paused]);

  const clear = useCallback(() => {
    setEntries([]);
    bufferRef.current = [];
    setExpandedIdx(null);
  }, []);

  // Filter
  const filtered = filter
    ? entries.filter((e) =>
        e.event.toLowerCase().includes(filter.toLowerCase()) ||
        formatPayload(e.payload).toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  return (
    <div className="flex flex-col h-[320px] border-t border-border/30 bg-card dark:bg-[oklch(0.11_0.005_270)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
            WebSocket Events
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
            {filtered.length}
          </span>
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
            onClick={() => setPaused((v) => !v)}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground/30 hover:text-foreground"
            onClick={clear}
            title="Clear"
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

      {/* Paused indicator */}
      {paused && (
        <div className="px-4 py-1 text-[10px] text-amber-400/60 bg-amber-400/[0.03] border-b border-border/10 shrink-0 font-mono">
          paused — {bufferRef.current.length} buffered
        </div>
      )}

      {/* Events */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-[1.65] scrollbar-hide"
      >
        {filtered.length === 0 && (
          <div className="text-muted-foreground/30 py-4 text-center text-xs font-sans">
            {filter ? "No matching events" : "Waiting for WebSocket events..."}
          </div>
        )}

        {filtered.map((entry) => {
          const isExpanded = expandedIdx === entry.seq;
          const payloadStr = formatPayload(entry.payload);
          const truncated = payloadStr.length > 120
            ? payloadStr.slice(0, 120) + "…"
            : payloadStr;

          return (
            <div
              key={entry.seq}
              className="flex gap-3 py-[2px] hover:bg-white/[0.02] -mx-1 px-1 rounded cursor-pointer"
              onClick={() => setExpandedIdx(isExpanded ? null : entry.seq)}
            >
              {/* Time */}
              <span className="text-muted-foreground/25 shrink-0 tabular-nums w-[85px]">
                {entry.time}
              </span>

              {/* Event name */}
              <span className={`shrink-0 w-[140px] truncate ${getEventColor(entry.event)}`}>
                {entry.event}
              </span>

              {/* Payload */}
              <span className="text-muted-foreground/40 min-w-0 break-all">
                {isExpanded ? (
                  <pre className="whitespace-pre-wrap text-muted-foreground/50 py-1">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                ) : (
                  truncated
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
