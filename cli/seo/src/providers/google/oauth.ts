import { randomBytes, createHash } from "node:crypto";

import { CliError } from "../../core/errors.ts";
import type { GoogleOAuthTokenSet, ResolvedGoogleOAuthProviderConfig } from "../../types/config.ts";

export interface GoogleOAuthLoginUrlOptions {
  config: ResolvedGoogleOAuthProviderConfig;
  state?: string;
  scopes?: string[];
  accessType?: "online" | "offline";
  includeGrantedScopes?: boolean;
  prompt?: string;
  loginHint?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
}

export interface GoogleOAuthLoginUrlResult {
  url: string;
  state: string;
}

export interface GeneratedPkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface GoogleOAuthTokenExchangeOptions {
  config: ResolvedGoogleOAuthProviderConfig;
  code: string;
  codeVerifier?: string;
}

export interface GoogleOAuthTokenRefreshOptions {
  config: ResolvedGoogleOAuthProviderConfig;
  refreshToken?: string;
}

interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleOAuthErrorResponse {
  error: string;
  error_description?: string;
}

export function buildGoogleOAuthLoginUrl(options: GoogleOAuthLoginUrlOptions): GoogleOAuthLoginUrlResult {
  const scope = (options.scopes ?? options.config.scopes).join(" ").trim();
  const state = options.state ?? randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: options.config.clientId,
    redirect_uri: options.config.redirectUri,
    response_type: "code",
    scope,
    state,
    access_type: options.accessType ?? "offline",
    include_granted_scopes: String(options.includeGrantedScopes ?? true),
  });

  if (options.prompt) {
    params.set("prompt", options.prompt);
  }

  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }

  if (options.codeChallenge) {
    params.set("code_challenge", options.codeChallenge);
    params.set("code_challenge_method", options.codeChallengeMethod ?? "S256");
  }

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

export function generateGooglePkcePair(): GeneratedPkcePair {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export async function exchangeGoogleAuthorizationCode(
  options: GoogleOAuthTokenExchangeOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleOAuthTokenSet> {
  if (!options.config.redirectUri) {
    throw new CliError("Google authorization code exchange requires a configured redirect URI.", 2);
  }

  const body = new URLSearchParams({
    code: options.code,
    client_id: options.config.clientId,
    redirect_uri: options.config.redirectUri,
    grant_type: "authorization_code",
  });

  if (options.config.clientSecret) {
    body.set("client_secret", options.config.clientSecret);
  }

  if (options.codeVerifier) {
    body.set("code_verifier", options.codeVerifier);
  }

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const payload = (await safeParseError(response)) ?? {
      error: `http_${response.status}`,
      error_description: response.statusText,
    };
    throw new CliError(`Google OAuth token exchange failed: ${formatGoogleError(payload)}`, 2);
  }

  const payload = (await response.json()) as GoogleOAuthTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    scope: payload.scope?.split(" ").filter(Boolean) ?? options.config.scopes,
    expiryDate: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : undefined,
  };
}

export async function refreshGoogleAccessToken(
  options: GoogleOAuthTokenRefreshOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleOAuthTokenSet> {
  const refreshToken = options.refreshToken ?? options.config.tokens?.refreshToken;
  if (!refreshToken) {
    throw new CliError("Google OAuth refresh requires a stored refresh token.", 2);
  }

  const body = new URLSearchParams({
    client_id: options.config.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (options.config.clientSecret) {
    body.set("client_secret", options.config.clientSecret);
  }

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const payload = (await safeParseError(response)) ?? {
      error: `http_${response.status}`,
      error_description: response.statusText,
    };
    throw new CliError(`Google OAuth token refresh failed: ${formatGoogleError(payload)}`, 2);
  }

  const payload = (await response.json()) as GoogleOAuthTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    tokenType: payload.token_type,
    scope: payload.scope?.split(" ").filter(Boolean) ?? options.config.tokens?.scope ?? options.config.scopes,
    expiryDate: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : undefined,
  };
}

export function isGoogleAccessTokenExpired(tokens: GoogleOAuthTokenSet | undefined, skewMs = 60_000): boolean {
  if (!tokens?.accessToken) {
    return true;
  }

  if (!tokens.expiryDate) {
    return false;
  }

  return Date.parse(tokens.expiryDate) <= Date.now() + skewMs;
}

export function parseGoogleOAuthCallback(callbackUrl: string): {
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

async function safeParseError(response: Response): Promise<GoogleOAuthErrorResponse | null> {
  try {
    return (await response.json()) as GoogleOAuthErrorResponse;
  } catch {
    return null;
  }
}

function formatGoogleError(error: GoogleOAuthErrorResponse): string {
  return error.error_description ? `${error.error} (${error.error_description})` : error.error;
}
