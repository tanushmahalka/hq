import { getBooleanFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { clearProviderConfig, maskToken, readConfig, resolveConfig, saveProviderConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";

const AUTH_SCHEMA = {
  "--api-key": "string",
  "--base-url": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runAuthCommand(argv: string[]): Promise<void> {
  const [action = "help", providerOrFlag, ...rest] = argv;

  if (action === "help" || action === "--help") {
    printHelp();
    return;
  }

  if (action === "show") {
    const parsed = parseArgs([providerOrFlag, ...rest].filter(Boolean) as string[], AUTH_SCHEMA);
    const resolved = resolveConfig(await readConfig());
    const payload = {
      providers: {
        apollo: {
          baseUrl: resolved.providers.apollo.baseUrl,
          apiKey: maskToken(resolved.providers.apollo.apiKey),
        },
      },
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJson(payload);
      return;
    }

    printLine(`Apollo base URL: ${payload.providers.apollo.baseUrl ?? "(not set)"}`);
    printLine(`Apollo API key: ${payload.providers.apollo.apiKey ?? "(not set)"}`);
    return;
  }

  if (providerOrFlag !== "apollo") {
    throw new CliError("V1 only supports the `apollo` provider.", 2);
  }

  const parsed = parseArgs(rest, AUTH_SCHEMA);
  if (getBooleanFlag(parsed, "--help")) {
    printHelp();
    return;
  }

  if (action === "set") {
    const apiKey = requireFlag(getStringFlag(parsed, "--api-key"), "--api-key");
    const baseUrl = getStringFlag(parsed, "--base-url");
    const { configPath, config } = await saveProviderConfig("apollo", {
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    });
    const resolved = resolveConfig(config);

    printJson({
      ok: true,
      configPath,
      providers: {
        apollo: {
          baseUrl: resolved.providers.apollo.baseUrl,
          apiKey: maskToken(resolved.providers.apollo.apiKey),
        },
      },
    });
    return;
  }

  if (action === "clear") {
    const { configPath } = await clearProviderConfig("apollo");
    printJson({ ok: true, configPath, provider: "apollo" });
    return;
  }

  throw new CliError(`Unknown auth action: ${action}`, 2);
}

function printHelp(): void {
  printLine("Prospect auth commands");
  printLine("");
  printLine("Usage:");
  printLine("  prospect auth set apollo --api-key <key> [--base-url <url>]");
  printLine("  prospect auth show [--json]");
  printLine("  prospect auth clear apollo");
}
