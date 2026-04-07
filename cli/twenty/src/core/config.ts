import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ResolvedTwentyConfig, TwentyCliConfig, TwentyContextConfig, TwentyProviderConfig } from "../types/config.ts";
import { CliError } from "./errors.ts";

export const DEFAULT_TIMEOUT_MS = 30_000;

function defaultConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "twenty-cli");
  }

  return path.join(homedir(), ".config", "twenty-cli");
}

export function getConfigPath(): string {
  if (process.env.TWENTY_CONFIG_PATH) {
    return path.resolve(process.env.TWENTY_CONFIG_PATH);
  }

  return path.join(defaultConfigDir(), "config.json");
}

export async function readConfig(): Promise<TwentyCliConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    return (JSON.parse(raw) as TwentyCliConfig) ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw new CliError(`Failed to read config from ${configPath}: ${(error as Error).message}`);
  }
}

export async function writeConfig(config: TwentyCliConfig): Promise<string> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath, 0o600);

  return configPath;
}

export async function saveAuthConfig(
  nextConfig: Partial<TwentyProviderConfig>,
): Promise<{ configPath: string; config: TwentyCliConfig }> {
  const current = await readConfig();
  const merged: TwentyCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      ...nextConfig,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function clearAuthConfig(): Promise<{ configPath: string; config: TwentyCliConfig }> {
  const current = await readConfig();
  const merged: TwentyCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      token: undefined,
      baseUrl: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function saveContextConfig(
  context: TwentyContextConfig,
): Promise<{ configPath: string; config: TwentyCliConfig }> {
  const current = await readConfig();
  const merged: TwentyCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      context: {
        ...current.provider?.context,
        ...context,
      },
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function clearContextConfig(): Promise<{ configPath: string; config: TwentyCliConfig }> {
  const current = await readConfig();
  const merged: TwentyCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      context: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export function resolveTwentyConfig(config: TwentyCliConfig): ResolvedTwentyConfig {
  const provider = config.provider ?? {};
  const timeoutCandidate = process.env.TWENTY_TIMEOUT_MS ?? (provider.timeoutMs !== undefined ? String(provider.timeoutMs) : undefined);
  const timeoutMs = timeoutCandidate !== undefined ? Number.parseInt(timeoutCandidate, 10) : DEFAULT_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CliError("TWENTY_TIMEOUT_MS must be a positive integer.", 2);
  }

  return {
    baseUrl: normalizeBaseUrl(process.env.TWENTY_BASE_URL ?? provider.baseUrl),
    token: process.env.TWENTY_TOKEN ?? provider.token,
    timeoutMs,
    context: {
      depth: process.env.TWENTY_DEPTH ? Number.parseInt(process.env.TWENTY_DEPTH, 10) : provider.context?.depth,
      limit: process.env.TWENTY_LIMIT ? Number.parseInt(process.env.TWENTY_LIMIT, 10) : provider.context?.limit,
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
    return new URL(normalized).toString();
  } catch {
    throw new CliError(`Invalid Twenty base URL: ${value}`, 2);
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
