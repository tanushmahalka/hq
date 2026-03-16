import { parseArgs, getBooleanFlag, getStringArrayFlag, getStringFlag } from "../../../core/args.ts";
import { readConfig, resolveDataForSeoConfig } from "../../../core/config.ts";
import { CliError } from "../../../core/errors.ts";
import { printJson, printLine } from "../../../core/output.ts";
import { DataForSeoClient } from "../../../providers/dataforseo/client.ts";
import { runPageAudit } from "../../../providers/dataforseo/page-audit.ts";

const AUDIT_SCHEMA = {
  "--page": "string[]",
  "--json": "boolean",
  "--accept-language": "string",
  "--device": "string",
  "--help": "boolean",
} as const;

export async function runPageAuditCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv, AUDIT_SCHEMA);

  if (getBooleanFlag(parsed, "--help")) {
    printAuditHelp();
    return;
  }

  const pages = getStringArrayFlag(parsed, "--page");
  if (pages.length === 0) {
    throw new CliError("`seo page audit` needs at least one `--page` value.", 2);
  }

  const requestedDevice = getStringFlag(parsed, "--device") ?? "desktop";
  if (!["desktop", "mobile", "tablet"].includes(requestedDevice)) {
    throw new CliError("`--device` must be one of: desktop, mobile, tablet.", 2);
  }

  const config = resolveDataForSeoConfig(await readConfig());
  const client = new DataForSeoClient(config);
  const report = await runPageAudit(client, {
    pages,
    acceptLanguage: getStringFlag(parsed, "--accept-language"),
    device: requestedDevice as "desktop" | "mobile" | "tablet",
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJson(report);
    return;
  }

  printLine(`Audited ${report.summary.pagesRequested} page(s) with DataForSEO`);
  printLine(`Succeeded: ${report.summary.pagesSucceeded}`);
  printLine(`Failed: ${report.summary.pagesFailed}`);
  printLine(`Estimated API cost: $${report.summary.totalCostUsd.toFixed(6)}`);

  for (const page of report.pages) {
    printLine("");
    printLine(page.url);
    printLine(`  status: ${page.success ? "ok" : "failed"}`);
    printLine(`  cost: $${page.totalCostUsd.toFixed(6)}`);
    printLine("  endpoint: instant_pages");
    if (page.errors.length > 0) {
      for (const error of page.errors) {
        printLine(`  error: ${error}`);
      }
    } else {
      printLine("  tip: rerun with `--json` to inspect the full machine-readable payload");
    }
  }
}

function printAuditHelp(): void {
  printLine("Usage:");
  printLine("  seo page audit --page <url> [--page <url> ...] [--json]");
  printLine("");
  printLine("Options:");
  printLine("  --device <desktop|mobile|tablet>   Audit rendering preset");
  printLine("  --accept-language <locale>         Pass an Accept-Language header");
}
