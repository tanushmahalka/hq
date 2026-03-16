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

export interface DataForSeoAuditClient {
  auditInstantPage(url: string, options: AuditRequestOptions): Promise<DataForSeoTask<DataForSeoInstantPageResult>>;
}

export class DataForSeoClient implements DataForSeoAuditClient {
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

    return task;
  }
}
