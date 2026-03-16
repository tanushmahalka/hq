import { parseArgs, getBooleanFlag, getStringFlag } from "../core/args.ts";
import {
  getConfigPath,
  readConfig,
  redactDataForSeoConfig,
  redactGoogleOAuthConfig,
  resolveGoogleOAuthConfig,
  saveDataForSeoConfig,
  saveGoogleOAuthConfig,
  saveGoogleOAuthTokens,
} from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";
import { GoogleDeviceAuthClient } from "../providers/google/device-auth.ts";
import { buildGoogleOAuthLoginUrl, generateGooglePkcePair } from "../providers/google/oauth.ts";
import type { GoogleOAuthApplicationType } from "../types/config.ts";

const PROVIDER_SCHEMA = {
  "--login": "string",
  "--password": "string",
  "--base-url": "string",
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
  "--timeout-seconds": "string",
  "--interval-seconds": "string",
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
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    await runSetProvider(provider, parsed);
    return;
  }

  if (action === "show") {
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    await runShowProvider(provider, parsed);
    return;
  }

  if (action === "login-url") {
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    await runProviderLoginUrl(provider, parsed);
    return;
  }

  if (action === "auth") {
    const parsed = parseArgs(rest, PROVIDER_SCHEMA);
    await runProviderAuth(provider, parsed);
    return;
  }

  throw new CliError(`Unknown providers action: ${action}`, 2);
}

function printProvidersHelp(): void {
  printLine("Usage:");
  printLine("  seo providers set dataforseo --login <login> --password <password> [--base-url <url>] [--json]");
  printLine("  seo providers show dataforseo [--json]");
  printLine("  seo providers set google --client-id <id> [--redirect-uri <uri>] [--client-secret <secret>] [--application-type <web|desktop|limited-input-device>] [--scope <scope> ...] [--json]");
  printLine("  seo providers show google [--json]");
  printLine("  seo providers login-url google [--scope <scope> ...] [--state <state>] [--access-type <online|offline>] [--prompt <value>] [--login-hint <email>] [--pkce] [--json]");
  printLine("  seo providers auth google [--scope <scope> ...] [--timeout-seconds <n>] [--interval-seconds <n>] [--json]");
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

    if (!clientId) {
      throw new CliError("`seo providers set google` requires `--client-id`.", 2);
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
    if (result.config.tokens.accessToken) {
      printLine("Stored Tokens: yes");
    }
    return;
  }

  throw new CliError("Supported providers: `dataforseo`, `google`.", 2);
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
    return;
  }

  throw new CliError("Supported providers: `dataforseo`, `google`.", 2);
}

async function runProviderLoginUrl(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  if (provider !== "google") {
    throw new CliError("`seo providers login-url` currently supports only `google`.", 2);
  }

  const resolved = resolveGoogleOAuthConfig(await readConfig());
  if (!resolved.redirectUri) {
    throw new CliError("Google login URL flow requires a redirect URI. Run `seo providers set google --redirect-uri ...` first.", 2);
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

  const result = buildGoogleOAuthLoginUrl({
    config: resolved,
    scopes,
    state,
    accessType: accessType as "online" | "offline" | undefined,
    prompt,
    loginHint,
    codeChallenge,
    codeChallengeMethod: codeChallengeMethod as "S256" | "plain" | undefined,
  });

  const payload = {
    provider: "google",
    applicationType: resolved.applicationType,
    redirectUri: resolved.redirectUri,
    scopes: scopes ?? resolved.scopes,
    state: result.state,
    loginUrl: result.url,
    ...(codeVerifier ? { codeVerifier } : {}),
  };

  if (asJson) {
    printJson(payload);
    return;
  }

  printLine(`Provider: ${payload.provider}`);
  printLine(`Application Type: ${payload.applicationType}`);
  printLine(`Redirect URI: ${payload.redirectUri}`);
  printLine(`State: ${payload.state}`);
  if (codeVerifier) {
    printLine(`Code Verifier: ${codeVerifier}`);
  }
  printLine(`Login URL: ${payload.loginUrl}`);
}

function parseGoogleApplicationType(value: string | undefined): GoogleOAuthApplicationType | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "web" || value === "desktop") {
    return value;
  }

  if (value === "limited-input-device") {
    return value;
  }

  throw new CliError("`--application-type` must be `web`, `desktop`, or `limited-input-device`.", 2);
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

async function runProviderAuth(provider: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<void> {
  if (provider !== "google") {
    throw new CliError("`seo providers auth` currently supports only `google`.", 2);
  }

  const resolved = resolveGoogleOAuthConfig(await readConfig());
  const scopes = getStringArrayFlagOrUndefined(parsed, "--scope");
  const timeoutSeconds = parsePositiveInteger(getStringFlag(parsed, "--timeout-seconds")) ?? 900;
  const intervalSecondsOverride = parsePositiveInteger(getStringFlag(parsed, "--interval-seconds"));
  const asJson = getBooleanFlag(parsed, "--json");
  const client = new GoogleDeviceAuthClient(resolved);
  const authorization = await client.startDeviceAuthorization({ scopes });
  const intervalSeconds = intervalSecondsOverride ?? authorization.interval;

  if (!asJson) {
    printLine("Google device authorization started");
    printLine(`Verification URL: ${authorization.verificationUrl}`);
    if (authorization.verificationUrlComplete) {
      printLine(`Direct URL: ${authorization.verificationUrlComplete}`);
    }
    printLine(`User Code: ${authorization.userCode}`);
    printLine("Waiting for the user to approve access...");
  }

  const tokens = await client.pollForTokens({
    deviceCode: authorization.deviceCode,
    intervalSeconds,
    timeoutSeconds,
  });
  const { configPath } = await saveGoogleOAuthTokens(tokens);

  if (asJson) {
    printJson({
      ok: true,
      provider: "google",
      flow: "device",
      configPath,
      tokens: {
        accessToken: "********",
        refreshToken: tokens.refreshToken ? "********" : null,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        expiryDate: tokens.expiryDate ?? null,
      },
    });
    return;
  }

  printLine("Google authorization completed");
  printLine(`Config path: ${configPath}`);
  printLine(`Token type: ${tokens.tokenType}`);
  printLine(`Scopes: ${tokens.scope.join(", ")}`);
  printLine(`Expires at: ${tokens.expiryDate ?? "(not provided)"}`);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError("Expected a positive integer value.", 2);
  }

  return parsed;
}
