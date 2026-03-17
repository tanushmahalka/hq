import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveDataForSeoConfig } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import { DataForSeoClient, type DataForSeoBacklinksSpamScoreClient } from "../../providers/dataforseo/client.ts";
import { runBulkDomainSpamScore } from "../../providers/dataforseo/domain-spam-score.ts";
import type { CompetitorBacklinkSourcesRepository } from "../../providers/postgres/competitor-backlink-sources.ts";
import { loadDomainTargets } from "./input.ts";
import { runDomainSpamScoreSyncDbCommand } from "./spam-score-sync-db.ts";

const DOMAIN_SPAM_SCORE_SCHEMA = {
  "--domain": "string[]",
  "--file": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

interface RunDomainSpamScoreCommandDependencies {
  resolvedConfig?: ReturnType<typeof resolveDataForSeoConfig>;
  createClient?: (config: ReturnType<typeof resolveDataForSeoConfig>) => DataForSeoBacklinksSpamScoreClient;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
  readFileImpl?: (path: string, encoding: "utf8") => Promise<string>;
  readStdinImpl?: () => Promise<string>;
  createRepository?: (databaseUrl: string) => Promise<{
    repository: CompetitorBacklinkSourcesRepository;
    close: () => Promise<void>;
  }>;
}

export async function runDomainSpamScoreCommand(
  argv: string[],
  dependencies: RunDomainSpamScoreCommandDependencies = {},
): Promise<void> {
  if (argv[0] === "sync-db") {
    await runDomainSpamScoreSyncDbCommand(argv.slice(1), dependencies);
    return;
  }

  const parsed = parseArgs(argv, DOMAIN_SPAM_SCORE_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (getBooleanFlag(parsed, "--help")) {
    printDomainSpamScoreHelp(printLineImpl);
    return;
  }

  const domains = await loadDomainTargets({
    domains: getStringArrayFlag(parsed, "--domain"),
    file: getStringFlag(parsed, "--file"),
    readFileImpl: dependencies.readFileImpl,
    readStdinImpl: dependencies.readStdinImpl,
  });

  const config = dependencies.resolvedConfig ?? resolveDataForSeoConfig(await readConfig());
  const client = dependencies.createClient?.(config) ?? new DataForSeoClient(config);
  const report = await runBulkDomainSpamScore(client, {
    domains,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl(report);
    return;
  }

  if (report.results.length === 1) {
    const result = report.results[0];
    if (!result) {
      throw new CliError("Expected one domain spam score result.", 1);
    }

    printLineImpl(`Domain spam score for ${result.domain}`);
    printLineImpl(`Spam score: ${result.spamScore}`);
    printLineImpl(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);
    return;
  }

  printLineImpl(`Domain spam scores for ${report.summary.domainsRequested} target(s)`);
  printLineImpl(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);
  printLineImpl("");
  printLineImpl("domain\tspam_score");

  for (const result of report.results) {
    printLineImpl(`${result.domain}\t${result.spamScore}`);
  }
}

function printDomainSpamScoreHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo domain spam-score (--domain <domain> | --file <path|->) [--json]");
  printLineImpl("  seo domain spam-score sync-db [--database-url <url>] [--batch-size <n>] [--from-id <id>] [--limit <n>] [--force] [--dry-run] [--json]");
  printLineImpl("");
  printLineImpl("Options:");
  printLineImpl("  --domain <domain>   Domain to score with DataForSEO bulk spam score; repeat for multiple domains");
  printLineImpl("  --file <path|->     Text or JSON file with domains; use `-` to read from stdin");
}
