export interface DataForSeoProviderConfig {
  login: string;
  password: string;
  baseUrl?: string;
}

export type GoogleOAuthApplicationType = "web" | "desktop" | "limited-input-device";

export interface GoogleOAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string[];
  expiryDate?: string;
}

export interface GoogleOAuthProviderConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  applicationType?: GoogleOAuthApplicationType;
  scopes?: string[];
  tokens?: GoogleOAuthTokenSet;
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
}
