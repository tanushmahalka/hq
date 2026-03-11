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
  const [streamSessionKey, setStreamSessionKey] = useState<string | null>(null);

  const sessionKeysRef = useRef(new Set<string>());
  const fetchIdRef = useRef(0);
  const streamRef = useRef<string | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);

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

      setSessions((prev) =>
        prev.map((session) =>
          session.key === sessionKey
            ? {
                ...session,
                messages: [...session.messages, next].sort(
                  (a, b) => a.timestamp - b.timestamp,
                ),
              }
            : session,
        ),
      );
    },
    [],
  );

  const clearStreaming = useCallback(() => {
    streamRef.current = null;
    streamStartedAtRef.current = null;
    setStreamSessionKey(null);
    setStream(null);
  }, []);

  const loadAll = useCallback(async (options?: { background?: boolean }) => {
    if (!client || !connected || !cronId) return;

    const id = ++fetchIdRef.current;
    if (!options?.background) {
      setLoading(true);
    }
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

      const streamStartedAt = streamStartedAtRef.current;
      const activeSessionKey = streamSessionKey;
      if (
        streamStartedAt !== null &&
        activeSessionKey &&
        results.some(
          (session) =>
            session.key === activeSessionKey &&
            session.messages.some(
              (message) =>
                message.role === "assistant" &&
                message.timestamp >= streamStartedAt
            )
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
  }, [clearStreaming, client, connected, cronId, streamSessionKey]);

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
          if (streamStartedAtRef.current === null) {
            streamStartedAtRef.current = Date.now();
          }
          const text = extractText(payload.message);
          if (typeof text === "string") {
            setStreamSessionKey(payload.sessionKey);
            setStream((prev) => {
              const resolved =
                !prev || text.length >= prev.length ? text : prev;
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
  }, [appendAssistantMessage, clearStreaming, subscribe, cronId, loadAll]);

  useEffect(() => {
    if (stream === null) return;
    const interval = window.setInterval(() => {
      void loadAll({ background: true });
    }, 1500);
    return () => window.clearInterval(interval);
  }, [loadAll, stream]);

  const isStreaming = stream !== null;

  return { sessions, stream, streamSessionKey, isStreaming, loading, error };
}
