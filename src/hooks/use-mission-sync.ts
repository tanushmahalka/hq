export function useMissionSync() {
  return {
    status: "idle" as const,
    sync: async (_agentId: string) => {
      // Mission sync is temporarily disabled during the API migration.
    },
  };
}
