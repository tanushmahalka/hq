import { useRef, useEffect, useState, type FormEvent } from "react";
import { X, ChevronDown, SendHorizonal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { useGateway, type Agent } from "@/hooks/use-gateway";

type Props = {
  agent: Agent;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
};

export function MessengerChat({ agent, minimized, onMinimize, onClose }: Props) {
  const { connected } = useGateway();
  const { messages, stream, isStreaming, loading, error, sendMessage } =
    useChat(agent.id);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayName = agent.identity?.name ?? agent.name ?? agent.id;
  const emoji = agent.identity?.emoji;

  useEffect(() => {
    if (!minimized) {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages, stream, minimized]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput("");
  };

  return (
    <div className="w-80 flex flex-col rounded-lg border bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 flex items-center gap-2 bg-primary text-primary-foreground shrink-0">
        {emoji && <span className="text-sm">{emoji}</span>}
        <span className="text-sm font-medium truncate flex-1">{displayName}</span>
        <button
          onClick={onMinimize}
          className="p-0.5 rounded hover:bg-primary-foreground/20 transition-colors"
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-primary-foreground/20 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Body */}
          <div ref={scrollRef} className="h-80 overflow-auto p-3 space-y-2">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span className="text-xs">Loading history...</span>
              </div>
            )}

            {messages.map((msg: ChatMessage, i: number) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isStreaming && stream && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap bg-muted text-foreground">
                  {stream}
                  <span className="inline-block w-1 h-3 ml-0.5 bg-foreground/50 animate-pulse" />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive px-3 py-1.5 rounded-lg bg-destructive/10">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-2">
            <form onSubmit={handleSubmit} className="flex gap-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={connected ? "Message..." : "Connecting..."}
                disabled={!connected || isStreaming}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={!connected || isStreaming || !input.trim()}
              >
                <SendHorizonal className="size-3.5" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
