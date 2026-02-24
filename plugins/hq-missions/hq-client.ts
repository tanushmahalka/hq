export interface MissionChain {
  mission: {
    id: string;
    agentId: string;
    title: string;
    description: string | null;
    status: string;
  };
  objective: {
    id: string;
    title: string;
    description: string | null;
    targetMetric: string | null;
    targetValue: string | null;
    currentValue: string | null;
    status: string;
    dueDate: string | null;
  };
  campaign: {
    id: string;
    title: string;
    description: string | null;
    hypothesis: string | null;
    learnings: string | null;
    status: string;
  };
}

export function createHQClient(baseUrl: string, token: string) {
  async function call<T = unknown>(
    procedure: string,
    input?: unknown
  ): Promise<T> {
    const isQuery = !input;
    const url = isQuery
      ? `${baseUrl}/${procedure}?input=${encodeURIComponent(JSON.stringify(input ?? {}))}`
      : `${baseUrl}/${procedure}`;

    const res = await fetch(url, {
      method: isQuery ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: isQuery ? undefined : JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`HQ API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.result?.data as T;
  }

  async function fetchMissionChain(
    campaignId: string
  ): Promise<MissionChain | null> {
    try {
      return await call<MissionChain | null>("custom.mission.chain", {
        campaignId,
      });
    } catch {
      return null;
    }
  }

  return { call, fetchMissionChain };
}

export type HQClient = ReturnType<typeof createHQClient>;
