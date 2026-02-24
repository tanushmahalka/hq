import { useEffect, useState } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

/**
 * Returns true while the gateway is streaming chat events
 * for any task session belonging to the given agent.
 * Used to show a shimmer on mission cards when the agent
 * is working on a mission-linked task.
 */
export function useMissionActive(agentId: string): boolean {
  const { subscribe } = useGateway();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const prefix = `agent:${agentId}:task:`;

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey?.startsWith(prefix)) return;

      switch (payload.state) {
        case "delta":
          setActive(true);
          break;
        case "final":
        case "aborted":
        case "error":
          setActive(false);
          break;
      }
    });
  }, [subscribe, agentId]);

  return active;
}
