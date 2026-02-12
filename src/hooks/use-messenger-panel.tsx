import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "@uidotdev/usehooks";

type MessengerPanelContextValue = {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  selectedAgentId: string | null;
  selectAgent: (id: string) => void;
  goBack: () => void;
};

const MessengerPanelContext =
  createContext<MessengerPanelContextValue | null>(null);

export function MessengerPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] =
    useLocalStorage<string | null>("hq:messenger:agentId", null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedAgentId(null);
  }, [setSelectedAgentId]);

  const selectAgent = useCallback(
    (id: string) => {
      setSelectedAgentId(id);
      if (!isOpen) setIsOpen(true);
    },
    [isOpen, setSelectedAgentId],
  );

  const goBack = useCallback(
    () => setSelectedAgentId(null),
    [setSelectedAgentId],
  );

  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    toggle();
  });

  return (
    <MessengerPanelContext.Provider
      value={{ isOpen, toggle, open, close, selectedAgentId, selectAgent, goBack }}
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
