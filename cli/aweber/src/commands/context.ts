import { getBooleanFlag, getStringFlag, parseArgs } from "../core/args.ts";
import {
  clearAweberContext,
  getConfigPath,
  readConfig,
  resolveAweberConfig,
  saveAweberContext,
} from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";

const CONTEXT_SCHEMA = {
  "--account-id": "string",
  "--list-id": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runContextCommand(
  argv: string[],
  dependencies: {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, CONTEXT_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (!action || action === "--help" || action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action === "set") {
    const accountId = getStringFlag(parsed, "--account-id");
    const listId = getStringFlag(parsed, "--list-id");
    if (!accountId && !listId) {
      throw new CliError("`aweber context set` requires `--account-id`, `--list-id`, or both.", 2);
    }

    const result = await saveAweberContext({
      ...(accountId ? { accountId } : {}),
      ...(listId ? { listId } : {}),
    });

    const payload = {
      ok: true,
      configPath: result.configPath,
      context: resolveAweberConfig(result.config).context,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Saved AWeber context at ${payload.configPath}`);
    printLineImpl(`Account ID: ${payload.context.accountId ?? "(not set)"}`);
    printLineImpl(`List ID: ${payload.context.listId ?? "(not set)"}`);
    return;
  }

  if (action === "show") {
    const resolved = resolveAweberConfig(await readConfig());
    const payload = {
      configPath: getConfigPath(),
      context: resolved.context,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Config path: ${payload.configPath}`);
    printLineImpl(`Account ID: ${payload.context.accountId ?? "(not set)"}`);
    printLineImpl(`List ID: ${payload.context.listId ?? "(not set)"}`);
    return;
  }

  if (action === "clear") {
    const result = await clearAweberContext();
    const payload = {
      ok: true,
      configPath: result.configPath,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Cleared AWeber context at ${payload.configPath}`);
    return;
  }

  throw new CliError(`Unknown context action: ${action}`, 2);
}

function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("AWeber context commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  aweber context set --account-id <id> [--list-id <id>] [--json]");
  printLineImpl("  aweber context show [--json]");
  printLineImpl("  aweber context clear [--json]");
}
