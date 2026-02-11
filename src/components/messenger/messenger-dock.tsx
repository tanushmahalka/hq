import { useState, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/hooks/use-gateway";
import { MessengerChat } from "./messenger-chat";

export function FloatingMessenger() {
  const { agents, connected } = useGateway();
  const [openChats, setOpenChats] = useState<string[]>([]);
  const [minimized, setMinimized] = useState<Set<string>>(new Set());
  const [dockOpen, setDockOpen] = useState(false);

  const openChat = useCallback((agentId: string) => {
    setOpenChats((prev) =>
      prev.includes(agentId) ? prev : [...prev, agentId],
    );
    setMinimized((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
    setDockOpen(false);
  }, []);

  const closeChat = useCallback((agentId: string) => {
    setOpenChats((prev) => prev.filter((id) => id !== agentId));
    setMinimized((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
  }, []);

  const toggleMinimize = useCallback((agentId: string) => {
    setMinimized((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3">
      {/* Chat windows — flex-row-reverse so they stack left from the dock */}
      <div className="flex flex-row-reverse items-end gap-3">
        {openChats.map((agentId) => {
          const agent = agents.find((a) => a.id === agentId);
          if (!agent) return null;
          return (
            <MessengerChat
              key={agentId}
              agent={agent}
              minimized={minimized.has(agentId)}
              onMinimize={() => toggleMinimize(agentId)}
              onClose={() => closeChat(agentId)}
            />
          );
        })}
      </div>

      {/* Dock column: popover + button */}
      <div className="flex flex-col items-end gap-2">
        {/* Agent list popover */}
        {dockOpen && (
          <div className="w-56 rounded-lg border bg-background shadow-lg p-2">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Agents
            </div>
            {agents.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No agents available
              </div>
            )}
            {agents.map((agent) => {
              const displayName =
                agent.identity?.name ?? agent.name ?? agent.id;
              const emoji = agent.identity?.emoji;
              return (
                <button
                  key={agent.id}
                  onClick={() => openChat(agent.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm">{emoji ?? "🤖"}</span>
                  <span className="text-sm truncate flex-1">{displayName}</span>
                  <span
                    className={`size-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Dock button */}
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg relative"
          onClick={() => setDockOpen((prev) => !prev)}
        >
          <MessageCircle className="size-5" />
          {openChats.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {openChats.length}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
