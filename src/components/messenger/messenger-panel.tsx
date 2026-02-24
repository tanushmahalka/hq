import { useRef, useEffect, useState, type FormEvent } from "react";
import { X, ArrowUp } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { ChatSendProvider } from "@/hooks/use-chat-send";
import { SessionMessageRow } from "@/components/chat/session-blocks";
import { MessageContent } from "./message-content";
import { parseAgentName } from "@/lib/mentions";
import { useAllAgentActivity } from "@/hooks/use-agent-activity";

/* ── Agent Strip (always-visible right edge) ── */

export function AgentStrip() {
  const { agents, connected } = useGateway();
  const { selectedAgentId, selectAgent } = useMessengerPanel();
  const activityMap = useAllAgentActivity();

  return (
    <div className="h-full w-16 flex flex-col items-center border-l border-border/50 dark:bg-[oklch(0.10_0.005_270)] py-3 gap-1 shrink-0">
      <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 font-medium mb-2">
        Agents
      </span>

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center gap-3 w-full px-1.5">
        {agents.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground/30 text-center leading-tight">
              No<br />agents
            </span>
          </div>
        )}

        {agents.map((agent) => {
          const raw = agent.identity?.name ?? agent.name ?? agent.id;
          const { name, role } = parseAgentName(raw);
          const activity = activityMap.get(agent.id);
          const isActive = activity?.active ?? false;
          const isSelected = selectedAgentId === agent.id;
          const initial = name.charAt(0).toUpperCase();

          return (
            <AgentBubble
              key={agent.id}
              initial={initial}
              role={role}
              active={isActive}
              selected={isSelected}
              connected={connected}
              onClick={() => selectAgent(agent.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function AgentBubble({
  initial,
  role,
  active,
  selected,
  connected,
  onClick,
}: {
  initial: string;
  role?: string;
  active: boolean;
  selected: boolean;
  connected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
    >
      {/* Bubble with optional shimmer ring */}
      <div className="relative">
        {/* Shimmer ring (behind the bubble) */}
        {active && (
          <div
            className="absolute -inset-[3px] rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, var(--swarm-violet) 25%, transparent 50%, var(--swarm-violet) 75%, transparent 100%)",
              opacity: 0.5,
              animation: "agent-ring-shimmer 3s linear infinite",
            }}
          />
        )}

        {/* Avatar circle */}
        <div
          className={`relative size-10 rounded-full flex items-center justify-center transition-colors text-sm font-mono ${
            selected
              ? "bg-[var(--swarm-violet)]/15 text-[var(--swarm-violet)] ring-1 ring-[var(--swarm-violet)]/40"
              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
          }`}
        >
          {initial}

          {/* Connection status dot */}
          <div
            className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[oklch(0.10_0.005_270)] ${
              connected ? "bg-[var(--swarm-mint)]" : "bg-red-400"
            }`}
          />
        </div>
      </div>

      {/* Role label */}
      {role && (
        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/40 font-medium truncate max-w-[56px] text-center leading-none">
          {role}
        </span>
      )}
    </button>
  );
}

/* ── Chat Panel (slides in/out) ── */

export function ChatPanel({ agentId }: { agentId: string }) {
  const { agents, connected } = useGateway();
  const { closeChat } = useMessengerPanel();
  const { rawMessages, stream, isStreaming, loading, error, sendMessage } =
    useChat(agentId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === agentId);
  const raw = agent?.identity?.name ?? agent?.name ?? agentId;
  const { name: displayName, role } = parseAgentName(raw);
  const emoji = agent?.identity?.emoji;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [rawMessages, stream]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput("");
  };

  return (
    <div className="h-full w-[380px] flex flex-col border-l border-border/50 dark:bg-[oklch(0.11_0.005_270)]">
      {/* Header */}
      <div className="h-11 px-3 flex items-center gap-2 border-b border-border/50 shrink-0">
        <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-[10px]">{emoji ?? "🤖"}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-mono font-normal truncate">
            {displayName}
          </span>
          {role && (
            <span className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 shrink-0">
              {role}
            </span>
          )}
        </div>
        <span
          className={`size-1.5 rounded-full shrink-0 ${
            connected ? "bg-[var(--swarm-mint)]" : "bg-red-400"
          }`}
        />
        <button
          onClick={closeChat}
          className="p-1 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Messages */}
      <ChatSendProvider sendMessage={(text) => void sendMessage(text)}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide"
        >
          {loading && (
            <div className="flex items-center justify-center py-12">
              <StreamingDots />
            </div>
          )}

          {!loading && rawMessages.length === 0 && !isStreaming && (
            <p className="text-xs text-muted-foreground/50 text-center py-12">
              Start a conversation
            </p>
          )}

          {rawMessages.map((msg, i) => (
            <SessionMessageRow key={i} msg={msg} />
          ))}

          {isStreaming && (
            <div className="px-4 py-1.5">
              <div className="max-w-[90%]">
                {stream ? (
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    <MessageContent text={stream} />
                    <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-[var(--swarm-violet)] animate-pulse rounded-full" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <StreamingDots />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 my-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      </ChatSendProvider>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end rounded-xl border border-border/50 bg-card/80 transition-colors focus-within:border-border"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={connected ? "Message..." : "Connecting..."}
            disabled={!connected || isStreaming}
            rows={1}
            className="flex-1 bg-transparent px-3.5 py-2.5 pr-10 text-sm resize-none outline-none placeholder:text-muted-foreground/40 disabled:opacity-30 max-h-32 leading-relaxed"
            style={{ minHeight: "40px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "40px";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            type="submit"
            disabled={!connected || isStreaming || !input.trim()}
            className="absolute right-2 bottom-2 size-6 rounded-lg bg-foreground text-background flex items-center justify-center transition-opacity disabled:opacity-20 hover:opacity-80"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: "0ms" }} />
      <span className="size-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="size-1.5 rounded-full bg-muted-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
    </div>
  );
}
