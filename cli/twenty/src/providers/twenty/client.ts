import type { ResolvedTwentyConfig } from "../../types/config.ts";
import { generatedOpenApiMeta, generatedOperationsById, type GeneratedOperationId } from "../../generated/index.ts";
import { CliError } from "../../core/errors.ts";
import { readResponseBody, toStringRecord } from "../../core/http.ts";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface TwentyResponse<T> {
  data: T;
  headers: Headers;
  status: number;
}

export class TwentyClient {
  private readonly config: ResolvedTwentyConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { config: ResolvedTwentyConfig; fetchImpl?: typeof fetch }) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(options: {
    method?: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    json?: unknown;
    verbose?: boolean;
  }): Promise<TwentyResponse<T>> {
    const baseUrl = this.config.baseUrl ?? generatedOpenApiMeta.servers[0];
    if (!baseUrl) {
      throw new CliError(
        "Missing Twenty base URL. Run `twenty auth set --base-url <url> --token <token>` or set TWENTY_BASE_URL.",
        2,
      );
    }

    const normalizedPath = options.path.startsWith("/") ? options.path.slice(1) : options.path;
    const url = new URL(normalizedPath, baseUrl);

    if (options.query) {
      for (const [key, value] of Object.entries(toStringRecord(options.query))) {
        url.searchParams.set(key, value);
      }
    }

    return this.requestUrl<T>(url.toString(), options);
  }

  async requestOperation<T>(options: {
    operationId: GeneratedOperationId | string;
    pathParams?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined>;
    json?: unknown;
    verbose?: boolean;
  }): Promise<TwentyResponse<T>> {
    const operation = generatedOperationsById[options.operationId as GeneratedOperationId];
    if (!operation) {
      throw new CliError(`Unknown operationId: ${options.operationId}`, 2);
    }

    const interpolatedPath = operation.path.replace(/\{([^}]+)\}/g, (_match, key) => {
      const value = options.pathParams?.[key];
      if (!value) {
        throw new CliError(`Missing path parameter: ${key}`, 2);
      }

      return encodeURIComponent(value);
    });

    return this.request<T>({
      method: operation.method,
      path: interpolatedPath,
      query: options.query,
      json: options.json,
      verbose: options.verbose,
    });
  }

  private async requestUrl<T>(
    url: string,
    options: {
      method?: string;
      json?: unknown;
      verbose?: boolean;
    },
  ): Promise<TwentyResponse<T>> {
    const method = (options.method ?? "GET").toUpperCase();
    const token = this.config.token;

    if (!token) {
      throw new CliError(
        "Missing Twenty bearer token. Run `twenty auth set --base-url <url> --token <token>` or set TWENTY_TOKEN.",
        2,
      );
    }

    let lastError: unknown;
    const attempts = IDEMPOTENT_METHODS.has(method) ? 3 : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const headers: Record<string, string> = {
          Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
          Accept: "application/json",
        };

        let body: string | undefined;
        if (options.json !== undefined) {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(options.json);
        }

        if (options.verbose) {
          process.stderr.write(
            `${JSON.stringify({ type: "request", method, url, hasBody: body !== undefined, timeoutMs: this.config.timeoutMs })}\n`,
          );
        }

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (IDEMPOTENT_METHODS.has(method) && RETRYABLE_STATUS_CODES.has(response.status) && attempt < attempts) {
            await delay(attempt * 150);
            continue;
          }

          throw await normalizeApiError(response);
        }

        const data = (await readResponseBody(response)) as T;

        if (options.verbose) {
          process.stderr.write(
            `${JSON.stringify({ type: "response", method, url, status: response.status, requestId: response.headers.get("x-request-id") ?? undefined })}\n`,
          );
        }

        return {
          data,
          headers: response.headers,
          status: response.status,
        };
      } catch (error) {
        lastError = error;
        if (error instanceof CliError) {
          throw error;
        }

        if (attempt >= attempts) {
          break;
        }

        await delay(attempt * 150);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new CliError(`Twenty request failed: ${(lastError as Error)?.message ?? String(lastError)}`, 1);
  }
}

async function normalizeApiError(response: Response): Promise<CliError> {
  const body = await readResponseBody(response);
  const payload = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;
  const requestId = response.headers.get("x-request-id") ?? undefined;

  const message = payload
    ? (typeof payload.message === "string"
        ? payload.message
        : Array.isArray(payload.messages)
          ? payload.messages.join("; ")
          : typeof payload.error === "string"
            ? payload.error
            : undefined)
    : undefined;

  return new CliError(message ?? `Twenty API request failed with status ${response.status}`, 1, {
    status: response.status,
    requestId,
    details: body,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
