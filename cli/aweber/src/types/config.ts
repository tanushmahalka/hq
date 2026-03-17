export type AweberClientType = "public" | "confidential";

export interface AweberTokenSet {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiryDate?: string;
}

export interface AweberPendingAuth {
  state: string;
  scopes: string[];
  createdAt: string;
  codeVerifier?: string;
}

export interface AweberContextConfig {
  accountId?: string;
  listId?: string;
}

export interface AweberProviderConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  clientType?: AweberClientType;
  scopes?: string[];
  tokens?: AweberTokenSet;
  pendingAuth?: AweberPendingAuth;
  context?: AweberContextConfig;
}

export interface AweberCliConfig {
  provider?: AweberProviderConfig;
}

export interface ResolvedAweberConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  clientType: AweberClientType;
  scopes: string[];
  tokens: AweberTokenSet;
  pendingAuth?: AweberPendingAuth;
  context: AweberContextConfig;
}
