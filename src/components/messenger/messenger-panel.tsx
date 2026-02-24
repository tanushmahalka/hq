import { useRef, useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, X, ArrowUp } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { ChatSendProvider } from "@/hooks/use-chat-send";
import { SessionMessageRow } from "@/components/chat/session-blocks";
import { MessageContent } from "./message-content";
import { parseAgentName } from "@/lib/mentions";

export function MessengerPanel() {
  const { selectedAgentId } = useMessengerPanel();

  return (
    <div className="h-full w-[420px] flex flex-col border-l border-border dark:bg-[oklch(0.11_0.005_270)]">
      {selectedAgentId ? (
        <ChatView agentId={selectedAgentId} />
      ) : (
        <AgentListView />
      )}
    </div>
  );
}

function AgentListView() {
  const { agents, connected } = useGateway();
  const { selectAgent, close } = useMessengerPanel();

  return (
    <>
      {/* Header */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-border/50 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
          Agents
        </span>
        <button
          onClick={close}
          className="p-1 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {agents.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">
            No agents available
          </p>
        )}
        {agents.map((agent) => {
          const raw = agent.identity?.name ?? agent.name ?? agent.id;
          const { name, role } = parseAgentName(raw);
          const emoji = agent.identity?.emoji;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--swarm-surface-hover)] transition-colors text-left group"
            >
              <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs">{emoji ?? "🤖"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono font-normal truncate">
                    {name}
                  </span>
                  {role && (
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 shrink-0">
                      {role}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`size-1.5 rounded-full shrink-0 ${
                  connected
                    ? "bg-[var(--swarm-mint)]"
                    : "bg-red-400"
                }`}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

function ChatView({ agentId }: { agentId: string }) {
  const { agents, connected } = useGateway();
  const { goBack, close } = useMessengerPanel();
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
    <>
      {/* Header */}
      <div className="h-11 px-3 flex items-center gap-2 border-b border-border/50 shrink-0">
        <button
          onClick={goBack}
          className="p-1 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
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
          onClick={close}
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
    </>
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
