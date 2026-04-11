export interface NormalizedPhone {
  value: string;
  type: string;
  source: string;
  status: string;
}

export interface NormalizedCompany {
  id?: string;
  name?: string;
  domain?: string;
  websiteUrl?: string;
  phones?: NormalizedPhone[];
  industry?: string;
  employeeCount?: number;
  location?: string;
}

export interface NormalizedPerson {
  id?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  phones?: NormalizedPhone[];
  linkedinUrl?: string;
  company?: NormalizedCompany;
  location?: string;
}

export interface ProviderResult<T> {
  ok: boolean;
  provider: string;
  result: T | null;
  warnings: string[];
  explain: string[];
  providerRaw?: unknown;
}

export interface CommandEnvelope<T> {
  ok: boolean;
  command: string;
  entity: string;
  input: Record<string, unknown>;
  provider?: string;
  result: T | null;
  explain: string[];
  providerRaw?: unknown;
  warnings: string[];
}

export interface CollectionEnvelope<T> {
  ok: boolean;
  command: string;
  entity: string;
  input: Record<string, unknown>;
  provider?: string;
  results: T[];
  totalEntries?: number;
  page?: number;
  perPage?: number;
  explain: string[];
  providerRaw?: unknown;
  warnings: string[];
}

export interface PersonLookupInput {
  email?: string;
  linkedinUrl?: string;
  name?: string;
  domain?: string;
  company?: string;
}

export interface AccountLookupInput {
  domain?: string;
  name?: string;
}

export interface RequestOptions {
  includeRaw?: boolean;
  explain?: boolean;
  timeoutMs?: number;
  providerFilters?: Record<string, unknown>;
}
