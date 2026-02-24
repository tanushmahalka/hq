import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "@uidotdev/usehooks";

type MessengerPanelContextValue = {
  selectedAgentId: string | null;
  chatOpen: boolean;
  selectAgent: (id: string) => void;
  closeChat: () => void;
};

const MessengerPanelContext =
  createContext<MessengerPanelContextValue | null>(null);

export function MessengerPanelProvider({ children }: { children: ReactNode }) {
  const [selectedAgentId, setSelectedAgentId] =
    useLocalStorage<string | null>("hq:messenger:agentId", null);

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

  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    if (chatOpen) closeChat();
  });

  return (
    <MessengerPanelContext.Provider
      value={{ selectedAgentId, chatOpen, selectAgent, closeChat }}
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
