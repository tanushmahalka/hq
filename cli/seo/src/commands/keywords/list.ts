import { getBooleanFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveGoogleOAuthConfig, saveGoogleOAuthTokens } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import {
  GoogleSearchConsoleClient,
  type ListAllQueryKeywordsResult,
  type SearchConsoleSearchType,
} from "../../providers/google/search-console.ts";

const KEYWORDS_LIST_SCHEMA = {
  "--site": "string",
  "--from": "string",
  "--to": "string",
  "--type": "string",
  "--fresh": "boolean",
  "--json": "boolean",
  "--help": "boolean",
} as const;

interface RunKeywordsListDependencies {
  resolvedConfig?: ReturnType<typeof resolveGoogleOAuthConfig>;
  createClient?: (config: ReturnType<typeof resolveGoogleOAuthConfig>) => GoogleSearchConsoleClientLike;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
}

interface GoogleSearchConsoleClientLike {
  listAllQueryKeywords(options: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    type?: SearchConsoleSearchType;
    dataState?: "final" | "all";
  }): Promise<ListAllQueryKeywordsResult>;
}

export async function runKeywordsListCommand(
  argv: string[],
  dependencies: RunKeywordsListDependencies = {},
): Promise<void> {
  const parsed = parseArgs(argv, KEYWORDS_LIST_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (getBooleanFlag(parsed, "--help")) {
    printKeywordsHelp(printLineImpl);
    return;
  }

  const siteUrl = getStringFlag(parsed, "--site");
  const startDate = getStringFlag(parsed, "--from");
  const endDate = getStringFlag(parsed, "--to");
  const requestedType = getStringFlag(parsed, "--type");
  const type = parseSearchType(requestedType);

  if (!siteUrl || !startDate || !endDate) {
    throw new CliError("`seo keywords list` requires `--site`, `--from`, and `--to`.", 2);
  }

  const config = dependencies.resolvedConfig ?? resolveGoogleOAuthConfig(await readConfig());
  const client =
    dependencies.createClient?.(config) ??
    new GoogleSearchConsoleClient({
      config,
      persistTokens: async (tokens) => {
        await saveGoogleOAuthTokens(tokens);
      },
    });

  const report = await client.listAllQueryKeywords({
    siteUrl,
    startDate,
    endDate,
    type,
    dataState: getBooleanFlag(parsed, "--fresh") ? "all" : "final",
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl(report);
    return;
  }

  renderKeywordRows(report, printLineImpl);
}

function printKeywordsHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo keywords list --site <sc-property> --from <yyyy-mm-dd> --to <yyyy-mm-dd> [--type <web|image|video|news|googleNews|discover>] [--fresh] [--json]");
  printLineImpl("");
  printLineImpl("Options:");
  printLineImpl("  --site <sc-property>   Search Console property, for example `sc-domain:example.com` or `https://example.com/`");
  printLineImpl("  --from <yyyy-mm-dd>    Start date");
  printLineImpl("  --to <yyyy-mm-dd>      End date");
  printLineImpl("  --type <type>          Search type, defaults to `web`");
  printLineImpl("  --fresh                Include incomplete recent data when available");
}

function renderKeywordRows(report: ListAllQueryKeywordsResult, printLineImpl: typeof printLine): void {
  printLineImpl(`Fetched ${report.totalRows} query row(s) for ${report.siteUrl}`);
  printLineImpl(`Window: ${report.startDate} to ${report.endDate}`);
  printLineImpl(`Type: ${report.type}`);
  printLineImpl(`Pages fetched: ${report.pageCount}`);
  printLineImpl("");
  printLineImpl("query\tclicks\timpressions\tctr\tposition");

  for (const row of report.rows) {
    printLineImpl(
      `${row.query}\t${row.clicks}\t${row.impressions}\t${row.ctr.toFixed(4)}\t${row.position.toFixed(2)}`,
    );
  }
}

function parseSearchType(value: string | undefined): SearchConsoleSearchType | undefined {
  if (!value) {
    return undefined;
  }

  if (["web", "image", "video", "news", "googleNews", "discover"].includes(value)) {
    return value as SearchConsoleSearchType;
  }

  throw new CliError("`--type` must be one of: web, image, video, news, googleNews, discover.", 2);
}
