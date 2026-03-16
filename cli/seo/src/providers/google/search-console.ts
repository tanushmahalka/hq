import { CliError } from "../../core/errors.ts";
import type { GoogleOAuthTokenSet, ResolvedGoogleOAuthProviderConfig } from "../../types/config.ts";
import {
  isGoogleAccessTokenExpired,
  refreshGoogleAccessToken,
} from "./oauth.ts";

export type SearchConsoleSearchType = "web" | "image" | "video" | "news" | "googleNews" | "discover";
export type SearchConsoleDataState = "final" | "all";

export interface SearchConsoleQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ListAllQueryKeywordsOptions {
  siteUrl: string;
  startDate: string;
  endDate: string;
  type?: SearchConsoleSearchType;
  dataState?: SearchConsoleDataState;
  pageSize?: number;
}

export interface ListAllQueryKeywordsResult {
  siteUrl: string;
  startDate: string;
  endDate: string;
  type: SearchConsoleSearchType;
  dataState: SearchConsoleDataState;
  totalRows: number;
  pageCount: number;
  rows: SearchConsoleQueryRow[];
}

interface SearchAnalyticsApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchAnalyticsApiResponse {
  rows?: SearchAnalyticsApiRow[];
}

interface SearchConsoleClientOptions {
  config: ResolvedGoogleOAuthProviderConfig;
  fetchImpl?: typeof fetch;
  persistTokens?: (tokens: GoogleOAuthTokenSet) => Promise<void>;
}

export class GoogleSearchConsoleClient {
  private readonly config: ResolvedGoogleOAuthProviderConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly persistTokens?: (tokens: GoogleOAuthTokenSet) => Promise<void>;
  private activeTokens?: GoogleOAuthTokenSet;

  constructor(options: SearchConsoleClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.persistTokens = options.persistTokens;
    this.activeTokens = options.config.tokens;
  }

  async listAllQueryKeywords(options: ListAllQueryKeywordsOptions): Promise<ListAllQueryKeywordsResult> {
    validateDate(options.startDate, "--from");
    validateDate(options.endDate, "--to");

    const type = options.type ?? "web";
    const dataState = options.dataState ?? "final";
    const pageSize = options.pageSize ?? 25_000;
    let startRow = 0;
    let pageCount = 0;
    const rows: SearchConsoleQueryRow[] = [];

    while (true) {
      const page = await this.runQuery({
        siteUrl: options.siteUrl,
        startDate: options.startDate,
        endDate: options.endDate,
        type,
        dataState,
        rowLimit: pageSize,
        startRow,
      });
      const pageRows = page.rows ?? [];

      for (const row of pageRows) {
        const query = row.keys?.[0];
        if (!query) {
          continue;
        }

        rows.push({
          query,
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
        });
      }

      pageCount += 1;

      if (pageRows.length < pageSize) {
        break;
      }

      startRow += pageSize;
    }

    return {
      siteUrl: options.siteUrl,
      startDate: options.startDate,
      endDate: options.endDate,
      type,
      dataState,
      totalRows: rows.length,
      pageCount,
      rows,
    };
  }

  private async runQuery(input: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    type: SearchConsoleSearchType;
    dataState: SearchConsoleDataState;
    rowLimit: number;
    startRow: number;
  }): Promise<SearchAnalyticsApiResponse> {
    const accessToken = await this.getAccessToken();
    const requestUrl = buildQueryUrl(input.siteUrl);
    const body = {
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: ["query"],
      type: input.type,
      dataState: input.dataState,
      rowLimit: input.rowLimit,
      startRow: input.startRow,
    };

    const execute = async (token: string) =>
      this.fetchImpl(requestUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

    let response = await execute(accessToken);

    if (response.status === 401 && this.activeTokens?.refreshToken) {
      const refreshed = await this.refreshTokens();
      response = await execute(refreshed.accessToken);
    }

    if (!response.ok) {
      const payload = await safeParseJson(response);
      const message =
        typeof payload?.error?.message === "string"
          ? payload.error.message
          : `Search Console request failed with HTTP ${response.status}`;
      throw new CliError(message, 2);
    }

    return (await response.json()) as SearchAnalyticsApiResponse;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.activeTokens?.accessToken) {
      throw new CliError(
        "Missing Google access token. Run `seo providers auth google` and `seo providers exchange-code google` first.",
        2,
      );
    }

    if (isGoogleAccessTokenExpired(this.activeTokens)) {
      if (!this.activeTokens.refreshToken) {
        throw new CliError(
          "Stored Google access token is expired and no refresh token is available. Re-authenticate with `seo providers auth google --prompt consent`.",
          2,
        );
      }

      const refreshed = await this.refreshTokens();
      return refreshed.accessToken;
    }

    return this.activeTokens.accessToken;
  }

  private async refreshTokens(): Promise<GoogleOAuthTokenSet> {
    const refreshed = await refreshGoogleAccessToken(
      {
        config: {
          ...this.config,
          tokens: this.activeTokens ?? this.config.tokens,
        },
      },
      this.fetchImpl,
    );

    this.activeTokens = refreshed;
    if (this.persistTokens) {
      await this.persistTokens(refreshed);
    }

    return refreshed;
  }
}

function buildQueryUrl(siteUrl: string): string {
  return `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

function validateDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new CliError(`${label} must be a valid date in YYYY-MM-DD format.`, 2);
  }
}

async function safeParseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
