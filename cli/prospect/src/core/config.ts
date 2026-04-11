import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ProspectCliConfig, ProspectProviderConfig, ResolvedProspectConfig } from "../types/config.ts";
import { CliError } from "./errors.ts";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_APOLLO_BASE_URL = "https://api.apollo.io";
export const DEFAULT_PROVIDER_ORDER = ["apollo"];

function defaultConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "prospect-cli");
  }

  return path.join(homedir(), ".config", "prospect-cli");
}

export function getConfigPath(): string {
  if (process.env.PROSPECT_CONFIG_PATH) {
    return path.resolve(process.env.PROSPECT_CONFIG_PATH);
  }

  return path.join(defaultConfigDir(), "config.json");
}

export async function readConfig(): Promise<ProspectCliConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    return (JSON.parse(raw) as ProspectCliConfig) ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw new CliError(`Failed to read config from ${configPath}: ${(error as Error).message}`);
  }
}

async function writeConfig(config: ProspectCliConfig): Promise<string> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath, 0o600);

  return configPath;
}

export async function saveProviderConfig(
  provider: "apollo",
  config: ProspectProviderConfig,
): Promise<{ configPath: string; config: ProspectCliConfig }> {
  const current = await readConfig();
  const merged: ProspectCliConfig = {
    ...current,
    providers: {
      ...current.providers,
      [provider]: {
        ...current.providers?.[provider],
        ...config,
      },
    },
  };

  return {
    configPath: await writeConfig(merged),
    config: merged,
  };
}

export async function clearProviderConfig(
  provider: "apollo",
): Promise<{ configPath: string; config: ProspectCliConfig }> {
  const current = await readConfig();
  const merged: ProspectCliConfig = {
    ...current,
    providers: {
      ...current.providers,
      [provider]: {},
    },
  };

  return {
    configPath: await writeConfig(merged),
    config: merged,
  };
}

export function resolveConfig(config: ProspectCliConfig): ResolvedProspectConfig {
  const timeoutCandidate =
    process.env.PROSPECT_TIMEOUT_MS ??
    (config.defaults?.timeoutMs !== undefined ? String(config.defaults.timeoutMs) : undefined);
  const timeoutMs = timeoutCandidate !== undefined ? Number.parseInt(timeoutCandidate, 10) : DEFAULT_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CliError("PROSPECT_TIMEOUT_MS must be a positive integer.", 2);
  }

  const apolloBaseUrl = normalizeBaseUrl(process.env.APOLLO_BASE_URL ?? config.providers?.apollo?.baseUrl ?? DEFAULT_APOLLO_BASE_URL);
  const providerOrder = config.defaults?.providerOrder?.length ? config.defaults.providerOrder : DEFAULT_PROVIDER_ORDER;

  return {
    providers: {
      apollo: {
        apiKey: process.env.APOLLO_API_KEY ?? config.providers?.apollo?.apiKey,
        baseUrl: apolloBaseUrl,
      },
    },
    defaults: {
      providerOrder,
      timeoutMs,
    },
  };
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  try {
    return new URL(normalized).toString().replace(/\/$/, "");
  } catch {
    throw new CliError(`Invalid base URL: ${value}`, 2);
  }
}

export function maskToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
