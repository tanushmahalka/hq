import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { CliError } from "./errors.ts";
import type {
  DataForSeoProviderConfig,
  ResolvedDataForSeoProviderConfig,
  SeoCliConfig,
} from "../types/config.ts";

const DEFAULT_DATAFORSEO_BASE_URL = "https://api.dataforseo.com";

function defaultConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "seo-cli");
  }

  return path.join(homedir(), ".config", "seo-cli");
}

export function getConfigPath(): string {
  if (process.env.SEO_CLI_CONFIG_PATH) {
    return path.resolve(process.env.SEO_CLI_CONFIG_PATH);
  }

  return path.join(defaultConfigDir(), "config.json");
}

export async function readConfig(): Promise<SeoCliConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as SeoCliConfig;
    return parsed ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw new CliError(`Failed to read config from ${configPath}: ${(error as Error).message}`);
  }
}

export async function writeConfig(config: SeoCliConfig): Promise<string> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(configPath, 0o600);

  return configPath;
}

export async function saveDataForSeoConfig(
  nextConfig: DataForSeoProviderConfig,
): Promise<{ configPath: string; config: SeoCliConfig }> {
  const current = await readConfig();
  const merged: SeoCliConfig = {
    ...current,
    providers: {
      ...current.providers,
      dataforseo: {
        ...current.providers?.dataforseo,
        ...nextConfig,
        baseUrl: nextConfig.baseUrl ?? current.providers?.dataforseo?.baseUrl ?? DEFAULT_DATAFORSEO_BASE_URL,
      },
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export function resolveDataForSeoConfig(config: SeoCliConfig): ResolvedDataForSeoProviderConfig {
  const fromFile = config.providers?.dataforseo ?? {};
  const login = process.env.DATAFORSEO_LOGIN ?? fromFile.login;
  const password = process.env.DATAFORSEO_PASSWORD ?? fromFile.password;
  const baseUrl = process.env.DATAFORSEO_BASE_URL ?? fromFile.baseUrl ?? DEFAULT_DATAFORSEO_BASE_URL;

  if (!login || !password) {
    throw new CliError(
      "Missing DataForSEO credentials. Run `seo providers set dataforseo --login ... --password ...` or set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.",
      2,
    );
  }

  return { login, password, baseUrl };
}

export function redactDataForSeoConfig(config: Partial<DataForSeoProviderConfig> | undefined): Record<string, string | null> {
  return {
    login: config?.login ?? null,
    password: config?.password ? "********" : null,
    baseUrl: config?.baseUrl ?? DEFAULT_DATAFORSEO_BASE_URL,
  };
}
