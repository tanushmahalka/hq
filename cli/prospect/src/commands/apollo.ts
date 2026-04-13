import { spawn } from "node:child_process";

import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { readConfig, resolveConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { parseAssignmentList, readJsonInput } from "../core/http.ts";
import { printJson, printLine } from "../core/output.ts";
import { ApolloClient } from "../providers/apollo/client.ts";
import { createApolloProvider, toCollectionEnvelope, toEnvelope } from "../providers/apollo/index.ts";
import { createApolloWebhookSession } from "../providers/apollo/webhook.ts";
import { ACCOUNT_SCHEMA, COMMON_SCHEMA, outputEnvelope, parseAccountInput, parsePersonInput, parseRequestOptions, PERSON_SCHEMA } from "./shared.ts";

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

const APOLLO_PERSON_ENRICH_SCHEMA = {
  ...PERSON_SCHEMA,
  "--reveal-personal-emails": "boolean",
  "--reveal-phone-number": "boolean",
  "--webhook-url": "string",
  "--wait": "boolean",
  "--wait-timeout-ms": "string",
} as const;

const APOLLO_BULK_ENRICH_SCHEMA = {
  ...COMMON_SCHEMA,
  "--data": "string",
  "--data-file": "string",
  "--detail": "string[]",
  "--reveal-personal-emails": "boolean",
  "--reveal-phone-number": "boolean",
  "--webhook-url": "string",
  "--wait": "boolean",
  "--wait-timeout-ms": "string",
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
  dependencies: { fetchImpl?: typeof fetch; spawnImpl?: typeof spawn } = {},
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
    const parsed = parseArgs(rest, APOLLO_PERSON_ENRICH_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printApolloEnrichPersonHelp();
      return;
    }
    const input = parsePersonInput(parsed);
    const options = parseRequestOptions(parsed);
    validateApolloEnrichPersonInput(input);
    const waitConfig = parseApolloWaitOptions(parsed);
    const webhookSession = await maybeCreateApolloWaitSession(waitConfig, dependencies.spawnImpl);
    const stopProgress = webhookSession ? startApolloWaitProgress(webhookSession.webhookUrl, waitConfig.timeoutMs) : undefined;
    try {
      options.providerOptions = parseApolloEnrichmentOptions(parsed, webhookSession?.webhookUrl);
      const result = await provider.enrichPerson(input, options);

      if (webhookSession) {
        const webhookPayload = await webhookSession.waitForPayload(waitConfig.timeoutMs);
        stopProgress?.("Apollo webhook received.");
        outputRawApolloWaitResponse(result.providerRaw, webhookPayload);
        return;
      }

      outputRawEnrichResponse(result.providerRaw);
    } finally {
      stopProgress?.();
      await webhookSession?.close();
    }
    return;
  }

  if (group === "enrich" && entity === "account") {
    const parsed = parseArgs(rest, ACCOUNT_SCHEMA);
    const input = parseAccountInput(parsed);
    const options = parseRequestOptions(parsed);
    const result = await provider.enrichAccount(input, options);
    outputRawEnrichResponse(result.providerRaw);
    return;
  }

  if (group === "enrich" && entity === "people") {
    const parsed = parseArgs(rest, APOLLO_BULK_ENRICH_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printApolloBulkEnrichPeopleHelp();
      return;
    }

    const options = parseRequestOptions(parsed);
    const waitConfig = parseApolloWaitOptions(parsed);
    const webhookSession = await maybeCreateApolloWaitSession(waitConfig, dependencies.spawnImpl);
    const stopProgress = webhookSession ? startApolloWaitProgress(webhookSession.webhookUrl, waitConfig.timeoutMs) : undefined;
    try {
      options.providerOptions = parseApolloEnrichmentOptions(parsed, webhookSession?.webhookUrl);
      const payload = validateBulkPeoplePayload(await readBulkPeopleInput(parsed));
      const result = await provider.bulkEnrichPeople(payload, options);

      if (webhookSession) {
        const webhookPayload = await webhookSession.waitForPayload(waitConfig.timeoutMs);
        stopProgress?.("Apollo webhook received.");
        outputRawApolloWaitResponse(result.providerRaw, webhookPayload);
        return;
      }

      outputRawEnrichResponse(result.providerRaw);
    } finally {
      stopProgress?.();
      await webhookSession?.close();
    }
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
  printLine("  prospect apollo enrich person --email <email> [--reveal-personal-emails] [--reveal-phone-number --webhook-url <url>] [--wait] [--json]");
  printLine("    Credit behavior: potentially credit-consuming depending on enrichment and reveal behavior.");
  printLine("  prospect apollo enrich people --detail 'id=<apollo-id>' [--detail 'email=jane@example.com'] [--wait] [--json]");
  printLine("    Bulk People Enrichment. Prefer People API Search first, then pass person IDs in details.");
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

function printApolloEnrichPersonHelp(): void {
  printLine("Prospect Apollo enrich person");
  printLine("");
  printLine("Use this for Apollo People Enrichment for one person.");
  printLine("");
  printLine("Usage:");
  printLine("  prospect apollo enrich person --id <apollo-id> [--json] [--debug]");
  printLine("  prospect apollo enrich person --email <email> [--reveal-personal-emails] [--json] [--debug]");
  printLine("  prospect apollo enrich person --email <email> --reveal-phone-number --wait [--json] [--debug]");
  printLine("  prospect apollo enrich person --email <email> --reveal-phone-number --webhook-url <url> [--json] [--debug]");
  printLine("");
  printLine("Identity inputs:");
  printLine("  --id, --email, --hashed-email, --linkedin-url, --name, --first-name, --last-name, --domain, --company");
  printLine("");
  printLine("Enrichment controls:");
  printLine("  --reveal-personal-emails");
  printLine("  --reveal-phone-number");
  printLine("  --webhook-url <https-url>");
  printLine("  --wait");
  printLine("  --wait-timeout-ms <ms>");
  printLine("");
  printLine("Notes:");
  printLine("  Apollo requires --webhook-url when --reveal-phone-number is enabled.");
  printLine("  --wait starts a temporary local webhook receiver and a Cloudflare tunnel automatically.");
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

function printApolloBulkEnrichPeopleHelp(): void {
  printLine("Prospect Apollo enrich people");
  printLine("");
  printLine("Use this for Apollo Bulk People Enrichment.");
  printLine("");
  printLine("Recommended flow:");
  printLine("  1. Use `prospect apollo list people` to find Apollo person IDs without consuming credits.");
  printLine("  2. Pass those IDs in the details array here when you need richer person data.");
  printLine("");
  printLine("Usage:");
  printLine("  prospect apollo enrich people --detail 'id=<apollo-id>' [--detail 'id=<apollo-id>'] [--json] [--debug]");
  printLine("  prospect apollo enrich people --detail 'email=jane@example.com' --detail 'name=John Doe;domain=acme.com' [--json] [--debug]");
  printLine("  prospect apollo enrich people --detail 'id=<apollo-id>' --reveal-phone-number --wait [--json] [--debug]");
  printLine("  prospect apollo enrich people --data '{\"details\":[...]}' [--json] [--debug]");
  printLine("  prospect apollo enrich people --data-file payload.json [--json] [--debug]");
  printLine("");
  printLine("Behavior:");
  printLine("  Sends POST /api/v1/people/bulk_match with a details array of 1 to 10 people.");
  printLine("  Use repeated --detail flags for first-class CLI input, or --data/--data-file for raw JSON payloads.");
  printLine("  Top-level enrichment controls are available via --reveal-personal-emails, --reveal-phone-number, --webhook-url, and --wait.");
  printLine("  To minimize credit usage, prefer `id` values from People API Search instead of raw identity fields when possible.");
  printLine("");
  printLine("Example detail syntax:");
  printLine("  --detail 'id=64a7ff0cc4dfae00013df1a5'");
  printLine("  --detail 'name=John Doe;domain=acme.com'");
  printLine("  --detail '{\"email\":\"jane@example.com\",\"company\":\"Acme\"}'");
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

function validateBulkPeoplePayload(value: unknown): { details: Record<string, unknown>[] } & Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new CliError("Bulk people enrichment expects a JSON object body.", 2);
  }

  const details = Array.isArray(value.details) ? value.details.filter(isPlainObject) : [];
  if (details.length === 0) {
    throw new CliError("Bulk people enrichment expects a non-empty `details` array.", 2);
  }

  if (details.length > 10) {
    throw new CliError("Bulk people enrichment supports at most 10 people per request.", 2);
  }

  return {
    ...value,
    details,
  };
}

function validateApolloEnrichPersonInput(input: Record<string, unknown>): void {
  if (
    stringValue(input.id) ||
    stringValue(input.email) ||
    stringValue(input.hashedEmail) ||
    stringValue(input.linkedinUrl) ||
    stringValue(input.name) ||
    stringValue(input.company) ||
    stringValue(input.domain) ||
    stringValue(input.firstName) ||
    stringValue(input.lastName)
  ) {
    return;
  }

  throw new CliError(
    "Provide at least one Apollo person identifier such as --id, --email, --hashed-email, --linkedin-url, or name/domain fields.",
    2,
  );
}

function parseApolloEnrichmentOptions(parsed: ReturnType<typeof parseArgs>, generatedWebhookUrl?: string): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (getBooleanFlag(parsed, "--reveal-personal-emails")) {
    options.reveal_personal_emails = true;
  }
  if (getBooleanFlag(parsed, "--reveal-phone-number")) {
    options.reveal_phone_number = true;
  }

  const webhookUrl = generatedWebhookUrl ?? getStringFlag(parsed, "--webhook-url");
  if (webhookUrl) {
    options.webhook_url = webhookUrl;
  }

  if (options.reveal_phone_number === true && !webhookUrl) {
    throw new CliError("Apollo requires --webhook-url when --reveal-phone-number is enabled.", 2);
  }

  if (webhookUrl && options.reveal_phone_number !== true) {
    throw new CliError("Use --webhook-url only with --reveal-phone-number.", 2);
  }

  return options;
}

function parseApolloWaitOptions(parsed: ReturnType<typeof parseArgs>): { enabled: boolean; timeoutMs: number } {
  const enabled = getBooleanFlag(parsed, "--wait");
  const timeoutValue = getStringFlag(parsed, "--wait-timeout-ms");
  const timeoutMs = timeoutValue ? Number.parseInt(timeoutValue, 10) : 180_000;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CliError("Option --wait-timeout-ms expects a positive integer.", 2);
  }

  if (!enabled) {
    return {
      enabled,
      timeoutMs,
    };
  }

  if (getStringFlag(parsed, "--webhook-url")) {
    throw new CliError("Use either --wait or --webhook-url, not both.", 2);
  }

  const expectsWebhook = getBooleanFlag(parsed, "--reveal-phone-number");
  if (!expectsWebhook) {
    throw new CliError("Use --wait only with Apollo flows that send async webhooks, such as --reveal-phone-number.", 2);
  }

  return {
    enabled,
    timeoutMs,
  };
}

async function maybeCreateApolloWaitSession(
  waitConfig: { enabled: boolean },
  spawnImpl?: typeof spawn,
): Promise<Awaited<ReturnType<typeof createApolloWebhookSession>> | undefined> {
  if (!waitConfig.enabled) {
    return undefined;
  }

  return await createApolloWebhookSession({ spawnImpl });
}

async function readBulkPeopleInput(parsed: ReturnType<typeof parseArgs>): Promise<unknown> {
  const data = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
  const details = getStringArrayFlag(parsed, "--detail");

  if (data !== undefined && details.length > 0) {
    throw new CliError("Use either --detail or --data/--data-file for bulk people enrichment, not both.", 2);
  }

  if (details.length === 0) {
    return data;
  }

  return {
    details: details.map((entry) => parseBulkDetail(entry)),
  };
}

function parseBulkDetail(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliError("Bulk detail entries cannot be empty.", 2);
  }

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new CliError(`Invalid JSON detail: ${(error as Error).message}`, 2);
    }

    if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
      throw new CliError("Bulk detail JSON must be a non-empty object.", 2);
    }

    return parsed;
  }

  const assignments = trimmed
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsed = parseAssignmentList(assignments);

  if (Object.keys(parsed).length === 0) {
    throw new CliError("Bulk detail entries must include at least one key=value pair.", 2);
  }

  return parsed;
}

function outputRawEnrichResponse(value: unknown): void {
  printJson(value ?? null);
}

function outputRawApolloWaitResponse(syncPayload: unknown, webhookPayload: unknown): void {
  printJson({
    sync: syncPayload ?? null,
    webhook: webhookPayload ?? null,
  });
}

function startApolloWaitProgress(webhookUrl: string, timeoutMs: number): (message?: string) => void {
  const startedAt = Date.now();
  process.stderr.write(`Apollo async wait started.\n`);
  process.stderr.write(`Temporary webhook: ${webhookUrl}\n`);
  process.stderr.write(`Timeout: ${Math.round(timeoutMs / 1000)}s\n`);
  process.stderr.write(`Waiting for Apollo webhook...\n`);

  const interval = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    process.stderr.write(`Still waiting for Apollo webhook... ${elapsedSeconds}s elapsed\n`);
  }, 15_000);

  return (message?: string) => {
    clearInterval(interval);
    if (message) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      process.stderr.write(`${message} ${elapsedSeconds}s elapsed\n`);
    }
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
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
