import { randomBytes, createHash } from "node:crypto";

import type { ResolvedGoogleOAuthProviderConfig } from "../../types/config.ts";

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
