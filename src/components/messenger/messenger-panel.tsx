import { useRef, useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { MessageContent } from "./message-content";

function parseAgentName(raw: string): { name: string; role?: string } {
  const match = raw.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (match) return { name: match[1].trim(), role: match[2].trim() };
  return { name: raw };
}

export function MessengerPanel() {
  const { selectedAgentId } = useMessengerPanel();

  return (
    <div className="h-full w-[420px] flex flex-col border-l bg-background">
      {selectedAgentId ? <ChatView agentId={selectedAgentId} /> : <AgentListView />}
    </div>
  );
}

function AgentListView() {
  const { agents, connected } = useGateway();
  const { selectAgent, close } = useMessengerPanel();

  return (
    <>
      <div className="h-12 px-4 flex items-center justify-between border-b shrink-0">
        <span className="text-sm font-medium">Agents</span>
        <button
          onClick={close}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 && (
          <div className="px-4 py-8 text-xs text-muted-foreground text-center">
            No agents available
          </div>
        )}
        {agents.map((agent) => {
          const raw = agent.identity?.name ?? agent.name ?? agent.id;
          const { name, role } = parseAgentName(raw);
          const emoji = agent.identity?.emoji;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-sm">{emoji ?? "🤖"}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-sm font-normal truncate">{name}</span>
                {role && (
                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
                    {role}
                  </span>
                )}
              </div>
              <span
                className={`size-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
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
  const { messages, stream, isStreaming, loading, error, sendMessage } =
    useChat(agentId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === agentId);
  const raw = agent?.identity?.name ?? agent?.name ?? agentId;
  const { name: displayName, role } = parseAgentName(raw);
  const emoji = agent?.identity?.emoji;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, stream]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput("");
  };

  return (
    <>
      {/* Header */}
      <div className="h-12 px-3 flex items-center gap-2 border-b shrink-0">
        <button
          onClick={goBack}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs">{emoji ?? "🤖"}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-normal truncate">{displayName}</span>
          {role && (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              {role}
            </span>
          )}
        </div>
        <span
          className={`size-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
        />
        <button
          onClick={close}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        )}

        {messages.map((msg: ChatMessage, i: number) => (
          <MessageBubble key={i} msg={msg} agentEmoji={emoji} />
        ))}

        {isStreaming && stream && (
          <div className="flex gap-3">
            <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px]">{emoji ?? "🤖"}</span>
            </div>
            <div className="flex-1 min-w-0 text-sm text-muted-foreground opacity-60 leading-relaxed">
              <MessageContent text={stream} />
              <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-foreground/40 animate-pulse" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive text-center py-2">{error}</p>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative border-t bg-muted/30 shrink-0">
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
          rows={2}
          className="w-full bg-transparent px-4 py-3 pr-11 text-sm resize-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-40"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-2 bottom-2 size-7"
          disabled={!connected || isStreaming || !input.trim()}
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </>
  );
}

function MessageBubble({
  msg,
  agentEmoji,
}: {
  msg: ChatMessage;
  agentEmoji?: string;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%]">
          <div className="text-sm leading-relaxed bg-foreground text-background rounded-lg rounded-br-sm px-3 py-2">
            <MessageContent text={msg.content} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px]">{agentEmoji ?? "🤖"}</span>
      </div>
      <div className="flex-1 min-w-0 text-sm text-muted-foreground opacity-60 leading-relaxed">
        <MessageContent text={msg.content} />
      </div>
    </div>
  );
}
