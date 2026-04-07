import { getBooleanFlag, getOptionalIntegerFlag, parseArgs } from "../core/args.ts";
import { clearContextConfig, readConfig, resolveTwentyConfig, saveContextConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";

const CONTEXT_SCHEMA = {
  "--depth": "string",
  "--limit": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runContextCommand(argv: string[]): Promise<void> {
  const [action = "help", ...rest] = argv;
  const parsed = parseArgs(rest, CONTEXT_SCHEMA);

  if (action === "help" || action === "--help" || getBooleanFlag(parsed, "--help")) {
    printHelp();
    return;
  }

  if (action === "set") {
    const depth = getOptionalIntegerFlag(parsed, "--depth");
    const limit = getOptionalIntegerFlag(parsed, "--limit");
    const { configPath } = await saveContextConfig({
      ...(depth !== undefined ? { depth } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });

    printJson({ ok: true, configPath, context: { ...(depth !== undefined ? { depth } : {}), ...(limit !== undefined ? { limit } : {}) } });
    return;
  }

  if (action === "show") {
    const resolved = resolveTwentyConfig(await readConfig());
    const payload = { context: resolved.context };
    if (getBooleanFlag(parsed, "--json")) {
      printJson(payload);
      return;
    }

    printHuman(payload);
    return;
  }

  if (action === "clear") {
    const { configPath } = await clearContextConfig();
    printJson({ ok: true, configPath });
    return;
  }

  throw new CliError(`Unknown context action: ${action}`, 2);
}

function printHelp(): void {
  printLine("Twenty context commands");
  printLine("");
  printLine("Usage:");
  printLine("  twenty context set [--depth <0|1>] [--limit <n>]");
  printLine("  twenty context show [--json]");
  printLine("  twenty context clear");
}
