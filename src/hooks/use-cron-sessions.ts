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

export type CronSession = {
  key: string;
  messages: RawMessage[];
};

/**
 * Discovers gateway sessions related to a cron job by matching the cron ID
 * in session keys, loads chat history for each, and streams live updates.
 */
export function useCronSessions(cronId: string | null) {
  const { client, connected, subscribe } = useGateway();

  const [sessions, setSessions] = useState<CronSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<string | null>(null);

  const sessionKeysRef = useRef(new Set<string>());
  const fetchIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    if (!client || !connected || !cronId) return;

    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await client.request<unknown>("sessions.list", { limit: 500 });
      if (fetchIdRef.current !== id) return;

      const entries = (
        Array.isArray(res)
          ? res
          : Array.isArray((res as Record<string, unknown>)?.sessions)
            ? (res as Record<string, unknown>).sessions
            : []
      ) as Array<{ key?: string }>;

      // Match sessions containing this cron ID
      const cronPattern = `cron:${cronId}`;
      const matchingKeys = entries
        .filter((s) => s.key?.includes(cronPattern))
        .map((s) => s.key!);

      sessionKeysRef.current = new Set(matchingKeys);

      if (matchingKeys.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // Load history for all matching sessions
      const results = await Promise.all(
        matchingKeys.map(async (key) => {
          const h = await client.request<{ messages?: Array<unknown> }>(
            "chat.history",
            { sessionKey: key, limit: 200 },
          );
          return { key, messages: parseRawMessages(h.messages ?? []) };
        }),
      );
      if (fetchIdRef.current !== id) return;

      // Sort sessions by first message timestamp (most recent first)
      results.sort((a, b) => {
        const aTs = a.messages[0]?.timestamp ?? 0;
        const bTs = b.messages[0]?.timestamp ?? 0;
        return bTs - aTs;
      });

      setSessions(results);
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      setError(String(err));
    } finally {
      if (fetchIdRef.current === id) setLoading(false);
    }
  }, [client, connected, cronId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Subscribe to real-time chat events for discovered sessions
  useEffect(() => {
    if (!cronId) return;
    const cronSuffix = `:cron:${cronId}`;

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload;
      if (!payload?.sessionKey) return;

      const isRelevant =
        payload.sessionKey.includes(cronSuffix) ||
        sessionKeysRef.current.has(payload.sessionKey);
      if (!isRelevant) return;

      if (!sessionKeysRef.current.has(payload.sessionKey)) {
        sessionKeysRef.current.add(payload.sessionKey);
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
  }, [subscribe, cronId, loadAll]);

  const isStreaming = stream !== null;

  return { sessions, stream, isStreaming, loading, error };
}
