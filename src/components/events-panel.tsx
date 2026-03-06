import { useEffect, useRef, useState, useCallback } from "react";
import { X, Trash2, Pause, Play, ChevronRight, Send, Terminal, Copy, Check } from "lucide-react";
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

const RPC_METHODS = [
  "health", "status", "usage.status", "usage.cost",
  "agents.list", "agent", "agent.identity.get", "agent.wait",
  "agents.files.list", "agents.files.get", "agents.files.set",
  "chat.send", "chat.history", "chat.abort",
  "sessions.list", "sessions.preview", "sessions.patch", "sessions.reset", "sessions.delete", "sessions.compact",
  "config.get", "config.set", "config.apply", "config.patch", "config.schema",
  "cron.list", "cron.add", "cron.update", "cron.remove", "cron.run",
  "exec.approvals.get", "exec.approvals.set", "exec.approval.request", "exec.approval.resolve",
  "channels.status", "channels.logout",
  "node.list", "node.describe", "node.invoke",
  "skills.status", "skills.bins", "skills.install", "skills.update",
  "logs.tail", "models.list",
  "send", "wake",
];

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

// --- RPC Console ---

type RpcResult = {
  id: number;
  method: string;
  params: unknown;
  response: unknown;
  error: string | null;
  duration: number;
  time: string;
};

function RpcConsole() {
  const { client, connected } = useGateway();
  const [method, setMethod] = useState("");
  const [params, setParams] = useState("");
  const [results, setResults] = useState<RpcResult[]>([]);
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const idRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const suggestions = method
    ? RPC_METHODS.filter((m) => m.toLowerCase().includes(method.toLowerCase()))
    : RPC_METHODS;

  const send = useCallback(async () => {
    if (!client || !connected || !method.trim()) return;
    setSending(true);
    const id = idRef.current++;
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });

    let parsed: unknown = undefined;
    if (params.trim()) {
      try {
        parsed = JSON.parse(params);
      } catch {
        setResults((prev) => [...prev, {
          id, method, params: params, response: null,
          error: "Invalid JSON params", duration: 0, time,
        }]);
        setSending(false);
        return;
      }
    }

    const start = performance.now();
    try {
      const res = await client.request(method.trim(), parsed);
      const duration = Math.round(performance.now() - start);
      setResults((prev) => [...prev, {
        id, method, params: parsed, response: res,
        error: null, duration, time,
      }]);
      setExpandedId(id);
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setResults((prev) => [...prev, {
        id, method, params: parsed, response: null,
        error: err instanceof Error ? err.message : String(err), duration, time,
      }]);
      setExpandedId(id);
    } finally {
      setSending(false);
      setTimeout(() => {
        resultsRef.current?.scrollTo({ top: resultsRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }, [client, connected, method, params]);

  const copyResult = useCallback((id: number, data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  return (
    <div className="flex flex-col gap-2 px-4 py-2.5 border-b border-border/20 shrink-0">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <Terminal className="size-3.5 text-muted-foreground/30 shrink-0" />
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={method}
            onChange={(e) => { setMethod(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); send(); }
              if (e.key === "Escape") setShowSuggestions(false);
            }}
            placeholder="method (e.g. agents.list)"
            className="w-full text-[11px] font-mono bg-transparent border border-border/20 rounded px-2 py-1 outline-none placeholder:text-muted-foreground/25 placeholder:font-sans focus:border-border/40"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[180px] overflow-y-auto rounded border border-border/30 bg-card shadow-lg">
              {suggestions.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="block w-full text-left px-2.5 py-1 text-[11px] font-mono text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMethod(m);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          value={params}
          onChange={(e) => setParams(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          placeholder='params (JSON)'
          className="flex-1 min-w-0 text-[11px] font-mono bg-transparent border border-border/20 rounded px-2 py-1 outline-none placeholder:text-muted-foreground/25 placeholder:font-sans focus:border-border/40"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground/40 hover:text-foreground shrink-0"
          onClick={send}
          disabled={!connected || !method.trim() || sending}
          title="Send RPC"
        >
          <Send className="size-3" />
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div ref={resultsRef} className="max-h-[200px] overflow-y-auto space-y-1">
          {results.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded border border-border/15 bg-muted/10">
                <div
                  className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <ChevronRight className={`size-3 text-muted-foreground/30 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                  <span className="text-[10px] text-muted-foreground/25 tabular-nums font-mono shrink-0">
                    {r.time}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/70 shrink-0">
                    {r.method}
                  </span>
                  <span className={`text-[10px] font-mono tabular-nums shrink-0 ${r.error ? "text-red-400/70" : "text-[var(--swarm-mint)]/70"}`}>
                    {r.error ? "err" : "ok"} {r.duration}ms
                  </span>
                  {!r.error && r.response !== null && (
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground/20 hover:text-muted-foreground/60 transition-colors shrink-0"
                      onClick={(e) => { e.stopPropagation(); copyResult(r.id, r.response); }}
                      title="Copy response"
                    >
                      {copiedId === r.id
                        ? <Check className="size-3 text-[var(--swarm-mint)]" />
                        : <Copy className="size-3" />
                      }
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <pre className="px-2 pb-2 text-[10px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                    {r.error ? (
                      <span className="text-red-400/60">{r.error}</span>
                    ) : (
                      <span className="text-muted-foreground/50">
                        {JSON.stringify(r.response, null, 2)}
                      </span>
                    )}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Events Panel ---

export function EventsPanel({ onClose }: { onClose: () => void }) {
  const { subscribe } = useGateway();
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [filter, setFilter] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showConsole, setShowConsole] = useState(false);
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
        setBufferedCount(bufferRef.current.length);
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
      setBufferedCount(0);
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
    setBufferedCount(0);
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
    <div className="flex flex-col h-[320px] border-t border-border/30 bg-card">
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
            className={`size-6 hover:text-foreground ${showConsole ? "text-[var(--swarm-violet)]" : "text-muted-foreground/30"}`}
            onClick={() => setShowConsole((v) => !v)}
            title="RPC Console"
          >
            <Terminal className="size-3" />
          </Button>
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

      {/* RPC Console */}
      {showConsole && <RpcConsole />}

      {/* Paused indicator */}
      {paused && (
        <div className="px-4 py-1 text-[10px] text-amber-400/60 bg-amber-400/[0.03] border-b border-border/10 shrink-0 font-mono">
          paused — {bufferedCount} buffered
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
