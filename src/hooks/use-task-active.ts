import { useEffect, useState } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

/**
 * Returns true while the gateway is streaming chat events
 * for any session whose key ends with `:{taskId}`.
 */
export function useTaskActive(taskId: string): boolean {
  const { subscribe } = useGateway();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const suffix = `:${taskId}`;

    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey?.endsWith(suffix)) return;

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
  }, [subscribe, taskId]);

  return active;
}
