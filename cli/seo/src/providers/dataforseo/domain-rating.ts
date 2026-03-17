import { CliError } from "../../core/errors.ts";
import type {
  DataForSeoBacklinksBulkRankItem,
  DataForSeoBacklinksBulkRankResult,
  DataForSeoBacklinksClient,
  DataForSeoBacklinksRankScale,
  DataForSeoTask,
} from "./client.ts";
import { normalizeDomainTargets } from "../../commands/domain/input.ts";

export const DATAFORSEO_BULK_TARGET_LIMIT = 1000;

export interface DomainRatingOptions {
  domain: string;
  rankScale: DataForSeoBacklinksRankScale;
}

export interface BulkDomainRatingOptions {
  domains: string[];
  rankScale: DataForSeoBacklinksRankScale;
}

export interface DomainRatingReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      bulkRanks: string;
    };
    options: {
      domain: string;
      rankScale: DataForSeoBacklinksRankScale;
    };
  };
  summary: {
    domain: string;
    rating: number;
    rankScale: DataForSeoBacklinksRankScale;
    totalCostUsd: number;
  };
  result: {
    target: string;
    rating: number;
  };
  tasks: {
    bulkRanks: DataForSeoTask<DataForSeoBacklinksBulkRankResult>;
  };
}

export interface BulkDomainRatingReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      bulkRanks: string;
    };
    options: {
      domainsRequested: number;
      rankScale: DataForSeoBacklinksRankScale;
      batchSize: number;
    };
  };
  summary: {
    domainsRequested: number;
    domainsSucceeded: number;
    domainsFailed: number;
    rankScale: DataForSeoBacklinksRankScale;
    totalCostUsd: number;
  };
  results: Array<{
    domain: string;
    target: string;
    rating: number;
  }>;
  tasks: {
    bulkRanks: Array<DataForSeoTask<DataForSeoBacklinksBulkRankResult>>;
  };
}

export async function runDomainRating(
  client: DataForSeoBacklinksClient,
  options: DomainRatingOptions,
): Promise<DomainRatingReport> {
  const bulkReport = await runBulkDomainRating(client, {
    domains: [options.domain],
    rankScale: options.rankScale,
  });
  const result = bulkReport.results[0];
  const task = bulkReport.tasks.bulkRanks[0];

  if (!result || !task) {
    throw new CliError(`DataForSEO returned no rank for domain: ${options.domain}`);
  }

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: bulkReport.meta.generatedAt,
      docs: {
        bulkRanks: bulkReport.meta.docs.bulkRanks,
      },
      options: {
        domain: result.domain,
        rankScale: options.rankScale,
      },
    },
    summary: {
      domain: result.domain,
      rating: result.rating,
      rankScale: options.rankScale,
      totalCostUsd: bulkReport.summary.totalCostUsd,
    },
    result: {
      target: result.target,
      rating: result.rating,
    },
    tasks: {
      bulkRanks: task,
    },
  };
}

export async function runBulkDomainRating(
  client: DataForSeoBacklinksClient,
  options: BulkDomainRatingOptions,
): Promise<BulkDomainRatingReport> {
  const domains = normalizeDomainTargets(options.domains);
  if (domains.length === 0) {
    throw new CliError("At least one domain is required.", 2);
  }

  const tasks: Array<DataForSeoTask<DataForSeoBacklinksBulkRankResult>> = [];

  for (const chunk of chunkStrings(domains, DATAFORSEO_BULK_TARGET_LIMIT)) {
    tasks.push(
      await client.backlinksBulkRanks({
        targets: chunk,
        rankScale: options.rankScale,
      }),
    );
  }

  const itemsByTarget = new Map<string, DataForSeoBacklinksBulkRankItem>();
  for (const task of tasks) {
    const items = task.result?.flatMap((entry) => entry.items ?? []) ?? [];
    for (const item of items) {
      itemsByTarget.set(normalizeRankTarget(item.target), item);
    }
  }

  const results = domains.map((domain) => {
    const item = itemsByTarget.get(domain);

    if (!item) {
      throw new CliError(`DataForSEO returned no rank for domain: ${domain}`);
    }

    return {
      domain,
      target: item.target,
      rating: item.rank,
    };
  });

  const totalCostUsd = Number(tasks.reduce((sum, task) => sum + (task.cost ?? 0), 0).toFixed(6));

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        bulkRanks: "https://docs.dataforseo.com/v3/backlinks-bulk_ranks-live/",
      },
      options: {
        domainsRequested: domains.length,
        rankScale: options.rankScale,
        batchSize: DATAFORSEO_BULK_TARGET_LIMIT,
      },
    },
    summary: {
      domainsRequested: domains.length,
      domainsSucceeded: results.length,
      domainsFailed: domains.length - results.length,
      rankScale: options.rankScale,
      totalCostUsd,
    },
    results,
    tasks: {
      bulkRanks: tasks,
    },
  };
}

function normalizeRankTarget(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function chunkStrings(values: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
