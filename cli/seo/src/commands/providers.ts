import { parseArgs, getBooleanFlag, getStringFlag } from "../core/args.ts";
import {
  getConfigPath,
  readConfig,
  redactDataForSeoConfig,
  saveDataForSeoConfig,
} from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";

const PROVIDER_SCHEMA = {
  "--login": "string",
  "--password": "string",
  "--base-url": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runProvidersCommand(argv: string[]): Promise<void> {
  const [action, provider, ...rest] = argv;

  if (!action || getBooleanFlag(parseArgs(rest, PROVIDER_SCHEMA), "--help")) {
    printProvidersHelp();
    return;
  }

  if (provider !== "dataforseo") {
    throw new CliError("Only `dataforseo` is supported right now.", 2);
  }

  if (action === "set") {
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    const login = getStringFlag(parsed, "--login");
    const password = getStringFlag(parsed, "--password");
    const baseUrl = getStringFlag(parsed, "--base-url");
    const asJson = getBooleanFlag(parsed, "--json");

    if (!login || !password) {
      throw new CliError("`seo providers set dataforseo` requires `--login` and `--password`.", 2);
    }

    const { config, configPath } = await saveDataForSeoConfig({ login, password, baseUrl });
    const result = {
      ok: true,
      provider: "dataforseo",
      configPath,
      config: redactDataForSeoConfig(config.providers?.dataforseo),
    };

    if (asJson) {
      printJson(result);
      return;
    }

    printLine(`Stored DataForSEO config at ${configPath}`);
    printLine(`Login: ${result.config.login}`);
    printLine(`Base URL: ${result.config.baseUrl}`);
    return;
  }

  if (action === "show") {
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    const config = await readConfig();
    const result = {
      provider: "dataforseo",
      configPath: getConfigPath(),
      config: redactDataForSeoConfig(config.providers?.dataforseo),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJson(result);
      return;
    }

    printLine(`Config path: ${result.configPath}`);
    printLine(`Login: ${result.config.login ?? "(not set)"}`);
    printLine(`Password: ${result.config.password ?? "(not set)"}`);
    printLine(`Base URL: ${result.config.baseUrl}`);
    return;
  }

  throw new CliError(`Unknown providers action: ${action}`, 2);
}

function printProvidersHelp(): void {
  printLine("Usage:");
  printLine("  seo providers set dataforseo --login <login> --password <password> [--base-url <url>] [--json]");
  printLine("  seo providers show dataforseo [--json]");
}
