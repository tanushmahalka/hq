import type { RawMessage } from "./use-chat";

export type CronSession = {
  key: string;
  messages: RawMessage[];
};

export function useCronSessions(_cronId: string) {
  return {
    sessions: [] as CronSession[],
    stream: null as string | null,
    streamSessionKey: null as string | null,
    isStreaming: false,
    loading: false,
    error: null as string | null,
  };
}
