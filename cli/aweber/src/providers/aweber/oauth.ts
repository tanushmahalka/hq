import { createHash, randomBytes } from "node:crypto";

import { CliError } from "../../core/errors.ts";
import type { AweberTokenSet, ResolvedAweberConfig } from "../../types/config.ts";
import { throwAweberError } from "./errors.ts";

const AUTHORIZE_URL = "https://auth.aweber.com/oauth2/authorize";
const TOKEN_URL = "https://auth.aweber.com/oauth2/token";
const REVOKE_URL = "https://auth.aweber.com/oauth2/revoke";

export interface GeneratedPkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface BuildLoginUrlResult {
  url: string;
  state: string;
  codeVerifier?: string;
}

export function generatePkcePair(): GeneratedPkcePair {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export function buildAuthorizationUrl(options: {
  config: ResolvedAweberConfig;
  state?: string;
  scopes?: string[];
}): BuildLoginUrlResult {
  if (!options.config.clientId) {
    throw new CliError("Missing AWeber client ID.", 2);
  }

  const state = options.state ?? randomBytes(16).toString("hex");
  const scopes = options.scopes ?? options.config.scopes;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: options.config.clientId,
    redirect_uri: options.config.redirectUri,
    scope: scopes.join(" "),
    state,
  });

  let codeVerifier: string | undefined;

  if (options.config.clientType === "public") {
    const pkce = generatePkcePair();
    codeVerifier = pkce.codeVerifier;
    params.set("code_challenge", pkce.codeChallenge);
    params.set("code_challenge_method", pkce.codeChallengeMethod);
  }

  return {
    url: `${AUTHORIZE_URL}?${params.toString()}`,
    state,
    codeVerifier,
  };
}

export function parseOAuthCallback(callbackUrl: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch (error) {
    throw new CliError(`Invalid callback URL: ${(error as Error).message}`, 2);
  }

  return {
    code: url.searchParams.get("code") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    error: url.searchParams.get("error") ?? undefined,
    errorDescription: url.searchParams.get("error_description") ?? undefined,
  };
}

export async function exchangeAuthorizationCode(
  options: {
    config: ResolvedAweberConfig;
    code: string;
    codeVerifier?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AweberTokenSet> {
  if (!options.config.clientId) {
    throw new CliError("Missing AWeber client ID.", 2);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    client_id: options.config.clientId,
  });

  const headers = buildTokenHeaders(options.config, body);

  if (options.config.clientType === "public") {
    if (!options.codeVerifier) {
      throw new CliError("Public AWeber clients require a PKCE code verifier for token exchange.", 2);
    }
    body.set("code_verifier", options.codeVerifier);
  }

  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    await throwAweberError(response);
  }

  return normalizeTokenResponse(await response.json() as TokenResponse);
}

export async function refreshAccessToken(
  options: {
    config: ResolvedAweberConfig;
    refreshToken?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AweberTokenSet> {
  if (!options.config.clientId) {
    throw new CliError("Missing AWeber client ID.", 2);
  }

  const refreshToken = options.refreshToken ?? options.config.tokens.refreshToken;
  if (!refreshToken) {
    throw new CliError("AWeber token refresh requires a stored refresh token.", 2);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: options.config.clientId,
  });

  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: buildTokenHeaders(options.config, body),
    body,
  });

  if (!response.ok) {
    await throwAweberError(response);
  }

  const tokens = normalizeTokenResponse(await response.json() as TokenResponse);
  return {
    ...tokens,
    refreshToken: tokens.refreshToken ?? refreshToken,
  };
}

export async function revokeToken(
  options: {
    config: ResolvedAweberConfig;
    token: string;
    tokenTypeHint?: "access_token" | "refresh_token";
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!options.config.clientId) {
    throw new CliError("Missing AWeber client ID.", 2);
  }

  const body = new URLSearchParams({
    client_id: options.config.clientId,
    token: options.token,
  });

  if (options.tokenTypeHint) {
    body.set("token_type_hint", options.tokenTypeHint);
  }

  const response = await fetchImpl(REVOKE_URL, {
    method: "POST",
    headers: buildTokenHeaders(options.config, body),
    body,
  });

  if (!response.ok) {
    await throwAweberError(response);
  }
}

export function isAccessTokenExpired(tokens: AweberTokenSet | undefined, skewMs = 60_000): boolean {
  if (!tokens?.accessToken) {
    return true;
  }

  if (!tokens.expiryDate) {
    return false;
  }

  return Date.parse(tokens.expiryDate) <= Date.now() + skewMs;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

function normalizeTokenResponse(payload: TokenResponse): AweberTokenSet {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type ?? "bearer",
    expiryDate: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : undefined,
  };
}

function buildTokenHeaders(config: ResolvedAweberConfig, body: URLSearchParams): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.clientType === "confidential") {
    if (!config.clientId || !config.clientSecret) {
      throw new CliError("Confidential AWeber clients require both client ID and client secret.", 2);
    }

    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", config.clientId ?? "");
  }

  return headers;
}
