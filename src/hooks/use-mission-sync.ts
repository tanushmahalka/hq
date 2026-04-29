type MissionSyncStatus = "idle" | "syncing" | "synced" | "error";

export function useMissionSync() {
  return {
    status: "idle" as MissionSyncStatus,
    sync: async (_agentId: string) => {
      // Mission sync is temporarily disabled during the API migration.
    },
  };
}
