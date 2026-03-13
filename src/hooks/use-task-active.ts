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
 * for any session whose key ends with `:{taskId}`.
 */
export function useTaskActive(
  taskId: string,
  linkedSessionKeys?: string[],
): boolean {
  const { subscribe } = useGateway();
  const [active, setActive] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const suffix = `:task:${taskId}`;
    const linked = new Set(linkedSessionKeys ?? []);

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey) return;

      const isRelevant =
        payload.sessionKey.endsWith(suffix) || linked.has(payload.sessionKey);
      if (!isRelevant) return;

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
  }, [linkedSessionKeys, subscribe, taskId]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  return active;
}
