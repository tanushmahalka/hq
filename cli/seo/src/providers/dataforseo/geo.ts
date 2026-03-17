import { CliError } from "../../core/errors.ts";
import type {
  DataForSeoGeoClient,
  DataForSeoLlmMentionResult,
  DataForSeoLlmResponseEngine,
  DataForSeoLlmResponseResult,
  DataForSeoMentionsPlatform,
  DataForSeoTask,
} from "./client.ts";

export const DEFAULT_GEO_LOCATION_CODE = 2840;
export const DEFAULT_GEO_LANGUAGE_CODE = "en";
export const DEFAULT_GEO_LIMIT = 50;
export const DEFAULT_PROMPT_AUDIT_ENGINES: DataForSeoLlmResponseEngine[] = [
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
];

const DEFAULT_PROMPT_AUDIT_MODELS: Partial<Record<DataForSeoLlmResponseEngine, string>> = {
  chatgpt: "gpt-4.1-mini",
  claude: "claude-sonnet-4-0",
  gemini: "gemini-2.5-flash",
  perplexity: "sonar",
};

type JsonRecord = Record<string, unknown>;

interface GeoBaseMeta {
  provider: "dataforseo";
  generatedAt: string;
}

interface GeoMentionOptions {
  locationCode: number;
  languageCode: string;
  platforms: DataForSeoMentionsPlatform[];
  limit: number;
}

export interface GeoTopDomain {
  domain: string;
  mentions: number;
  owned: boolean;
  platform: DataForSeoMentionsPlatform;
}

export interface GeoTopPage {
  url: string;
  domain: string | null;
  mentions: number;
  owned: boolean;
  platform: DataForSeoMentionsPlatform;
}

export interface GeoCitationRow {
  platform: DataForSeoMentionsPlatform;
  question: string | null;
  answer: string | null;
  url: string;
  domain: string | null;
  scope: "source" | "search_result" | "reference";
  owned: boolean;
}

export interface BrandVisibilityReport {
  meta: GeoBaseMeta & {
    docs: {
      mentionsSearch: string;
      aggregatedMetrics: string;
      topDomains: string;
      topPages: string;
    };
    options: GeoMentionOptions & {
      domain: string;
    };
  };
  summary: {
    domain: string;
    totalMentions: number;
    totalCitations: number;
    uniqueSourceDomains: number;
    errors: string[];
  };
  platformBreakdown: Array<{
    platform: DataForSeoMentionsPlatform;
    mentionCount: number;
    citationCount: number;
  }>;
  topSourceDomains: GeoTopDomain[];
  topPages: GeoTopPage[];
  sampleCitations: GeoCitationRow[];
  tasks: {
    search: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
    aggregatedMetrics: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
    topDomains: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
    topPages: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
  };
}

export interface CompetitorGapReport {
  meta: GeoBaseMeta & {
    docs: {
      crossAggregatedMetrics: string;
      topPages: string;
    };
    options: GeoMentionOptions & {
      primaryDomain: string;
      competitors: string[];
    };
  };
  summary: {
    primaryDomain: string;
    totalMentions: number;
    errors: string[];
  };
  ranking: Array<{
    domain: string;
    mentionCount: number;
    shareOfVoice: number;
  }>;
  competitors: Array<{
    domain: string;
    mentionCount: number;
    shareOfVoice: number;
    topPages: GeoTopPage[];
    competitorOnlyPages: GeoTopPage[];
  }>;
  tasks: {
    crossAggregatedMetrics: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
    topPages: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
  };
}

export type KeywordCitationStatus = "owned" | "mixed" | "missing";

export interface SourceGapKeywordRow {
  keyword: string;
  status: KeywordCitationStatus;
  ownedCitations: GeoTopPage[];
  competitorPages: GeoTopPage[];
  topDomains: GeoTopDomain[];
  platforms: DataForSeoMentionsPlatform[];
}

export interface SourceGapReport {
  meta: GeoBaseMeta & {
    docs: {
      topDomains: string;
      topPages: string;
    };
    options: GeoMentionOptions & {
      domain: string;
      keywords: string[];
    };
  };
  summary: {
    domain: string;
    keywordsRequested: number;
    ownedKeywords: number;
    mixedKeywords: number;
    missingKeywords: number;
    errors: string[];
  };
  keywords: SourceGapKeywordRow[];
  tasks: {
    topDomains: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
    topPages: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
  };
}

export interface TopicSizingKeywordRow extends SourceGapKeywordRow {
  searchVolumeLastMonth: number;
  monthlyTrend: number[];
}

export interface TopicSizingReport {
  meta: GeoBaseMeta & {
    docs: {
      keywordSearchVolume: string;
      topDomains: string;
      topPages: string;
    };
    options: GeoMentionOptions & {
      domain: string;
      keywords: string[];
    };
  };
  summary: {
    domain: string;
    keywordsRequested: number;
    uncitedKeywords: number;
    errors: string[];
  };
  keywords: TopicSizingKeywordRow[];
  tasks: {
    keywordSearchVolume: DataForSeoTask<JsonRecord>;
    topDomains: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
    topPages: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
  };
}

export interface CitationReport {
  meta: GeoBaseMeta & {
    docs: {
      mentionsSearch: string;
    };
    options: GeoMentionOptions & {
      domain: string;
    };
  };
  summary: {
    domain: string;
    totalCitations: number;
    uniqueDomains: number;
    errors: string[];
  };
  topPages: GeoTopPage[];
  citations: GeoCitationRow[];
  tasks: {
    search: Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>;
  };
}

export interface PromptAuditReport {
  meta: GeoBaseMeta & {
    docs: {
      llmResponses: string;
    };
    options: {
      prompt: string;
      domain: string;
      brand: string | null;
      engines: DataForSeoLlmResponseEngine[];
      systemMessage: string | null;
    };
  };
  summary: {
    domain: string;
    enginesRequested: number;
    enginesSucceeded: number;
    errors: string[];
  };
  engines: Array<{
    engine: DataForSeoLlmResponseEngine;
    answerText: string;
    citedUrls: string[];
    citedDomains: string[];
    mentionedDomain: boolean;
    mentionedBrand: boolean | null;
    errors: string[];
    success: boolean;
  }>;
  tasks: Partial<Record<DataForSeoLlmResponseEngine, DataForSeoTask<DataForSeoLlmResponseResult>>>;
}

export interface BrandVisibilityOptions extends GeoMentionOptions {
  domain: string;
}

export interface CompetitorGapOptions extends GeoMentionOptions {
  primaryDomain: string;
  competitors: string[];
}

export interface SourceGapOptions extends GeoMentionOptions {
  domain: string;
  keywords: string[];
}

export interface TopicSizingOptions extends GeoMentionOptions {
  domain: string;
  keywords: string[];
}

export interface CitationReportOptions extends GeoMentionOptions {
  domain: string;
}

export interface PromptAuditOptions {
  prompt: string;
  domain: string;
  brand?: string;
  engines: DataForSeoLlmResponseEngine[];
  systemMessage?: string;
}

export function normalizeDomainInput(input: string): string {
  const value = input.trim().toLowerCase();

  if (!value) {
    throw new CliError("Expected a non-empty domain.", 2);
  }

  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    if (!url.hostname) {
      throw new Error("missing hostname");
    }

    return stripLeadingWww(url.hostname.toLowerCase());
  } catch {
    throw new CliError(`Invalid domain value: ${input}`, 2);
  }
}

export function normalizeKeywords(inputs: string[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const input of inputs) {
    const keyword = input.trim();
    if (!keyword) {
      continue;
    }

    const key = keyword.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      keywords.push(keyword);
    }
  }

  return keywords;
}

export function resolveMentionsPlatforms(
  requestedPlatforms: string[],
  locationCode: number,
  languageCode: string,
): DataForSeoMentionsPlatform[] {
  const normalized = dedupeStrings(requestedPlatforms).map((platform) => {
    if (platform !== "google" && platform !== "chat_gpt") {
      throw new CliError("`--platform` must be one of: google, chat_gpt.", 2);
    }

    return platform as DataForSeoMentionsPlatform;
  });

  if (normalized.length === 0) {
    return locationCode === DEFAULT_GEO_LOCATION_CODE && languageCode === DEFAULT_GEO_LANGUAGE_CODE
      ? ["google", "chat_gpt"]
      : ["google"];
  }

  if (normalized.includes("chat_gpt") && (locationCode !== DEFAULT_GEO_LOCATION_CODE || languageCode !== DEFAULT_GEO_LANGUAGE_CODE)) {
    throw new CliError("DataForSEO `chat_gpt` mentions currently support only `--location-code 2840 --language-code en`.", 2);
  }

  return normalized;
}

export function resolvePromptAuditEngines(requestedEngines: string[]): DataForSeoLlmResponseEngine[] {
  if (requestedEngines.length === 0) {
    return [...DEFAULT_PROMPT_AUDIT_ENGINES];
  }

  return dedupeStrings(requestedEngines).map((engine) => {
    if (engine !== "chatgpt" && engine !== "claude" && engine !== "gemini" && engine !== "perplexity") {
      throw new CliError("`--engine` must be one of: chatgpt, claude, gemini, perplexity.", 2);
    }

    return engine as DataForSeoLlmResponseEngine;
  });
}

export async function runBrandVisibility(
  client: DataForSeoGeoClient,
  options: BrandVisibilityOptions,
): Promise<BrandVisibilityReport> {
  const domain = normalizeDomainInput(options.domain);
  const errors: string[] = [];
  const tasks: BrandVisibilityReport["tasks"] = {
    search: {},
    aggregatedMetrics: {},
    topDomains: {},
    topPages: {},
  };
  const platformBreakdown: BrandVisibilityReport["platformBreakdown"] = [];
  const topDomains: GeoTopDomain[] = [];
  const topPages: GeoTopPage[] = [];
  const citations: GeoCitationRow[] = [];

  for (const platform of options.platforms) {
    const [searchResult, metricsResult, topDomainsResult, topPagesResult] = await Promise.allSettled([
      client.llmMentionsSearch({
        target: domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        limit: options.limit,
      }),
      client.llmMentionsAggregatedMetrics({
        target: domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        aggregationKey: "platform",
        limit: options.limit,
      }),
      client.llmMentionsTopDomains({
        target: domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        searchScope: "sources",
        limit: options.limit,
      }),
      client.llmMentionsTopPages({
        target: domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        searchScope: "sources",
        limit: options.limit,
      }),
    ]);

    if (searchResult.status === "fulfilled") {
      tasks.search[platform] = searchResult.value;
      citations.push(...extractCitationRows(searchResult.value, domain, platform));
    } else {
      errors.push(`${platform} search failed: ${errorMessage(searchResult.reason)}`);
    }

    if (metricsResult.status === "fulfilled") {
      tasks.aggregatedMetrics[platform] = metricsResult.value;
      platformBreakdown.push({
        platform,
        mentionCount: aggregateMentionCount(metricsResult.value),
        citationCount: searchResult.status === "fulfilled" ? extractCitationRows(searchResult.value, domain, platform).length : 0,
      });
    } else {
      errors.push(`${platform} aggregated metrics failed: ${errorMessage(metricsResult.reason)}`);
    }

    if (topDomainsResult.status === "fulfilled") {
      tasks.topDomains[platform] = topDomainsResult.value;
      topDomains.push(...extractTopDomains(topDomainsResult.value, domain, platform));
    } else {
      errors.push(`${platform} top domains failed: ${errorMessage(topDomainsResult.reason)}`);
    }

    if (topPagesResult.status === "fulfilled") {
      tasks.topPages[platform] = topPagesResult.value;
      topPages.push(...extractTopPages(topPagesResult.value, domain, platform));
    } else {
      errors.push(`${platform} top pages failed: ${errorMessage(topPagesResult.reason)}`);
    }
  }

  ensureAtLeastOneTask(tasks.search, errors, "brand visibility");
  const uniqueSourceDomains = new Set(citations.map((citation) => citation.domain).filter(Boolean) as string[]).size;

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        mentionsSearch: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search/live/",
        aggregatedMetrics: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/aggregated_metrics/live/",
        topDomains: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_domains/live/",
        topPages: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_pages/live/",
      },
      options: {
        domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platforms: [...options.platforms],
        limit: options.limit,
      },
    },
    summary: {
      domain,
      totalMentions: platformBreakdown.reduce((sum, row) => sum + row.mentionCount, 0),
      totalCitations: citations.length,
      uniqueSourceDomains,
      errors,
    },
    platformBreakdown,
    topSourceDomains: rankTopDomains(topDomains, options.limit),
    topPages: rankTopPages(topPages, options.limit),
    sampleCitations: citations.slice(0, Math.min(options.limit, 10)),
    tasks,
  };
}

export async function runCompetitorGap(
  client: DataForSeoGeoClient,
  options: CompetitorGapOptions,
): Promise<CompetitorGapReport> {
  const primaryDomain = normalizeDomainInput(options.primaryDomain);
  const competitors = dedupeDomains(options.competitors);
  if (competitors.length === 0) {
    throw new CliError("`seo geo competitor-gap` requires at least one `--vs` domain.", 2);
  }

  const targets = dedupeDomains([primaryDomain, ...competitors]);
  const errors: string[] = [];
  const tasks: CompetitorGapReport["tasks"] = {
    crossAggregatedMetrics: {},
    topPages: {},
  };
  const counts = new Map<string, number>();

  for (const platform of options.platforms) {
    const metricsResult = await settleTask(
      client.llmMentionsCrossAggregatedMetrics({
        targets,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        aggregationKey: "target",
        limit: options.limit,
      }),
    );

    if (metricsResult.ok) {
      tasks.crossAggregatedMetrics[platform] = metricsResult.task;
      for (const row of extractCrossMetricRows(metricsResult.task)) {
        counts.set(row.key, (counts.get(row.key) ?? 0) + row.mentions);
      }
    } else {
      errors.push(`${platform} cross aggregated metrics failed: ${metricsResult.error}`);
    }
  }

  const perTargetPages = new Map<string, GeoTopPage[]>();
  for (const target of targets) {
    for (const platform of options.platforms) {
      const result = await settleTask(
        client.llmMentionsTopPages({
          target,
          locationCode: options.locationCode,
          languageCode: options.languageCode,
          platform,
          searchScope: "sources",
          limit: options.limit,
        }),
      );

      if (result.ok) {
        if (!tasks.topPages[target]) {
          tasks.topPages[target] = {};
        }
        tasks.topPages[target]![platform] = result.task;
        const rows = extractTopPages(result.task, primaryDomain, platform);
        perTargetPages.set(target, [...(perTargetPages.get(target) ?? []), ...rows]);
      } else {
        errors.push(`${platform} top pages failed for ${target}: ${result.error}`);
      }
    }
  }

  if (counts.size === 0 && perTargetPages.size === 0) {
    throw new CliError(`All competitor gap requests failed: ${errors.join("; ")}`, 1);
  }

  const totalMentions = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const ranking = targets
    .map((target) => ({
      domain: target,
      mentionCount: counts.get(target) ?? 0,
      shareOfVoice: totalMentions > 0 ? Number(((counts.get(target) ?? 0) / totalMentions).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.mentionCount - left.mentionCount || left.domain.localeCompare(right.domain));

  const primaryPages = new Set(
    (perTargetPages.get(primaryDomain) ?? [])
      .filter((page) => page.owned)
      .map((page) => page.url),
  );

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        crossAggregatedMetrics: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live/",
        topPages: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_pages/live/",
      },
      options: {
        primaryDomain,
        competitors,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platforms: [...options.platforms],
        limit: options.limit,
      },
    },
    summary: {
      primaryDomain,
      totalMentions,
      errors,
    },
    ranking,
    competitors: competitors.map((domain) => {
      const topPages = rankTopPages(perTargetPages.get(domain) ?? [], options.limit);
      return {
        domain,
        mentionCount: counts.get(domain) ?? 0,
        shareOfVoice: totalMentions > 0 ? Number(((counts.get(domain) ?? 0) / totalMentions).toFixed(4)) : 0,
        topPages,
        competitorOnlyPages: topPages.filter((page) => !primaryPages.has(page.url)),
      };
    }),
    tasks,
  };
}

export async function runSourceGap(
  client: DataForSeoGeoClient,
  options: SourceGapOptions,
): Promise<SourceGapReport> {
  const domain = normalizeDomainInput(options.domain);
  const keywords = normalizeKeywords(options.keywords);
  if (keywords.length === 0) {
    throw new CliError("At least one `--keyword` value is required.", 2);
  }

  const errors: string[] = [];
  const tasks: SourceGapReport["tasks"] = {
    topDomains: {},
    topPages: {},
  };

  const rows = await Promise.all(
    keywords.map(async (keyword) => {
      const analysis = await analyzeKeywordSourceGap(client, keyword, domain, options, tasks, errors);
      return analysis;
    }),
  );

  if (rows.every((row) => row.topDomains.length === 0 && row.ownedCitations.length === 0 && row.competitorPages.length === 0)) {
    throw new CliError(`All source gap requests failed: ${errors.join("; ")}`, 1);
  }

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        topDomains: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_domains/live/",
        topPages: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_pages/live/",
      },
      options: {
        domain,
        keywords,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platforms: [...options.platforms],
        limit: options.limit,
      },
    },
    summary: {
      domain,
      keywordsRequested: keywords.length,
      ownedKeywords: rows.filter((row) => row.status === "owned").length,
      mixedKeywords: rows.filter((row) => row.status === "mixed").length,
      missingKeywords: rows.filter((row) => row.status === "missing").length,
      errors,
    },
    keywords: rows,
    tasks,
  };
}

export async function runTopicSizing(
  client: DataForSeoGeoClient,
  options: TopicSizingOptions,
): Promise<TopicSizingReport> {
  const domain = normalizeDomainInput(options.domain);
  const keywords = normalizeKeywords(options.keywords);
  if (keywords.length === 0) {
    throw new CliError("At least one `--keyword` value is required.", 2);
  }

  const keywordVolumeTask = await client.aiKeywordSearchVolume({
    keywords,
    locationCode: options.locationCode,
    languageCode: options.languageCode,
  });
  const errors: string[] = [];
  const tasks: TopicSizingReport["tasks"] = {
    keywordSearchVolume: keywordVolumeTask as DataForSeoTask<JsonRecord>,
    topDomains: {},
    topPages: {},
  };

  const volumeRows = extractKeywordVolumeRows(keywordVolumeTask);
  const sourceGapRows = await Promise.all(
    keywords.map((keyword) => analyzeKeywordSourceGap(client, keyword, domain, options, tasks, errors)),
  );
  const sourceGapMap = new Map(sourceGapRows.map((row) => [row.keyword.toLowerCase(), row]));

  const rows = keywords
    .map((keyword) => {
      const sourceGap = sourceGapMap.get(keyword.toLowerCase());
      const volume = volumeRows.get(keyword.toLowerCase());
      return {
        keyword,
        status: sourceGap?.status ?? "missing",
        ownedCitations: sourceGap?.ownedCitations ?? [],
        competitorPages: sourceGap?.competitorPages ?? [],
        topDomains: sourceGap?.topDomains ?? [],
        platforms: sourceGap?.platforms ?? [],
        searchVolumeLastMonth: volume?.searchVolumeLastMonth ?? 0,
        monthlyTrend: volume?.monthlyTrend ?? [],
      } satisfies TopicSizingKeywordRow;
    })
    .sort((left, right) => {
      const leftMissing = left.status === "missing" ? 1 : 0;
      const rightMissing = right.status === "missing" ? 1 : 0;
      if (leftMissing !== rightMissing) {
        return rightMissing - leftMissing;
      }

      if (left.searchVolumeLastMonth !== right.searchVolumeLastMonth) {
        return right.searchVolumeLastMonth - left.searchVolumeLastMonth;
      }

      return left.keyword.localeCompare(right.keyword);
    });

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        keywordSearchVolume: "https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live/",
        topDomains: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_domains/live/",
        topPages: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_pages/live/",
      },
      options: {
        domain,
        keywords,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platforms: [...options.platforms],
        limit: options.limit,
      },
    },
    summary: {
      domain,
      keywordsRequested: keywords.length,
      uncitedKeywords: rows.filter((row) => row.status === "missing").length,
      errors,
    },
    keywords: rows,
    tasks,
  };
}

export async function runCitationReport(
  client: DataForSeoGeoClient,
  options: CitationReportOptions,
): Promise<CitationReport> {
  const domain = normalizeDomainInput(options.domain);
  const tasks: CitationReport["tasks"] = { search: {} };
  const errors: string[] = [];
  const citations: GeoCitationRow[] = [];

  for (const platform of options.platforms) {
    const result = await settleTask(
      client.llmMentionsSearch({
        target: domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        limit: options.limit,
      }),
    );

    if (result.ok) {
      tasks.search[platform] = result.task;
      citations.push(...extractCitationRows(result.task, domain, platform));
    } else {
      errors.push(`${platform} search failed: ${result.error}`);
    }
  }

  ensureAtLeastOneTask(tasks.search, errors, "citation report");
  const topPages = rankTopPages(
    citations.map((citation) => ({
      url: citation.url,
      domain: citation.domain,
      mentions: 1,
      owned: citation.owned,
      platform: citation.platform,
    })),
    options.limit,
  );

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        mentionsSearch: "https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search/live/",
      },
      options: {
        domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platforms: [...options.platforms],
        limit: options.limit,
      },
    },
    summary: {
      domain,
      totalCitations: citations.length,
      uniqueDomains: new Set(citations.map((citation) => citation.domain).filter(Boolean) as string[]).size,
      errors,
    },
    topPages,
    citations,
    tasks,
  };
}

export async function runPromptAudit(
  client: DataForSeoGeoClient,
  options: PromptAuditOptions,
): Promise<PromptAuditReport> {
  const domain = normalizeDomainInput(options.domain);
  const brand = options.brand?.trim() ? options.brand.trim() : undefined;
  const errors: string[] = [];
  const tasks: PromptAuditReport["tasks"] = {};

  const settled = await Promise.all(
    options.engines.map(async (engine) => {
      const result = await settleTask(
        client.llmResponseLive(engine, {
          userPrompt: options.prompt,
          systemMessage: options.systemMessage,
          modelName: DEFAULT_PROMPT_AUDIT_MODELS[engine],
          webSearch: true,
          maxOutputTokens: 1500,
        }),
      );

      return { engine, result };
    }),
  );

  const engines = settled.map(({ engine, result }) => {
    if (!result.ok) {
      errors.push(`${engine} failed: ${result.error}`);
      return {
        engine,
        answerText: "",
        citedUrls: [],
        citedDomains: [],
        mentionedDomain: false,
        mentionedBrand: brand ? false : null,
        errors: [result.error],
        success: false,
      };
    }

    tasks[engine] = result.task;
    const answerText = extractResponseText(result.task);
    const citedUrls = dedupeStrings(extractResponseUrls(result.task));
    const citedDomains = dedupeStrings(
      citedUrls
        .map((url) => safeHostname(url))
        .filter((value): value is string => Boolean(value)),
    );
    const mentionedDomain =
      answerText.toLowerCase().includes(domain.toLowerCase()) ||
      citedDomains.some((candidate) => domainOwnsHostname(domain, candidate));
    const mentionedBrand = brand ? answerText.toLowerCase().includes(brand.toLowerCase()) : null;

    return {
      engine,
      answerText,
      citedUrls,
      citedDomains,
      mentionedDomain,
      mentionedBrand,
      errors: [],
      success: true,
    };
  });

  if (engines.every((entry) => !entry.success)) {
    throw new CliError(`All prompt audit requests failed: ${errors.join("; ")}`, 1);
  }

  return {
    meta: {
      provider: "dataforseo",
      generatedAt: new Date().toISOString(),
      docs: {
        llmResponses: "https://docs.dataforseo.com/v3/ai_optimization/llm_responses/overview/",
      },
      options: {
        prompt: options.prompt,
        domain,
        brand: brand ?? null,
        engines: [...options.engines],
        systemMessage: options.systemMessage ?? null,
      },
    },
    summary: {
      domain,
      enginesRequested: options.engines.length,
      enginesSucceeded: engines.filter((entry) => entry.success).length,
      errors,
    },
    engines,
    tasks,
  };
}

async function analyzeKeywordSourceGap(
  client: DataForSeoGeoClient,
  keyword: string,
  domain: string,
  options: GeoMentionOptions,
  tasks: {
    topDomains: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
    topPages: Partial<Record<string, Partial<Record<DataForSeoMentionsPlatform, DataForSeoTask<DataForSeoLlmMentionResult>>>>>;
  },
  errors: string[],
): Promise<SourceGapKeywordRow> {
  const topDomains: GeoTopDomain[] = [];
  const topPages: GeoTopPage[] = [];
  const platformsHit = new Set<DataForSeoMentionsPlatform>();

  for (const platform of options.platforms) {
    const [topDomainsResult, topPagesResult] = await Promise.allSettled([
      client.llmMentionsTopDomains({
        target: keyword,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        searchScope: "sources",
        limit: options.limit,
      }),
      client.llmMentionsTopPages({
        target: keyword,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        platform,
        searchScope: "sources",
        limit: options.limit,
      }),
    ]);

    if (topDomainsResult.status === "fulfilled") {
      if (!tasks.topDomains[keyword]) {
        tasks.topDomains[keyword] = {};
      }
      tasks.topDomains[keyword]![platform] = topDomainsResult.value;
      const rows = extractTopDomains(topDomainsResult.value, domain, platform);
      if (rows.length > 0) {
        platformsHit.add(platform);
      }
      topDomains.push(...rows);
    } else {
      errors.push(`${platform} top domains failed for keyword "${keyword}": ${errorMessage(topDomainsResult.reason)}`);
    }

    if (topPagesResult.status === "fulfilled") {
      if (!tasks.topPages[keyword]) {
        tasks.topPages[keyword] = {};
      }
      tasks.topPages[keyword]![platform] = topPagesResult.value;
      const rows = extractTopPages(topPagesResult.value, domain, platform);
      if (rows.length > 0) {
        platformsHit.add(platform);
      }
      topPages.push(...rows);
    } else {
      errors.push(`${platform} top pages failed for keyword "${keyword}": ${errorMessage(topPagesResult.reason)}`);
    }
  }

  const rankedTopDomains = rankTopDomains(topDomains, options.limit);
  const rankedTopPages = rankTopPages(topPages, options.limit);
  const ownedCitations = rankedTopPages.filter((page) => page.owned);
  const competitorPages = rankedTopPages.filter((page) => !page.owned);
  const status = determineKeywordCitationStatus(rankedTopDomains, rankedTopPages);

  return {
    keyword,
    status,
    ownedCitations,
    competitorPages,
    topDomains: rankedTopDomains,
    platforms: [...platformsHit],
  };
}

function determineKeywordCitationStatus(topDomains: GeoTopDomain[], topPages: GeoTopPage[]): KeywordCitationStatus {
  const hasOwned = topDomains.some((row) => row.owned) || topPages.some((row) => row.owned);
  const hasCompetitor = topDomains.some((row) => !row.owned) || topPages.some((row) => !row.owned);

  if (hasOwned && !hasCompetitor) {
    return "owned";
  }

  if (hasOwned && hasCompetitor) {
    return "mixed";
  }

  return "missing";
}

function extractKeywordVolumeRows(task: DataForSeoTask<JsonRecord>): Map<string, { searchVolumeLastMonth: number; monthlyTrend: number[] }> {
  const rows = new Map<string, { searchVolumeLastMonth: number; monthlyTrend: number[] }>();

  for (const item of extractItems(task as DataForSeoTask<JsonRecord>)) {
    const keyword = pickString(item, ["keyword", "key", "query"]);
    if (!keyword) {
      continue;
    }

    rows.set(keyword.toLowerCase(), {
      searchVolumeLastMonth: pickNumber(item, ["search_volume_last_month", "search_volume", "volume"]) ?? 0,
      monthlyTrend: extractMonthlyTrend(item),
    });
  }

  return rows;
}

function extractMonthlyTrend(item: JsonRecord): number[] {
  const values = item.monthly_searches;
  if (Array.isArray(values)) {
    return values
      .map((entry) => {
        if (typeof entry === "number") {
          return entry;
        }

        if (isRecord(entry)) {
          return pickNumber(entry, ["search_volume", "volume", "value"]) ?? 0;
        }

        return 0;
      })
      .filter((value) => Number.isFinite(value));
  }

  return [];
}

function extractCrossMetricRows(task: DataForSeoTask<DataForSeoLlmMentionResult>): Array<{ key: string; mentions: number }> {
  return extractItems(task)
    .map((item) => {
      const key = normalizePossibleDomain(pickString(item, ["key", "target", "domain", "value"]));
      const mentions = pickNumber(item, ["mention_count", "mentions", "count"]) ?? recursiveMentionCount(item);
      return key ? { key, mentions } : null;
    })
    .filter((value): value is { key: string; mentions: number } => value !== null);
}

function aggregateMentionCount(task: DataForSeoTask<DataForSeoLlmMentionResult>): number {
  const direct = pickNumber(task.data, ["mention_count", "mentions", "count"]);
  if (direct !== undefined) {
    return direct;
  }

  const itemSum = extractItems(task).reduce((sum, item) => sum + (pickNumber(item, ["mention_count", "mentions", "count"]) ?? recursiveMentionCount(item)), 0);
  if (itemSum > 0) {
    return itemSum;
  }

  return task.result_count ?? 0;
}

function extractTopDomains(
  task: DataForSeoTask<DataForSeoLlmMentionResult>,
  ownedDomain: string,
  platform: DataForSeoMentionsPlatform,
): GeoTopDomain[] {
  return extractItems(task)
    .map((item) => {
      const domain = normalizePossibleDomain(pickString(item, ["domain", "key", "target", "url", "page", "link"]));
      if (!domain) {
        return null;
      }

      return {
        domain,
        mentions: pickNumber(item, ["mention_count", "mentions", "count"]) ?? recursiveMentionCount(item) ?? 0,
        owned: domainOwnsHostname(ownedDomain, domain),
        platform,
      } satisfies GeoTopDomain;
    })
    .filter((value): value is GeoTopDomain => value !== null);
}

function extractTopPages(
  task: DataForSeoTask<DataForSeoLlmMentionResult>,
  ownedDomain: string,
  platform: DataForSeoMentionsPlatform,
): GeoTopPage[] {
  return extractItems(task)
    .map((item) => {
      const url = normalizePossibleUrl(pickString(item, ["url", "page", "page_url", "link"]));
      if (!url) {
        return null;
      }

      const domain = safeHostname(url);
      return {
        url,
        domain,
        mentions: pickNumber(item, ["mention_count", "mentions", "count"]) ?? recursiveMentionCount(item) ?? 0,
        owned: domain ? domainOwnsHostname(ownedDomain, domain) : false,
        platform,
      } satisfies GeoTopPage;
    })
    .filter((value): value is GeoTopPage => value !== null);
}

function extractCitationRows(
  task: DataForSeoTask<DataForSeoLlmMentionResult>,
  ownedDomain: string,
  platform: DataForSeoMentionsPlatform,
): GeoCitationRow[] {
  const rows: GeoCitationRow[] = [];

  for (const item of extractItems(task)) {
    const question = pickString(item, ["question", "prompt", "query"]) ?? null;
    const answer = pickString(item, ["answer", "response", "text"]) ?? null;
    const sourceUrls = collectUrlsByLikelyKey(item, ["source", "sources", "reference", "references"]);
    const searchResultUrls = collectUrlsByLikelyKey(item, ["search_result", "search_results"]);
    const fallbackUrls = collectUrlsDeep(item);

    for (const url of sourceUrls) {
      rows.push(buildCitationRow(platform, question, answer, url, "source", ownedDomain));
    }

    for (const url of searchResultUrls) {
      rows.push(buildCitationRow(platform, question, answer, url, "search_result", ownedDomain));
    }

    if (sourceUrls.length === 0 && searchResultUrls.length === 0) {
      for (const url of fallbackUrls) {
        rows.push(buildCitationRow(platform, question, answer, url, "reference", ownedDomain));
      }
    }
  }

  return dedupeCitationRows(rows);
}

function buildCitationRow(
  platform: DataForSeoMentionsPlatform,
  question: string | null,
  answer: string | null,
  url: string,
  scope: GeoCitationRow["scope"],
  ownedDomain: string,
): GeoCitationRow {
  const domain = safeHostname(url);
  return {
    platform,
    question,
    answer,
    url,
    domain,
    scope,
    owned: domain ? domainOwnsHostname(ownedDomain, domain) : false,
  };
}

function extractResponseText(task: DataForSeoTask<DataForSeoLlmResponseResult>): string {
  const parts: string[] = [];
  collectTextDeep(task.result ?? [], parts);
  return dedupeStrings(parts.map((part) => part.trim()).filter(Boolean)).join("\n\n");
}

function extractResponseUrls(task: DataForSeoTask<DataForSeoLlmResponseResult>): string[] {
  return collectUrlsDeep(task.result ?? []);
}

function collectTextDeep(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    parts.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTextDeep(entry, parts);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && ["text", "answer", "response", "content", "title", "snippet"].includes(key)) {
      parts.push(entry);
      continue;
    }

    collectTextDeep(entry, parts);
  }
}

function collectUrlsByLikelyKey(value: unknown, keys: string[]): string[] {
  const urls: string[] = [];
  collectUrlsByKey(value, new Set(keys), urls);
  return dedupeStrings(urls);
}

function collectUrlsByKey(value: unknown, keys: Set<string>, urls: string[]): void {
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectUrlsByKey(entry, keys, urls);
    }
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (keys.has(key)) {
      urls.push(...collectUrlsDeep(entry));
      continue;
    }

    collectUrlsByKey(entry, keys, urls);
  }
}

function collectUrlsDeep(value: unknown): string[] {
  const urls: string[] = [];

  const visit = (entry: unknown): void => {
    if (typeof entry === "string") {
      const normalized = normalizePossibleUrl(entry);
      if (normalized) {
        urls.push(normalized);
      }
      return;
    }

    if (Array.isArray(entry)) {
      for (const item of entry) {
        visit(item);
      }
      return;
    }

    if (!isRecord(entry)) {
      return;
    }

    for (const item of Object.values(entry)) {
      visit(item);
    }
  };

  visit(value);
  return dedupeStrings(urls);
}

function extractItems(task: DataForSeoTask<JsonRecord>): JsonRecord[] {
  const rows: JsonRecord[] = [];

  for (const result of task.result ?? []) {
    if (!isRecord(result)) {
      continue;
    }

    let pushedFromCollection = false;
    const candidates = [result.items, result.groups, result.domains, result.pages];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          if (isRecord(item)) {
            rows.push(item);
            pushedFromCollection = true;
          }
        }
      }
    }

    if (!pushedFromCollection && hasUsefulItemShape(result)) {
      rows.push(result);
    }
  }

  return rows;
}

function hasUsefulItemShape(value: JsonRecord): boolean {
  return Boolean(pickString(value, ["keyword", "domain", "url", "page", "question", "answer", "key", "target"]));
}

function rankTopDomains(rows: GeoTopDomain[], limit: number): GeoTopDomain[] {
  const ranked = new Map<string, GeoTopDomain>();

  for (const row of rows) {
    const key = `${row.platform}:${row.domain}`;
    const existing = ranked.get(key);
    if (existing) {
      existing.mentions += row.mentions;
      continue;
    }

    ranked.set(key, { ...row });
  }

  return [...ranked.values()]
    .sort((left, right) => right.mentions - left.mentions || left.domain.localeCompare(right.domain))
    .slice(0, limit);
}

function rankTopPages(rows: GeoTopPage[], limit: number): GeoTopPage[] {
  const ranked = new Map<string, GeoTopPage>();

  for (const row of rows) {
    const key = `${row.platform}:${row.url}`;
    const existing = ranked.get(key);
    if (existing) {
      existing.mentions += row.mentions;
      continue;
    }

    ranked.set(key, { ...row });
  }

  return [...ranked.values()]
    .sort((left, right) => right.mentions - left.mentions || left.url.localeCompare(right.url))
    .slice(0, limit);
}

function dedupeCitationRows(rows: GeoCitationRow[]): GeoCitationRow[] {
  const deduped = new Map<string, GeoCitationRow>();

  for (const row of rows) {
    const key = [row.platform, row.scope, row.url, row.question ?? "", row.answer ?? ""].join("::");
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  }

  return [...deduped.values()];
}

function pickString(value: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const entry = value[key];
    if (typeof entry === "string" && entry.trim()) {
      return entry;
    }
  }

  return undefined;
}

function pickNumber(value: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const entry = value[key];
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }
  }

  return undefined;
}

function recursiveMentionCount(value: unknown): number {
  if (typeof value === "number") {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => sum + recursiveMentionCount(entry), 0);
  }

  if (!isRecord(value)) {
    return 0;
  }

  let sum = 0;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry) && ["mention_count", "mentions", "count"].includes(key)) {
      sum += entry;
      continue;
    }

    sum += recursiveMentionCount(entry);
  }

  return sum;
}

function normalizePossibleUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizePossibleDomain(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const fromUrl = normalizePossibleUrl(value);
  if (fromUrl) {
    return safeHostname(fromUrl);
  }

  try {
    return normalizeDomainInput(value);
  } catch {
    return null;
  }
}

function safeHostname(value: string): string | null {
  try {
    return stripLeadingWww(new URL(value).hostname.toLowerCase());
  } catch {
    return null;
  }
}

function stripLeadingWww(value: string): string {
  return value.replace(/^www\./, "");
}

function domainOwnsHostname(domain: string, hostname: string): boolean {
  const normalizedDomain = stripLeadingWww(domain.toLowerCase());
  const normalizedHostname = stripLeadingWww(hostname.toLowerCase());
  return normalizedHostname === normalizedDomain || normalizedHostname.endsWith(`.${normalizedDomain}`);
}

function ensureAtLeastOneTask(
  tasks: Partial<Record<string, unknown>>,
  errors: string[],
  label: string,
): void {
  if (Object.keys(tasks).length === 0) {
    throw new CliError(`All ${label} requests failed: ${errors.join("; ")}`, 1);
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function dedupeDomains(values: string[]): string[] {
  return dedupeStrings(values.map((value) => normalizeDomainInput(value)));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function settleTask<T>(promise: Promise<DataForSeoTask<T>>): Promise<{ ok: true; task: DataForSeoTask<T> } | { ok: false; error: string }> {
  try {
    return { ok: true, task: await promise };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
