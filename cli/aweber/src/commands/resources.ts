import { getBooleanFlag, getOptionalIntegerFlag, getStringArrayFlag, getStringFlag, parseArgs, requireFlag, type ParsedArgs } from "../core/args.ts";
import { readConfig, resolveAweberConfig, saveAweberTokens } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { parseAssignmentList, readJsonInput, toStringRecord } from "../core/http.ts";
import { paginateLinkHeader, paginateWs, parseLinkHeader } from "../core/pagination.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";
import { AweberClient } from "../providers/aweber/client.ts";
import { getOperation, getOperationHelp, type FlagDefinition, type OperationDefinition } from "./operations.ts";

const SHARED_SCHEMA = {
  "--account-id": "string",
  "--list-id": "string",
  "--query": "string[]",
  "--field": "string[]",
  "--form": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--all": "boolean",
  "--json": "boolean",
  "--help": "boolean",
  "--ws-start": "string",
  "--ws-size": "string",
  "--before": "string",
  "--after": "string",
  "--page-size": "string",
} as const;

export async function runResourceGroupCommand(
  group: string,
  argv: string[],
  dependencies: {
    fetchImpl?: typeof fetch;
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action = "", ...rest] = argv;
  const operation = getOperation(group, action);
  const parsed = parseArgs(rest, buildSchema(operation));
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  const isHelpRequest = !action || action === "--help" || action === "help" || getBooleanFlag(parsed, "--help");

  if (isHelpRequest || !operation) {
    printGroupHelp(group, printLineImpl);
    if (!isHelpRequest && !operation && action) {
      throw new CliError(`Unknown ${group} action: ${action}`, 2);
    }
    return;
  }

  const resolved = resolveAweberConfig(await readConfig());
  const client = new AweberClient({
    config: resolved,
    fetchImpl: dependencies.fetchImpl,
    persistTokens: async (tokens) => {
      await saveAweberTokens(tokens);
    },
  });

  const pathParams = buildPathParams(operation, parsed, resolved.context);
  const path = interpolatePath(operation.pathTemplate, pathParams);
  const query = buildQuery(operation, parsed);
  const body = await buildBody(operation, parsed);

  let data: unknown;

  if (getBooleanFlag(parsed, "--all") && operation.pagination) {
    if (operation.pagination === "ws") {
      const pageSize = getOptionalIntegerFlag(parsed, "--ws-size") ?? 100;
      const start = getOptionalIntegerFlag(parsed, "--ws-start") ?? 0;

      data = await paginateWs({
        pageSize,
        start,
        fetchPage: async (pageStart, currentPageSize) => {
          const response = await client.request({
            method: operation.method,
            path,
            version: operation.version ?? "v1",
            query: {
              ...query,
              "ws.start": pageStart,
              "ws.size": currentPageSize,
            },
            ...(body.form ? { form: body.form } : {}),
            ...(body.json ? { json: body.json } : {}),
          });

          return response.data;
        },
      });
    } else {
      const initialResponse = await client.request({
        method: operation.method,
        path,
        version: operation.version ?? "v1",
        query,
        ...(body.form ? { form: body.form } : {}),
        ...(body.json ? { json: body.json } : {}),
      });

      data = await paginateLinkHeader({
        initialPage: {
          data: initialResponse.data,
          nextUrl: parseLinkHeader(initialResponse.headers.get("link")).next,
        },
        fetchPage: async (url) => {
          const response = await client.requestAbsolute({
            method: operation.method,
            url,
            ...(body.form ? { form: body.form } : {}),
            ...(body.json ? { json: body.json } : {}),
          });

          return {
            data: response.data,
            nextUrl: parseLinkHeader(response.headers.get("link")).next,
          };
        },
      });
    }
  } else {
    const response = await client.request({
      method: operation.method,
      path,
      version: operation.version ?? "v1",
      query,
      ...(body.form ? { form: body.form } : {}),
      ...(body.json ? { json: body.json } : {}),
    });
    data = response.data;
  }

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl(data);
    return;
  }

  printHuman(data, printLineImpl);
}

function buildSchema(operation: OperationDefinition | undefined): Record<string, "boolean" | "string" | "string[]"> {
  const schema: Record<string, "boolean" | "string" | "string[]"> = {
    ...SHARED_SCHEMA,
  };

  for (const flag of operation?.pathFlags ?? []) {
    schema[flag.flag] = flag.type === "boolean" ? "boolean" : "string";
  }

  for (const flag of operation?.queryFlags ?? []) {
    schema[flag.flag] = flag.type === "boolean" ? "boolean" : "string";
  }

  for (const flag of operation?.bodyFlags ?? []) {
    schema[flag.flag] = flag.type === "boolean" ? "boolean" : "string";
  }

  return schema;
}

function printGroupHelp(group: string, printLineImpl: typeof printLine = printLine): void {
  printLineImpl(`AWeber ${group} commands`);
  printLineImpl("");
  printLineImpl("Usage:");
  for (const line of getOperationHelp(group)) {
    printLineImpl(line);
  }
  printLineImpl("");
  printLineImpl("Shared flags:");
  printLineImpl("  --json                Print machine-friendly JSON");
  printLineImpl("  --all                 Page through all results when supported");
  printLineImpl("  --query key=value     Extra query parameters, repeatable");
  printLineImpl("  --field key=value     JSON body fields, repeatable");
  printLineImpl("  --form key=value      Form body fields, repeatable");
  printLineImpl("  --data '{...}'        Raw JSON request body");
}

function buildPathParams(
  operation: OperationDefinition,
  parsed: ParsedArgs,
  context: { accountId?: string; listId?: string },
): Record<string, string> {
  const result: Record<string, string> = {};

  if (operation.requiresAccountId) {
    result.accountId = requireFlag(getStringFlag(parsed, "--account-id") ?? context.accountId, "--account-id");
  }

  if (operation.requiresListId) {
    result.listId = requireFlag(getStringFlag(parsed, "--list-id") ?? context.listId, "--list-id");
  }

  for (const flag of operation.pathFlags ?? []) {
    result[flag.param] = requireFlag(getFlagValue(parsed, flag), flag.flag);
  }

  return result;
}

function interpolatePath(template: string, params: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key) => {
    const value = params[key];
    if (value === undefined) {
      throw new CliError(`Missing path parameter: ${key}`, 2);
    }
    return encodeURIComponent(value);
  });
}

function buildQuery(operation: OperationDefinition, parsed: ParsedArgs): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    ...(operation.fixedQuery ?? {}),
    ...(parseAssignmentList(getStringArrayFlag(parsed, "--query")) as Record<string, string | number | boolean>),
  };

  const wsStart = getOptionalIntegerFlag(parsed, "--ws-start");
  const wsSize = getOptionalIntegerFlag(parsed, "--ws-size");
  const pageSize = getOptionalIntegerFlag(parsed, "--page-size");
  const before = getStringFlag(parsed, "--before");
  const after = getStringFlag(parsed, "--after");

  if (wsStart !== undefined) query["ws.start"] = wsStart;
  if (wsSize !== undefined) query["ws.size"] = wsSize;
  if (pageSize !== undefined) query.page_size = pageSize;
  if (before !== undefined) query.before = before;
  if (after !== undefined) query.after = after;

  for (const flag of operation.queryFlags ?? []) {
    const value = getFlagValue(parsed, flag);
    if (value !== undefined) {
      query[flag.param] = flag.type === "boolean" ? value === "true" : value;
    }
  }

  return query;
}

async function buildBody(
  operation: OperationDefinition,
  parsed: ParsedArgs,
): Promise<{ json?: unknown; form?: Record<string, string> }> {
  const jsonInput = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
  const fieldPayload = parseAssignmentList(getStringArrayFlag(parsed, "--field"));
  const formPayload = toStringRecord(parseAssignmentList(getStringArrayFlag(parsed, "--form"), (value) => value));
  const namedBodyValues = buildNamedBodyValues(operation.bodyFlags ?? [], parsed);

  if (operation.bodyMode === "none" || operation.bodyMode === undefined) {
    return {};
  }

  if (jsonInput !== undefined && Object.keys(fieldPayload).length > 0) {
    throw new CliError("Use either `--data`/`--data-file` or `--field`, not both.", 2);
  }

  if (operation.bodyMode === "form") {
    if (jsonInput !== undefined) {
      throw new CliError("This command expects form fields. Use `--form key=value` flags instead of `--data`.", 2);
    }

    return {
      form: {
        ...toStringRecord(namedBodyValues),
        ...formPayload,
      },
    };
  }

  if (operation.bodyMode === "jsonOrForm" && Object.keys(formPayload).length > 0) {
    return {
      form: {
        ...toStringRecord(namedBodyValues),
        ...formPayload,
      },
    };
  }

  const json =
    jsonInput ??
    (Object.keys(fieldPayload).length > 0 || Object.keys(namedBodyValues).length > 0
      ? {
          ...namedBodyValues,
          ...fieldPayload,
        }
      : undefined);

  return json === undefined ? {} : { json };
}

function buildNamedBodyValues(flags: FlagDefinition[], parsed: ParsedArgs): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const flag of flags) {
    const value = getFlagValue(parsed, flag);
    if (value !== undefined) {
      values[flag.param] = flag.type === "boolean" ? value === "true" : value;
    }
  }
  return values;
}

function getFlagValue(parsed: ParsedArgs, flag: FlagDefinition): string | undefined {
  if (flag.type === "boolean") {
    return getBooleanFlag(parsed, flag.flag) ? "true" : undefined;
  }
  return getStringFlag(parsed, flag.flag);
}
