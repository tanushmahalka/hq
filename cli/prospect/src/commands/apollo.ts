import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { readConfig, resolveConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { parseAssignmentList, readJsonInput } from "../core/http.ts";
import { printJson, printLine } from "../core/output.ts";
import { ApolloClient } from "../providers/apollo/client.ts";
import { createApolloProvider, toCollectionEnvelope, toEnvelope } from "../providers/apollo/index.ts";
import { outputEnvelope, parseAccountInput, parsePersonInput, parseRequestOptions, PERSON_SCHEMA, ACCOUNT_SCHEMA } from "./shared.ts";

const API_SCHEMA = {
  "--method": "string",
  "--path": "string",
  "--query": "string[]",
  "--field": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--json": "boolean",
  "--timeout-ms": "string",
  "--help": "boolean",
} as const;

const USAGE_SCHEMA = {
  "--match": "string",
  "--json": "boolean",
  "--timeout-ms": "string",
  "--help": "boolean",
} as const;

const APOLLO_PERSON_FIND_SCHEMA = {
  ...PERSON_SCHEMA,
  "--query": "string[]",
  "--filters": "boolean",
} as const;

const APOLLO_PEOPLE_SEARCH_FILTERS = [
  { name: "person_titles[]", type: "string[]", description: "Job titles held by the people you want to find." },
  { name: "include_similar_titles", type: "boolean", description: "Return similar job titles in addition to strict matches." },
  { name: "q_keywords", type: "string", description: "Keyword search across people records." },
  { name: "person_locations[]", type: "string[]", description: "Locations where the people live." },
  { name: "person_seniorities[]", type: "string[]", description: "Current seniority levels such as director or vp." },
  { name: "organization_locations[]", type: "string[]", description: "Headquarters locations of current employers." },
  { name: "q_organization_domains_list[]", type: "string[]", description: "Employer domains to include." },
  { name: "contact_email_status[]", type: "string[]", description: "Email status filters such as verified or unavailable." },
  { name: "organization_ids[]", type: "string[]", description: "Apollo organization IDs to include." },
  { name: "organization_num_employees_ranges[]", type: "string[]", description: "Employee count ranges such as 250,500." },
  { name: "revenue_range[min]", type: "integer", description: "Minimum employer revenue." },
  { name: "revenue_range[max]", type: "integer", description: "Maximum employer revenue." },
  { name: "currently_using_all_of_technology_uids[]", type: "string[]", description: "Technologies the employer must all use." },
  { name: "currently_using_any_of_technology_uids[]", type: "string[]", description: "Technologies the employer may use." },
  { name: "currently_not_using_any_of_technology_uids[]", type: "string[]", description: "Technologies the employer must not use." },
  { name: "q_organization_job_titles[]", type: "string[]", description: "Active job posting titles at the current employer." },
  { name: "organization_job_locations[]", type: "string[]", description: "Locations of the employer's active job postings." },
  { name: "organization_num_jobs_range[min]", type: "integer", description: "Minimum number of active jobs at the employer." },
  { name: "organization_num_jobs_range[max]", type: "integer", description: "Maximum number of active jobs at the employer." },
  { name: "organization_job_posted_at_range[min]", type: "date", description: "Earliest job posting date at the employer." },
  { name: "organization_job_posted_at_range[max]", type: "date", description: "Latest job posting date at the employer." },
  { name: "page", type: "integer", description: "Page number for paginated search." },
  { name: "per_page", type: "integer", description: "Results per page." },
] as const;

export async function runApolloCommand(
  argv: string[],
  dependencies: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const [group = "help", entity, ...rest] = argv;
  const resolved = resolveConfig(await readConfig());
  const provider = createApolloProvider(
    new ApolloClient({
      config: resolved.providers.apollo,
      fetchImpl: dependencies.fetchImpl,
    }),
  );

  if (group === "help" || group === "--help") {
    printHelp();
    return;
  }

  if (group === "api") {
    const parsed = parseArgs([entity, ...rest].filter(Boolean) as string[], API_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const method = (getStringFlag(parsed, "--method") ?? "GET").toUpperCase();
    const path = requireFlag(getStringFlag(parsed, "--path"), "--path");
    const query = parseAssignmentList(getStringArrayFlag(parsed, "--query"));
    const fields = parseAssignmentList(getStringArrayFlag(parsed, "--field"));
    const data = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
    const body = data ?? (Object.keys(fields).length > 0 ? fields : undefined);

    if (data !== undefined && Object.keys(fields).length > 0) {
      throw new CliError("Use either --data/--data-file or --field, not both.", 2);
    }

    const timeoutValue = getStringFlag(parsed, "--timeout-ms");
    const timeoutMs = timeoutValue ? Number.parseInt(timeoutValue, 10) : resolved.defaults.timeoutMs;

    const result = await provider.rawRequest({
      method,
      path,
      query,
      json: body,
      timeoutMs,
    });

    printJson(result);
    return;
  }

  if (group === "usage") {
    const parsed = parseArgs([entity, ...rest].filter(Boolean) as string[], USAGE_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const timeoutValue = getStringFlag(parsed, "--timeout-ms");
    const timeoutMs = timeoutValue ? Number.parseInt(timeoutValue, 10) : resolved.defaults.timeoutMs;
    const result = await provider.rawRequest({
      method: "POST",
      path: "/api/v1/usage_stats/api_usage_stats",
      timeoutMs,
    });
    const filtered = filterApolloUsage(result, {
      match: getStringFlag(parsed, "--match"),
    });

    if (getBooleanFlag(parsed, "--json")) {
      printJson({
        ok: true,
        provider: "apollo",
        command: "usage",
        result: filtered,
      });
      return;
    }

    printApolloUsage(filtered);
    return;
  }

  if (group === "find" && entity === "person") {
    const parsed = parseArgs(rest, APOLLO_PERSON_FIND_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printApolloFindPersonHelp();
      return;
    }
    if (getBooleanFlag(parsed, "--filters")) {
      printApolloPeopleSearchFilters(getBooleanFlag(parsed, "--json"));
      return;
    }
    const input = parsePersonInput(parsed);
    const options = parseRequestOptions(parsed);
    options.providerFilters = parseAssignmentList(getStringArrayFlag(parsed, "--query"));
    const result = await provider.findPerson(input, options);
    outputEnvelope(toEnvelope("find", "person", input, result), options.json);
    return;
  }

  if (group === "list" && entity === "people") {
    const parsed = parseArgs(rest, APOLLO_PERSON_FIND_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printApolloListPeopleHelp();
      return;
    }
    if (getBooleanFlag(parsed, "--filters")) {
      printApolloPeopleSearchFilters(getBooleanFlag(parsed, "--json"));
      return;
    }

    const input = parsePersonInput(parsed);
    const options = parseRequestOptions(parsed);
    options.providerFilters = parseAssignmentList(getStringArrayFlag(parsed, "--query"));
    const result = await provider.listPeople(input, options);

    if (options.json) {
      printJson(toCollectionEnvelope("list", "people", input, result));
      return;
    }

    printApolloPeopleListHuman(toCollectionEnvelope("list", "people", input, result));
    return;
  }

  if (group === "find" && entity === "account") {
    const parsed = parseArgs(rest, ACCOUNT_SCHEMA);
    const input = parseAccountInput(parsed);
    const options = parseRequestOptions(parsed);
    const result = await provider.findAccount(input, options);
    outputEnvelope(toEnvelope("find", "account", input, result), options.json);
    return;
  }

  if (group === "find" && entity === "number") {
    const parsed = parseArgs(rest, PERSON_SCHEMA);
    const input = parsePersonInput(parsed);
    const options = parseRequestOptions(parsed);
    const result = await provider.findNumber(input, options);
    outputEnvelope(toEnvelope("find", "number", input, result), options.json);
    return;
  }

  if (group === "enrich" && entity === "person") {
    const parsed = parseArgs(rest, PERSON_SCHEMA);
    const input = parsePersonInput(parsed);
    const options = parseRequestOptions(parsed);
    const result = await provider.enrichPerson(input, options);
    outputEnvelope(toEnvelope("enrich", "person", input, result), options.json);
    return;
  }

  if (group === "enrich" && entity === "account") {
    const parsed = parseArgs(rest, ACCOUNT_SCHEMA);
    const input = parseAccountInput(parsed);
    const options = parseRequestOptions(parsed);
    const result = await provider.enrichAccount(input, options);
    outputEnvelope(toEnvelope("enrich", "account", input, result), options.json);
    return;
  }

  throw new CliError(`Unknown Apollo command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("Prospect Apollo commands");
  printLine("");
  printLine("Usage:");
  printLine("  prospect apollo find person ...");
  printLine("    Use `prospect apollo find person --help` for single-person lookup help.");
  printLine("  prospect apollo list people ...");
  printLine("    Use `prospect apollo list people --help` for multi-person search help.");
  printLine("  prospect apollo find account --domain <domain> [--json]");
  printLine("    Credit behavior: may consume Apollo credits for organization search.");
  printLine("  prospect apollo find number --email <email> [--json]");
  printLine("    Credit behavior: may consume credits or trigger async enrichment when phone reveal is requested.");
  printLine("  prospect apollo enrich person --email <email> [--json]");
  printLine("    Credit behavior: potentially credit-consuming depending on enrichment and reveal behavior.");
  printLine("  prospect apollo enrich account --domain <domain> [--json]");
  printLine("    Credit behavior: may consume Apollo credits for organization enrichment.");
  printLine("  prospect apollo usage [--match people] [--json]");
  printLine("    Shows rate limits by endpoint family. It does not currently show billing-cycle credit totals.");
  printLine("  prospect apollo api --method GET --path /api/v1/auth/health [--json]");
  printLine("    Raw endpoint access. Credit behavior depends on the endpoint you call.");
}

function printApolloFindPersonHelp(): void {
  printLine("Prospect Apollo find person");
  printLine("");
  printLine("Use this for one exact person or one best match.");
  printLine("");
  printLine("Usage:");
  printLine("  prospect apollo find person --email <email> [--json] [--debug]");
  printLine("  prospect apollo find person --linkedin-url <url> [--json] [--debug]");
  printLine("  prospect apollo find person [--query key=value ...] [--filters] [--json] [--debug]");
  printLine("");
  printLine("Behavior:");
  printLine("  Exact identity inputs like --email and --linkedin-url use Apollo People Match.");
  printLine("  Filter-style searches use Apollo People API Search.");
  printLine("");
  printLine("Discover filters:");
  printLine("  prospect apollo find person --filters");
  printLine("  prospect apollo find person --filters --json");
  printLine("");
  printLine("Available query keys:");
  printApolloPeopleSearchFilterNames();
  printLine("");
  printLine("Example:");
  printLine("  prospect apollo find person --query 'person_titles[]=marketing director' --query 'person_locations[]=bangalore, india' --json");
}

function printApolloListPeopleHelp(): void {
  printLine("Prospect Apollo list people");
  printLine("");
  printLine("Use this for result sets, not exact single-person resolution.");
  printLine("");
  printLine("Usage:");
  printLine("  prospect apollo list people --query key=value [--query key=value ...] [--filters] [--json]");
  printLine("");
  printLine("Behavior:");
  printLine("  Uses Apollo People API Search and returns multiple normalized people plus pagination metadata.");
  printLine("");
  printLine("Discover filters:");
  printLine("  prospect apollo find person --filters");
  printLine("  prospect apollo find person --filters --json");
  printLine("");
  printLine("Available query keys:");
  printApolloPeopleSearchFilterNames();
  printLine("");
  printLine("Example:");
  printLine("  prospect apollo list people --query 'person_titles[]=marketing director' --query 'person_locations[]=bangalore, india' --query 'per_page=10' --query 'page=1' --json");
}

function printApolloPeopleSearchFilterNames(): void {
  for (const filter of APOLLO_PEOPLE_SEARCH_FILTERS) {
    printLine(`  ${filter.name}`);
  }
}

function printApolloPeopleSearchFilters(json: boolean): void {
  const payload = {
    ok: true,
    provider: "apollo",
    command: "find person filters",
    endpoint: "people-api-search",
    path: "/api/v1/mixed_people/api_search",
    filters: APOLLO_PEOPLE_SEARCH_FILTERS,
  };

  if (json) {
    printJson(payload);
    return;
  }

  printLine(colorize("Apollo People API Search Filters", "cyan"));
  printLine(`${labelize("Endpoint")} /api/v1/mixed_people/api_search`);
  printLine("");
  for (const filter of APOLLO_PEOPLE_SEARCH_FILTERS) {
    printLine(`${colorize(filter.name, "bold")} (${filter.type})`);
    printLine(`  ${filter.description}`);
  }
}

function printApolloPeopleListHuman(value: {
  provider?: string;
  results: Array<Record<string, unknown>>;
  totalEntries?: number;
  page?: number;
  perPage?: number;
}): void {
  printLine(colorize("Apollo People Results", "cyan"));
  if (value.provider) {
    printLine(`${labelize("Provider")} ${value.provider}`);
  }
  if (value.totalEntries !== undefined) {
    printLine(`${labelize("Total")} ${value.totalEntries}`);
  }
  if (value.page !== undefined || value.perPage !== undefined) {
    printLine(`${labelize("Page")} ${value.page ?? "-"} / per_page ${value.perPage ?? "-"}`);
  }
  printLine("");

  if (value.results.length === 0) {
    printLine("No results.");
    return;
  }

  for (const result of value.results) {
    const name = stringField(result, "fullName") ?? stringField(result, "firstName") ?? "Unknown";
    printLine(colorize(name, "bold"));
    const title = stringField(result, "jobTitle");
    if (title) {
      printLine(`  title: ${title}`);
    }
    const company = isPlainObject(result.company) ? stringField(result.company, "name") : undefined;
    if (company) {
      printLine(`  company: ${company}`);
    }
  }
}

function printApolloUsage(value: unknown): void {
  if (!isPlainObject(value)) {
    printJson(value);
    return;
  }

  printLine(colorize("Apollo API Usage", "cyan"));

  const plan = stringField(value, "plan_name") ?? stringField(value, "plan");
  const periodStart = stringField(value, "period_start");
  const periodEnd = stringField(value, "period_end");
  const totalEndpoints = numberField(value, "totalEndpoints");
  const returnedEndpoints = numberField(value, "returnedEndpoints");
  const match = stringField(value, "match");
  const filter = stringField(value, "filter");

  if (plan) {
    printLine(`${labelize("Plan")} ${colorize(plan, "bold")}`);
  }
  if (periodStart || periodEnd) {
    printLine(`${labelize("Window")} ${[periodStart, periodEnd].filter(Boolean).join(" -> ")}`);
  }
  if (totalEndpoints !== undefined || returnedEndpoints !== undefined) {
    printLine(
      `${labelize("Endpoints")} ${colorize(String(returnedEndpoints ?? totalEndpoints ?? 0), "bold")}/${colorize(String(totalEndpoints ?? returnedEndpoints ?? 0), "dim")}`,
    );
  }
  if (filter) {
    printLine(`${labelize("Filter")} ${filter}`);
  }
  if (match) {
    printLine(`${labelize("Match")} ${match}`);
  }

  const renderedSections: string[] = [];

  const credits = findObject(value, ["credits", "credit_usage", "credit_stats"]);
  if (credits) {
    renderedSections.push("credits");
    printLine("");
    printLine(colorize("Credits", "yellow"));
    printObjectTable(credits);
  }

  const usage = findObject(value, ["usage", "stats"]);
  if (usage) {
    renderedSections.push("usage");
    printLine("");
    printLine(colorize("Usage", "green"));
    printObjectTable(usage);
  }

  const rateLimits = findObject(value, ["rate_limits", "rateLimits"]);
  if (rateLimits) {
    renderedSections.push("rate_limits");
    printLine("");
    printLine(colorize("Rate Limits", "magenta"));
    printRateLimits(rateLimits);
  }

  const endpoints = findObject(value, ["endpoints"]);
  if (endpoints) {
    renderedSections.push("endpoints");
    printLine("");
    printLine(colorize("Endpoints", "magenta"));
    printRateLimits(endpoints);
  }

  if (renderedSections.length === 0) {
    printJson(value);
  }
}

function filterApolloUsage(
  value: unknown,
  options: {
    match?: string;
  },
): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const match = options.match?.trim().toLowerCase();
  const endpointEntries = Object.entries(value).filter(([key]) => looksLikeApolloUsageEndpointKey(key));
  const metadataEntries = Object.entries(value).filter(([key]) => !looksLikeApolloUsageEndpointKey(key));
  const filteredEntries = endpointEntries.filter(([key]) => {
    const normalizedKey = key.toLowerCase();
    if (match && !normalizedKey.includes(match)) {
      return false;
    }

    return true;
  });

  return {
    ...Object.fromEntries(metadataEntries),
    totalEndpoints: Object.keys(value).length,
    totalEndpointEntries: endpointEntries.length,
    returnedEndpoints: filteredEntries.length,
    ...(match ? { match } : {}),
    endpoints: Object.fromEntries(filteredEntries),
  };
}

function looksLikeApolloUsageEndpointKey(key: string): boolean {
  return key.startsWith("[") && key.includes("api/v1/");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function labelize(value: string): string {
  return `${colorize(`${value}:`, "dim")}`;
}

function printObjectTable(value: Record<string, unknown>, prefix = ""): void {
  for (const [key, entry] of Object.entries(value)) {
    const label = prefix ? `${prefix}.${key}` : key;

    if (isScalar(entry)) {
      printLine(`${labelize(label)} ${formatScalar(entry)}`);
      continue;
    }

    if (Array.isArray(entry)) {
      printLine(`${labelize(label)} ${formatScalar(entry)}`);
      continue;
    }

    if (isPlainObject(entry)) {
      const flat = tryFlatten(entry);
      if (flat) {
        printLine(`${labelize(label)} ${flat}`);
      } else {
        printObjectTable(entry, label);
      }
      continue;
    }

    printLine(`${labelize(label)} ${String(entry)}`);
  }
}

function printRateLimits(value: Record<string, unknown>): void {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    printLine(`${labelize("rate_limits")} none`);
    return;
  }

  for (const [endpoint, rawStats] of entries) {
    printLine(colorize(endpoint, "bold"));
    if (!isPlainObject(rawStats)) {
      printLine(`  ${formatScalar(rawStats)}`);
      continue;
    }

    const flattened = flattenLimitStats(rawStats);
    if (flattened.length === 0) {
      printLine(`  ${JSON.stringify(rawStats)}`);
      continue;
    }

    for (const line of flattened) {
      printLine(`  ${line}`);
    }
  }
}

function flattenLimitStats(value: Record<string, unknown>): string[] {
  const lines: string[] = [];

  for (const [key, entry] of Object.entries(value)) {
    if (isScalar(entry)) {
      lines.push(`${colorize(key, "dim")}: ${formatScalar(entry)}`);
      continue;
    }

    if (isPlainObject(entry)) {
      const parts = ["limit", "remaining", "used", "reset", "reset_at"]
        .map((field) => {
          const fieldValue = entry[field];
          if (fieldValue === undefined) {
            return null;
          }
          return `${field}=${formatScalar(fieldValue)}`;
        })
        .filter(Boolean);

      if (parts.length > 0) {
        lines.push(`${colorize(key, "dim")}: ${parts.join("  ")}`);
        continue;
      }

      lines.push(`${colorize(key, "dim")}: ${JSON.stringify(entry)}`);
      continue;
    }

    lines.push(`${colorize(key, "dim")}: ${formatScalar(entry)}`);
  }

  return lines;
}

function tryFlatten(value: Record<string, unknown>): string | null {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return null;
  }

  if (!entries.every(([, entry]) => isScalar(entry))) {
    return null;
  }

  return entries.map(([key, entry]) => `${colorize(key, "dim")}=${formatScalar(entry)}`).join("  ");
}

function findObject(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];
    if (isPlainObject(value)) {
      return value;
    }
  }

  return null;
}

function isScalar(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return colorize("-", "dim");
  }
  if (typeof value === "boolean") {
    return value ? colorize("yes", "green") : colorize("no", "red");
  }
  if (typeof value === "number") {
    return colorize(String(value), "bold");
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function colorize(value: string, tone: "bold" | "dim" | "red" | "green" | "yellow" | "magenta" | "cyan"): string {
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    return value;
  }

  const codes: Record<typeof tone, number> = {
    bold: 1,
    dim: 2,
    red: 31,
    green: 32,
    yellow: 33,
    magenta: 35,
    cyan: 36,
  };

  return `\u001b[${codes[tone]}m${value}\u001b[0m`;
}
