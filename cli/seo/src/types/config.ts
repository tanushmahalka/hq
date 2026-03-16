export interface DataForSeoProviderConfig {
  login: string;
  password: string;
  baseUrl?: string;
}

export type GoogleOAuthApplicationType = "web" | "desktop";

export interface GoogleOAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string[];
  expiryDate?: string;
}

export interface GoogleOAuthPendingAuth {
  state: string;
  scopes: string[];
  accessType: "online" | "offline";
  prompt?: string;
  loginHint?: string;
  codeVerifier?: string;
  createdAt: string;
}

export interface GoogleOAuthProviderConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  applicationType?: GoogleOAuthApplicationType;
  scopes?: string[];
  tokens?: GoogleOAuthTokenSet;
  pendingAuth?: GoogleOAuthPendingAuth;
}

export interface SeoCliConfig {
  providers?: {
    dataforseo?: Partial<DataForSeoProviderConfig>;
    google?: Partial<GoogleOAuthProviderConfig>;
  };
}

export interface ResolvedDataForSeoProviderConfig {
  login: string;
  password: string;
  baseUrl: string;
}

export interface ResolvedGoogleOAuthProviderConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  applicationType: GoogleOAuthApplicationType;
  scopes: string[];
  tokens?: GoogleOAuthTokenSet;
  pendingAuth?: GoogleOAuthPendingAuth;
}
