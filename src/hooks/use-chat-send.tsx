import { createContext, useContext, type ReactNode } from "react";

type ChatSendContextValue = {
  sendMessage: (text: string) => void;
};

const ChatSendContext = createContext<ChatSendContextValue | null>(null);

export function ChatSendProvider({
  sendMessage,
  children,
}: {
  sendMessage: (text: string) => void;
  children: ReactNode;
}) {
  return (
    <ChatSendContext.Provider value={{ sendMessage }}>
      {children}
    </ChatSendContext.Provider>
  );
}

export function useChatSend(): ChatSendContextValue | null {
  return useContext(ChatSendContext);
}
