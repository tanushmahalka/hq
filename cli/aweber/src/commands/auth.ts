import { getBooleanFlag, getStringArrayFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import {
  AWEBER_DEFAULT_SCOPES,
  clearAweberPendingAuth,
  clearAweberTokens,
  getConfigPath,
  readConfig,
  redactAweberConfig,
  requireResolvedAweberConfig,
  resolveAweberConfig,
  saveAweberAuthConfig,
  saveAweberPendingAuth,
  saveAweberTokens,
} from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";
import { buildAuthorizationUrl, exchangeAuthorizationCode, parseOAuthCallback, refreshAccessToken, revokeToken } from "../providers/aweber/oauth.ts";
import type { AweberClientType } from "../types/config.ts";

const AUTH_SCHEMA = {
  "--client-id": "string",
  "--client-secret": "string",
  "--redirect-uri": "string",
  "--client-type": "string",
  "--scope": "string[]",
  "--state": "string",
  "--callback-url": "string",
  "--code": "string",
  "--token": "string",
  "--token-type-hint": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runAuthCommand(
  argv: string[],
  dependencies: {
    fetchImpl?: typeof fetch;
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
    now?: () => Date;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, AUTH_SCHEMA);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;
  const now = dependencies.now ?? (() => new Date());

  if (!action || action === "--help" || action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action === "set") {
    const clientType = parseClientType(getStringFlag(parsed, "--client-type"));
    const scopes = getStringArrayFlag(parsed, "--scope");
    const result = await saveAweberAuthConfig({
      clientId: getStringFlag(parsed, "--client-id"),
      clientSecret: getStringFlag(parsed, "--client-secret"),
      redirectUri: getStringFlag(parsed, "--redirect-uri"),
      clientType,
      scopes: scopes.length > 0 ? scopes : undefined,
    });

    const payload = {
      ok: true,
      configPath: result.configPath,
      config: redactAweberConfig(result.config.provider),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Stored AWeber auth config at ${payload.configPath}`);
    printLineImpl(`Client ID: ${String(payload.config.clientId)}`);
    printLineImpl(`Client Type: ${String(payload.config.clientType)}`);
    printLineImpl(`Redirect URI: ${String(payload.config.redirectUri)}`);
    printLineImpl(`Scopes: ${(payload.config.scopes as string[]).join(", ")}`);
    return;
  }

  if (action === "show") {
    const resolved = resolveAweberConfig(await readConfig());
    const payload = {
      configPath: getConfigPath(),
      config: redactAweberConfig(resolved),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Config path: ${payload.configPath}`);
    printLineImpl(`Client ID: ${String(payload.config.clientId)}`);
    printLineImpl(`Client Type: ${String(payload.config.clientType)}`);
    printLineImpl(`Redirect URI: ${String(payload.config.redirectUri)}`);
    printLineImpl(`Scopes: ${(payload.config.scopes as string[]).join(", ")}`);
    printLineImpl(`Stored Access Token: ${(payload.config.tokens as { accessToken: string | null }).accessToken ? "yes" : "no"}`);
    return;
  }

  if (action === "login") {
    const resolved = requireResolvedAweberConfig(await readConfig());
    const scopes = getStringArrayFlag(parsed, "--scope");
    const login = buildAuthorizationUrl({
      config: {
        ...resolved,
        scopes: scopes.length > 0 ? scopes : resolved.scopes,
      },
      state: getStringFlag(parsed, "--state"),
      scopes: scopes.length > 0 ? scopes : undefined,
    });

    const { configPath } = await saveAweberPendingAuth({
      state: login.state,
      scopes: scopes.length > 0 ? scopes : resolved.scopes,
      codeVerifier: login.codeVerifier,
      createdAt: now().toISOString(),
    });

    const payload = {
      ok: true,
      flow: "manual-copy-paste",
      configPath,
      clientType: resolved.clientType,
      redirectUri: resolved.redirectUri,
      scopes: scopes.length > 0 ? scopes : resolved.scopes,
      state: login.state,
      loginUrl: login.url,
      ...(login.codeVerifier ? { codeVerifier: login.codeVerifier } : {}),
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl("AWeber auth session started");
    printLineImpl(`Client Type: ${payload.clientType}`);
    printLineImpl(`Redirect URI: ${payload.redirectUri}`);
    printLineImpl(`State: ${payload.state}`);
    if ("codeVerifier" in payload) {
      printLineImpl(`Code Verifier: ${payload.codeVerifier}`);
    }
    printLineImpl(`Login URL: ${payload.loginUrl}`);
    if (payload.redirectUri === "urn:ietf:wg:oauth:2.0:oob") {
      printLineImpl("Next: open the login URL, authorize the app, then paste the returned code into `aweber auth exchange-code --code ...`.");
    } else {
      printLineImpl("Next: open the login URL, authorize the app, then paste the final callback URL into `aweber auth exchange-code --callback-url ...`.");
    }
    return;
  }

  if (action === "exchange-code") {
    const resolved = requireResolvedAweberConfig(await readConfig());
    const callbackUrl = getStringFlag(parsed, "--callback-url");
    const explicitCode = getStringFlag(parsed, "--code");

    if (!callbackUrl && !explicitCode) {
      throw new CliError("`aweber auth exchange-code` requires either `--callback-url` or `--code`.", 2);
    }

    const parsedCallback = callbackUrl ? parseOAuthCallback(callbackUrl) : {};
    if (parsedCallback.error) {
      throw new CliError(
        `AWeber OAuth returned an error: ${parsedCallback.errorDescription ? `${parsedCallback.error} (${parsedCallback.errorDescription})` : parsedCallback.error}`,
        2,
      );
    }

    const code = explicitCode ?? parsedCallback.code;
    if (!code) {
      throw new CliError("No authorization code was found. Pass `--code` or a callback URL containing `code=...`.", 2);
    }

    const pendingAuth = resolved.pendingAuth;
    const callbackState = parsedCallback.state ?? getStringFlag(parsed, "--state");
    if (pendingAuth?.state && callbackState && callbackState !== pendingAuth.state) {
      throw new CliError("Callback state did not match the pending AWeber auth session.", 2);
    }
    if (pendingAuth?.state && callbackUrl && !callbackState) {
      throw new CliError("Expected the pasted callback URL to include `state` so the pending AWeber auth session can be validated.", 2);
    }

    const tokens = await exchangeAuthorizationCode(
      {
        config: resolved,
        code,
        codeVerifier: pendingAuth?.codeVerifier,
      },
      fetchImpl,
    );

    await saveAweberTokens(tokens);
    await clearAweberPendingAuth();

    const payload = {
      ok: true,
      configPath: getConfigPath(),
      tokens: redactAweberConfig({ tokens }).tokens,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl("AWeber authorization completed");
    printLineImpl(`Config path: ${payload.configPath}`);
    printLineImpl(`Access Token: ${String((payload.tokens as { accessToken: string | null }).accessToken)}`);
    return;
  }

  if (action === "refresh") {
    const resolved = requireResolvedAweberConfig(await readConfig());
    const tokens = await refreshAccessToken({ config: resolved }, fetchImpl);
    await saveAweberTokens(tokens);

    const payload = {
      ok: true,
      configPath: getConfigPath(),
      tokens: redactAweberConfig({ tokens }).tokens,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl("AWeber access token refreshed");
    printLineImpl(`Config path: ${payload.configPath}`);
    return;
  }

  if (action === "revoke") {
    const resolved = requireResolvedAweberConfig(await readConfig());
    const token =
      getStringFlag(parsed, "--token") ??
      resolved.tokens.refreshToken ??
      resolved.tokens.accessToken;

    if (!token) {
      throw new CliError("No token was found to revoke. Pass `--token` or store tokens first.", 2);
    }

    const tokenTypeHint = parseTokenTypeHint(getStringFlag(parsed, "--token-type-hint"));
    await revokeToken({ config: resolved, token, tokenTypeHint }, fetchImpl);
    await clearAweberTokens();

    const payload = {
      ok: true,
      configPath: getConfigPath(),
      revoked: tokenTypeHint ?? "unknown",
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl("AWeber token revoked");
    printLineImpl(`Config path: ${payload.configPath}`);
    return;
  }

  if (action === "logout") {
    const tokensResult = await clearAweberTokens();
    await clearAweberPendingAuth();

    const payload = {
      ok: true,
      configPath: tokensResult.configPath,
    };

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(payload);
      return;
    }

    printLineImpl(`Cleared stored AWeber tokens at ${payload.configPath}`);
    return;
  }

  throw new CliError(`Unknown auth action: ${action}`, 2);
}

function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("AWeber auth commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  aweber auth set --client-id <id> [--client-secret <secret>] [--client-type <public|confidential>] [--redirect-uri <uri>] [--scope <scope> ...] [--json]");
  printLineImpl("  aweber auth show [--json]");
  printLineImpl("  aweber auth login [--scope <scope> ...] [--state <state>] [--json]");
  printLineImpl("  aweber auth exchange-code (--callback-url <url> | --code <code>) [--json]");
  printLineImpl("  aweber auth refresh [--json]");
  printLineImpl("  aweber auth revoke [--token <token>] [--token-type-hint <access_token|refresh_token>] [--json]");
  printLineImpl("  aweber auth logout [--json]");
  printLineImpl("");
  printLineImpl(`Default scopes: ${AWEBER_DEFAULT_SCOPES.join(", ")}`);
}

function parseClientType(value: string | undefined): AweberClientType | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "public" && value !== "confidential") {
    throw new CliError("`--client-type` must be `public` or `confidential`.", 2);
  }

  return value;
}

function parseTokenTypeHint(value: string | undefined): "access_token" | "refresh_token" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "access_token" && value !== "refresh_token") {
    throw new CliError("`--token-type-hint` must be `access_token` or `refresh_token`.", 2);
  }

  return value;
}
