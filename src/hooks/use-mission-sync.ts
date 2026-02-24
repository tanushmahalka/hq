import { useState, useCallback } from "react";
import { useGateway } from "./use-gateway";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

export function useMissionSync() {
  const { client, connected } = useGateway();
  const [status, setStatus] = useState<SyncStatus>("idle");

  const sync = useCallback(
    async (agentId: string) => {
      if (!client || !connected) return;
      setStatus("syncing");
      try {
        await client.request("missions.sync", { agentId });
        setStatus("synced");
        setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    },
    [client, connected]
  );

  const checkStatus = useCallback(async () => {
    if (!client || !connected) return null;
    try {
      return await client.request<{ ok: boolean; connected: boolean }>(
        "missions.status"
      );
    } catch {
      return null;
    }
  }, [client, connected]);

  return { sync, checkStatus, status, connected };
}
