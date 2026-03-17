import assert from "node:assert/strict";
import test from "node:test";

import type {
  AiKeywordSearchVolumeRequestOptions,
  DataForSeoGeoClient,
  DataForSeoLlmMentionResult,
  DataForSeoLlmResponseEngine,
  DataForSeoLlmResponseResult,
  DataForSeoMentionsPlatform,
  DataForSeoTask,
  LlmMentionsAggregatedMetricsRequestOptions,
  LlmMentionsCrossAggregatedMetricsRequestOptions,
  LlmMentionsRequestOptions,
  LlmMentionsTopRequestOptions,
  LlmResponseLiveRequestOptions,
} from "../src/providers/dataforseo/client.ts";
import {
  runBrandVisibility,
  runCompetitorGap,
  runPromptAudit,
  runTopicSizing,
} from "../src/providers/dataforseo/geo.ts";

class FakeGeoClient implements DataForSeoGeoClient {
  async aiKeywordSearchVolume(
    options: AiKeywordSearchVolumeRequestOptions,
  ): Promise<DataForSeoTask<Record<string, unknown>>> {
    return task("/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live", {
      options,
      result: [
        {
          items: options.keywords.map((keyword) => ({
            keyword,
            search_volume_last_month: keyword === "crm software" ? 80 : 200,
            monthly_searches: [{ search_volume: keyword === "crm software" ? 70 : 190 }, { search_volume: 50 }],
          })),
        },
      ],
    });
  }

  async llmMentionsSearch(
    options: LlmMentionsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return task("/v3/ai_optimization/llm_mentions/search/live", {
      options,
      result: [
        {
          items: [
            {
              question: `best answer for ${options.target}`,
              answer: `Sources mention ${options.target}`,
              sources: [{ url: "https://example.com/guide" }, { url: "https://competitor.com/compare" }],
              search_results: [{ url: "https://search.example.com/result" }],
            },
          ],
        },
      ],
    });
  }

  async llmMentionsAggregatedMetrics(
    options: LlmMentionsAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return task("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", {
      options,
      result: [
        {
          items: [{ key: options.platform, mention_count: options.platform === "google" ? 3 : 2 }],
        },
      ],
    });
  }

  async llmMentionsCrossAggregatedMetrics(
    options: LlmMentionsCrossAggregatedMetricsRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    return task("/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live", {
      options,
      result: [
        {
          items: options.targets.map((target) => ({
            target,
            mention_count:
              target === "example.com"
                ? 10
                : target === "competitor-a.com"
                  ? 7
                  : 4,
          })),
        },
      ],
    });
  }

  async llmMentionsTopDomains(
    options: LlmMentionsTopRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    if (options.target === "crm software") {
      return task("/v3/ai_optimization/llm_mentions/top_domains/live", {
        options,
        result: [{ items: [{ domain: "example.com", mention_count: 4 }] }],
      });
    }

    return task("/v3/ai_optimization/llm_mentions/top_domains/live", {
      options,
      result: [{ items: [{ domain: "competitor.com", mention_count: 6 }] }],
    });
  }

  async llmMentionsTopPages(
    options: LlmMentionsTopRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmMentionResult>> {
    if (options.target === "example.com") {
      return task("/v3/ai_optimization/llm_mentions/top_pages/live", {
        options,
        result: [
          {
            items: [
              { url: "https://example.com/guide", mention_count: 5 },
              { url: "https://example.com/pricing", mention_count: 2 },
            ],
          },
        ],
      });
    }

    if (options.target === "competitor-a.com") {
      return task("/v3/ai_optimization/llm_mentions/top_pages/live", {
        options,
        result: [{ items: [{ url: "https://competitor-a.com/alt", mention_count: 3 }] }],
      });
    }

    if (options.target === "competitor-b.com") {
      return task("/v3/ai_optimization/llm_mentions/top_pages/live", {
        options,
        result: [{ items: [{ url: "https://competitor-b.com/plan", mention_count: 2 }] }],
      });
    }

    if (options.target === "crm software") {
      return task("/v3/ai_optimization/llm_mentions/top_pages/live", {
        options,
        result: [{ items: [{ url: "https://example.com/guide", mention_count: 4 }] }],
      });
    }

    return task("/v3/ai_optimization/llm_mentions/top_pages/live", {
      options,
      result: [{ items: [{ url: "https://competitor.com/compare", mention_count: 6 }] }],
    });
  }

  async llmResponseLive(
    engine: DataForSeoLlmResponseEngine,
    options: LlmResponseLiveRequestOptions,
  ): Promise<DataForSeoTask<DataForSeoLlmResponseResult>> {
    return task(`/v3/ai_optimization/${engine}/llm_responses/live`, {
      options,
      result: [
        {
          items: [
            {
              sections: [{ text: `${engine} recommends Example CRM from example.com` }],
              references: [{ url: "https://example.com/guide" }, { url: "https://docs.vendor.com/page" }],
            },
          ],
        },
      ],
    });
  }
}

test("runBrandVisibility builds a normalized visibility report", async () => {
  const report = await runBrandVisibility(new FakeGeoClient(), {
    domain: "example.com",
    locationCode: 2840,
    languageCode: "en",
    platforms: ["google", "chat_gpt"],
    limit: 10,
  });

  assert.equal(report.summary.domain, "example.com");
  assert.equal(report.summary.totalMentions, 5);
  assert.equal(report.platformBreakdown.length, 2);
  assert.equal(report.topSourceDomains[0]?.domain, "competitor.com");
  assert.equal(report.topPages[0]?.url, "https://example.com/guide");
  assert.equal(report.sampleCitations[0]?.owned, true);
});

test("runCompetitorGap ranks competitors and highlights competitor-only pages", async () => {
  const report = await runCompetitorGap(new FakeGeoClient(), {
    primaryDomain: "example.com",
    competitors: ["competitor-a.com", "competitor-b.com"],
    locationCode: 2840,
    languageCode: "en",
    platforms: ["google"],
    limit: 10,
  });

  assert.equal(report.ranking[0]?.domain, "example.com");
  assert.equal(report.competitors[0]?.domain, "competitor-a.com");
  assert.equal(report.competitors[0]?.competitorOnlyPages[0]?.url, "https://competitor-a.com/alt");
});

test("runPromptAudit detects domain and brand mentions across engines", async () => {
  const report = await runPromptAudit(new FakeGeoClient(), {
    prompt: "best crm",
    domain: "example.com",
    brand: "Example CRM",
    engines: ["chatgpt", "gemini"],
  });

  assert.equal(report.summary.enginesSucceeded, 2);
  assert.equal(report.engines[0]?.mentionedDomain, true);
  assert.equal(report.engines[0]?.mentionedBrand, true);
  assert.deepEqual(report.engines[0]?.citedDomains, ["example.com", "docs.vendor.com"]);
});

test("runTopicSizing sorts uncited keywords first and preserves volume data", async () => {
  const report = await runTopicSizing(new FakeGeoClient(), {
    domain: "example.com",
    keywords: ["crm software", "sales ai"],
    locationCode: 2840,
    languageCode: "en",
    platforms: ["google"],
    limit: 10,
  });

  assert.equal(report.keywords[0]?.keyword, "sales ai");
  assert.equal(report.keywords[0]?.status, "missing");
  assert.equal(report.keywords[0]?.searchVolumeLastMonth, 200);
  assert.equal(report.keywords[1]?.status, "owned");
  assert.deepEqual(report.keywords[1]?.monthlyTrend, [70, 50]);
});

function task(
  endpoint: string,
  options: {
    options: unknown;
    result: Array<Record<string, unknown>>;
  },
): DataForSeoTask<Record<string, unknown>> {
  return {
    id: `${endpoint}:task`,
    status_code: 20000,
    status_message: "Ok.",
    time: "0.1 sec.",
    cost: 0.01,
    result_count: options.result.length,
    path: ["v3", ...endpoint.split("/").filter(Boolean)],
    data: isRecord(options.options) ? options.options : {},
    result: options.result,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
