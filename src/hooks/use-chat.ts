import { useState, useEffect, useCallback } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: { content?: Array<{ type: string; text?: string }> };
  errorMessage?: string;
};

function extractText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as { content?: unknown };
  if (!Array.isArray(msg.content)) return "";
  return msg.content
    .filter(
      (block: unknown) =>
        typeof block === "object" &&
        block !== null &&
        (block as { type: string }).type === "text",
    )
    .map((block: unknown) => (block as { text?: string }).text ?? "")
    .join("");
}

export function useChat(agentId: string) {
  const { client, connected, subscribe } = useGateway();
  const sessionKey = `${agentId}:webchat:main`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    if (!client || !connected) return;
    setLoading(true);
    client
      .request<{ messages?: Array<unknown> }>("chat.history", {
        sessionKey,
        limit: 200,
      })
      .then((res) => {
        const msgs: ChatMessage[] = (res.messages ?? []).map((m: unknown) => {
          const msg = m as {
            role?: string;
            content?: unknown;
            timestamp?: number;
          };
          return {
            role: (msg.role as "user" | "assistant") ?? "assistant",
            content: extractText(m),
            timestamp: msg.timestamp ?? 0,
          };
        });
        setMessages(msgs);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [client, connected, sessionKey]);

  // TODO(human): Implement handleChatEvent
  // This function receives a real-time event payload from the gateway
  // and should update the chat state accordingly.
  //
  // Available state setters: setStream(text), setRunId(id), setError(msg)
  // Available helper: extractText(payload.message) → string
  //
  // The payload.state will be one of:
  //   "delta"   → partial streaming text (agent is still typing)
  //   "final"   → agent finished responding
  //   "aborted" → run was cancelled
  //   "error"   → something went wrong
  function handleChatEvent(payload: ChatEventPayload) {
    if (payload.sessionKey !== sessionKey) return;
    if (payload.runId && runId && payload.runId !== runId) return;

    // TODO(human): Handle each payload.state case
    // For "delta": update the stream with the latest text
    // For "final": clear the stream, reload history to get the full message
    // For "aborted"/"error": clear the stream, optionally show error
    void payload;
  }

  // Subscribe to gateway events
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      handleChatEvent(evt.payload as ChatEventPayload);
    });
  });

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !connected || !text.trim()) return;

      const newRunId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, timestamp: Date.now() },
      ]);
      setRunId(newRunId);
      setStream("");
      setError(null);

      try {
        await client.request("chat.send", {
          sessionKey,
          message: text,
          deliver: false,
          idempotencyKey: newRunId,
        });
      } catch (err) {
        setRunId(null);
        setStream(null);
        setError(String(err));
      }
    },
    [client, connected, sessionKey],
  );

  const isStreaming = stream !== null;

  return { messages, stream, isStreaming, loading, error, sendMessage };
}
