import { describe, expect, it } from "vitest";
import { getSeoOverview } from "../worker/lib/seo.ts";

function createDb(results: unknown[]) {
  let index = 0;

  return {
    select() {
      const result = results[index++];
      return {
        from() {
          return Promise.resolve(result);
        },
      };
    },
    execute() {
      const result = results[index++];
      return Promise.resolve({ rows: result });
    },
  };
}

describe("getSeoOverview", () => {
  it("normalizes string timestamps before sorting overview data", async () => {
    const db = createDb([
      [{ id: 1, name: "Acme", domain: "acme.com" }],
      [
        {
          id: 11,
          siteId: 1,
          url: "https://acme.com/services",
          titleTag: "Services",
          metaDescription: null,
          h1: "Services",
          pageType: "service",
          statusCode: 200,
          indexability: "index",
          contentStatus: "published",
          isMoneyPage: true,
          isAuthorityAsset: false,
          lastCrawledAt: "2026-03-12T08:00:00.000Z",
          lastAuditedOn: null,
        },
      ],
      [
        {
          id: 21,
          siteId: 1,
          name: "Primary services",
          primaryIntent: "transactional",
          funnelStage: "decision",
          priorityScore: "88",
        },
      ],
      [{ clusterId: 21, query: "acme services", isPrimary: true }],
      [{ pageId: 11, clusterId: 21 }],
      [
        {
          id: 31,
          siteId: 1,
          label: "Example Competitor",
          competitorDomain: "example.com",
          competitorType: "direct",
          isActive: true,
          notes: null,
        },
      ],
      [
        {
          siteCompetitorId: 31,
          location: "United States",
          languageCode: "en",
          estimatedOrganicTraffic: 1200,
          estimatedPaidTraffic: 30,
          rankedKeywordsCount: 400,
          top3KeywordsCount: 22,
          top10KeywordsCount: 57,
          top100KeywordsCount: 300,
          visibilityScore: "12.34",
          capturedAt: "2026-03-11T00:00:00.000Z",
        },
      ],
      [
        {
          siteId: 1,
          location: "United States",
          languageCode: "en",
          estimatedOrganicTraffic: 900,
          estimatedPaidTraffic: 10,
          rankedKeywordsCount: 250,
          top3KeywordsCount: 12,
          top10KeywordsCount: 40,
          top100KeywordsCount: 180,
          visibilityScore: "9.87",
          capturedAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      [
        {
          siteCompetitorId: 31,
          keywordRowCount: 1,
          latestKeywordCount: 1,
          latestKeywordCapturedAt: "2026-03-11T00:00:00.000Z",
        },
      ],
      [
        {
          siteCompetitorId: 31,
          keyword: "acme alternative",
          location: "United States",
          languageCode: "en",
          rank: 3,
          searchVolume: 600,
          keywordDifficulty: "45.00",
          searchIntent: "commercial",
          isRelevant: null,
          rankingUrl: "https://example.com/acme-alternative",
          serpItemType: "organic",
          estimatedTraffic: "18.50",
          capturedAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    ]) as never;

    const overview = await getSeoOverview(db);

    expect(overview.sites[0]?.latestFootprint?.capturedAt).toBeInstanceOf(Date);
    expect(overview.sites[0]?.history[0]?.capturedAt).toBeInstanceOf(Date);
    expect(overview.pages[0]?.lastCrawledAt).toBeInstanceOf(Date);
    expect(overview.competitors[0]?.latestFootprint?.capturedAt).toBeInstanceOf(Date);
    expect(overview.competitors[0]?.latestKeywordCapturedAt).toBeInstanceOf(Date);
    expect(overview.competitors[0]?.topKeywords[0]?.capturedAt).toBeInstanceOf(Date);
  });
});
