export type CronJob = {
  id: string;
  name?: string | null;
  agentId?: string | null;
  enabled?: boolean;
  schedule?: unknown;
  state?: {
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
  } | null;
};

export function useCron() {
  return {
    jobs: [] as CronJob[],
    isLoading: false,
  };
}
