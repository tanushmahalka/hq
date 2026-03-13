import superjson from "superjson";

export interface MissionChain {
  mission: {
    id: number;
    agentId: string;
    title: string;
    description: string | null;
    status: string;
  };
  objective: {
    id: number;
    title: string;
    description: string | null;
    targetMetric: string | null;
    targetValue: string | null;
    currentValue: string | null;
    status: string;
    dueDate: Date | null;
  };
  campaign: {
    id: number;
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
    input?: unknown,
    options?: { type?: "query" | "mutation" }
  ): Promise<T> {
    const isQuery = options?.type
      ? options.type === "query"
      : !input;
    const serializedInput = superjson.serialize(input ?? {});
    const url = isQuery
      ? `${baseUrl}/${procedure}?input=${encodeURIComponent(JSON.stringify(serializedInput))}`
      : `${baseUrl}/${procedure}`;

    const res = await fetch(url, {
      method: isQuery ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: isQuery ? undefined : JSON.stringify(serializedInput),
    });

    if (!res.ok) {
      throw new Error(`HQ API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const result = data.result?.data;
    return result === undefined
      ? (undefined as T)
      : (superjson.deserialize(result) as T);
  }

  async function fetchMissionChain(
    campaignId: number
  ): Promise<MissionChain | null> {
    try {
      return await call<MissionChain | null>(
        "custom.mission.chain",
        { campaignId },
        { type: "query" }
      );
    } catch {
      return null;
    }
  }

  return { call, fetchMissionChain };
}

export type HQClient = ReturnType<typeof createHQClient>;
