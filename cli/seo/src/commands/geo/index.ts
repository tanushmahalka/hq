import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveDataForSeoConfig } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import { DataForSeoClient, type DataForSeoGeoClient } from "../../providers/dataforseo/client.ts";
import {
  DEFAULT_GEO_LANGUAGE_CODE,
  DEFAULT_GEO_LIMIT,
  DEFAULT_GEO_LOCATION_CODE,
  normalizeDomainInput,
  normalizeKeywords,
  resolveMentionsPlatforms,
  resolvePromptAuditEngines,
  runBrandVisibility,
  runCitationReport,
  runCompetitorGap,
  runPromptAudit,
  runSourceGap,
  runTopicSizing,
  type BrandVisibilityReport,
  type CitationReport,
  type CompetitorGapReport,
  type PromptAuditReport,
  type SourceGapReport,
  type TopicSizingReport,
} from "../../providers/dataforseo/geo.ts";

const GEO_SCHEMA = {
  "--domain": "string",
  "--vs": "string[]",
  "--platform": "string[]",
  "--location-code": "string",
  "--language-code": "string",
  "--limit": "string",
  "--keyword": "string[]",
  "--prompt": "string",
  "--brand": "string",
  "--engine": "string[]",
  "--system-message": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

interface RunGeoCommandDependencies {
  resolvedConfig?: ReturnType<typeof resolveDataForSeoConfig>;
  createClient?: (config: ReturnType<typeof resolveDataForSeoConfig>) => DataForSeoGeoClient;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
}

export async function runGeoCommand(
  argv: string[],
  dependencies: RunGeoCommandDependencies = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, GEO_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (!action || action === "--help" || action === "help" || getBooleanFlag(parsed, "--help")) {
    printGeoHelp(printLineImpl);
    return;
  }

  if (action === "brand-visibility") {
    const workflowOptions = {
      domain: requireDomain(parsed, "brand-visibility"),
      ...resolveMentionOptions(parsed),
    };
    const client = await resolveClient(dependencies);
    const report = await runBrandVisibility(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderBrandVisibility);
  }

  if (action === "competitor-gap") {
    const workflowOptions = {
      primaryDomain: requireDomain(parsed, "competitor-gap"),
      competitors: getStringArrayFlag(parsed, "--vs"),
      ...resolveMentionOptions(parsed),
    };
    const client = await resolveClient(dependencies);
    const report = await runCompetitorGap(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderCompetitorGap);
  }

  if (action === "prompt-audit") {
    const prompt = getStringFlag(parsed, "--prompt");
    if (!prompt) {
      throw new CliError("`seo geo prompt-audit` requires `--prompt`.", 2);
    }

    const workflowOptions = {
      prompt,
      domain: requireDomain(parsed, "prompt-audit"),
      brand: getStringFlag(parsed, "--brand"),
      engines: resolvePromptAuditEngines(getStringArrayFlag(parsed, "--engine")),
      systemMessage: getStringFlag(parsed, "--system-message"),
    };
    const client = await resolveClient(dependencies);
    const report = await runPromptAudit(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderPromptAudit);
  }

  if (action === "source-gap") {
    const keywords = normalizeKeywords(getStringArrayFlag(parsed, "--keyword"));
    if (keywords.length === 0) {
      throw new CliError("`seo geo source-gap` requires at least one `--keyword`.", 2);
    }

    const workflowOptions = {
      domain: requireDomain(parsed, "source-gap"),
      keywords,
      ...resolveMentionOptions(parsed),
    };
    const client = await resolveClient(dependencies);
    const report = await runSourceGap(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderSourceGap);
  }

  if (action === "topic-sizing") {
    const keywords = normalizeKeywords(getStringArrayFlag(parsed, "--keyword"));
    if (keywords.length === 0) {
      throw new CliError("`seo geo topic-sizing` requires at least one `--keyword`.", 2);
    }

    const workflowOptions = {
      domain: requireDomain(parsed, "topic-sizing"),
      keywords,
      ...resolveMentionOptions(parsed),
    };
    const client = await resolveClient(dependencies);
    const report = await runTopicSizing(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderTopicSizing);
  }

  if (action === "citation-report") {
    const workflowOptions = {
      domain: requireDomain(parsed, "citation-report"),
      ...resolveMentionOptions(parsed),
    };
    const client = await resolveClient(dependencies);
    const report = await runCitationReport(client, workflowOptions);
    return emitReport(report, printJsonImpl, printLineImpl, getBooleanFlag(parsed, "--json"), renderCitationReport);
  }

  throw new CliError(`Unknown geo action: ${action}`, 2);
}

async function resolveClient(dependencies: RunGeoCommandDependencies): Promise<DataForSeoGeoClient> {
  const config = dependencies.resolvedConfig ?? resolveDataForSeoConfig(await readConfig());
  return dependencies.createClient?.(config) ?? new DataForSeoClient(config);
}

function printGeoHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo geo brand-visibility --domain <domain> [--platform <google|chat_gpt> ...] [--location-code <n>] [--language-code <code>] [--limit <n>] [--json]");
  printLineImpl("  seo geo competitor-gap --domain <domain> --vs <domain> [--vs <domain> ...] [--platform <google|chat_gpt> ...] [--location-code <n>] [--language-code <code>] [--limit <n>] [--json]");
  printLineImpl("  seo geo prompt-audit --prompt <text> --domain <domain> [--brand <name>] [--engine <chatgpt|claude|gemini|perplexity> ...] [--system-message <text>] [--json]");
  printLineImpl("  seo geo source-gap --domain <domain> --keyword <keyword> [--keyword <keyword> ...] [--platform <google|chat_gpt> ...] [--location-code <n>] [--language-code <code>] [--limit <n>] [--json]");
  printLineImpl("  seo geo topic-sizing --domain <domain> --keyword <keyword> [--keyword <keyword> ...] [--platform <google|chat_gpt> ...] [--location-code <n>] [--language-code <code>] [--limit <n>] [--json]");
  printLineImpl("  seo geo citation-report --domain <domain> [--platform <google|chat_gpt> ...] [--location-code <n>] [--language-code <code>] [--limit <n>] [--json]");
}

function requireDomain(parsed: ReturnType<typeof parseArgs>, action: string): string {
  const domain = getStringFlag(parsed, "--domain");
  if (!domain) {
    throw new CliError(`\`seo geo ${action}\` requires \`--domain\`.`, 2);
  }

  return normalizeDomainInput(domain);
}

function resolveMentionOptions(parsed: ReturnType<typeof parseArgs>): {
  locationCode: number;
  languageCode: string;
  platforms: Array<"google" | "chat_gpt">;
  limit: number;
} {
  const locationCode = parsePositiveInteger(getStringFlag(parsed, "--location-code") ?? `${DEFAULT_GEO_LOCATION_CODE}`, "--location-code");
  const languageCode = (getStringFlag(parsed, "--language-code") ?? DEFAULT_GEO_LANGUAGE_CODE).trim().toLowerCase();
  const limit = parsePositiveInteger(getStringFlag(parsed, "--limit") ?? `${DEFAULT_GEO_LIMIT}`, "--limit");

  if (limit < 1 || limit > 100) {
    throw new CliError("`--limit` must be between 1 and 100.", 2);
  }

  return {
    locationCode,
    languageCode,
    platforms: resolveMentionsPlatforms(getStringArrayFlag(parsed, "--platform"), locationCode, languageCode),
    limit,
  };
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`\`${flag}\` must be a positive integer.`, 2);
  }

  return parsed;
}

function emitReport<T>(
  report: T,
  printJsonImpl: typeof printJson,
  printLineImpl: typeof printLine,
  asJson: boolean,
  renderer: (report: T, printLineImpl: typeof printLine) => void,
): void {
  if (asJson) {
    printJsonImpl(report);
    return;
  }

  renderer(report, printLineImpl);
}

function renderBrandVisibility(report: BrandVisibilityReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Brand visibility for ${report.summary.domain}`);
  printLineImpl(`Mentions: ${report.summary.totalMentions}`);
  printLineImpl(`Citations: ${report.summary.totalCitations}`);
  printLineImpl(`Unique source domains: ${report.summary.uniqueSourceDomains}`);
  renderErrors(report.summary.errors, printLineImpl);

  if (report.platformBreakdown.length > 0) {
    printLineImpl("");
    printLineImpl("platform\tmentions\tcitations");
    for (const row of report.platformBreakdown) {
      printLineImpl(`${row.platform}\t${row.mentionCount}\t${row.citationCount}`);
    }
  }

  renderTopDomains(report.topSourceDomains, printLineImpl);
  renderTopPages(report.topPages, printLineImpl);
}

function renderCompetitorGap(report: CompetitorGapReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Competitor gap for ${report.summary.primaryDomain}`);
  printLineImpl(`Mentions across set: ${report.summary.totalMentions}`);
  renderErrors(report.summary.errors, printLineImpl);

  printLineImpl("");
  printLineImpl("domain\tmentions\tshare_of_voice");
  for (const row of report.ranking) {
    printLineImpl(`${row.domain}\t${row.mentionCount}\t${row.shareOfVoice.toFixed(4)}`);
  }

  for (const competitor of report.competitors) {
    printLineImpl("");
    printLineImpl(`${competitor.domain}`);
    printLineImpl(`  mentions: ${competitor.mentionCount}`);
    printLineImpl(`  share_of_voice: ${competitor.shareOfVoice.toFixed(4)}`);
    const page = competitor.competitorOnlyPages[0] ?? competitor.topPages[0];
    if (page) {
      printLineImpl(`  top_gap_page: ${page.url}`);
    }
  }
}

function renderPromptAudit(report: PromptAuditReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Prompt audit for ${report.summary.domain}`);
  printLineImpl(`Engines succeeded: ${report.summary.enginesSucceeded}/${report.summary.enginesRequested}`);
  renderErrors(report.summary.errors, printLineImpl);

  printLineImpl("");
  printLineImpl("engine\tsuccess\tdomain_mentioned\tbrand_mentioned\tcitations");
  for (const engine of report.engines) {
    printLineImpl(
      `${engine.engine}\t${engine.success ? "yes" : "no"}\t${engine.mentionedDomain ? "yes" : "no"}\t${formatMaybeBoolean(engine.mentionedBrand)}\t${engine.citedUrls.length}`,
    );
  }
}

function renderSourceGap(report: SourceGapReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Source gap for ${report.summary.domain}`);
  printLineImpl(`Keywords: ${report.summary.keywordsRequested}`);
  printLineImpl(`Owned: ${report.summary.ownedKeywords}`);
  printLineImpl(`Mixed: ${report.summary.mixedKeywords}`);
  printLineImpl(`Missing: ${report.summary.missingKeywords}`);
  renderErrors(report.summary.errors, printLineImpl);

  printLineImpl("");
  printLineImpl("keyword\tstatus\towned_citations\tcompetitor_pages");
  for (const row of report.keywords) {
    printLineImpl(`${row.keyword}\t${row.status}\t${row.ownedCitations.length}\t${row.competitorPages.length}`);
  }
}

function renderTopicSizing(report: TopicSizingReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Topic sizing for ${report.summary.domain}`);
  printLineImpl(`Keywords: ${report.summary.keywordsRequested}`);
  printLineImpl(`Uncited keywords: ${report.summary.uncitedKeywords}`);
  renderErrors(report.summary.errors, printLineImpl);

  printLineImpl("");
  printLineImpl("keyword\tstatus\tsearch_volume_last_month");
  for (const row of report.keywords) {
    printLineImpl(`${row.keyword}\t${row.status}\t${row.searchVolumeLastMonth}`);
  }
}

function renderCitationReport(report: CitationReport, printLineImpl: typeof printLine): void {
  printLineImpl(`Citation report for ${report.summary.domain}`);
  printLineImpl(`Citations: ${report.summary.totalCitations}`);
  printLineImpl(`Unique domains: ${report.summary.uniqueDomains}`);
  renderErrors(report.summary.errors, printLineImpl);

  renderTopPages(report.topPages, printLineImpl);

  if (report.citations.length > 0) {
    printLineImpl("");
    printLineImpl("scope\tplatform\tdomain\turl");
    for (const citation of report.citations.slice(0, 10)) {
      printLineImpl(`${citation.scope}\t${citation.platform}\t${citation.domain ?? "(unknown)"}\t${citation.url}`);
    }
  }
}

function renderTopDomains(
  rows: Array<{ domain: string; mentions: number; owned: boolean; platform: string }>,
  printLineImpl: typeof printLine,
): void {
  if (rows.length === 0) {
    return;
  }

  printLineImpl("");
  printLineImpl("top_source_domain\tmentions\towned\tplatform");
  for (const row of rows.slice(0, 5)) {
    printLineImpl(`${row.domain}\t${row.mentions}\t${row.owned ? "yes" : "no"}\t${row.platform}`);
  }
}

function renderTopPages(
  rows: Array<{ url: string; mentions: number; owned: boolean; platform: string }>,
  printLineImpl: typeof printLine,
): void {
  if (rows.length === 0) {
    return;
  }

  printLineImpl("");
  printLineImpl("top_page\tmentions\towned\tplatform");
  for (const row of rows.slice(0, 5)) {
    printLineImpl(`${row.url}\t${row.mentions}\t${row.owned ? "yes" : "no"}\t${row.platform}`);
  }
}

function renderErrors(errors: string[], printLineImpl: typeof printLine): void {
  if (errors.length === 0) {
    return;
  }

  printLineImpl(`Errors: ${errors.join(" | ")}`);
}

function formatMaybeBoolean(value: boolean | null): string {
  if (value === null) {
    return "n/a";
  }

  return value ? "yes" : "no";
}
