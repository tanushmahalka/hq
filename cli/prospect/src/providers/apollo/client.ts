import { CliError } from "../../core/errors.ts";
import { readResponseBody } from "../../core/http.ts";
import type { ResolvedApolloConfig } from "../../types/config.ts";
import { throwApolloError } from "./errors.ts";

export interface ApolloResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class ApolloClient {
  private readonly config: ResolvedApolloConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { config: ResolvedApolloConfig; fetchImpl?: typeof fetch }) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(options: {
    method?: string;
    path: string;
    query?: Record<string, unknown>;
    json?: unknown;
    timeoutMs?: number;
  }): Promise<ApolloResponse<T>> {
    const apiKey = this.config.apiKey;
    const baseUrl = this.config.baseUrl;

    if (!apiKey) {
      throw new CliError(
        "Missing Apollo API key. Run `prospect auth set apollo --api-key <key>` or set APOLLO_API_KEY.",
        2,
      );
    }

    if (!baseUrl) {
      throw new CliError("Missing Apollo base URL.", 2);
    }

    const url = new URL(options.path.startsWith("/") ? options.path : `/${options.path}`, `${baseUrl}/`);
    if (options.query) {
      appendQueryParams(url.searchParams, options.query);
    }

    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
    };

    let body: string | undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        await throwApolloError(response);
      }

      return {
        data: await readResponseBody(response) as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new CliError(`Apollo request timed out after ${timeoutMs}ms.`, 1);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function appendQueryParams(params: URLSearchParams, value: Record<string, unknown>): void {
  for (const [key, entry] of Object.entries(value)) {
    appendQueryValue(params, key, entry);
  }
}

function appendQueryValue(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(params, key, item);
    }
    return;
  }

  if (value === null) {
    params.append(key, "null");
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    params.append(key, String(value));
    return;
  }

  params.append(key, JSON.stringify(value));
}
