import { Buffer } from "node:buffer";

import { CliError } from "../../core/errors.ts";
import type { ResolvedDataForSeoProviderConfig } from "../../types/config.ts";

interface DataForSeoResponse<T> {
  status_code: number;
  status_message: string;
  tasks_count: number;
  tasks_error: number;
  cost: number;
  tasks: Array<DataForSeoTask<T>>;
}

export interface DataForSeoTask<T> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: Record<string, unknown>;
  result?: T[];
}

export interface DataForSeoInstantPageResult {
  [key: string]: unknown;
}

export interface AuditRequestOptions {
  acceptLanguage?: string;
  device: "desktop" | "mobile" | "tablet";
}

export type DataForSeoMentionsPlatform = "google" | "chat_gpt";
export type DataForSeoMentionsSearchScope = "sources" | "search_results";
export type DataForSeoLlmResponseEngine = "chatgpt" | "claude" | "gemini" | "perplexity";

export interface DataForSeoAuditClient {
  auditInstantPage(url: string, options: AuditRequestOptions): Promise<DataForSeoTask<DataForSeoInstantPageResult>>;
}

export interface DataForSeoAiKeywordDataResult {
  [key: string]: unknown;
}

export interface DataForSeoLlmMentionResult {
  [key: string]: unknown;
}

export interface DataForSeoLlmResponseResult {
  [key: string]: unknown;
}

export interface AiKeywordSearchVolumeRequestOptions {
  keywords: string[];
  locationCode: number;
  languageCode: string;
}

export interface LlmMentionsRequestOptions {
  target: string;
  locationCode: number;
  languageCode: string;
  platform: DataForSeoMentionsPlatform;
  limit?: number;
}

export interface LlmMentionsTopRequestOptions extends LlmMentionsRequestOptions {
  searchScope: DataForSeoMentionsSearchScope;
}

export interface LlmMentionsAggregatedMetricsRequestOptions extends LlmMentionsRequestOptions {
  aggregationKey: string;
}

export interface LlmMentionsCrossAggregatedMetricsRequestOptions {
  targets: string[];
  locationCode: number;
  languageCode: string;
  platform: DataForSeoMentionsPlatform;
  aggregationKey: string;
  limit?: number;
}

export interface LlmResponseLiveRequestOptions {
  userPrompt: string;
  systemMessage?: string;
  modelName?: string;
  webSearch?: boolean;
  maxOutputTokens?: number;
}

export interface DataForSeoGeoClient {
  aiKeywordSearchVolume(
    options: AiKeywordSearchVolumeRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoAiKeywordDataResult>>;
  llmMentionsSearch(options: LlmMentionsRequestOptions): Promise<DataForSeoTask<DataForSeoLlmMentionResult>>;
  llmMentionsAggregatedMetrics(
    options: LlmMentionsAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>>;
  llmMentionsCrossAggregatedMetrics(
    options: LlmMentionsCrossAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>>;
  llmMentionsTopDomains(options: LlmMentionsTopRequestOptions): Promise<DataForSeoTask<DataForSeoLlmMentionResult>>;
  llmMentionsTopPages(options: LlmMentionsTopRequestOptions): Promise<DataForSeoTask<DataForSeoLlmMentionResult>>;
  llmResponseLive(
    engine: DataForSeoLlmResponseEngine,
    options: LlmResponseLiveRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmResponseResult>>;
}

export class DataForSeoClient implements DataForSeoAuditClient, DataForSeoGeoClient {
  constructor(
    private readonly config: ResolvedDataForSeoProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async auditInstantPage(
    url: string,
    options: AuditRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoInstantPageResult>> {
    const task = await this.post<DataForSeoInstantPageResult>("/v3/on_page/instant_pages", [
      {
        url,
        accept_language: options.acceptLanguage,
        enable_browser_rendering: true,
        browser_preset: options.device,
        disable_cookie_popup: true,
        return_despite_timeout: true,
      },
    ]);

    return task;
  }

  async aiKeywordSearchVolume(
    options: AiKeywordSearchVolumeRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoAiKeywordDataResult>> {
    return this.post<DataForSeoAiKeywordDataResult>(
      "/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live",
      [
        {
          keywords: options.keywords,
          location_code: options.locationCode,
          language_code: options.languageCode,
        },
      ],
    );
  }

  async llmMentionsSearch(
    options: LlmMentionsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return this.post<DataForSeoLlmMentionResult>("/v3/ai_optimization/llm_mentions/search/live", [
      {
        target: options.target,
        location_code: options.locationCode,
        language_code: options.languageCode,
        platform: options.platform,
        limit: options.limit,
      },
    ]);
  }

  async llmMentionsAggregatedMetrics(
    options: LlmMentionsAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return this.post<DataForSeoLlmMentionResult>("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", [
      {
        target: options.target,
        location_code: options.locationCode,
        language_code: options.languageCode,
        platform: options.platform,
        aggregation_key: options.aggregationKey,
        limit: options.limit,
      },
    ]);
  }

  async llmMentionsCrossAggregatedMetrics(
    options: LlmMentionsCrossAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return this.post<DataForSeoLlmMentionResult>("/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live", [
      {
        targets: options.targets,
        location_code: options.locationCode,
        language_code: options.languageCode,
        platform: options.platform,
        aggregation_key: options.aggregationKey,
        limit: options.limit,
      },
    ]);
  }

  async llmMentionsTopDomains(
    options: LlmMentionsTopRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return this.post<DataForSeoLlmMentionResult>("/v3/ai_optimization/llm_mentions/top_domains/live", [
      {
        target: options.target,
        location_code: options.locationCode,
        language_code: options.languageCode,
        platform: options.platform,
        search_scope: options.searchScope,
        limit: options.limit,
      },
    ]);
  }

  async llmMentionsTopPages(
    options: LlmMentionsTopRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return this.post<DataForSeoLlmMentionResult>("/v3/ai_optimization/llm_mentions/top_pages/live", [
      {
        target: options.target,
        location_code: options.locationCode,
        language_code: options.languageCode,
        platform: options.platform,
        search_scope: options.searchScope,
        limit: options.limit,
      },
    ]);
  }

  async llmResponseLive(
    engine: DataForSeoLlmResponseEngine,
    options: LlmResponseLiveRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmResponseResult>> {
    return this.post<DataForSeoLlmResponseResult>(`/v3/ai_optimization/${mapLlmResponseEnginePath(engine)}/llm_responses/live`, [
      {
        user_prompt: options.userPrompt,
        system_message: options.systemMessage,
        model_name: options.modelName,
        web_search: options.webSearch,
        max_output_tokens: options.maxOutputTokens,
      },
    ]);
  }

  private async post<T>(endpoint: string, tasks: Array<Record<string, unknown>>): Promise<DataForSeoTask<T>> {
    const body = JSON.stringify(
      tasks.map((task) =>
        Object.fromEntries(Object.entries(task).filter(([, value]) => value !== undefined)),
      ),
    );
    const authorization = Buffer.from(`${this.config.login}:${this.config.password}`).toString("base64");
    const response = await this.fetchImpl(new URL(endpoint, this.config.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new CliError(`DataForSEO request failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = (await response.json()) as DataForSeoResponse<T>;
    if (payload.status_code !== 20000) {
      throw new CliError(`DataForSEO error ${payload.status_code}: ${payload.status_message}`);
    }

    const task = payload.tasks?.[0];
    if (!task) {
      throw new CliError(`DataForSEO returned no tasks for ${endpoint}`);
    }

    if (task.status_code !== 20000) {
      throw new CliError(`DataForSEO task error ${task.status_code}: ${task.status_message}`);
    }

    return task;
  }
}

function mapLlmResponseEnginePath(engine: DataForSeoLlmResponseEngine): string {
  switch (engine) {
    case "chatgpt":
      return "chat_gpt";
    case "claude":
      return "claude";
    case "gemini":
      return "gemini";
    case "perplexity":
      return "perplexity";
  }
}
