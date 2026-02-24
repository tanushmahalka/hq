import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useGateway } from "@/hooks/use-gateway";

type MessengerPanelContextValue = {
  selectedAgentId: string | null;
  chatOpen: boolean;
  selectAgent: (id: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
};

const MessengerPanelContext =
  createContext<MessengerPanelContextValue | null>(null);

export function MessengerPanelProvider({ children }: { children: ReactNode }) {
  const [selectedAgentId, setSelectedAgentId] =
    useLocalStorage<string | null>("hq:messenger:agentId", null);
  const { agents } = useGateway();

  const chatOpen = selectedAgentId !== null;

  const selectAgent = useCallback(
    (id: string) => {
      setSelectedAgentId((prev) => (prev === id ? null : id));
    },
    [setSelectedAgentId],
  );

  const closeChat = useCallback(
    () => setSelectedAgentId(null),
    [setSelectedAgentId],
  );

  const toggleChat = useCallback(() => {
    if (chatOpen) {
      setSelectedAgentId(null);
    } else {
      // Open with last-used agent from localStorage, or first available
      const stored = localStorage.getItem("hq:messenger:agentId");
      const lastId = stored ? JSON.parse(stored) : null;
      const validId =
        lastId && agents.some((a) => a.id === lastId)
          ? lastId
          : agents[0]?.id ?? null;
      if (validId) setSelectedAgentId(validId);
    }
  }, [chatOpen, agents, setSelectedAgentId]);

  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    toggleChat();
  });

  return (
    <MessengerPanelContext.Provider
      value={{ selectedAgentId, chatOpen, selectAgent, closeChat, toggleChat }}
    >
      {children}
    </MessengerPanelContext.Provider>
  );
}

export function useMessengerPanel() {
  const ctx = useContext(MessengerPanelContext);
  if (!ctx)
    throw new Error(
      "useMessengerPanel must be used within MessengerPanelProvider",
    );
  return ctx;
}
