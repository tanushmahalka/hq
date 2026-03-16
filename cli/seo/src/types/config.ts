export interface DataForSeoProviderConfig {
  login: string;
  password: string;
  baseUrl?: string;
}

export interface SeoCliConfig {
  providers?: {
    dataforseo?: Partial<DataForSeoProviderConfig>;
  };
}

export interface ResolvedDataForSeoProviderConfig {
  login: string;
  password: string;
  baseUrl: string;
}
