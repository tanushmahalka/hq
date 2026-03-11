import { useEffect, useRef, useState } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

const ACTIVE_STALE_MS = 10_000;

/**
 * Returns true while the gateway is streaming chat events
 * for any task session belonging to the given agent.
 * Used to show a shimmer on mission cards when the agent
 * is working on a mission-linked task.
 */
export function useMissionActive(agentId: string): boolean {
  const { subscribe } = useGateway();
  const [active, setActive] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prefix = `agent:${agentId}:task:`;

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey?.startsWith(prefix)) return;

      switch (payload.state) {
        case "delta":
          if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
          }
          setActive(true);
          clearTimerRef.current = setTimeout(() => {
            setActive(false);
            clearTimerRef.current = null;
          }, ACTIVE_STALE_MS);
          break;
        case "final":
        case "aborted":
        case "error":
          if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
          }
          setActive(false);
          break;
      }
    });
  }, [subscribe, agentId]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  return active;
}
