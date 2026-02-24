import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

// Global pending sessions — tracks sessions where a message was sent but
// no delta has arrived yet (the "waiting for agent" phase).
const pendingSessions = new Set<string>();
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

/** Call when a chat.send is fired — marks the session as pending. */
export function markSessionPending(sessionKey: string) {
  pendingSessions.add(sessionKey);
  emitChange();
}

/** Call to clear a pending session (e.g. on error before any gateway event). */
export function clearSessionPending(sessionKey: string) {
  pendingSessions.delete(sessionKey);
  emitChange();
}

function subscribeToPending(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getPendingCount() {
  return pendingSessions.size;
}

/**
 * Returns true while any agent is actively responding OR while we're
 * waiting for an agent to start responding after sending a message.
 */
export function useAnyAgentActive(): boolean {
  const { subscribe } = useGateway();
  const [streaming, setStreaming] = useState(false);
  const sessionsRef = useRef(new Set<string>());

  const pendingCount = useSyncExternalStore(subscribeToPending, getPendingCount);

  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey) return;

      const sessions = sessionsRef.current;

      switch (payload.state) {
        case "delta":
          // First delta means agent started — clear the pending state
          pendingSessions.delete(payload.sessionKey);
          emitChange();
          sessions.add(payload.sessionKey);
          setStreaming(true);
          break;
        case "final":
        case "aborted":
        case "error":
          pendingSessions.delete(payload.sessionKey);
          emitChange();
          sessions.delete(payload.sessionKey);
          if (sessions.size === 0) setStreaming(false);
          break;
      }
    });
  }, [subscribe]);

  return streaming || pendingCount > 0;
}
