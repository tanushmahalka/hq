import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveDataForSeoConfig } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import {
  DataForSeoClient,
  type DataForSeoBacklinksClient,
  type DataForSeoBacklinksRankScale,
} from "../../providers/dataforseo/client.ts";
import { runBulkDomainRating } from "../../providers/dataforseo/domain-rating.ts";
import { loadDomainTargets } from "./input.ts";

const DOMAIN_RATING_SCHEMA = {
  "--domain": "string[]",
  "--file": "string",
  "--scale": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

interface RunDomainRatingCommandDependencies {
  resolvedConfig?: ReturnType<typeof resolveDataForSeoConfig>;
  createClient?: (config: ReturnType<typeof resolveDataForSeoConfig>) => DataForSeoBacklinksClient;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
  readFileImpl?: (path: string, encoding: "utf8") => Promise<string>;
  readStdinImpl?: () => Promise<string>;
}

export async function runDomainRatingCommand(
  argv: string[],
  dependencies: RunDomainRatingCommandDependencies = {},
): Promise<void> {
  const parsed = parseArgs(argv, DOMAIN_RATING_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (getBooleanFlag(parsed, "--help")) {
    printDomainRatingHelp(printLineImpl);
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
  const rankScale = parseRankScale(getStringFlag(parsed, "--scale"));
  const report = await runBulkDomainRating(client, {
    domains,
    rankScale,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl(report);
    return;
  }

  if (report.results.length === 1) {
    const result = report.results[0];
    if (!result) {
      throw new CliError("Expected one domain rating result.", 1);
    }

    printLineImpl(`Domain rating for ${result.domain}`);
    printLineImpl(`Rating: ${result.rating}`);
    printLineImpl(`Scale: ${formatRankScale(report.summary.rankScale)}`);
    printLineImpl(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);
    return;
  }

  printLineImpl(`Domain ratings for ${report.summary.domainsRequested} target(s)`);
  printLineImpl(`Scale: ${formatRankScale(report.summary.rankScale)}`);
  printLineImpl(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);
  printLineImpl("");
  printLineImpl("domain\trating");

  for (const result of report.results) {
    printLineImpl(`${result.domain}\t${result.rating}`);
  }
}

function printDomainRatingHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo domain rating (--domain <domain> | --file <path|->) [--scale <100|1000>] [--json]");
  printLineImpl("");
  printLineImpl("Options:");
  printLineImpl("  --domain <domain>   Domain to score with DataForSEO Backlinks rank; repeat for multiple domains");
  printLineImpl("  --file <path|->     Text or JSON file with domains; use `-` to read from stdin");
  printLineImpl("  --scale <100|1000>  Return rank on a 0-100 or 0-1000 scale (default: 1000)");
}

function parseRankScale(value: string | undefined): DataForSeoBacklinksRankScale {
  if (!value || value === "1000") {
    return "one_thousand";
  }

  if (value === "100") {
    return "one_hundred";
  }

  throw new CliError("`--scale` must be `100` or `1000`.", 2);
}

function formatRankScale(value: DataForSeoBacklinksRankScale): string {
  return value === "one_hundred" ? "0-100" : "0-1000";
}
