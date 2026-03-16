import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { CliError } from "./errors.ts";
import type {
  DataForSeoProviderConfig,
  GoogleOAuthProviderConfig,
  GoogleOAuthApplicationType,
  GoogleOAuthTokenSet,
  ResolvedGoogleOAuthProviderConfig,
  ResolvedDataForSeoProviderConfig,
  SeoCliConfig,
} from "../types/config.ts";

const DEFAULT_DATAFORSEO_BASE_URL = "https://api.dataforseo.com";
const DEFAULT_GOOGLE_APPLICATION_TYPE: GoogleOAuthApplicationType = "web";
const DEFAULT_GOOGLE_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

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

export async function saveGoogleOAuthConfig(
  nextConfig: GoogleOAuthProviderConfig,
): Promise<{ configPath: string; config: SeoCliConfig }> {
  const current = await readConfig();
  const merged: SeoCliConfig = {
    ...current,
    providers: {
      ...current.providers,
      google: {
        ...current.providers?.google,
        ...nextConfig,
        applicationType:
          nextConfig.applicationType ??
          current.providers?.google?.applicationType ??
          DEFAULT_GOOGLE_APPLICATION_TYPE,
        scopes: nextConfig.scopes ?? current.providers?.google?.scopes ?? DEFAULT_GOOGLE_SCOPES,
      },
    },
  };

  const configPath = await writeConfig(merged);
  return { configPath, config: merged };
}

export async function saveGoogleOAuthTokens(
  tokens: GoogleOAuthTokenSet,
): Promise<{ configPath: string; config: SeoCliConfig }> {
  const current = await readConfig();
  const merged: SeoCliConfig = {
    ...current,
    providers: {
      ...current.providers,
      google: {
        ...current.providers?.google,
        tokens,
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

export function resolveGoogleOAuthConfig(config: SeoCliConfig): ResolvedGoogleOAuthProviderConfig {
  const fromFile = config.providers?.google ?? {};
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? fromFile.clientId;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? fromFile.clientSecret;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? fromFile.redirectUri;
  const applicationType =
    (process.env.GOOGLE_OAUTH_APPLICATION_TYPE as GoogleOAuthApplicationType | undefined) ??
    fromFile.applicationType ??
    DEFAULT_GOOGLE_APPLICATION_TYPE;
  const scopes = process.env.GOOGLE_OAUTH_SCOPES
    ? process.env.GOOGLE_OAUTH_SCOPES.split(",").map((scope) => scope.trim()).filter(Boolean)
    : fromFile.scopes ?? DEFAULT_GOOGLE_SCOPES;

  if (!clientId) {
    throw new CliError(
      "Missing Google OAuth settings. Run `seo providers set google --client-id ...` or set GOOGLE_OAUTH_CLIENT_ID.",
      2,
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    applicationType,
    scopes,
    tokens: fromFile.tokens,
  };
}

export function redactDataForSeoConfig(config: Partial<DataForSeoProviderConfig> | undefined): Record<string, string | null> {
  return {
    login: config?.login ?? null,
    password: config?.password ? "********" : null,
    baseUrl: config?.baseUrl ?? DEFAULT_DATAFORSEO_BASE_URL,
  };
}

export function redactGoogleOAuthConfig(
  config: Partial<GoogleOAuthProviderConfig> | undefined,
): {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  applicationType: GoogleOAuthApplicationType;
  scopes: string[];
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenType: string | null;
    scope: string[];
    expiryDate: string | null;
  };
} {
  return {
    clientId: config?.clientId ?? null,
    clientSecret: config?.clientSecret ? "********" : null,
    redirectUri: config?.redirectUri ?? null,
    applicationType: config?.applicationType ?? DEFAULT_GOOGLE_APPLICATION_TYPE,
    scopes: config?.scopes ?? DEFAULT_GOOGLE_SCOPES,
    tokens: {
      accessToken: config?.tokens?.accessToken ? "********" : null,
      refreshToken: config?.tokens?.refreshToken ? "********" : null,
      tokenType: config?.tokens?.tokenType ?? null,
      scope: config?.tokens?.scope ?? [],
      expiryDate: config?.tokens?.expiryDate ?? null,
    },
  };
}
