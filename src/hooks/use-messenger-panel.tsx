import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "@uidotdev/usehooks";

type MessengerPanelContextValue = {
  chatOpen: boolean;
  closeChat: () => void;
  toggleChat: () => void;
};

const MessengerPanelContext =
  createContext<MessengerPanelContextValue | null>(null);

export function MessengerPanelProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useLocalStorage<boolean>(
    "hq:messenger:open",
    false,
  );

  const closeChat = useCallback(
    () => setChatOpen(false),
    [setChatOpen],
  );

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, [setChatOpen]);

  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    toggleChat();
  });

  return (
    <MessengerPanelContext.Provider
      value={{ chatOpen, closeChat, toggleChat }}
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
