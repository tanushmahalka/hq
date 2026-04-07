export interface TwentyContextConfig {
  depth?: number;
  limit?: number;
}

export interface TwentyProviderConfig {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  context?: TwentyContextConfig;
}

export interface TwentyCliConfig {
  provider?: TwentyProviderConfig;
}

export interface ResolvedTwentyConfig {
  baseUrl?: string;
  token?: string;
  timeoutMs: number;
  context: TwentyContextConfig;
}
