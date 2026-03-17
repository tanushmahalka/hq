import { Client } from "pg";

import { getBooleanFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveDataForSeoConfig } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import { DataForSeoClient, type DataForSeoBacklinksSpamScoreClient } from "../../providers/dataforseo/client.ts";
import {
  syncBacklinkSpamScores,
  type SyncBacklinkSpamScoreReport,
} from "../../providers/dataforseo/backlink-spam-score-sync.ts";
import {
  PgCompetitorBacklinkSourcesRepository,
  type CompetitorBacklinkSourcesRepository,
} from "../../providers/postgres/competitor-backlink-sources.ts";

const DOMAIN_SPAM_SCORE_SYNC_DB_SCHEMA = {
  "--database-url": "string",
  "--batch-size": "string",
  "--from-id": "string",
  "--limit": "string",
  "--force": "boolean",
  "--dry-run": "boolean",
  "--json": "boolean",
  "--help": "boolean",
} as const;

const DEFAULT_DB_BATCH_SIZE = 5000;

interface RunDomainSpamScoreSyncDbDependencies {
  resolvedConfig?: ReturnType<typeof resolveDataForSeoConfig>;
  createClient?: (config: ReturnType<typeof resolveDataForSeoConfig>) => DataForSeoBacklinksSpamScoreClient;
  createRepository?: (databaseUrl: string) => Promise<{
    repository: CompetitorBacklinkSourcesRepository;
    close: () => Promise<void>;
  }>;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
}

export async function runDomainSpamScoreSyncDbCommand(
  argv: string[],
  dependencies: RunDomainSpamScoreSyncDbDependencies = {},
): Promise<void> {
  const parsed = parseArgs(argv, DOMAIN_SPAM_SCORE_SYNC_DB_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (getBooleanFlag(parsed, "--help")) {
    printDomainSpamScoreSyncDbHelp(printLineImpl);
    return;
  }

  const databaseUrl = getStringFlag(parsed, "--database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new CliError("`seo domain spam-score sync-db` requires `--database-url` or DATABASE_URL.", 2);
  }

  const batchSize = parsePositiveInteger(getStringFlag(parsed, "--batch-size") ?? `${DEFAULT_DB_BATCH_SIZE}`, "--batch-size");
  const fromId = parseCursor(getStringFlag(parsed, "--from-id") ?? "0", "--from-id");
  const limit = getStringFlag(parsed, "--limit")
    ? parsePositiveInteger(getStringFlag(parsed, "--limit") as string, "--limit")
    : undefined;
  const dryRun = getBooleanFlag(parsed, "--dry-run");
  const force = getBooleanFlag(parsed, "--force");
  const asJson = getBooleanFlag(parsed, "--json");

  const config = dependencies.resolvedConfig ?? resolveDataForSeoConfig(await readConfig());
  const spamScoreClient = dependencies.createClient?.(config) ?? new DataForSeoClient(config);
  const repositoryBundle =
    (await dependencies.createRepository?.(databaseUrl)) ?? (await createPgRepository(databaseUrl));

  try {
    const report = await syncBacklinkSpamScores(repositoryBundle.repository, spamScoreClient, {
      batchSize,
      fromId,
      limit,
      force,
      dryRun,
      onBatchCompleted: asJson
        ? undefined
        : (progress) => {
            printLineImpl(
              `Processed ${progress.rowsScanned} row(s); updated ${progress.rowsUpdated}; skipped ${progress.rowsSkipped}; api calls ${progress.apiCalls}; cost $${progress.totalCostUsd.toFixed(6)}; last id ${progress.lastProcessedId}`,
            );
          },
    });

    if (asJson) {
      printJsonImpl(report);
      return;
    }

    renderSyncDbReport(report, printLineImpl);
  } finally {
    await repositoryBundle.close();
  }
}

async function createPgRepository(databaseUrl: string): Promise<{
  repository: CompetitorBacklinkSourcesRepository;
  close: () => Promise<void>;
}> {
  const client = new Client({
    connectionString: databaseUrl,
  });
  await client.connect();

  return {
    repository: new PgCompetitorBacklinkSourcesRepository(client),
    close: async () => {
      await client.end();
    },
  };
}

function renderSyncDbReport(report: SyncBacklinkSpamScoreReport, printLineImpl: typeof printLine): void {
  printLineImpl("Backlink spam score sync complete");
  printLineImpl(`Rows scanned: ${report.summary.rowsScanned}`);
  printLineImpl(`Rows updated: ${report.summary.rowsUpdated}`);
  printLineImpl(`Rows skipped: ${report.summary.rowsSkipped}`);
  printLineImpl(`Unique domains resolved: ${report.summary.uniqueDomainsResolved}`);
  printLineImpl(`API calls: ${report.summary.apiCalls}`);
  printLineImpl(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);
  printLineImpl(`Last processed id: ${report.summary.lastProcessedId}`);
  printLineImpl(`Dry run: ${report.meta.options.dryRun ? "yes" : "no"}`);
}

function printDomainSpamScoreSyncDbHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo domain spam-score sync-db [--database-url <url>] [--batch-size <n>] [--from-id <id>] [--limit <n>] [--force] [--dry-run] [--json]");
  printLineImpl("");
  printLineImpl("Defaults:");
  printLineImpl("  table: competitor_backlink_sources");
  printLineImpl("  source column: source_url");
  printLineImpl("  target column: backlink_spam_score");
  printLineImpl("");
  printLineImpl("Options:");
  printLineImpl("  --database-url <url>  Postgres connection string; defaults to DATABASE_URL");
  printLineImpl("  --batch-size <n>      Number of DB rows to process per fetch (default: 5000)");
  printLineImpl("  --from-id <id>        Resume from rows with id greater than this cursor");
  printLineImpl("  --limit <n>           Process at most this many rows");
  printLineImpl("  --force               Recompute rows even if backlink_spam_score is already set");
  printLineImpl("  --dry-run             Fetch and score rows without writing updates");
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`\`${flag}\` must be a positive integer.`, 2);
  }

  return parsed;
}

function parseCursor(value: string, flag: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new CliError(`\`${flag}\` must be an integer cursor value.`, 2);
  }

  return normalized;
}
