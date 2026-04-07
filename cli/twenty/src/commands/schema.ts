import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";
import { generatedOpenApiMeta, generatedOperations, generatedOperationsByTag, generatedSchemas } from "../generated/index.ts";
import { getResourceDefinition } from "./definitions.ts";

const SHARED_SCHEMA = {
  "--human": "boolean",
  "--help": "boolean",
} as const;

export async function runSchemaCommand(argv: string[]): Promise<void> {
  const [action = "help", ...rest] = argv;
  const needsResourceTarget = action === "resource";
  const target = needsResourceTarget ? rest[0] : undefined;
  const parsed = parseArgs(needsResourceTarget ? rest.slice(1) : rest, SHARED_SCHEMA);

  if (action === "help" || action === "--help" || getBooleanFlag(parsed, "--help")) {
    printHelp();
    return;
  }

  if (action === "operations") {
    const payload = generatedOperations.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      tags: operation.tags,
      summary: operation.summary,
    }));
    if (getBooleanFlag(parsed, "--human")) {
      printHuman(payload);
      return;
    }
    printJson(payload);
    return;
  }

  if (action === "resource") {
    if (!target) {
      throw new CliError("Missing resource name for `twenty schema resource`", 2);
    }

    const resource = getResourceDefinition(target);
    if (!resource) {
      throw new CliError(`Unknown resource: ${target}`, 2);
    }

    const payload = {
      meta: generatedOpenApiMeta,
      resource: resource.name,
      tag: resource.tag,
      actions: resource.actions,
      operations: (generatedOperationsByTag[resource.tag] ?? []).map((operationId) => {
        const operation = generatedOperations.find((entry) => entry.operationId === operationId);
        return {
          operationId,
          method: operation?.method,
          path: operation?.path,
          summary: operation?.summary,
          requestBody: operation?.requestBody,
        };
      }),
      schemas: generatedSchemas.filter((schema) =>
        schema.name.includes(resource.tag.replace(/^[a-z]/, (value) => value.toUpperCase()).replace(/-/g, "")) ||
        schema.name.toLowerCase().includes(resource.name.replace(/-/g, "").toLowerCase()),
      ),
    };

    if (getBooleanFlag(parsed, "--human")) {
      printHuman(payload);
      return;
    }
    printJson(payload);
    return;
  }

  throw new CliError(`Unknown schema action: ${action}`, 2);
}

function printHelp(): void {
  printLine("Twenty schema commands");
  printLine("");
  printLine("Usage:");
  printLine("  twenty schema operations");
  printLine("  twenty schema resource people");
}
