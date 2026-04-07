import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { readConfig, resolveTwentyConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { parseAssignmentList, readJsonInput } from "../core/http.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";
import { generatedOperationsById, type GeneratedOperationId } from "../generated/index.ts";
import { TwentyClient } from "../providers/twenty/client.ts";

const CALL_SCHEMA = {
  "--method": "string",
  "--path": "string",
  "--query": "string[]",
  "--field": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--human": "boolean",
  "--verbose": "boolean",
  "--help": "boolean",
} as const;

const OP_SCHEMA = {
  "--operation-id": "string",
  "--path-param": "string[]",
  "--query": "string[]",
  "--field": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--human": "boolean",
  "--verbose": "boolean",
  "--help": "boolean",
} as const;

export async function runApiCommand(argv: string[], dependencies: { fetchImpl?: typeof fetch } = {}): Promise<void> {
  const [action = "help", ...rest] = argv;

  if (action === "help" || action === "--help") {
    printHelp();
    return;
  }

  const client = new TwentyClient({
    config: resolveTwentyConfig(await readConfig()),
    fetchImpl: dependencies.fetchImpl,
  });

  if (action === "call") {
    const parsed = parseArgs(rest, CALL_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const method = (getStringFlag(parsed, "--method") ?? "GET").toUpperCase();
    const path = requireFlag(getStringFlag(parsed, "--path"), "--path");
    const query = parseAssignmentList(getStringArrayFlag(parsed, "--query")) as Record<string, string | number | boolean>;
    const jsonInput = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
    const fields = parseAssignmentList(getStringArrayFlag(parsed, "--field"));
    const body = resolveBody(jsonInput, fields);
    const response = await client.request({
      method,
      path,
      query,
      json: body,
      verbose: getBooleanFlag(parsed, "--verbose"),
    });

    if (getBooleanFlag(parsed, "--human")) {
      printHuman(response.data);
      return;
    }

    printJson(response.data);
    return;
  }

  if (action === "op") {
    const parsed = parseArgs(rest, OP_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const operationId = requireFlag(getStringFlag(parsed, "--operation-id"), "--operation-id") as GeneratedOperationId;
    if (!(operationId in generatedOperationsById)) {
      throw new CliError(`Unknown operationId: ${operationId}`, 2);
    }

    const pathParams = parseAssignmentList(getStringArrayFlag(parsed, "--path-param"), (value) => value) as Record<string, string>;
    const query = parseAssignmentList(getStringArrayFlag(parsed, "--query")) as Record<string, string | number | boolean>;
    const jsonInput = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
    const fields = parseAssignmentList(getStringArrayFlag(parsed, "--field"));
    const body = resolveBody(jsonInput, fields);

    const response = await client.requestOperation({
      operationId,
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
    return;
  }

  throw new CliError(`Unknown api action: ${action}`, 2);
}

function resolveBody(jsonInput: unknown | undefined, fields: Record<string, unknown>): unknown | undefined {
  if (jsonInput !== undefined && Object.keys(fields).length > 0) {
    throw new CliError("Use either --data/--data-file or --field, not both.", 2);
  }

  return jsonInput ?? (Object.keys(fields).length > 0 ? fields : undefined);
}

function printHelp(): void {
  printLine("Twenty raw API commands");
  printLine("");
  printLine("Usage:");
  printLine("  twenty api call --method GET --path /people --query limit=10");
  printLine("  twenty api op --operation-id findManyPeople --query limit=10");
  printLine("  twenty api op --operation-id UpdateOnePerson --path-param id=<uuid> --field firstName=Jane");
}
