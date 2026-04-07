import {
  getBooleanFlag,
  getOptionalIntegerFlag,
  getStringArrayFlag,
  getStringFlag,
  parseArgs,
} from "../core/args.ts";
import { readConfig, resolveTwentyConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { parseAssignmentList, readJsonInput } from "../core/http.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";
import { generatedOperationsById } from "../generated/index.ts";
import { TwentyClient } from "../providers/twenty/client.ts";
import { getResourceAction, getResourceDefinition } from "./definitions.ts";

const RESOURCE_SCHEMA = {
  "--id": "string",
  "--query": "string[]",
  "--field": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--depth": "string",
  "--limit": "string",
  "--yes": "boolean",
  "--human": "boolean",
  "--verbose": "boolean",
  "--help": "boolean",
} as const;

export async function runResourceGroupCommand(
  group: string,
  argv: string[],
  dependencies: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const resource = getResourceDefinition(group);
  const [action = "help", ...rest] = argv;
  const parsed = parseArgs(rest, RESOURCE_SCHEMA);

  if (!resource || action === "help" || action === "--help" || getBooleanFlag(parsed, "--help")) {
    printGroupHelp(group);
    if (!resource) {
      throw new CliError(`Unknown resource group: ${group}`, 2);
    }
    return;
  }

  const definition = getResourceAction(group, action);
  if (!definition) {
    printGroupHelp(group);
    throw new CliError(`Unknown ${group} action: ${action}`, 2);
  }

  const resolvedConfig = resolveTwentyConfig(await readConfig());
  const client = new TwentyClient({
    config: resolvedConfig,
    fetchImpl: dependencies.fetchImpl,
  });

  const operation = generatedOperationsById[definition.operationId];
  const query = {
    ...parseAssignmentList(getStringArrayFlag(parsed, "--query")),
    ...(resolvedConfig.context.depth !== undefined && !getStringArrayFlag(parsed, "--query").some((entry) => entry.startsWith("depth="))
      ? { depth: resolvedConfig.context.depth }
      : {}),
    ...(resolvedConfig.context.limit !== undefined && !getStringArrayFlag(parsed, "--query").some((entry) => entry.startsWith("limit="))
      ? { limit: resolvedConfig.context.limit }
      : {}),
  } as Record<string, string | number | boolean>;

  const depthOverride = getOptionalIntegerFlag(parsed, "--depth");
  const limitOverride = getOptionalIntegerFlag(parsed, "--limit");
  if (depthOverride !== undefined) query.depth = depthOverride;
  if (limitOverride !== undefined) query.limit = limitOverride;

  if (definition.requiresYes && !getBooleanFlag(parsed, "--yes")) {
    throw new CliError(`The \`${group} ${action}\` command requires --yes`, 2);
  }

  const jsonInput = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
  const fields = parseAssignmentList(getStringArrayFlag(parsed, "--field"));
  const body = resolveBody(jsonInput, fields);

  const pathParams: Record<string, string> = {};
  if (definition.requiresId) {
    const id = getStringFlag(parsed, "--id");
    if (!id) {
      throw new CliError("Missing required option: --id", 2);
    }
    pathParams.id = id;
  }

  if (operation.parameters.some((parameter) => parameter.name === "soft_delete") && !("soft_delete" in query) && definition.action === "delete") {
    query.soft_delete = false;
  }

  const response = await client.requestOperation({
    operationId: definition.operationId,
    pathParams,
    query,
    json: body,
    verbose: getBooleanFlag(parsed, "--verbose"),
  });

  if (getBooleanFlag(parsed, "--human")) {
    printHuman(response.data);
    return;
  }

  printJson(response.data);
}

function resolveBody(jsonInput: unknown | undefined, fields: Record<string, unknown>): unknown | undefined {
  if (jsonInput !== undefined && Object.keys(fields).length > 0) {
    throw new CliError("Use either --data/--data-file or --field, not both.", 2);
  }

  return jsonInput ?? (Object.keys(fields).length > 0 ? fields : undefined);
}

function printGroupHelp(group: string): void {
  const resource = getResourceDefinition(group);
  if (!resource) {
    throw new CliError(`Unknown resource group: ${group}`, 2);
  }

  printLine(`Twenty ${group} commands`);
  printLine("");
  printLine("Usage:");
  for (const action of resource.actions) {
    const parts = [`  twenty ${group} ${action.action}`];
    if (action.requiresId) {
      parts.push("--id <uuid>");
    }
    if (action.requiresYes) {
      parts.push("--yes");
    }
    printLine(parts.join(" "));
  }
  printLine("");
  printLine("Shared flags:");
  printLine("  --query key=value     Add request query parameters");
  printLine("  --field key=value     Build a JSON request body");
  printLine("  --data '{...}'        Provide a raw JSON body");
  printLine("  --data-file <path>    Read a JSON body from a file or - for stdin");
  printLine("  --human               Print human-readable output instead of JSON");
}
