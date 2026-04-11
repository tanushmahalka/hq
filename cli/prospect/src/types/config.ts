export interface ProspectProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface ProspectCliConfig {
  providers?: {
    apollo?: ProspectProviderConfig;
  };
  defaults?: {
    providerOrder?: string[];
    timeoutMs?: number;
  };
}

export interface ResolvedApolloConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface ResolvedProspectConfig {
  providers: {
    apollo: ResolvedApolloConfig;
  };
  defaults: {
    providerOrder: string[];
    timeoutMs: number;
  };
}
