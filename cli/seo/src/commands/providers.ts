import { parseArgs, getBooleanFlag, getStringFlag } from "../core/args.ts";
import {
  clearGoogleOAuthPendingAuth,
  getConfigPath,
  readConfig,
  redactDataForSeoConfig,
  redactGoogleOAuthConfig,
  redactOpenRouterConfig,
  resolveGoogleOAuthConfig,
  saveDataForSeoConfig,
  saveGoogleOAuthConfig,
  saveGoogleOAuthPendingAuth,
  saveGoogleOAuthTokens,
  saveOpenRouterConfig,
} from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";
import {
  buildGoogleOAuthLoginUrl,
  exchangeGoogleAuthorizationCode,
  generateGooglePkcePair,
  parseGoogleOAuthCallback,
} from "../providers/google/oauth.ts";
import type { GoogleOAuthApplicationType } from "../types/config.ts";

const PROVIDER_SCHEMA = {
  "--login": "string",
  "--password": "string",
  "--base-url": "string",
  "--api-key": "string",
  "--client-id": "string",
  "--client-secret": "string",
  "--redirect-uri": "string",
  "--application-type": "string",
  "--scope": "string[]",
  "--state": "string",
  "--access-type": "string",
  "--prompt": "string",
  "--login-hint": "string",
  "--code-challenge": "string",
  "--code-challenge-method": "string",
  "--callback-url": "string",
  "--code": "string",
  "--pkce": "boolean",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runProvidersCommand(argv: string[]): Promise<void> {
  const [action, provider, ...rest] = argv;

  if (!action || getBooleanFlag(parseArgs(rest, PROVIDER_SCHEMA), "--help")) {
    printProvidersHelp();
    return;
  }

  if (action === "set") {
    await runSetProvider(provider, parseArgs(rest, PROVIDER_SCHEMA));
    return;
  }

  if (action === "show") {
    await runShowProvider(provider, parseArgs(rest, PROVIDER_SCHEMA));
    return;
  }

  if (action === "auth" || action === "login-url") {
    await runProviderAuth(provider, parseArgs(rest, PROVIDER_SCHEMA));
    return;
  }

  if (action === "exchange-code") {
    await runProviderExchangeCode(provider, parseArgs(rest, PROVIDER_SCHEMA));
    return;
  }

  throw new CliError(`Unknown providers action: ${action}`, 2);
}

function printProvidersHelp(): void {
  printLine("Usage:");
  printLine("  seo providers set dataforseo --login <login> --password <password> [--base-url <url>] [--json]");
  printLine("  seo providers show dataforseo [--json]");
  printLine("  seo providers set openrouter --api-key <key> [--base-url <url>] [--json]");
  printLine("  seo providers show openrouter [--json]");
  printLine("  seo providers set google --client-id <id> --client-secret <secret> --redirect-uri <uri> [--application-type <web|desktop>] [--scope <scope> ...] [--json]");
  printLine("  seo providers show google [--json]");
  printLine("  seo providers auth google [--scope <scope> ...] [--state <state>] [--access-type <online|offline>] [--prompt <value>] [--login-hint <email>] [--pkce] [--json]");
  printLine("  seo providers exchange-code google (--callback-url <url> | --code <code>) [--state <state>] [--json]");
}

async function runSetProvider(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  if (provider === "dataforseo") {
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

  if (provider === "google") {
    const clientId = getStringFlag(parsed, "--client-id");
    const clientSecret = getStringFlag(parsed, "--client-secret");
    const redirectUri = getStringFlag(parsed, "--redirect-uri");
    const applicationType = parseGoogleApplicationType(getStringFlag(parsed, "--application-type"));
    const scopes = getStringArrayFlagOrUndefined(parsed, "--scope");
    const asJson = getBooleanFlag(parsed, "--json");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new CliError(
        "`seo providers set google` requires `--client-id`, `--client-secret`, and `--redirect-uri`.",
        2,
      );
    }

    const { config, configPath } = await saveGoogleOAuthConfig({
      clientId,
      clientSecret,
      redirectUri,
      applicationType,
      scopes,
    });
    const result = {
      ok: true,
      provider: "google",
      configPath,
      config: redactGoogleOAuthConfig(config.providers?.google),
    };

    if (asJson) {
      printJson(result);
      return;
    }

    printLine(`Stored Google OAuth config at ${configPath}`);
    printLine(`Client ID: ${result.config.clientId}`);
    printLine(`Redirect URI: ${result.config.redirectUri ?? "(not set)"}`);
    printLine(`Application Type: ${result.config.applicationType}`);
    printLine(`Scopes: ${result.config.scopes.join(", ")}`);
    printLine(`Pending Auth: ${result.config.pendingAuth.state ? "yes" : "no"}`);
    if (result.config.tokens.accessToken) {
      printLine("Stored Tokens: yes");
    }
    return;
  }

  if (provider === "openrouter") {
    const apiKey = getStringFlag(parsed, "--api-key");
    const baseUrl = getStringFlag(parsed, "--base-url");
    const asJson = getBooleanFlag(parsed, "--json");

    if (!apiKey) {
      throw new CliError("`seo providers set openrouter` requires `--api-key`.", 2);
    }

    const { config, configPath } = await saveOpenRouterConfig({ apiKey, baseUrl });
    const result = {
      ok: true,
      provider: "openrouter",
      configPath,
      config: redactOpenRouterConfig(config.providers?.openrouter),
    };

    if (asJson) {
      printJson(result);
      return;
    }

    printLine(`Stored OpenRouter config at ${configPath}`);
    printLine(`API Key: ${result.config.apiKey}`);
    printLine(`Base URL: ${result.config.baseUrl}`);
    return;
  }

  throw new CliError("Supported providers: `dataforseo`, `openrouter`, `google`.", 2);
}

async function runShowProvider(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  const config = await readConfig();

  if (provider === "dataforseo") {
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

  if (provider === "google") {
    const result = {
      provider: "google",
      configPath: getConfigPath(),
      config: redactGoogleOAuthConfig(config.providers?.google),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJson(result);
      return;
    }

    printLine(`Config path: ${result.configPath}`);
    printLine(`Client ID: ${result.config.clientId ?? "(not set)"}`);
    printLine(`Client Secret: ${result.config.clientSecret ?? "(not set)"}`);
    printLine(`Redirect URI: ${result.config.redirectUri ?? "(not set)"}`);
    printLine(`Application Type: ${result.config.applicationType}`);
    printLine(`Scopes: ${result.config.scopes.join(", ")}`);
    printLine(`Pending Auth: ${result.config.pendingAuth.state ? "yes" : "no"}`);
    if (result.config.pendingAuth.state) {
      printLine(`Pending State: ${result.config.pendingAuth.state}`);
    }
    return;
  }

  if (provider === "openrouter") {
    const result = {
      provider: "openrouter",
      configPath: getConfigPath(),
      config: redactOpenRouterConfig(config.providers?.openrouter),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJson(result);
      return;
    }

    printLine(`Config path: ${result.configPath}`);
    printLine(`API Key: ${result.config.apiKey ?? "(not set)"}`);
    printLine(`Base URL: ${result.config.baseUrl}`);
    return;
  }

  throw new CliError("Supported providers: `dataforseo`, `openrouter`, `google`.", 2);
}

async function runProviderAuth(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  if (provider !== "google") {
    throw new CliError("`seo providers auth` currently supports only `google`.", 2);
  }

  const resolved = resolveGoogleOAuthConfig(await readConfig());
  if (!resolved.redirectUri) {
    throw new CliError("Google web auth requires a redirect URI. Run `seo providers set google --redirect-uri ...` first.", 2);
  }

  const scopes = getStringArrayFlagOrUndefined(parsed, "--scope");
  const state = getStringFlag(parsed, "--state");
  const accessType = getStringFlag(parsed, "--access-type");
  const prompt = getStringFlag(parsed, "--prompt");
  const loginHint = getStringFlag(parsed, "--login-hint");
  const asJson = getBooleanFlag(parsed, "--json");
  const usePkce = getBooleanFlag(parsed, "--pkce");
  let codeChallenge = getStringFlag(parsed, "--code-challenge");
  let codeChallengeMethod = getStringFlag(parsed, "--code-challenge-method");
  let codeVerifier: string | undefined;

  if (accessType && accessType !== "online" && accessType !== "offline") {
    throw new CliError("`--access-type` must be `online` or `offline`.", 2);
  }

  if (usePkce) {
    const pkcePair = generateGooglePkcePair();
    codeVerifier = pkcePair.codeVerifier;
    codeChallenge = pkcePair.codeChallenge;
    codeChallengeMethod = pkcePair.codeChallengeMethod;
  }

  const login = buildGoogleOAuthLoginUrl({
    config: resolved,
    scopes,
    state,
    accessType: accessType as "online" | "offline" | undefined,
    prompt,
    loginHint,
    codeChallenge,
    codeChallengeMethod: codeChallengeMethod as "S256" | "plain" | undefined,
  });

  const { configPath } = await saveGoogleOAuthPendingAuth({
    state: login.state,
    scopes: scopes ?? resolved.scopes,
    accessType: (accessType as "online" | "offline" | undefined) ?? "offline",
    prompt,
    loginHint,
    codeVerifier,
    createdAt: new Date().toISOString(),
  });

  const payload = {
    ok: true,
    provider: "google",
    flow: "manual-copy-paste",
    configPath,
    applicationType: resolved.applicationType,
    redirectUri: resolved.redirectUri,
    scopes: scopes ?? resolved.scopes,
    state: login.state,
    loginUrl: login.url,
    ...(codeVerifier ? { codeVerifier } : {}),
  };

  if (asJson) {
    printJson(payload);
    return;
  }

  printLine("Google auth session started");
  printLine(`Redirect URI: ${payload.redirectUri}`);
  printLine(`State: ${payload.state}`);
  if (codeVerifier) {
    printLine(`Code Verifier: ${codeVerifier}`);
  }
  printLine(`Login URL: ${payload.loginUrl}`);
  printLine("Next: have the user open the login URL and paste back the final callback URL after Google redirects them.");
}

async function runProviderExchangeCode(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  if (provider !== "google") {
    throw new CliError("`seo providers exchange-code` currently supports only `google`.", 2);
  }

  const resolved = resolveGoogleOAuthConfig(await readConfig());
  if (!resolved.redirectUri) {
    throw new CliError("Google code exchange requires a redirect URI. Run `seo providers set google --redirect-uri ...` first.", 2);
  }

  const callbackUrl = getStringFlag(parsed, "--callback-url");
  const explicitCode = getStringFlag(parsed, "--code");
  const explicitState = getStringFlag(parsed, "--state");
  const asJson = getBooleanFlag(parsed, "--json");

  if (!callbackUrl && !explicitCode) {
    throw new CliError("`seo providers exchange-code google` requires either `--callback-url` or `--code`.", 2);
  }

  const parsedCallback = callbackUrl ? parseGoogleOAuthCallback(callbackUrl) : {};
  if (parsedCallback.error) {
    throw new CliError(
      `Google OAuth returned an error: ${parsedCallback.errorDescription ? `${parsedCallback.error} (${parsedCallback.errorDescription})` : parsedCallback.error}`,
      2,
    );
  }

  const code = explicitCode ?? parsedCallback.code;
  const state = explicitState ?? parsedCallback.state;
  if (!code) {
    throw new CliError("No authorization code was found. Pass `--code` or a callback URL containing `?code=...`.", 2);
  }

  const pendingAuth = resolved.pendingAuth;
  if (pendingAuth?.state && !state) {
    throw new CliError("Expected the pasted callback URL to include `state` so the pending Google auth session can be validated.", 2);
  }

  if (pendingAuth?.state && state !== pendingAuth.state) {
    throw new CliError("Callback state did not match the pending Google auth session.", 2);
  }

  const tokens = await exchangeGoogleAuthorizationCode({
    config: resolved,
    code,
    codeVerifier: pendingAuth?.codeVerifier,
  });
  const { configPath } = await saveGoogleOAuthTokens(tokens);
  await clearGoogleOAuthPendingAuth();

  const payload = {
    ok: true,
    provider: "google",
    configPath,
    tokens: {
      accessToken: "********",
      refreshToken: tokens.refreshToken ? "********" : null,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      expiryDate: tokens.expiryDate ?? null,
    },
  };

  if (asJson) {
    printJson(payload);
    return;
  }

  printLine("Google authorization completed");
  printLine(`Config path: ${configPath}`);
  printLine(`Token type: ${tokens.tokenType}`);
  printLine(`Scopes: ${tokens.scope.join(", ")}`);
  printLine(`Expires at: ${tokens.expiryDate ?? "(not provided)"}`);
}

function parseGoogleApplicationType(value: string | undefined): GoogleOAuthApplicationType | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "web" || value === "desktop") {
    return value;
  }

  throw new CliError("`--application-type` must be `web` or `desktop`.", 2);
}

function getStringArrayFlagOrUndefined(
  parsed: ReturnType<typeof parseArgs>,
  flag: "--scope",
): string[] | undefined {
  const values = parsed.flags[flag];

  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  return values;
}
