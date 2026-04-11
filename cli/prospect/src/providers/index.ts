import { CliError } from "../core/errors.ts";
import type { ResolvedProspectConfig } from "../types/config.ts";
import type {
  AccountLookupInput,
  NormalizedCompany,
  NormalizedPerson,
  PersonLookupInput,
  ProviderResult,
  RequestOptions,
} from "../types/normalized.ts";
import { ApolloClient } from "./apollo/client.ts";
import { createApolloProvider, type ApolloProvider } from "./apollo/index.ts";

export interface ProspectProvider {
  id: string;
  findPerson(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  findAccount(input: AccountLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedCompany>>;
  findNumber(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  enrichPerson(input: PersonLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedPerson>>;
  enrichAccount(input: AccountLookupInput, options?: RequestOptions): Promise<ProviderResult<NormalizedCompany>>;
  rawRequest(options: {
    method?: string;
    path: string;
    query?: Record<string, unknown>;
    json?: unknown;
    timeoutMs?: number;
  }): Promise<unknown>;
}

export function createProviders(
  config: ResolvedProspectConfig,
  dependencies: { fetchImpl?: typeof fetch } = {},
): Record<string, ProspectProvider> {
  const apollo: ApolloProvider = createApolloProvider(
    new ApolloClient({
      config: config.providers.apollo,
      fetchImpl: dependencies.fetchImpl,
    }),
  );

  return {
    apollo,
  };
}

export async function executeWithFallback<T>(
  providers: Record<string, ProspectProvider>,
  providerOrder: string[],
  preferredProvider: string | undefined,
  operation: (provider: ProspectProvider) => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  const order = preferredProvider ? [preferredProvider] : providerOrder;
  const explain: string[] = [];

  for (const providerId of order) {
    const provider = providers[providerId];
    if (!provider) {
      throw new CliError(`Unknown provider: ${providerId}`, 2);
    }

    explain.push(`Trying provider ${providerId}.`);
    const result = await operation(provider);
    const mergedExplain = [...explain, ...result.explain];

    if (result.ok) {
      return {
        ...result,
        explain: mergedExplain,
      };
    }

    explain.push(`Provider ${providerId} returned no usable result.`);
  }

  return {
    ok: false,
    provider: preferredProvider ?? order[0] ?? "unknown",
    result: null,
    warnings: ["No providers returned a usable result."],
    explain,
  };
}
