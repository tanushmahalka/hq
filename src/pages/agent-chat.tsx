import { useRef, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { SendHorizonal, Loader2 } from "lucide-react";

export default function AgentChat() {
  const { agentId } = useParams();
  const { connected } = useGateway();
  const { messages, stream, isStreaming, loading, error, sendMessage } =
    useChat(agentId ?? "default");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or stream updates
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
    <div className="flex flex-col h-[calc(100vh-41px)]">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold capitalize">{agentId}</h1>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Loading history...</span>
          </div>
        )}

        {messages.map((msg: ChatMessage, i: number) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
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
            <div className="max-w-[70%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap bg-muted text-foreground">
              {stream}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground/50 animate-pulse" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive px-4 py-2 rounded-lg bg-destructive/10">
            {error}
          </div>
        )}
      </div>

      <footer className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              connected ? "Send a message..." : "Connecting to gateway..."
            }
            disabled={!connected || isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!connected || isStreaming || !input.trim()}
          >
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
