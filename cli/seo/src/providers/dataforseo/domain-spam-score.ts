import { CliError } from "../../core/errors.ts";
import type {
  DataForSeoBacklinksBulkSpamScoreItem,
  DataForSeoBacklinksBulkSpamScoreResult,
  DataForSeoBacklinksSpamScoreClient,
  DataForSeoTask,
} from "./client.ts";
import { normalizeDomainTargets } from "../../commands/domain/input.ts";
import { DATAFORSEO_BULK_TARGET_LIMIT } from "./domain-rating.ts";

export interface DomainSpamScoreOptions {
  domain: string;
}

export interface BulkDomainSpamScoreOptions {
  domains: string[];
}

export interface DomainSpamScoreReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      bulkSpamScore: string;
    };
    options: {
      domain: string;
    };
  };
  summary: {
    domain: string;
    spamScore: number;
    totalCostUsd: number;
  };
  result: {
    target: string;
    spamScore: number;
  };
  tasks: {
    bulkSpamScore: DataForSeoTask<DataForSeoBacklinksBulkSpamScoreResult>;
  };
}

export interface BulkDomainSpamScoreReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      bulkSpamScore: string;
    };
    options: {
      domainsRequested: number;
      batchSize: number;
    };
  };
  summary: {
    domainsRequested: number;
    domainsSucceeded: number;
    domainsFailed: number;
    totalCostUsd: number;
  };
  results: Array<{
    domain: string;
    target: string;
    spamScore: number;
  }>;
  tasks: {
    bulkSpamScore: Array<DataForSeoTask<DataForSeoBacklinksBulkSpamScoreResult>>;
  };
}

export async function runDomainSpamScore(
  client: DataForSeoBacklinksSpamScoreClient,
  options: DomainSpamScoreOptions,
): Promise<DomainSpamScoreReport> {
  const bulkReport = await runBulkDomainSpamScore(client, {
    domains: [options.domain],
  });
  const result = bulkReport.results[0];
  const task = bulkReport.tasks.bulkSpamScore[0];

  if (!result || !task) {
    throw new CliError(`DataForSEO returned no spam score for domain: ${options.domain}`);
  }

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: bulkReport.meta.generatedAt,
      docs: {
        bulkSpamScore: bulkReport.meta.docs.bulkSpamScore,
      },
      options: {
        domain: result.domain,
      },
    },
    summary: {
      domain: result.domain,
      spamScore: result.spamScore,
      totalCostUsd: bulkReport.summary.totalCostUsd,
    },
    result: {
      target: result.target,
      spamScore: result.spamScore,
    },
    tasks: {
      bulkSpamScore: task,
    },
  };
}

export async function runBulkDomainSpamScore(
  client: DataForSeoBacklinksSpamScoreClient,
  options: BulkDomainSpamScoreOptions,
): Promise<BulkDomainSpamScoreReport> {
  const domains = normalizeDomainTargets(options.domains);
  if (domains.length === 0) {
    throw new CliError("At least one domain is required.", 2);
  }

  const tasks: Array<DataForSeoTask<DataForSeoBacklinksBulkSpamScoreResult>> = [];

  for (const chunk of chunkStrings(domains, DATAFORSEO_BULK_TARGET_LIMIT)) {
    tasks.push(
      await client.backlinksBulkSpamScore({
        targets: chunk,
      }),
    );
  }

  const itemsByTarget = new Map<string, DataForSeoBacklinksBulkSpamScoreItem>();
  for (const task of tasks) {
    const items = task.result?.flatMap((entry) => entry.items ?? []) ?? [];
    for (const item of items) {
      itemsByTarget.set(normalizeTarget(item.target), item);
    }
  }

  const results = domains.map((domain) => {
    const item = itemsByTarget.get(domain);
    if (!item) {
      throw new CliError(`DataForSEO returned no spam score for domain: ${domain}`);
    }

    return {
      domain,
      target: item.target,
      spamScore: item.spam_score,
    };
  });

  const totalCostUsd = Number(tasks.reduce((sum, task) => sum + (task.cost ?? 0), 0).toFixed(6));

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        bulkSpamScore: "https://docs.dataforseo.com/v3/backlinks-bulk_spam_score-live/",
      },
      options: {
        domainsRequested: domains.length,
        batchSize: DATAFORSEO_BULK_TARGET_LIMIT,
      },
    },
    summary: {
      domainsRequested: domains.length,
      domainsSucceeded: results.length,
      domainsFailed: domains.length - results.length,
      totalCostUsd,
    },
    results,
    tasks: {
      bulkSpamScore: tasks,
    },
  };
}

function normalizeTarget(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function chunkStrings(values: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
