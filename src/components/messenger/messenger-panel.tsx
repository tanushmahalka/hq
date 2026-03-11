import { ApprovalCard } from "@/components/approvals/approval-card";
import { useRef, useEffect, useState, type FormEvent } from "react";
import { X, ArrowUp, ChevronDown } from "lucide-react";
import { useApprovals } from "@/hooks/use-approvals";
import { useChat } from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { ChatSendProvider } from "@/hooks/use-chat-send";
import { UXMessageList } from "@/components/chat/session-blocks";
import { MessageContent } from "./message-content";
import { LoaderFive } from "@/components/ui/loader";
import { parseAgentName } from "@/lib/mentions";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ── Chat Panel (slides in/out, 420px) ── */

export function ChatPanel() {
  const { agents, connected } = useGateway();
  const { selectedAgentId, selectAgent, closeChat } = useMessengerPanel();

  if (!selectedAgentId) return null;

  return (
    <div className="h-full w-[420px] flex flex-col border-l border-border/50 bg-card relative">
      {/* Active shimmer — top edge */}
      <ActiveShimmer agentId={selectedAgentId} />

      {/* Header — selected agent + agent switcher dropdown + close */}
      <div className="h-11 px-4 flex items-center gap-2 border-b border-border/50 shrink-0">
        {(() => {
          const selectedAgent = agents.find((a) => a.id === selectedAgentId);
          const raw = selectedAgent?.identity?.name ?? selectedAgent?.name ?? selectedAgentId;
          const { name, role } = parseAgentName(raw);
          const otherAgents = agents.filter((a) => a.id !== selectedAgentId);

          return (
            <>
              {/* Selected agent name + role badge */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{name}</span>
                {role && (
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 shrink-0">
                    {role}
                  </span>
                )}
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    connected ? "bg-[var(--swarm-mint)]" : "bg-red-400"
                  )}
                />
              </div>

              {/* Other agents dropdown */}
              {otherAgents.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors">
                      <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    {otherAgents.map((agent) => {
                      const r = agent.identity?.name ?? agent.name ?? agent.id;
                      const { name: n, role: rl } = parseAgentName(r);
                      return (
                        <DropdownMenuItem
                          key={agent.id}
                          onClick={() => selectAgent(agent.id)}
                          className="flex items-center gap-2"
                        >
                          <span className="text-sm">{n}</span>
                          {rl && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {rl}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          );
        })()}

        <button
          onClick={closeChat}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Chat content */}
      <ChatContent agentId={selectedAgentId} />
    </div>
  );
}

/* ── Active shimmer on panel top edge ── */
function ActiveShimmer({ agentId }: { agentId: string }) {
  const { active } = useAgentActivity(agentId);
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden z-10">
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
          opacity: 0.6,
          animation: "swarm-shimmer 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ── Chat content (messages + input) ── */
function ChatContent({ agentId }: { agentId: string }) {
  const { connected } = useGateway();
  const { agents } = useGateway();
  const { approvals } = useApprovals();
  const { rawMessages, stream, isStreaming, loading, error, sendMessage } =
    useChat(agentId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionKey = `agent:${agentId}:webchat`;
  const sessionApprovals = approvals.filter(
    (approval) => approval.request.sessionKey === sessionKey,
  );

  const agent = agents.find((a) => a.id === agentId);
  const raw = agent?.identity?.name ?? agent?.name ?? agentId;
  const { name: displayName } = parseAgentName(raw);

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
    <>
      {/* Messages */}
      <ChatSendProvider sendMessage={(text) => void sendMessage(text)}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide"
        >
          {sessionApprovals.length > 0 && (
            <div className="space-y-3 px-4 pt-4">
              {sessionApprovals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs text-muted-foreground/40">
                Loading...
              </span>
            </div>
          )}

          {!loading && rawMessages.length === 0 && !isStreaming && (
            <p className="text-xs text-muted-foreground/50 text-center py-12">
              Start a conversation
            </p>
          )}

          <UXMessageList messages={rawMessages} />

          {isStreaming && (
            <div className="px-4 py-1.5">
              <div className="max-w-[90%] space-y-1.5">
                <LoaderFive text="Thinking..." />
                {stream ? (
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    <MessageContent text={stream} />
                  </div>
                ) : null}
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

      {/* Input — clean, border-top separator */}
      <div className="relative border-t border-border/50 shrink-0">
        {isStreaming && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <div
              className="h-full w-full animate-pulse-soft"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 18%, color-mix(in oklab, var(--swarm-violet) 92%, white 8%) 50%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 82%, transparent 100%)",
                boxShadow: "0 0 12px color-mix(in oklab, var(--swarm-violet) 65%, transparent)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
                opacity: 0.9,
                animation: "swarm-shimmer 2s ease-in-out infinite",
              }}
            />
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end"
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
            placeholder={
              connected ? `Message ${displayName}...` : "Connecting..."
            }
            disabled={!connected || isStreaming}
            rows={1}
            className="flex-1 bg-transparent px-4 py-3 pr-12 text-sm resize-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-30 max-h-32 leading-relaxed"
            style={{ minHeight: "44px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "44px";
              target.style.height =
                Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            type="submit"
            disabled={!connected || isStreaming || !input.trim()}
            className="absolute right-3 bottom-2.5 size-7 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-20"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}
