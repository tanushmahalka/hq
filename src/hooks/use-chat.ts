import { useState, useEffect, useCallback, useRef } from "react";
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
  const sessionKey = `agent:${agentId}:main`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs so event handlers always see latest values without re-subscribing
  const runIdRef = useRef(runId);
  runIdRef.current = runId;

  // Monotonically increasing fetch ID — only the latest fetch can write to state
  const fetchIdRef = useRef(0);

  function parseMessages(raw: Array<unknown>): ChatMessage[] {
    return raw.map((m: unknown) => {
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
  }

  // Load history once when connected — uses cleanup flag to ignore stale responses
  useEffect(() => {
    if (!client || !connected) return;
    let stale = false;
    setLoading(true);
    client
      .request<{ messages?: Array<unknown> }>("chat.history", {
        sessionKey,
        limit: 200,
      })
      .then((res) => {
        if (stale) return;
        setMessages(parseMessages(res.messages ?? []));
      })
      .catch((err) => {
        if (stale) return;
        setError(String(err));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [client, connected, sessionKey]);

  // Subscribe to gateway chat events
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload;
      if (!payload || payload.sessionKey !== sessionKey) return;

      const currentRunId = runIdRef.current;
      if (payload.runId && currentRunId && payload.runId !== currentRunId) {
        if (payload.state === "final") {
          reloadHistory();
        }
        return;
      }

      switch (payload.state) {
        case "delta": {
          const next = extractText(payload.message);
          if (typeof next === "string") {
            setStream((prev) =>
              !prev || next.length >= prev.length ? next : prev,
            );
          }
          break;
        }
        case "final":
          setStream(null);
          setRunId(null);
          reloadHistory();
          break;
        case "aborted":
          setStream(null);
          setRunId(null);
          break;
        case "error":
          setStream(null);
          setRunId(null);
          setError(payload.errorMessage ?? "chat error");
          break;
      }
    });
  }, [subscribe, sessionKey]);

  // Reload history after a run completes — only latest fetch wins
  function reloadHistory() {
    if (!client || !connected) return;
    const id = ++fetchIdRef.current;
    client
      .request<{ messages?: Array<unknown> }>("chat.history", {
        sessionKey,
        limit: 200,
      })
      .then((res) => {
        if (fetchIdRef.current !== id) return;
        setMessages(parseMessages(res.messages ?? []));
      })
      .catch(() => {});
  }

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
