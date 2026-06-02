/**
 * A 1:1 REST client for the Parallel.ai FindAll API.
 *
 * Mirrors the upstream field names exactly so the wrapper stays faithful.
 * Auth + the required beta header are attached to every request. A `fetchImpl`
 * can be injected for testing (same pattern as the SEO CLI clients).
 *
 * Docs: https://docs.parallel.ai/findall-api/findall-quickstart
 */
import type { Env } from "../trpc/context.ts";
import type { ParallelCandidate } from "./findall-mapping.ts";

const PARALLEL_DEFAULT_BASE_URL = "https://api.parallel.ai";
const PARALLEL_BETA_HEADER = "findall-2025-09-15";

export type ParallelGenerator = "preview" | "base" | "core" | "pro";
export type ParallelProcessor = "core" | "advanced" | "auto";

export interface ParallelMatchCondition {
  name: string;
  description: string;
}

export interface IngestRequest {
  objective: string;
}
export interface IngestResponse {
  objective: string;
  entity_type: string;
  match_conditions: ParallelMatchCondition[];
}

export interface CreateRunRequest {
  objective: string;
  entity_type?: string;
  match_conditions: ParallelMatchCondition[];
  generator: ParallelGenerator;
  match_limit: number; // 5..1000
  metadata?: Record<string, string>;
}
export interface CreateRunResponse {
  findall_id: string;
}

export interface RunStatus {
  status: "running" | "completed" | "cancelled" | "failed";
  is_active: boolean;
  metrics: {
    generated_candidates_count?: number;
    matched_candidates_count?: number;
  };
  termination_reason?: string;
}
export interface GetRunResponse {
  findall_id: string;
  status: RunStatus;
  generator: ParallelGenerator;
  metadata?: Record<string, string>;
  created_at: string;
  modified_at: string;
}

export interface GetResultResponse {
  findall_id: string;
  status: RunStatus;
  candidates: ParallelCandidate[];
  last_event_id?: string;
}

export interface EnrichRequest {
  processor: ParallelProcessor;
  output_schema: {
    type: "json";
    json_schema: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}
export interface ExtendRequest {
  additional_match_limit: number;
}

export class ParallelFindAllError extends Error {
  readonly status: number;
  readonly body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "ParallelFindAllError";
    this.status = status;
    this.body = body;
  }
}

export interface ParallelFindAllOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Resolve the Parallel config from env, or null when the API key is unset. */
export function getParallelConfig(
  env: Env,
): { apiKey: string; baseUrl: string } | null {
  const apiKey = env.PARALLEL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    baseUrl: (env.PARALLEL_API_BASE_URL?.trim() || PARALLEL_DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    ),
  };
}

export class ParallelFindAllClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ParallelFindAllOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? PARALLEL_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "parallel-beta": PARALLEL_BETA_HEADER,
      ...extra,
    };
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify(body ?? {}),
    });
    return this.parse<T>(response, path);
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    return this.parse<T>(response, path);
  }

  private async parse<T>(response: Response, path: string): Promise<T> {
    if (!response.ok) {
      const text = await safeReadText(response);
      throw new ParallelFindAllError(
        `Parallel FindAll ${path} failed with ${response.status}.${text ? ` ${text}` : ""}`,
        response.status,
        text,
      );
    }
    return (await response.json()) as T;
  }

  // POST /v1beta/findall/ingest — natural language → suggested schema.
  ingest(body: IngestRequest): Promise<IngestResponse> {
    return this.postJson("/v1beta/findall/ingest", body);
  }

  // POST /v1beta/findall/runs — start an async run.
  createRun(body: CreateRunRequest): Promise<CreateRunResponse> {
    return this.postJson("/v1beta/findall/runs", body);
  }

  // GET /v1beta/findall/runs/{id} — run status + metrics.
  getRun(findallId: string): Promise<GetRunResponse> {
    return this.getJson(`/v1beta/findall/runs/${findallId}`);
  }

  // GET /v1beta/findall/runs/{id}/result — full candidate set.
  getResult(findallId: string): Promise<GetResultResponse> {
    return this.getJson(`/v1beta/findall/runs/${findallId}/result`);
  }

  // POST /v1beta/findall/runs/{id}/enrich — add enrichment columns.
  enrich(findallId: string, body: EnrichRequest): Promise<unknown> {
    return this.postJson(`/v1beta/findall/runs/${findallId}/enrich`, body);
  }

  // POST /v1beta/findall/runs/{id}/extend — raise the match limit (incremental).
  extend(findallId: string, body: ExtendRequest): Promise<unknown> {
    return this.postJson(`/v1beta/findall/runs/${findallId}/extend`, body);
  }

  // POST /v1beta/findall/runs/{id}/cancel — stop the run.
  cancel(findallId: string): Promise<unknown> {
    return this.postJson(`/v1beta/findall/runs/${findallId}/cancel`, {});
  }

  /**
   * GET /v1beta/findall/runs/{id}/events — Server-Sent Events stream.
   * Returns the raw upstream Response so the caller owns `res.body`.
   */
  async streamEvents(
    findallId: string,
    opts?: { lastEventId?: string; timeout?: number; signal?: AbortSignal },
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}/v1beta/findall/runs/${findallId}/events`);
    if (opts?.lastEventId) url.searchParams.set("last_event_id", opts.lastEventId);
    if (opts?.timeout != null) url.searchParams.set("timeout", String(opts.timeout));

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: this.headers({ Accept: "text/event-stream" }),
      signal: opts?.signal,
    });
    if (!response.ok) {
      const text = await safeReadText(response);
      throw new ParallelFindAllError(
        `Parallel FindAll events failed with ${response.status}.${text ? ` ${text}` : ""}`,
        response.status,
        text,
      );
    }
    return response;
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}
