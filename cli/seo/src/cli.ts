import { CliError } from "./core/errors.ts";
import { printLine } from "./core/output.ts";
import { runProvidersCommand } from "./commands/providers.ts";
import { runPageAuditCommand } from "./commands/page/audit/index.ts";
import { runKeywordsListCommand } from "./commands/keywords/list.ts";
import { runKeywordsClassifyRelevanceCommand } from "./commands/keywords/classify-relevance.ts";
import { runGeoCommand } from "./commands/geo/index.ts";
import { runDomainRatingCommand } from "./commands/domain/rating.ts";
import { runDomainSpamScoreCommand } from "./commands/domain/spam-score.ts";

async function main(argv: string[]): Promise<void> {
  const [group, action, ...rest] = argv;

  if (!group || group === "--help" || group === "help") {
    printHelp();
    return;
  }

  if (group === "providers") {
    await runProvidersCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "page" && action === "audit") {
    await runPageAuditCommand(rest);
    return;
  }

  if (group === "keywords" && action === "list") {
    await runKeywordsListCommand(rest);
    return;
  }

  if (group === "keywords" && action === "classify-relevance") {
    await runKeywordsClassifyRelevanceCommand(rest);
    return;
  }

  if (group === "domain" && action === "rating") {
    await runDomainRatingCommand(rest);
    return;
  }

  if (group === "domain" && action === "spam-score") {
    await runDomainSpamScoreCommand(rest);
    return;
  }

  if (group === "geo") {
    await runGeoCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("SEO CLI");
  printLine("");
  printLine("Usage:");
  printLine("  seo providers set dataforseo --login <login> --password <password>");
  printLine("  seo providers show dataforseo [--json]");
  printLine("  seo providers set openrouter --api-key <key>");
  printLine("  seo providers show openrouter [--json]");
  printLine("  seo providers set google --client-id <id> --client-secret <secret> --redirect-uri <uri>");
  printLine("  seo providers show google [--json]");
  printLine("  seo providers auth google [--pkce] [--json]");
  printLine("  seo providers exchange-code google --callback-url <url> [--json]");
  printLine("  seo page audit --page <url> [--page <url> ...] [--json]");
  printLine("  seo keywords list --site <sc-property> --from <yyyy-mm-dd> --to <yyyy-mm-dd> [--json]");
  printLine("  seo keywords classify-relevance (--query <keyword> | --jsonl <path|->) --brand <overview> [--json]");
  printLine("  seo domain rating (--domain <domain> | --file <path|->) [--scale <100|1000>] [--json]");
  printLine("  seo domain spam-score (--domain <domain> | --file <path|->) [--json]");
  printLine("  seo domain spam-score sync-db [--dry-run] [--json]");
  printLine("  seo geo brand-visibility --domain <domain> [--json]");
  printLine("  seo geo competitor-gap --domain <domain> --vs <domain> [--vs <domain> ...] [--json]");
  printLine("  seo geo prompt-audit --prompt <text> --domain <domain> [--json]");
  printLine("  seo geo source-gap --domain <domain> --keyword <keyword> [--keyword <keyword> ...] [--json]");
  printLine("  seo geo topic-sizing --domain <domain> --keyword <keyword> [--keyword <keyword> ...] [--json]");
  printLine("  seo geo citation-report --domain <domain> [--json]");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
