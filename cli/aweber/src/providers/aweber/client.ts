import { CliError } from "../../core/errors.ts";
import { readResponseBody, toStringRecord } from "../../core/http.ts";
import type { ResolvedAweberConfig, AweberTokenSet } from "../../types/config.ts";
import { throwAweberError } from "./errors.ts";
import { isAccessTokenExpired, refreshAccessToken } from "./oauth.ts";

export type AweberApiVersion = "v1" | "beta";

export interface AweberResponse<T> {
  data: T;
  headers: Headers;
  status: number;
}

export class AweberClient {
  private config: ResolvedAweberConfig;
  private fetchImpl: typeof fetch;
  private persistTokens?: (tokens: AweberTokenSet) => Promise<void>;

  constructor(options: {
    config: ResolvedAweberConfig;
    fetchImpl?: typeof fetch;
    persistTokens?: (tokens: AweberTokenSet) => Promise<void>;
  }) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.persistTokens = options.persistTokens;
  }

  async request<T>(options: {
    method?: string;
    path: string;
    version?: AweberApiVersion;
    query?: Record<string, string | number | boolean | undefined>;
    json?: unknown;
    form?: Record<string, string>;
  }): Promise<AweberResponse<T>> {
    return this.requestUrl<T>(this.buildUrl(options.path, options.version ?? "v1", options.query), options);
  }

  async requestAbsolute<T>(options: {
    method?: string;
    url: string;
    json?: unknown;
    form?: Record<string, string>;
  }): Promise<AweberResponse<T>> {
    return this.requestUrl<T>(options.url, options);
  }

  private async requestUrl<T>(
    url: string,
    options: {
      method?: string;
      json?: unknown;
      form?: Record<string, string>;
    },
  ): Promise<AweberResponse<T>> {
    const accessToken = await this.ensureAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    let body: BodyInit | undefined;

    if (options.json !== undefined && options.form !== undefined) {
      throw new CliError("Cannot send both JSON and form payloads in the same request.", 2);
    }

    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options.form !== undefined) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.form);
    }

    const response = await this.fetchImpl(url, {
      method: options.method ?? "GET",
      headers,
      body,
    });

    if (!response.ok) {
      await throwAweberError(response);
    }

    return {
      data: await readResponseBody(response) as T,
      headers: response.headers,
      status: response.status,
    };
  }

  private buildUrl(
    path: string,
    version: AweberApiVersion,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const basePath = version === "beta" ? "https://api.aweber.com/2.0-beta" : "https://api.aweber.com/1.0";
    const url = new URL(`${basePath}${normalizedPath}`);

    if (query) {
      const params = toStringRecord(query);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private async ensureAccessToken(): Promise<string> {
    if (!isAccessTokenExpired(this.config.tokens)) {
      return this.config.tokens.accessToken!;
    }

    if (!this.config.tokens.refreshToken) {
      throw new CliError(
        "Missing AWeber access token. Run `aweber auth login` and `aweber auth exchange-code`, or set AWEBER_ACCESS_TOKEN.",
        2,
      );
    }

    if (!this.config.clientId) {
      throw new CliError("Refreshing an expired AWeber token requires a configured client ID.", 2);
    }

    const refreshed = await refreshAccessToken({ config: this.config }, this.fetchImpl);
    this.config = {
      ...this.config,
      tokens: refreshed,
    };

    if (this.persistTokens) {
      await this.persistTokens(refreshed);
    }

    if (!refreshed.accessToken) {
      throw new CliError("AWeber refresh completed without returning an access token.", 1);
    }

    return refreshed.accessToken;
  }
}
