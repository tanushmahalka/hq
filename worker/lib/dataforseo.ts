const DEFAULT_BASE_URL = "https://api.dataforseo.com";

export type GeoPlatform = "google_ai_overviews" | "chat_gpt";

export interface DataForSeoConfig {
  login: string;
  password: string;
  baseUrl?: string;
}

export interface LlmMentionsSearchInput {
  keyword: string;
  target: string[];
  platform?: GeoPlatform;
  searchScope?: "google" | "platforms_news" | "platforms_content";
  matchType?: "partial_match" | "exact_match" | "word_match";
  locationName?: string;
  languageName?: string;
}

type DataForSeoTaskError = {
  status_code?: number;
  status_message?: string;
  result?: unknown;
};

type DataForSeoEnvelope = {
  status_code?: number;
  status_message?: string;
  tasks_error?: number;
  tasks?: DataForSeoTaskError[];
};

function buildAuthorizationValue(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function createTaskErrorMessage(payload: DataForSeoEnvelope): string {
  const taskMessage = payload.tasks?.find((task) => task.status_message)?.status_message;
  return taskMessage || payload.status_message || "DataForSEO request failed.";
}

export async function searchLlmMentions(
  config: DataForSeoConfig,
  input: LlmMentionsSearchInput,
): Promise<unknown> {
  const url = new URL(
    "/v3/ai_optimization/llm_mentions/search/live",
    config.baseUrl ?? DEFAULT_BASE_URL,
  );

  const payload = [
    {
      keyword: input.keyword,
      target: input.target.slice(0, 10),
      platform: input.platform ?? "google_ai_overviews",
      search_scope: input.searchScope ?? "google",
      match_type: input.matchType ?? "partial_match",
      location_name: input.locationName ?? "United States",
      language_name: input.languageName ?? "English",
    },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationValue(config.login, config.password),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsed: DataForSeoEnvelope | undefined;

  try {
    parsed = rawText ? (JSON.parse(rawText) as DataForSeoEnvelope) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    throw new Error(parsed ? createTaskErrorMessage(parsed) : rawText || "DataForSEO request failed.");
  }

  if (!parsed) {
    throw new Error("DataForSEO returned an empty response.");
  }

  if (parsed.status_code && parsed.status_code !== 20000) {
    throw new Error(createTaskErrorMessage(parsed));
  }

  if ((parsed.tasks_error ?? 0) > 0) {
    throw new Error(createTaskErrorMessage(parsed));
  }

  const taskError = parsed.tasks?.find((task) => task.status_code && task.status_code !== 20000);
  if (taskError) {
    throw new Error(taskError.status_message || "DataForSEO task failed.");
  }

  return parsed;
}
