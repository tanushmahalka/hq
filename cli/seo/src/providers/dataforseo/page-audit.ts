import { CliError } from "../../core/errors.ts";
import type {
  AuditRequestOptions,
  DataForSeoAuditClient,
  DataForSeoTask,
} from "./client.ts";

export interface PageAuditOptions extends AuditRequestOptions {
  pages: string[];
}

export interface PageAuditReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      instantPages: string;
    };
    options: {
      device: PageAuditOptions["device"];
      acceptLanguage: string | null;
    };
  };
  summary: {
    pagesRequested: number;
    pagesSucceeded: number;
    pagesFailed: number;
    totalCostUsd: number;
  };
  pages: Array<{
    url: string;
    success: boolean;
    errors: string[];
    totalCostUsd: number;
    tasks: {
      instant: DataForSeoTask<Record<string, unknown>>;
    };
  }>;
}

export async function runPageAudit(
  client: DataForSeoAuditClient,
  options: PageAuditOptions,
): Promise<PageAuditReport> {
  const pages = options.pages.map(normalizePageUrl);
  if (pages.length === 0) {
    throw new CliError("At least one `--page` value is required.", 2);
  }

  const pageReports = [];

  for (const url of pages) {
    const instant = await client.auditInstantPage(url, options);
    const errors = [instant]
      .filter(Boolean)
      .filter((task) => (task as DataForSeoTask<Record<string, unknown>>).status_code !== 20000)
      .map((task) => `${(task as DataForSeoTask<Record<string, unknown>>).path.join("/")} failed: ${(task as DataForSeoTask<Record<string, unknown>>).status_message}`);

    pageReports.push({
      url,
      success: errors.length === 0,
      errors,
      totalCostUsd: instant.cost ?? 0,
      tasks: {
        instant: instant as DataForSeoTask<Record<string, unknown>>,
      },
    });
  }

  const pagesSucceeded = pageReports.filter((page) => page.success).length;
  const totalCostUsd = pageReports.reduce((sum, page) => sum + page.totalCostUsd, 0);

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        instantPages: "https://docs.dataforseo.com/v3/on_page/instant_pages/",
      },
      options: {
        device: options.device,
        acceptLanguage: options.acceptLanguage ?? null,
      },
    },
    summary: {
      pagesRequested: pageReports.length,
      pagesSucceeded,
      pagesFailed: pageReports.length - pagesSucceeded,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
    },
    pages: pageReports,
  };
}

function normalizePageUrl(input: string): string {
  try {
    return new URL(input).toString();
  } catch {
    throw new CliError(`Invalid page URL: ${input}`, 2);
  }
}
