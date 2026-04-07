import { getBooleanFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { clearAuthConfig, maskToken, readConfig, resolveTwentyConfig, saveAuthConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";

const AUTH_SCHEMA = {
  "--base-url": "string",
  "--token": "string",
  "--timeout-ms": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runAuthCommand(argv: string[]): Promise<void> {
  const [action = "help", ...rest] = argv;
  const parsed = parseArgs(rest, AUTH_SCHEMA);

  if (action === "help" || action === "--help" || getBooleanFlag(parsed, "--help")) {
    printHelp();
    return;
  }

  if (action === "set") {
    const baseUrl = requireFlag(getStringFlag(parsed, "--base-url"), "--base-url");
    const token = requireFlag(getStringFlag(parsed, "--token"), "--token");
    const timeoutValue = getStringFlag(parsed, "--timeout-ms");
    const timeoutMs = timeoutValue !== undefined ? Number.parseInt(timeoutValue, 10) : undefined;

    if (timeoutValue !== undefined && !Number.isFinite(timeoutMs)) {
      throw new CliError("Option --timeout-ms expects an integer", 2);
    }

    const { configPath, config } = await saveAuthConfig({
      baseUrl,
      token,
      timeoutMs,
    });

    const resolved = resolveTwentyConfig(config);
    const payload = {
      configPath,
      provider: {
        baseUrl: resolved.baseUrl,
        token: maskToken(resolved.token),
        timeoutMs: resolved.timeoutMs,
      },
    };

    printJson(payload);
    return;
  }

  if (action === "show") {
    const resolved = resolveTwentyConfig(await readConfig());
    const payload = {
      provider: {
        baseUrl: resolved.baseUrl,
        token: maskToken(resolved.token),
        timeoutMs: resolved.timeoutMs,
      },
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJson(payload);
      return;
    }

    printHuman(payload);
    return;
  }

  if (action === "clear") {
    const { configPath } = await clearAuthConfig();
    printJson({ ok: true, configPath });
    return;
  }

  throw new CliError(`Unknown auth action: ${action}`, 2);
}

function printHelp(): void {
  printLine("Twenty auth commands");
  printLine("");
  printLine("Usage:");
  printLine("  twenty auth set --base-url <url> --token <token> [--timeout-ms <ms>]");
  printLine("  twenty auth show [--json]");
  printLine("  twenty auth clear");
}
