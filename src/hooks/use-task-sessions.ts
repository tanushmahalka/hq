import { useState, useEffect, useRef, useCallback } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";
import {
  parseRawMessages,
  extractText,
  parseRawMessage,
  buildAssistantTextMessage,
  type RawMessage,
} from "./use-chat";

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type UseTaskSessionsOptions = {
  fallbackAgentId?: string;
  linkedSessionKeys?: string[];
  primarySessionKey?: string;
};

/**
 * Loads task-related session history. Complex tasks can provide linked session
 * keys from HQ workflow state, while simple tasks still fall back to task-key
 * discovery via sessions.list.
 */
export function useTaskSessions(
  taskId: string,
  options: UseTaskSessionsOptions = {},
) {
  const { client, connected, subscribe } = useGateway();
  const { fallbackAgentId, linkedSessionKeys = [], primarySessionKey } = options;

  const [sessionKeys, setSessionKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<string | null>(null);

  const sessionKeysRef = useRef(new Set<string>());
  const fetchIdRef = useRef(0);
  const streamRef = useRef<string | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);
  const streamSessionKeyRef = useRef<string | null>(null);

  const appendAssistantMessage = useCallback(
    (sessionKey: string, message: unknown, fallbackText?: string) => {
      const parsed = parseRawMessage(message);
      const fallback = fallbackText?.trim() ?? "";
      const next =
        parsed?.role === "assistant"
          ? {
              ...parsed,
              sessionKey,
              timestamp: parsed.timestamp || Date.now(),
            }
          : (() => {
              const built = buildAssistantTextMessage(fallback);
              return built ? { ...built, sessionKey } : null;
            })();

      if (!next) {
        return;
      }

      setMessages((prev) =>
        [...prev, next].sort((a, b) => a.timestamp - b.timestamp),
      );
    },
    [],
  );

  const clearStreaming = useCallback(() => {
    streamRef.current = null;
    streamStartedAtRef.current = null;
    streamSessionKeyRef.current = null;
    setStream(null);
  }, []);

  const loadAll = useCallback(async (options?: { background?: boolean }) => {
    if (!client || !connected) return;

    const id = ++fetchIdRef.current;
    if (!options?.background) {
      setLoading(true);
    }
    setError(null);

    try {
      let matchingKeys = [...new Set(linkedSessionKeys.filter(Boolean))];

      if (matchingKeys.length === 0) {
        // 1. Discover sessions matching this task via sessions.list
        const res = await client.request<unknown>("sessions.list", { limit: 500 });
        if (fetchIdRef.current !== id) return;

        // Handle different response shapes (array or { sessions: [...] })
        const entries = (
          Array.isArray(res)
            ? res
            : Array.isArray((res as Record<string, unknown>)?.sessions)
              ? (res as Record<string, unknown>).sessions
              : []
        ) as Array<{ key?: string }>;

        const taskPattern = `task:${taskId}`;
        matchingKeys = entries
          .filter((s) => s.key?.includes(taskPattern))
          .map((s) => s.key!)
          .filter(Boolean);
      }

      sessionKeysRef.current = new Set(matchingKeys);
      setSessionKeys(matchingKeys);

      if (matchingKeys.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // 2. Load history for all task sessions
      const histories = await Promise.all(
        matchingKeys.map(async (key) => {
          const h = await client
            .request<{ messages?: Array<unknown> }>("chat.history", {
              sessionKey: key,
              limit: 200,
            })
            .catch(() => ({ messages: [] }));
          const msgs = parseRawMessages(h.messages ?? []);
          // Tag each message with its session key
          for (const m of msgs) m.sessionKey = key;
          return { key, msgs };
        }),
      );
      if (fetchIdRef.current !== id) return;

      const allMsgs: RawMessage[] = [];
      const subAgentKeys: string[] = [];

      for (const { msgs } of histories) {
        allMsgs.push(...msgs);

        // 3. Scan tool results for sub-agent session keys
        for (const msg of msgs) {
          for (const block of msg.blocks) {
            if (block.type === "toolResult" && block.content) {
              const matches = block.content.matchAll(
                /agent:[a-zA-Z0-9_.-]+:subagent:[a-zA-Z0-9_.-]+/g,
              );
              for (const m of matches) {
                if (!sessionKeysRef.current.has(m[0])) {
                  subAgentKeys.push(m[0]);
                }
              }
            }
          }
        }
      }

      // 4. Load sub-agent session histories
      if (subAgentKeys.length > 0) {
        for (const k of subAgentKeys) sessionKeysRef.current.add(k);
        setSessionKeys([...sessionKeysRef.current]);

        const subHistories = await Promise.all(
          subAgentKeys.map(async (key) => {
            const h = await client
              .request<{ messages?: Array<unknown> }>("chat.history", {
                sessionKey: key,
                limit: 200,
              })
              .catch(() => ({ messages: [] }));
            const msgs = parseRawMessages(h.messages ?? []);
            for (const m of msgs) m.sessionKey = key;
            return msgs;
          }),
        );
        if (fetchIdRef.current !== id) return;

        for (const msgs of subHistories) allMsgs.push(...msgs);
      }

      allMsgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(allMsgs);

      const streamStartedAt = streamStartedAtRef.current;
      const streamSessionKey = streamSessionKeyRef.current;
      if (
        streamStartedAt !== null &&
        streamSessionKey &&
        allMsgs.some(
          (message) =>
            message.sessionKey === streamSessionKey &&
            message.role === "assistant" &&
            message.timestamp >= streamStartedAt
        )
      ) {
        clearStreaming();
      }
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      setError(String(err));
    } finally {
      if (fetchIdRef.current === id && !options?.background) setLoading(false);
    }
  }, [clearStreaming, client, connected, linkedSessionKeys, taskId]);

  // Initial load and reload on reconnect
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Subscribe to real-time chat events for discovered sessions
  useEffect(() => {
    const taskSuffix = `:task:${taskId}`;
    const linked = new Set(linkedSessionKeys);

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload;
      if (!payload?.sessionKey) return;

      const isRelevant =
        linked.has(payload.sessionKey) ||
        payload.sessionKey.includes(taskSuffix) ||
        sessionKeysRef.current.has(payload.sessionKey);
      if (!isRelevant) return;

      // Track newly discovered sessions (e.g. from live events)
      if (!sessionKeysRef.current.has(payload.sessionKey)) {
        sessionKeysRef.current.add(payload.sessionKey);
        setSessionKeys([...sessionKeysRef.current]);
      }

      switch (payload.state) {
        case "delta": {
          streamSessionKeyRef.current = payload.sessionKey;
          if (streamStartedAtRef.current === null) {
            streamStartedAtRef.current = Date.now();
          }
          const text = extractText(payload.message);
          if (typeof text === "string") {
            setStream((prev) => {
              const resolved = !prev || text.length >= prev.length ? text : prev;
              streamRef.current = resolved;
              return resolved;
            });
          }
          break;
        }
        case "final":
          appendAssistantMessage(
            payload.sessionKey,
            payload.message,
            streamRef.current ?? undefined,
          );
          clearStreaming();
          void loadAll({ background: true });
          break;
        case "aborted":
          appendAssistantMessage(
            payload.sessionKey,
            payload.message,
            streamRef.current ?? undefined,
          );
          clearStreaming();
          break;
        case "error":
          clearStreaming();
          setError(payload.errorMessage ?? "chat error");
          break;
      }
    });
  }, [appendAssistantMessage, clearStreaming, linkedSessionKeys, subscribe, taskId, loadAll]);

  useEffect(() => {
    if (stream === null) return;
    const interval = window.setInterval(() => {
      void loadAll({ background: true });
    }, 1500);
    return () => window.clearInterval(interval);
  }, [loadAll, stream]);

  // Send message to the primary task session (or fallback)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !connected || !text.trim()) return;

      const primaryKey =
        primarySessionKey ??
        [...sessionKeysRef.current].find((k) =>
          k.includes(`:task:${taskId}`),
        ) ??
        (fallbackAgentId
          ? `agent:${fallbackAgentId}:task:${taskId}`
          : null);
      if (!primaryKey) return;

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          blocks: [{ type: "text", text }],
          timestamp: Date.now(),
        },
      ]);
      const startedAt = Date.now();
      streamStartedAtRef.current = startedAt;
      streamSessionKeyRef.current = primaryKey;
      streamRef.current = "";
      setStream("");
      setError(null);

      try {
        await client.request("chat.send", {
          sessionKey: primaryKey,
          message: text,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        clearStreaming();
        setError(String(err));
      }
    },
    [clearStreaming, client, connected, primarySessionKey, taskId, fallbackAgentId],
  );

  const isStreaming = stream !== null;

  return {
    messages,
    sessionKeys,
    stream,
    isStreaming,
    loading,
    error,
    sendMessage,
  };
}
