import { useState, useEffect, useRef, useCallback } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";
import { parseRawMessages, extractText, type RawMessage } from "./use-chat";

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: { content?: Array<{ type: string; text?: string }> };
  errorMessage?: string;
};

/**
 * Discovers all gateway sessions related to a task (including sub-agent sessions)
 * by querying sessions.list and filtering by task ID, rather than constructing
 * session keys manually.
 */
export function useTaskSessions(taskId: string, fallbackAgentId?: string) {
  const { client, connected, subscribe } = useGateway();

  const [sessionKeys, setSessionKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<string | null>(null);

  const sessionKeysRef = useRef(new Set<string>());
  const fetchIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    if (!client || !connected) return;

    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
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
      const matchingKeys = entries
        .filter((s) => s.key?.includes(taskPattern))
        .map((s) => s.key!);

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
          const h = await client.request<{ messages?: Array<unknown> }>(
            "chat.history",
            { sessionKey: key, limit: 200 },
          );
          return { key, msgs: parseRawMessages(h.messages ?? []) };
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
            const h = await client.request<{ messages?: Array<unknown> }>(
              "chat.history",
              { sessionKey: key, limit: 200 },
            );
            return parseRawMessages(h.messages ?? []);
          }),
        );
        if (fetchIdRef.current !== id) return;

        for (const msgs of subHistories) allMsgs.push(...msgs);
      }

      allMsgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(allMsgs);
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      setError(String(err));
    } finally {
      if (fetchIdRef.current === id) setLoading(false);
    }
  }, [client, connected, taskId]);

  // Initial load and reload on reconnect
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Subscribe to real-time chat events for discovered sessions
  useEffect(() => {
    const taskSuffix = `:task:${taskId}`;

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload;
      if (!payload?.sessionKey) return;

      const isRelevant =
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
          const text = extractText(payload.message);
          if (typeof text === "string") {
            setStream((prev) =>
              !prev || text.length >= prev.length ? text : prev,
            );
          }
          break;
        }
        case "final":
          setStream(null);
          loadAll();
          break;
        case "aborted":
          setStream(null);
          break;
        case "error":
          setStream(null);
          setError(payload.errorMessage ?? "chat error");
          break;
      }
    });
  }, [subscribe, taskId, loadAll]);

  // Send message to the primary task session (or fallback)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !connected || !text.trim()) return;

      const primaryKey =
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
        setStream(null);
        setError(String(err));
      }
    },
    [client, connected, taskId, fallbackAgentId],
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
