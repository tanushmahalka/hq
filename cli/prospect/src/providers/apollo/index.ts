import type {
  AccountLookupInput,
  CommandEnvelope,
  CollectionEnvelope,
  NormalizedCompany,
  NormalizedPerson,
  NormalizedPhone,
  PersonLookupInput,
  ProviderResult,
  RequestOptions,
} from "../../types/normalized.ts";
import { ApolloClient } from "./client.ts";

export interface ApolloProvider {
  id: "apollo";
  findPerson(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  listPeople(input: PersonLookupInput, options?: RequestOptions): Promise<{
    ok: boolean;
    provider: string;
    results: NormalizedPerson[];
    totalEntries?: number;
    page?: number;
    perPage?: number;
    warnings: string[];
    explain: string[];
    providerRaw?: unknown;
  }>;
  findAccount(input: AccountLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedCompany>>;
  findNumber(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  enrichPerson(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  enrichAccount(input: AccountLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedCompany>>;
  bulkEnrichPeople(
    payload: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<{
    ok: boolean;
    provider: string;
    results: NormalizedPerson[];
    warnings: string[];
    explain: string[];
    providerRaw?: unknown;
  }>;
  rawRequest(options: {
    method?: string;
    path: string;
    query?: Record<string, unknown>;
    json?: unknown;
    timeoutMs?: number;
  }): Promise<unknown>;
}

export function createApolloProvider(client: ApolloClient): ApolloProvider {
  return {
    id: "apollo",
    async findPerson(input, options = {}) {
      if (shouldUsePeopleMatch(input, options.providerFilters)) {
        const response = await client.request<Record<string, unknown>>({
          method: "POST",
          path: "/api/v1/people/match",
          query: buildPeopleEnrichmentPayload(input),
          timeoutMs: options.timeoutMs,
        });

        const person = normalizePerson(firstObject(response.data.person) ?? firstObject(response.data.contact) ?? response.data);
        return makeResult("apollo", person, response.data, options, ["Used Apollo People Match for exact identity lookup."]);
      }

      const payload = buildPeopleSearchPayload(input, options.providerFilters);
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/mixed_people/api_search",
        query: payload,
        timeoutMs: options.timeoutMs,
      });

      const person = firstObject(response.data.people) ?? firstObject(response.data.contacts);
      return makeResult("apollo", normalizePerson(person), response.data, options, ["Used Apollo People API Search for filter-based lookup."]);
    },
    async listPeople(input, options = {}) {
      const payload = buildPeopleSearchPayload(input, options.providerFilters);
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/mixed_people/api_search",
        query: payload,
        timeoutMs: options.timeoutMs,
      });

      const people = collectObjects(response.data.people)
        .map((person) => normalizePerson(person))
        .filter((person): person is NormalizedPerson => person !== null);

      return {
        ok: true,
        provider: "apollo",
        results: people,
        totalEntries: numberField(response.data, "total_entries"),
        page: numberFromPayload(payload.page),
        perPage: numberFromPayload(payload.per_page),
        warnings: [],
        explain: options.explain ? ["Used Apollo People API Search and returned a result set."] : [],
        providerRaw: response.data,
      };
    },
    async findAccount(input, options = {}) {
      const query = buildOrganizationQuery(input);
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/organizations/search",
        json: query,
        timeoutMs: options.timeoutMs,
      });

      const account = firstObject(response.data.organizations) ?? firstObject(response.data.accounts);
      return makeResult("apollo", normalizeCompany(account), response.data, options);
    },
    async findNumber(input, options = {}) {
      const payload = buildPeopleEnrichmentPayload(input, {
        ...options.providerOptions,
        reveal_phone_number: true,
      });
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/people/match",
        query: payload,
        timeoutMs: options.timeoutMs,
      });

      const personRecord = firstObject(response.data.person) ?? firstObject(response.data.contact) ?? response.data;
      const person = normalizePerson(personRecord);
      const warnings: string[] = [];
      const explain: string[] = [];

      if ((person.phones?.length ?? 0) === 0 && looksAsyncEnrichment(response.data)) {
        person.phones = [
          {
            value: "pending",
            type: "phone",
            source: "apollo",
            status: "pending_async_enrichment",
          },
        ];
        warnings.push("Apollo indicates phone enrichment requires async webhook delivery for the requested data.");
      }

      explain.push("Used Apollo People Enrichment with reveal_phone_number=true.");
      if (warnings.length > 0) {
        explain.push("No synchronous phone value was returned, so the result is marked as pending async enrichment.");
      }

      return {
        ok: person !== null,
        provider: "apollo",
        result: person,
        warnings,
        explain: options.explain ? explain : [],
        providerRaw: response.data,
      };
    },
    async enrichPerson(input, options = {}) {
      const payload = buildPeopleEnrichmentPayload(input, options.providerOptions);
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/people/match",
        query: payload,
        timeoutMs: options.timeoutMs,
      });

      const person = normalizePerson(firstObject(response.data.person) ?? firstObject(response.data.contact) ?? response.data);
      return makeResult("apollo", person, response.data, options, ["Used Apollo People Enrichment."]);
    },
    async enrichAccount(input, options = {}) {
      const response = await client.request<Record<string, unknown>>({
        method: "GET",
        path: "/api/v1/organizations/enrich",
        query: buildOrganizationEnrichmentQuery(input),
        timeoutMs: options.timeoutMs,
      });

      const account = normalizeCompany(firstObject(response.data.organization) ?? response.data);
      return makeResult("apollo", account, response.data, options, ["Used Apollo Organization Enrichment."]);
    },
    async bulkEnrichPeople(payload, options = {}) {
      const response = await client.request<Record<string, unknown>>({
        method: "POST",
        path: "/api/v1/people/bulk_match",
        query: options.providerOptions,
        json: payload,
        timeoutMs: options.timeoutMs,
      });

      const people = collectBulkPeopleResults(response.data)
        .map((person) => normalizePerson(person))
        .filter((person): person is NormalizedPerson => person !== null);

      return {
        ok: people.length > 0,
        provider: "apollo",
        results: people,
        warnings: [],
        explain: options.explain ? ["Used Apollo Bulk People Enrichment."] : [],
        providerRaw: response.data,
      };
    },
    async rawRequest(options) {
      const response = await client.request<unknown>(options);
      return response.data;
    },
  };
}

export function toEnvelope<T>(
  command: string,
  entity: string,
  input: Record<string, unknown>,
  result: ProviderResult<T>,
): CommandEnvelope<T> {
  return {
    ok: result.ok,
    command,
    entity,
    input,
    provider: result.provider,
    result: result.result,
    explain: result.explain,
    ...(result.providerRaw !== undefined ? { providerRaw: result.providerRaw } : {}),
    warnings: result.warnings,
  };
}

export function toCollectionEnvelope<T>(
  command: string,
  entity: string,
  input: Record<string, unknown>,
  result: {
    ok: boolean;
    provider: string;
    results: T[];
    totalEntries?: number;
    page?: number;
    perPage?: number;
    warnings: string[];
    explain: string[];
    providerRaw?: unknown;
  },
): CollectionEnvelope<T> {
  return {
    ok: result.ok,
    command,
    entity,
    input,
    provider: result.provider,
    results: result.results,
    ...(result.totalEntries !== undefined ? { totalEntries: result.totalEntries } : {}),
    ...(result.page !== undefined ? { page: result.page } : {}),
    ...(result.perPage !== undefined ? { perPage: result.perPage } : {}),
    explain: result.explain,
    ...(result.providerRaw !== undefined ? { providerRaw: result.providerRaw } : {}),
    warnings: result.warnings,
  };
}

function makeResult<T>(
  provider: string,
  result: T | null,
  raw: unknown,
  options: RequestOptions,
  explain: string[] = [],
): ProviderResult<T> {
  return {
    ok: result !== null,
    provider,
    result,
    warnings: [],
    explain: options.explain ? explain : [],
    providerRaw: raw,
  };
}

function buildPeopleSearchPayload(
  input: PersonLookupInput,
  providerFilters: Record<string, unknown> = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    page: 1,
    per_page: 1,
    ...providerFilters,
  };

  if (input.email) payload.email = input.email;
  if (input.linkedinUrl) payload.person_linkedin_url = input.linkedinUrl;
  if (input.name) payload.q_keywords = input.name;
  if (input.domain) payload.organization_domains = [input.domain];
  if (input.company) payload.organization_names = [input.company];

  return payload;
}

function buildOrganizationQuery(input: AccountLookupInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    page: 1,
    per_page: 1,
  };

  if (input.domain) payload.organization_domains = [input.domain];
  if (input.name) payload.q_organization_name = input.name;

  return payload;
}

function buildPeopleEnrichmentPayload(
  input: PersonLookupInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...(input.id ? { id: input.id } : {}),
    ...extra,
    ...(input.email ? { email: input.email } : {}),
    ...(input.hashedEmail ? { hashed_email: input.hashedEmail } : {}),
    ...(input.linkedinUrl ? { linkedin_url: input.linkedinUrl } : {}),
    ...(input.name ? { name: input.name } : {}),
    ...(input.firstName ? { first_name: input.firstName } : {}),
    ...(input.lastName ? { last_name: input.lastName } : {}),
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.company ? { organization_name: input.company } : {}),
  };
}

function shouldUsePeopleMatch(
  input: PersonLookupInput,
  providerFilters: Record<string, unknown> | undefined,
): boolean {
  if (providerFilters && Object.keys(providerFilters).length > 0) {
    return false;
  }

  return Boolean(input.email || input.linkedinUrl);
}

function buildOrganizationEnrichmentQuery(input: AccountLookupInput): Record<string, unknown> {
  return {
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.name ? { organization_name: input.name } : {}),
  };
}

function normalizePerson(value: unknown): NormalizedPerson | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const company = isPlainObject(value.organization)
    ? normalizeCompany(value.organization)
    : normalizeCompany({
        id: stringField(value, "organization_id"),
        name: stringField(value, "organization_name") ?? stringField(value, "account_name"),
        domain: stringField(value, "organization_website_url")
          ? domainFromUrl(stringField(value, "organization_website_url"))
          : undefined,
        website_url: stringField(value, "organization_website_url"),
      });

  return {
    id: stringField(value, "id"),
    fullName: stringField(value, "name") ?? joinName(stringField(value, "first_name"), stringField(value, "last_name")),
    firstName: stringField(value, "first_name"),
    lastName: stringField(value, "last_name"),
    jobTitle: stringField(value, "title"),
    email: stringField(value, "email"),
    phones: collectPhones(value),
    linkedinUrl: stringField(value, "linkedin_url"),
    company,
    location: summarizeLocation(value),
  };
}

function normalizeCompany(value: unknown): NormalizedCompany | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    id: stringField(value, "id"),
    name: stringField(value, "name"),
    domain:
      stringField(value, "primary_domain") ??
      stringField(value, "domain") ??
      domainFromUrl(stringField(value, "website_url") ?? stringField(value, "website_url")),
    websiteUrl: stringField(value, "website_url"),
    phones: collectPhones(value),
    industry: stringField(value, "industry"),
    employeeCount: numberField(value, "estimated_num_employees") ?? numberField(value, "employee_count"),
    location: summarizeLocation(value),
  };
}

function collectPhones(value: Record<string, unknown>): NormalizedPhone[] {
  const phones: NormalizedPhone[] = [];

  const directKeys = [
    ["phone_number", "direct"],
    ["mobile_phone_number", "mobile"],
    ["organization_phone", "company"],
  ] as const;

  for (const [key, type] of directKeys) {
    const phone = stringField(value, key);
    if (phone) {
      phones.push({
        value: phone,
        type,
        source: "apollo",
        status: "available",
      });
    }
  }

  if (Array.isArray(value.phone_numbers)) {
    for (const entry of value.phone_numbers) {
      if (!isPlainObject(entry)) continue;
      const phone = stringField(entry, "sanitized_number") ?? stringField(entry, "raw_number") ?? stringField(entry, "number");
      if (!phone) continue;
      phones.push({
        value: phone,
        type: stringField(entry, "type") ?? "phone",
        source: "apollo",
        status: stringField(entry, "status") ?? "available",
      });
    }
  }

  return dedupePhones(phones);
}

function dedupePhones(value: NormalizedPhone[]): NormalizedPhone[] {
  const seen = new Set<string>();
  return value.filter((phone) => {
    const key = `${phone.value}:${phone.type}:${phone.status}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function looksAsyncEnrichment(value: Record<string, unknown>): boolean {
  const requestStatus = stringField(value, "waterfall_enrichment_status") ?? stringField(value, "status");
  if (requestStatus && /(queued|pending|processing)/i.test(requestStatus)) {
    return true;
  }

  const hasWebhookHints =
    "waterfall_enrichment_id" in value ||
    "phone_number_status" in value ||
    "phone_number_request_id" in value;
  return hasWebhookHints;
}

function firstObject(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return isPlainObject(first) ? first : undefined;
  }

  return isPlainObject(value) ? value : undefined;
}

function collectObjects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlainObject);
}

function collectBulkPeopleResults(value: Record<string, unknown>): Record<string, unknown>[] {
  const candidateKeys = ["matches", "people", "contacts", "details"];

  for (const key of candidateKeys) {
    const records = collectObjects(value[key]);
    if (records.length > 0) {
      return records.map((record) => firstObject(record.person) ?? firstObject(record.contact) ?? record);
    }
  }

  return [];
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function numberFromPayload(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinName(first?: string, last?: string): string | undefined {
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || undefined;
}

function summarizeLocation(value: Record<string, unknown>): string | undefined {
  const parts = [
    stringField(value, "city"),
    stringField(value, "state"),
    stringField(value, "country"),
    stringField(value, "location"),
  ].filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  return Array.from(new Set(parts)).join(", ");
}

function domainFromUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
