import { CliError } from "../../core/errors.ts";
import type { CompetitorBacklinkSourcesRepository } from "../postgres/competitor-backlink-sources.ts";
import type { DataForSeoBacklinksSpamScoreClient } from "./client.ts";
import { runBulkDomainSpamScore } from "./domain-spam-score.ts";
import { normalizeDomainInput } from "./geo.ts";

export interface SyncBacklinkSpamScoreOptions {
  batchSize: number;
  fromId: string;
  limit?: number;
  force: boolean;
  dryRun: boolean;
  onBatchCompleted?: (progress: SyncBacklinkSpamScoreProgress) => void;
}

export interface SyncBacklinkSpamScoreProgress {
  lastProcessedId: string;
  rowsScanned: number;
  rowsUpdated: number;
  rowsSkipped: number;
  apiCalls: number;
  uniqueDomainsResolved: number;
  totalCostUsd: number;
}

export interface SyncBacklinkSpamScoreReport {
  meta: {
    provider: "dataforseo";
    generatedAt: string;
    docs: {
      bulkSpamScore: string;
    };
    options: {
      batchSize: number;
      fromId: string;
      limit: number | null;
      force: boolean;
      dryRun: boolean;
    };
  };
  summary: {
    rowsScanned: number;
    rowsUpdated: number;
    rowsSkipped: number;
    apiCalls: number;
    uniqueDomainsResolved: number;
    totalCostUsd: number;
    lastProcessedId: string;
    completed: boolean;
  };
}

export async function syncBacklinkSpamScores(
  repository: CompetitorBacklinkSourcesRepository,
  spamScoreClient: DataForSeoBacklinksSpamScoreClient,
  options: SyncBacklinkSpamScoreOptions,
): Promise<SyncBacklinkSpamScoreReport> {
  let lastProcessedId = options.fromId;
  let rowsScanned = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let apiCalls = 0;
  let uniqueDomainsResolved = 0;
  let totalCostUsd = 0;
  const spamScoreCache = new Map<string, number>();

  while (true) {
    const remaining = options.limit === undefined ? options.batchSize : options.limit - rowsScanned;
    if (remaining <= 0) {
      break;
    }

    const rows = await repository.fetchBatch({
      afterId: lastProcessedId,
      limit: Math.min(options.batchSize, remaining),
      force: options.force,
    });

    if (rows.length === 0) {
      break;
    }

    lastProcessedId = rows[rows.length - 1]?.id ?? lastProcessedId;
    rowsScanned += rows.length;

    const normalizedRows: Array<{ id: string; domain: string }> = [];
    const uncachedDomains = new Set<string>();

    for (const row of rows) {
      try {
        const domain = normalizeDomainInput(row.sourceUrl);
        normalizedRows.push({ id: row.id, domain });
        if (!spamScoreCache.has(domain)) {
          uncachedDomains.add(domain);
        }
      } catch {
        rowsSkipped += 1;
      }
    }

    if (uncachedDomains.size > 0) {
      const report = await runBulkDomainSpamScore(spamScoreClient, {
        domains: [...uncachedDomains],
      });

      apiCalls += report.tasks.bulkSpamScore.length;
      uniqueDomainsResolved += report.results.length;
      totalCostUsd += report.summary.totalCostUsd;

      for (const result of report.results) {
        spamScoreCache.set(result.domain, result.spamScore);
      }
    }

    const updates = normalizedRows.flatMap((row) => {
      const spamScore = spamScoreCache.get(row.domain);
      if (spamScore === undefined) {
        throw new CliError(`Missing spam score in cache for domain: ${row.domain}`);
      }

      return [{ id: row.id, spamScore }];
    });

    if (options.dryRun) {
      rowsUpdated += updates.length;
    } else {
      const updatedCount = await repository.updateSpamScores(updates);
      if (updatedCount !== updates.length) {
        throw new CliError(`Expected to update ${updates.length} row(s), but updated ${updatedCount}.`);
      }

      rowsUpdated += updatedCount;
    }

    options.onBatchCompleted?.({
      lastProcessedId,
      rowsScanned,
      rowsUpdated,
      rowsSkipped,
      apiCalls,
      uniqueDomainsResolved,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
    });
  }

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        bulkSpamScore: "https://docs.dataforseo.com/v3/backlinks-bulk_spam_score-live/",
      },
      options: {
        batchSize: options.batchSize,
        fromId: options.fromId,
        limit: options.limit ?? null,
        force: options.force,
        dryRun: options.dryRun,
      },
    },
    summary: {
      rowsScanned,
      rowsUpdated,
      rowsSkipped,
      apiCalls,
      uniqueDomainsResolved,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      lastProcessedId,
      completed: true,
    },
  };
}
