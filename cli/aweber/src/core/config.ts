import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { CliError } from "./errors.ts";
import type {
  AweberCliConfig,
  AweberClientType,
  AweberContextConfig,
  AweberPendingAuth,
  AweberProviderConfig,
  AweberTokenSet,
  ResolvedAweberConfig,
} from "../types/config.ts";

export const AWEBER_DEFAULT_SCOPES = [
  "account.read",
  "landing-page.read",
  "list.read",
  "list.write",
  "subscriber.read",
  "subscriber.write",
  "subscriber.read-extended",
  "email.read",
  "email.write",
];

export const DEFAULT_PUBLIC_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
export const DEFAULT_CLIENT_TYPE: AweberClientType = "public";

function defaultConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "aweber-cli");
  }

  return path.join(homedir(), ".config", "aweber-cli");
}

export function getConfigPath(): string {
  if (process.env.AWEBER_CONFIG_PATH) {
    return path.resolve(process.env.AWEBER_CONFIG_PATH);
  }

  return path.join(defaultConfigDir(), "config.json");
}

export async function readConfig(): Promise<AweberCliConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    return (JSON.parse(raw) as AweberCliConfig) ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw new CliError(`Failed to read config from ${configPath}: ${(error as Error).message}`);
  }
}

export async function writeConfig(config: AweberCliConfig): Promise<string> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath, 0o600);

  return configPath;
}

export async function saveAweberAuthConfig(
  nextConfig: Partial<AweberProviderConfig>,
): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      ...nextConfig,
      clientType: nextConfig.clientType ?? current.provider?.clientType ?? DEFAULT_CLIENT_TYPE,
      redirectUri:
        nextConfig.redirectUri ??
        current.provider?.redirectUri ??
        ((nextConfig.clientType ?? current.provider?.clientType ?? DEFAULT_CLIENT_TYPE) === "public"
          ? DEFAULT_PUBLIC_REDIRECT_URI
          : undefined),
      scopes: nextConfig.scopes ?? current.provider?.scopes ?? AWEBER_DEFAULT_SCOPES,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function saveAweberTokens(tokens: AweberTokenSet): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      tokens,
      pendingAuth: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function clearAweberTokens(): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      tokens: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function saveAweberPendingAuth(
  pendingAuth: AweberPendingAuth,
): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      pendingAuth,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function clearAweberPendingAuth(): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      pendingAuth: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function saveAweberContext(
  context: AweberContextConfig,
): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
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

export async function clearAweberContext(): Promise<{ configPath: string; config: AweberCliConfig }> {
  const current = await readConfig();
  const merged: AweberCliConfig = {
    ...current,
    provider: {
      ...current.provider,
      context: undefined,
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export function resolveAweberConfig(config: AweberCliConfig): ResolvedAweberConfig {
  const fromFile = config.provider ?? {};
  const clientType = resolveClientType(process.env.AWEBER_CLIENT_TYPE ?? fromFile.clientType);
  const redirectUri = process.env.AWEBER_REDIRECT_URI ?? fromFile.redirectUri ?? DEFAULT_PUBLIC_REDIRECT_URI;
  const scopes = process.env.AWEBER_SCOPES
    ? process.env.AWEBER_SCOPES.split(",").map((scope) => scope.trim()).filter(Boolean)
    : fromFile.scopes ?? AWEBER_DEFAULT_SCOPES;

  const envAccessToken = process.env.AWEBER_ACCESS_TOKEN;
  const envRefreshToken = process.env.AWEBER_REFRESH_TOKEN;
  const tokens: AweberTokenSet = envAccessToken || envRefreshToken
    ? {
        ...fromFile.tokens,
        accessToken: envAccessToken ?? fromFile.tokens?.accessToken,
        refreshToken: envRefreshToken ?? fromFile.tokens?.refreshToken,
        tokenType: fromFile.tokens?.tokenType ?? "bearer",
      }
    : (fromFile.tokens ?? {});

  return {
    clientId: process.env.AWEBER_CLIENT_ID ?? fromFile.clientId,
    clientSecret: process.env.AWEBER_CLIENT_SECRET ?? fromFile.clientSecret,
    redirectUri,
    clientType,
    scopes,
    tokens,
    pendingAuth: fromFile.pendingAuth,
    context: {
      accountId: process.env.AWEBER_ACCOUNT_ID ?? fromFile.context?.accountId,
      listId: process.env.AWEBER_LIST_ID ?? fromFile.context?.listId,
    },
  };
}

export function requireResolvedAweberConfig(config: AweberCliConfig): ResolvedAweberConfig {
  const resolved = resolveAweberConfig(config);

  if (!resolved.clientId) {
    throw new CliError(
      "Missing AWeber client ID. Run `aweber auth set --client-id ...` or set AWEBER_CLIENT_ID.",
      2,
    );
  }

  if (resolved.clientType === "confidential" && !resolved.clientSecret) {
    throw new CliError(
      "Confidential AWeber clients require a client secret. Run `aweber auth set --client-secret ...` or set AWEBER_CLIENT_SECRET.",
      2,
    );
  }

  return resolved;
}

export function redactAweberConfig(config: AweberProviderConfig | ResolvedAweberConfig | undefined): Record<string, unknown> {
  return {
    clientId: config?.clientId ?? null,
    clientSecret: config?.clientSecret ? "********" : null,
    redirectUri: config?.redirectUri ?? DEFAULT_PUBLIC_REDIRECT_URI,
    clientType: config?.clientType ?? DEFAULT_CLIENT_TYPE,
    scopes: config?.scopes ?? AWEBER_DEFAULT_SCOPES,
    tokens: {
      accessToken: config?.tokens?.accessToken ? "********" : null,
      refreshToken: config?.tokens?.refreshToken ? "********" : null,
      tokenType: config?.tokens?.tokenType ?? null,
      expiryDate: config?.tokens?.expiryDate ?? null,
    },
    pendingAuth: {
      state: config?.pendingAuth?.state ?? null,
      scopes: config?.pendingAuth?.scopes ?? [],
      hasCodeVerifier: Boolean(config?.pendingAuth?.codeVerifier),
      createdAt: config?.pendingAuth?.createdAt ?? null,
    },
    context: {
      accountId: config?.context?.accountId ?? null,
      listId: config?.context?.listId ?? null,
    },
  };
}

function resolveClientType(value: string | undefined): AweberClientType {
  if (!value) {
    return DEFAULT_CLIENT_TYPE;
  }

  if (value !== "public" && value !== "confidential") {
    throw new CliError("`AWEBER_CLIENT_TYPE` must be `public` or `confidential`.", 2);
  }

  return value;
}
