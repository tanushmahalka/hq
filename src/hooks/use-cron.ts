import { useCallback, useEffect, useState } from "react";
import { useGateway } from "./use-gateway";

export type CronJob = {
  id: string;
  name?: string;
  schedule?: { kind?: string; expr?: string; tz?: string; everyMs?: number; at?: string };
  agentId?: string;
  lastRun?: string;
  nextRun?: string;
  enabled?: boolean;
  [key: string]: unknown;
};

export function useCron() {
  const { client, connected, subscribe } = useGateway();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = useCallback(() => {
    if (!client || !connected) return;
    client
      .request<{ jobs: CronJob[] }>("cron.list")
      .then((res) => {
        setJobs(res.jobs ?? []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [client, connected]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    return subscribe((evt) => {
      if (evt.event === "cron") {
        fetchJobs();
      }
    });
  }, [subscribe, fetchJobs]);

  return { jobs, isLoading };
}
