import { useState, useEffect, useCallback, useRef } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

// Rich types for raw session messages (preserves all block types)
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }
  | {
      type: "toolResult";
      toolName: string;
      content: string;
      exitCode?: number;
      durationMs?: number;
      isError?: boolean;
    };

export type RawMessage = {
  role: "user" | "assistant" | "toolResult";
  blocks: ContentBlock[];
  timestamp: number;
  /** Session key this message belongs to (set by multi-session hooks). */
  sessionKey?: string;
};

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: { content?: Array<{ type: string; text?: string }> };
  errorMessage?: string;
};

export function extractText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as { content?: unknown };
  if (!Array.isArray(msg.content)) return "";
  return msg.content
    .filter(
      (block: unknown) =>
        typeof block === "object" &&
        block !== null &&
        (block as { type: string }).type === "text"
    )
    .map((block: unknown) => (block as { text?: string }).text ?? "")
    .join("");
}

export function parseRawMessages(raw: Array<unknown>): RawMessage[] {
  return raw.map((m: unknown) => {
    const msg = m as {
      role?: string;
      content?: Array<Record<string, unknown>>;
      timestamp?: number;
      toolCallId?: string;
      toolName?: string;
      details?: { exitCode?: number; durationMs?: number; aggregated?: string };
      isError?: boolean;
    };

    const role =
      msg.role === "toolResult"
        ? ("toolResult" as const)
        : msg.role === "user"
        ? ("user" as const)
        : ("assistant" as const);

    const blocks: ContentBlock[] = [];

    if (role === "toolResult") {
      const text = (msg.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => (b.text as string) ?? "")
        .join("");
      blocks.push({
        type: "toolResult",
        toolName: (msg.toolName as string) ?? "tool",
        content: msg.details?.aggregated ?? text,
        exitCode: msg.details?.exitCode,
        durationMs: msg.details?.durationMs,
        isError: msg.isError,
      });
    } else {
      for (const block of msg.content ?? []) {
        switch (block.type) {
          case "text":
            if (block.text)
              blocks.push({ type: "text", text: block.text as string });
            break;
          case "thinking":
            if (block.thinking)
              blocks.push({
                type: "thinking",
                thinking: block.thinking as string,
              });
            break;
          case "toolCall":
            blocks.push({
              type: "toolCall",
              id: (block.id as string) ?? "",
              name: (block.name as string) ?? "tool",
              arguments: (block.arguments as Record<string, unknown>) ?? {},
            });
            break;
        }
      }
    }

    return { role, blocks, timestamp: msg.timestamp ?? 0 };
  });
}

export function useChat(agentId: string, sessionSuffix = "webchat") {
  const { client, connected, subscribe } = useGateway();
  const sessionKey = `agent:${agentId}:${sessionSuffix}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether we're awaiting a response (between send and final)
  const awaitingRef = useRef(false);
  // Capture the server-assigned runId from the first delta event
  const runIdRef = useRef<string | null>(null);

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
        const raw = res.messages ?? [];
        setMessages(parseMessages(raw));
        setRawMessages(parseRawMessages(raw));
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

      // If we know our runId, ignore events from other runs
      // but still handle their "final" to reload history
      const knownRunId = runIdRef.current;
      if (knownRunId && payload.runId && payload.runId !== knownRunId) {
        if (payload.state === "final") {
          reloadHistory();
        }
        return;
      }

      switch (payload.state) {
        case "delta": {
          // Capture server-assigned runId from the first delta
          if (payload.runId && !runIdRef.current) {
            runIdRef.current = payload.runId;
          }
          const next = extractText(payload.message);
          if (typeof next === "string") {
            setStream((prev) =>
              !prev || next.length >= prev.length ? next : prev
            );
          }
          break;
        }
        case "final":
          setStream(null);
          runIdRef.current = null;
          awaitingRef.current = false;
          reloadHistory();
          break;
        case "aborted":
          setStream(null);
          runIdRef.current = null;
          awaitingRef.current = false;
          break;
        case "error":
          setStream(null);
          runIdRef.current = null;
          awaitingRef.current = false;
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
        const raw = res.messages ?? [];
        setMessages(parseMessages(raw));
        setRawMessages(parseRawMessages(raw));
      })
      .catch(() => {});
  }

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !connected || !text.trim()) return;

      const now = Date.now();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, timestamp: now },
      ]);
      setRawMessages((prev) => [
        ...prev,
        { role: "user", blocks: [{ type: "text", text }], timestamp: now },
      ]);
      // Reset runId — will be captured from first delta event
      runIdRef.current = null;
      awaitingRef.current = true;
      setStream("");
      setError(null);

      const idempotencyKey = crypto.randomUUID();
      try {
        await client.request("chat.send", {
          sessionKey,
          message: text,
          deliver: false,
          idempotencyKey,
        });
      } catch (err) {
        runIdRef.current = null;
        awaitingRef.current = false;
        setStream(null);
        setError(String(err));
      }
    },
    [client, connected, sessionKey]
  );

  const isStreaming = stream !== null;

  return { messages, rawMessages, stream, isStreaming, loading, error, sendMessage };
}
