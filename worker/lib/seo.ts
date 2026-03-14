import { and, between, desc, eq, isNotNull, sql, sum } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  analyticsDaily,
  backlinkSources,
  competitorBacklinkSources,
  competitorDomainFootprints,
  linkOpportunities,
  outreachProspects,
  pageClusterTargets,
  pages,
  queryClusters,
  queries,
  siteDomainFootprints,
  siteCompetitors,
  sites,
} from "../../drizzle/schema/seo.ts";

function parseRequiredDate(value: Date | string, fieldName: string): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ${fieldName}: ${String(value)}`);
  }

  return date;
}

function parseOptionalDate(value: Date | string | null, fieldName: string): Date | null {
  if (value === null) return null;
  return parseRequiredDate(value, fieldName);
}

export type SeoOverview = {
  summary: {
    siteCount: number;
    pageCount: number;
    clusterCount: number;
    keywordCount: number;
    mappedPageCount: number;
  };
  sites: Array<{
    id: number;
    name: string;
    domain: string;
    pageCount: number;
    clusterCount: number;
    keywordCount: number;
    mappedPageCount: number;
    footprintSnapshotCount: number;
    latestFootprint: {
      location: string;
      languageCode: string;
      estimatedOrganicTraffic: number | null;
      estimatedPaidTraffic: number | null;
      rankedKeywordsCount: number | null;
      top3KeywordsCount: number | null;
      top10KeywordsCount: number | null;
      top100KeywordsCount: number | null;
      visibilityScore: string | null;
      capturedAt: Date;
    } | null;
    history: Array<{
      estimatedOrganicTraffic: number | null;
      rankedKeywordsCount: number | null;
      capturedAt: Date;
    }>;
  }>;
  competitors: Array<{
    id: number;
    siteId: number;
    label: string;
    competitorDomain: string;
    competitorType: string;
    isActive: boolean;
    notes: string | null;
    footprintSnapshotCount: number;
    keywordRowCount: number;
    latestKeywordCount: number;
    latestKeywordCapturedAt: Date | null;
    latestFootprint: {
      location: string;
      languageCode: string;
      estimatedOrganicTraffic: number | null;
      estimatedPaidTraffic: number | null;
      rankedKeywordsCount: number | null;
      top3KeywordsCount: number | null;
      top10KeywordsCount: number | null;
      top100KeywordsCount: number | null;
      visibilityScore: string | null;
      capturedAt: Date;
    } | null;
    history: Array<{
      estimatedOrganicTraffic: number | null;
      rankedKeywordsCount: number | null;
      capturedAt: Date;
    }>;
    topKeywords: Array<{
      keyword: string;
      location: string;
      languageCode: string;
      rank: number;
      searchVolume: number;
      keywordDifficulty: string | null;
      searchIntent: string | null;
      rankingUrl: string;
      serpItemType: string | null;
      estimatedTraffic: string | null;
      capturedAt: Date;
    }>;
  }>;
  pages: Array<{
    id: number;
    siteId: number;
    siteName: string;
    siteDomain: string;
    url: string;
    displayTitle: string;
    pageType: string;
    metaDescription: string | null;
    h1: string | null;
    statusCode: number | null;
    indexability: string | null;
    contentStatus: string;
    isMoneyPage: boolean;
    isAuthorityAsset: boolean;
    lastCrawledAt: Date | null;
    clusterCount: number;
    clusterNames: string[];
  }>;
  clusters: Array<{
    id: number;
    siteId: number;
    siteName: string;
    siteDomain: string;
    name: string;
    primaryIntent: string;
    funnelStage: string | null;
    priorityScore: string | null;
    keywordCount: number;
    primaryKeyword: string | null;
    keywords: string[];
    pageUrls: string[];
  }>;
};

type CompetitorKeywordStatsRow = {
  siteCompetitorId: number;
  keywordRowCount: number;
  latestKeywordCount: number;
  latestKeywordCapturedAt: Date | string | null;
};

type CompetitorTopKeywordRow = {
  siteCompetitorId: number;
  keyword: string;
  location: string;
  languageCode: string;
  rank: number;
  searchVolume: number;
  keywordDifficulty: string | null;
  searchIntent: string | null;
  rankingUrl: string;
  serpItemType: string | null;
  estimatedTraffic: string | null;
  capturedAt: Date | string;
};

export async function getSeoOverview(db: Database): Promise<SeoOverview> {
  const [
    siteRows,
    pageRows,
    clusterRows,
    queryRows,
    targetRows,
    competitorRows,
    footprintRows,
    siteFootprintRows,
    competitorKeywordStatsResult,
    competitorTopKeywordsResult,
  ] = await Promise.all([
    db
      .select({
        id: sites.id,
        name: sites.name,
        domain: sites.domain,
      })
      .from(sites),
    db
      .select({
        id: pages.id,
        siteId: pages.siteId,
        url: pages.url,
        titleTag: pages.titleTag,
        metaDescription: pages.metaDescription,
        h1: pages.h1,
        pageType: pages.pageType,
        statusCode: pages.statusCode,
        indexability: pages.indexability,
        contentStatus: pages.contentStatus,
        isMoneyPage: pages.isMoneyPage,
        isAuthorityAsset: pages.isAuthorityAsset,
        lastCrawledAt: pages.lastCrawledAt,
      })
      .from(pages),
    db
      .select({
        id: queryClusters.id,
        siteId: queryClusters.siteId,
        name: queryClusters.name,
        primaryIntent: queryClusters.primaryIntent,
        funnelStage: queryClusters.funnelStage,
        priorityScore: queryClusters.priorityScore,
      })
      .from(queryClusters),
    db
      .select({
        clusterId: queries.clusterId,
        query: queries.query,
        isPrimary: queries.isPrimary,
      })
      .from(queries),
    db
      .select({
        pageId: pageClusterTargets.pageId,
        clusterId: pageClusterTargets.clusterId,
      })
      .from(pageClusterTargets),
    db
      .select({
        id: siteCompetitors.id,
        siteId: siteCompetitors.siteId,
        label: siteCompetitors.label,
        competitorDomain: siteCompetitors.competitorDomain,
        competitorType: siteCompetitors.competitorType,
        isActive: siteCompetitors.isActive,
        notes: siteCompetitors.notes,
      })
      .from(siteCompetitors),
    db
      .select({
        siteCompetitorId: competitorDomainFootprints.siteCompetitorId,
        location: competitorDomainFootprints.location,
        languageCode: competitorDomainFootprints.languageCode,
        estimatedOrganicTraffic: competitorDomainFootprints.estimatedOrganicTraffic,
        estimatedPaidTraffic: competitorDomainFootprints.estimatedPaidTraffic,
        rankedKeywordsCount: competitorDomainFootprints.rankedKeywordsCount,
        top3KeywordsCount: competitorDomainFootprints.top3KeywordsCount,
        top10KeywordsCount: competitorDomainFootprints.top10KeywordsCount,
        top100KeywordsCount: competitorDomainFootprints.top100KeywordsCount,
        visibilityScore: competitorDomainFootprints.visibilityScore,
        capturedAt: competitorDomainFootprints.capturedAt,
      })
      .from(competitorDomainFootprints),
    db
      .select({
        siteId: siteDomainFootprints.siteId,
        location: siteDomainFootprints.location,
        languageCode: siteDomainFootprints.languageCode,
        estimatedOrganicTraffic: siteDomainFootprints.estimatedOrganicTraffic,
        estimatedPaidTraffic: siteDomainFootprints.estimatedPaidTraffic,
        rankedKeywordsCount: siteDomainFootprints.rankedKeywordsCount,
        top3KeywordsCount: siteDomainFootprints.top3KeywordsCount,
        top10KeywordsCount: siteDomainFootprints.top10KeywordsCount,
        top100KeywordsCount: siteDomainFootprints.top100KeywordsCount,
        visibilityScore: siteDomainFootprints.visibilityScore,
        capturedAt: siteDomainFootprints.capturedAt,
      })
      .from(siteDomainFootprints),
    db.execute(sql<CompetitorKeywordStatsRow>`
      WITH latest_snapshots AS (
        SELECT
          site_competitor_id,
          MAX(captured_at) AS captured_at
        FROM competitor_ranked_keywords
        GROUP BY site_competitor_id
      )
      SELECT
        crk.site_competitor_id AS "siteCompetitorId",
        COUNT(*)::integer AS "keywordRowCount",
        COUNT(*) FILTER (
          WHERE crk.captured_at = latest_snapshots.captured_at
        )::integer AS "latestKeywordCount",
        latest_snapshots.captured_at AS "latestKeywordCapturedAt"
      FROM competitor_ranked_keywords crk
      INNER JOIN latest_snapshots
        ON latest_snapshots.site_competitor_id = crk.site_competitor_id
      GROUP BY crk.site_competitor_id, latest_snapshots.captured_at
    `),
    db.execute(sql<CompetitorTopKeywordRow>`
      WITH latest_snapshots AS (
        SELECT
          site_competitor_id,
          MAX(captured_at) AS captured_at
        FROM competitor_ranked_keywords
        GROUP BY site_competitor_id
      ),
      ranked_latest AS (
        SELECT
          crk.site_competitor_id AS "siteCompetitorId",
          crk.keyword,
          crk.location,
          crk.language_code AS "languageCode",
          crk.rank,
          crk.search_volume AS "searchVolume",
          crk.keyword_difficulty AS "keywordDifficulty",
          crk.search_intent AS "searchIntent",
          crk.ranking_url AS "rankingUrl",
          crk.serp_item_type AS "serpItemType",
          crk.estimated_traffic AS "estimatedTraffic",
          crk.captured_at AS "capturedAt",
          ROW_NUMBER() OVER (
            PARTITION BY crk.site_competitor_id
            ORDER BY crk.rank ASC, crk.search_volume DESC, crk.keyword ASC
          ) AS keyword_rank
        FROM competitor_ranked_keywords crk
        INNER JOIN latest_snapshots
          ON latest_snapshots.site_competitor_id = crk.site_competitor_id
         AND latest_snapshots.captured_at = crk.captured_at
      )
      SELECT
        "siteCompetitorId",
        keyword,
        location,
        "languageCode",
        rank,
        "searchVolume",
        "keywordDifficulty",
        "searchIntent",
        "rankingUrl",
        "serpItemType",
        "estimatedTraffic",
        "capturedAt"
      FROM ranked_latest
      WHERE keyword_rank <= 8
      ORDER BY "siteCompetitorId", keyword_rank
    `),
  ]);

  const normalizedPageRows = pageRows.map((page) => ({
    ...page,
    lastCrawledAt: parseOptionalDate(page.lastCrawledAt, "pages.lastCrawledAt"),
  }));

  const normalizedFootprintRows = footprintRows.map((row) => ({
    ...row,
    capturedAt: parseRequiredDate(
      row.capturedAt,
      "competitor_domain_footprints.capturedAt",
    ),
  }));

  const normalizedSiteFootprintRows = siteFootprintRows.map((row) => ({
    ...row,
    capturedAt: parseRequiredDate(row.capturedAt, "site_domain_footprints.capturedAt"),
  }));

  const competitorKeywordStatsRows =
    competitorKeywordStatsResult.rows as CompetitorKeywordStatsRow[];
  const competitorTopKeywordRows =
    competitorTopKeywordsResult.rows as CompetitorTopKeywordRow[];

  const normalizedCompetitorKeywordStatsRows = competitorKeywordStatsRows.map((row) => ({
    ...row,
    latestKeywordCapturedAt: parseOptionalDate(
      row.latestKeywordCapturedAt,
      "competitor_ranked_keywords.capturedAt",
    ),
  }));

  const normalizedCompetitorTopKeywordRows = competitorTopKeywordRows.map((row) => ({
    ...row,
    capturedAt: parseRequiredDate(
      row.capturedAt,
      "competitor_ranked_keywords.capturedAt",
    ),
  }));

  const siteById = new Map(siteRows.map((site) => [site.id, site]));
  const pageById = new Map(normalizedPageRows.map((page) => [page.id, page]));
  const clusterById = new Map(clusterRows.map((cluster) => [cluster.id, cluster]));

  const keywordsByCluster = new Map<number, string[]>();
  const primaryKeywordByCluster = new Map<number, string>();

  for (const row of queryRows) {
    const existing = keywordsByCluster.get(row.clusterId) ?? [];
    existing.push(row.query);
    keywordsByCluster.set(row.clusterId, existing);

    if (row.isPrimary) {
      primaryKeywordByCluster.set(row.clusterId, row.query);
    }
  }

  const pageIdsByCluster = new Map<number, Set<number>>();
  const clusterIdsByPage = new Map<number, Set<number>>();

  for (const row of targetRows) {
    const pageIds = pageIdsByCluster.get(row.clusterId) ?? new Set<number>();
    pageIds.add(row.pageId);
    pageIdsByCluster.set(row.clusterId, pageIds);

    const clusterIds = clusterIdsByPage.get(row.pageId) ?? new Set<number>();
    clusterIds.add(row.clusterId);
    clusterIdsByPage.set(row.pageId, clusterIds);
  }

  const siteKeywordCount = new Map<number, number>();
  for (const cluster of clusterRows) {
    const count = keywordsByCluster.get(cluster.id)?.length ?? 0;
    siteKeywordCount.set(
      cluster.siteId,
      (siteKeywordCount.get(cluster.siteId) ?? 0) + count,
    );
  }

  const siteMappedPages = new Map<number, Set<number>>();
  for (const [pageId, clusterIds] of clusterIdsByPage) {
    if (clusterIds.size === 0) continue;
    const page = pageById.get(pageId);
    if (!page) continue;
    const mapped = siteMappedPages.get(page.siteId) ?? new Set<number>();
    mapped.add(pageId);
    siteMappedPages.set(page.siteId, mapped);
  }

  const footprintsByCompetitor = new Map<
    number,
    Array<(typeof normalizedFootprintRows)[number]>
  >();
  for (const row of normalizedFootprintRows) {
    const existing = footprintsByCompetitor.get(row.siteCompetitorId) ?? [];
    existing.push(row);
    footprintsByCompetitor.set(row.siteCompetitorId, existing);
  }

  const footprintsBySite = new Map<
    number,
    Array<(typeof normalizedSiteFootprintRows)[number]>
  >();
  for (const row of normalizedSiteFootprintRows) {
    const existing = footprintsBySite.get(row.siteId) ?? [];
    existing.push(row);
    footprintsBySite.set(row.siteId, existing);
  }

  const keywordStatsByCompetitor = new Map<
    number,
    (typeof normalizedCompetitorKeywordStatsRows)[number]
  >();
  for (const row of normalizedCompetitorKeywordStatsRows) {
    keywordStatsByCompetitor.set(row.siteCompetitorId, row);
  }

  const topKeywordsByCompetitor = new Map<
    number,
    Array<(typeof normalizedCompetitorTopKeywordRows)[number]>
  >();
  for (const row of normalizedCompetitorTopKeywordRows) {
    const existing = topKeywordsByCompetitor.get(row.siteCompetitorId) ?? [];
    existing.push(row);
    topKeywordsByCompetitor.set(row.siteCompetitorId, existing);
  }

  const competitorsResult = competitorRows
    .map((competitor) => {
      const competitorFootprints = [...(footprintsByCompetitor.get(competitor.id) ?? [])].sort(
        (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
      );
      const latestFootprint = competitorFootprints[0] ?? null;
      const history = [...competitorFootprints]
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
        .map((footprint) => ({
          estimatedOrganicTraffic: footprint.estimatedOrganicTraffic,
          rankedKeywordsCount: footprint.rankedKeywordsCount,
          capturedAt: footprint.capturedAt,
        }));

      const competitorKeywordStats = keywordStatsByCompetitor.get(competitor.id);
      const topKeywords = topKeywordsByCompetitor.get(competitor.id) ?? [];

      return {
        id: competitor.id,
        siteId: competitor.siteId,
        label: competitor.label,
        competitorDomain: competitor.competitorDomain,
        competitorType: competitor.competitorType,
        isActive: competitor.isActive,
        notes: competitor.notes,
        footprintSnapshotCount: competitorFootprints.length,
        keywordRowCount: competitorKeywordStats?.keywordRowCount ?? 0,
        latestKeywordCount: competitorKeywordStats?.latestKeywordCount ?? 0,
        latestKeywordCapturedAt:
          competitorKeywordStats?.latestKeywordCapturedAt ?? null,
        latestFootprint: latestFootprint
          ? {
              location: latestFootprint.location,
              languageCode: latestFootprint.languageCode,
              estimatedOrganicTraffic: latestFootprint.estimatedOrganicTraffic,
              estimatedPaidTraffic: latestFootprint.estimatedPaidTraffic,
              rankedKeywordsCount: latestFootprint.rankedKeywordsCount,
              top3KeywordsCount: latestFootprint.top3KeywordsCount,
              top10KeywordsCount: latestFootprint.top10KeywordsCount,
              top100KeywordsCount: latestFootprint.top100KeywordsCount,
              visibilityScore: latestFootprint.visibilityScore,
              capturedAt: latestFootprint.capturedAt,
            }
          : null,
        history,
        topKeywords,
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return Number(b.isActive) - Number(a.isActive);

      const rankedCountA = a.latestFootprint?.rankedKeywordsCount ?? -1;
      const rankedCountB = b.latestFootprint?.rankedKeywordsCount ?? -1;
      if (rankedCountA !== rankedCountB) return rankedCountB - rankedCountA;

      return a.label.localeCompare(b.label);
    });

  const pagesResult = normalizedPageRows
    .map((page) => {
      const site = siteById.get(page.siteId);
      const clusterNames = Array.from(clusterIdsByPage.get(page.id) ?? [])
        .map((clusterId) => clusterById.get(clusterId)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b));

      return {
        id: page.id,
        siteId: page.siteId,
        siteName: site?.name ?? "Site",
        siteDomain: site?.domain ?? "unknown",
        url: page.url,
        displayTitle: page.titleTag?.trim() || page.h1?.trim() || page.url,
        pageType: page.pageType,
        metaDescription: page.metaDescription,
        h1: page.h1,
        statusCode: page.statusCode,
        indexability: page.indexability,
        contentStatus: page.contentStatus,
        isMoneyPage: page.isMoneyPage,
        isAuthorityAsset: page.isAuthorityAsset,
        lastCrawledAt: page.lastCrawledAt,
        clusterCount: clusterNames.length,
        clusterNames,
      };
    })
    .sort((a, b) => {
      if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
      return a.url.localeCompare(b.url);
    });

  const clustersResult = clusterRows
    .map((cluster) => {
      const site = siteById.get(cluster.siteId);
      const keywords = [...(keywordsByCluster.get(cluster.id) ?? [])].sort((a, b) =>
        a.localeCompare(b),
      );
      const pageUrls = Array.from(pageIdsByCluster.get(cluster.id) ?? [])
        .map((pageId) => pageById.get(pageId)?.url)
        .filter((url): url is string => Boolean(url))
        .sort((a, b) => a.localeCompare(b));

      return {
        id: cluster.id,
        siteId: cluster.siteId,
        siteName: site?.name ?? "Site",
        siteDomain: site?.domain ?? "unknown",
        name: cluster.name,
        primaryIntent: cluster.primaryIntent,
        funnelStage: cluster.funnelStage,
        priorityScore: cluster.priorityScore,
        keywordCount: keywords.length,
        primaryKeyword: primaryKeywordByCluster.get(cluster.id) ?? keywords[0] ?? null,
        keywords,
        pageUrls,
      };
    })
    .sort((a, b) => {
      const priorityA = a.priorityScore ? Number(a.priorityScore) : -1;
      const priorityB = b.priorityScore ? Number(b.priorityScore) : -1;
      if (priorityA !== priorityB) return priorityB - priorityA;
      if (a.keywordCount !== b.keywordCount) return b.keywordCount - a.keywordCount;
      return a.name.localeCompare(b.name);
    });

  const sitesResult = siteRows
    .map((site) => {
      const sitePageCount = pageRows.filter((page) => page.siteId === site.id).length;
      const siteClusterCount = clusterRows.filter(
        (cluster) => cluster.siteId === site.id,
      ).length;
      const siteFootprints = [...(footprintsBySite.get(site.id) ?? [])].sort(
        (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
      );
      const latestFootprint = siteFootprints[0] ?? null;
      const history = [...siteFootprints]
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
        .map((footprint) => ({
          estimatedOrganicTraffic: footprint.estimatedOrganicTraffic,
          rankedKeywordsCount: footprint.rankedKeywordsCount,
          capturedAt: footprint.capturedAt,
        }));

      return {
        id: site.id,
        name: site.name,
        domain: site.domain,
        pageCount: sitePageCount,
        clusterCount: siteClusterCount,
        keywordCount: siteKeywordCount.get(site.id) ?? 0,
        mappedPageCount: siteMappedPages.get(site.id)?.size ?? 0,
        footprintSnapshotCount: siteFootprints.length,
        latestFootprint: latestFootprint
          ? {
              location: latestFootprint.location,
              languageCode: latestFootprint.languageCode,
              estimatedOrganicTraffic: latestFootprint.estimatedOrganicTraffic,
              estimatedPaidTraffic: latestFootprint.estimatedPaidTraffic,
              rankedKeywordsCount: latestFootprint.rankedKeywordsCount,
              top3KeywordsCount: latestFootprint.top3KeywordsCount,
              top10KeywordsCount: latestFootprint.top10KeywordsCount,
              top100KeywordsCount: latestFootprint.top100KeywordsCount,
              visibilityScore: latestFootprint.visibilityScore,
              capturedAt: latestFootprint.capturedAt,
            }
          : null,
        history,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    summary: {
      siteCount: siteRows.length,
      pageCount: pageRows.length,
      clusterCount: clusterRows.length,
      keywordCount: queryRows.length,
      mappedPageCount: new Set(targetRows.map((row) => row.pageId)).size,
    },
    sites: sitesResult,
    competitors: competitorsResult,
    pages: pagesResult,
    clusters: clustersResult,
  };
}

export type AnalyticsSummary = {
  headline: {
    current: {
      sessions: number;
      users: number;
      engagedSessions: number;
      conversions: number;
      revenue: number;
      avgEngagementSeconds: number;
    };
    prior: {
      sessions: number;
      users: number;
      engagedSessions: number;
      conversions: number;
      revenue: number;
      avgEngagementSeconds: number;
    };
  };
  channels: Array<{
    channel: string;
    sessions: number;
    users: number;
    conversions: number;
    revenue: number;
  }>;
  topPages: Array<{
    pageId: number;
    title: string;
    url: string;
    sessions: number;
  }>;
  devices: Array<{
    device: string;
    sessions: number;
  }>;
  daily: Array<{
    date: string;
    sessions: number;
    users: number;
  }>;
};

function n(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : Number(val);
  return Number.isNaN(num) ? 0 : num;
}

export async function getAnalyticsSummary(
  db: Database,
  siteId: number,
  startDate: string,
  endDate: string,
): Promise<AnalyticsSummary> {
  // Compute prior period: same duration ending the day before startDate
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 86400000); // day before start
  const priorStart = new Date(priorEnd.getTime() - durationMs);
  const priorStartStr = priorStart.toISOString().slice(0, 10);
  const priorEndStr = priorEnd.toISOString().slice(0, 10);

  const siteFilter = eq(analyticsDaily.siteId, siteId);
  const currentRange = between(analyticsDaily.eventDate, startDate, endDate);
  const priorRange = between(analyticsDaily.eventDate, priorStartStr, priorEndStr);

  const [currentTotals, priorTotals, channelRows, topPageRows, deviceRows, dailyRows] =
    await Promise.all([
      // 1. Headline totals — current
      db
        .select({
          sessions: sum(analyticsDaily.sessions),
          users: sum(analyticsDaily.users),
          engagedSessions: sum(analyticsDaily.engagedSessions),
          conversions: sum(analyticsDaily.conversions),
          revenue: sum(analyticsDaily.revenue),
          avgEngagement: sql<string>`
            CASE WHEN SUM(${analyticsDaily.sessions}) > 0
              THEN SUM(COALESCE(${analyticsDaily.avgEngagementSeconds}, 0) * ${analyticsDaily.sessions}) / SUM(${analyticsDaily.sessions})
              ELSE 0
            END`,
        })
        .from(analyticsDaily)
        .where(and(siteFilter, currentRange)),

      // 2. Headline totals — prior
      db
        .select({
          sessions: sum(analyticsDaily.sessions),
          users: sum(analyticsDaily.users),
          engagedSessions: sum(analyticsDaily.engagedSessions),
          conversions: sum(analyticsDaily.conversions),
          revenue: sum(analyticsDaily.revenue),
          avgEngagement: sql<string>`
            CASE WHEN SUM(${analyticsDaily.sessions}) > 0
              THEN SUM(COALESCE(${analyticsDaily.avgEngagementSeconds}, 0) * ${analyticsDaily.sessions}) / SUM(${analyticsDaily.sessions})
              ELSE 0
            END`,
        })
        .from(analyticsDaily)
        .where(and(siteFilter, priorRange)),

      // 3. Channel breakdown (current)
      db
        .select({
          channel: analyticsDaily.channel,
          sessions: sum(analyticsDaily.sessions),
          users: sum(analyticsDaily.users),
          conversions: sum(analyticsDaily.conversions),
          revenue: sum(analyticsDaily.revenue),
        })
        .from(analyticsDaily)
        .where(and(siteFilter, currentRange))
        .groupBy(analyticsDaily.channel)
        .orderBy(desc(sum(analyticsDaily.sessions))),

      // 4. Top pages by sessions (current, top 8)
      db
        .select({
          pageId: analyticsDaily.pageId,
          title: pages.titleTag,
          url: pages.url,
          sessions: sum(analyticsDaily.sessions),
        })
        .from(analyticsDaily)
        .innerJoin(pages, eq(analyticsDaily.pageId, pages.id))
        .where(and(siteFilter, currentRange, isNotNull(analyticsDaily.pageId)))
        .groupBy(analyticsDaily.pageId, pages.titleTag, pages.url)
        .orderBy(desc(sum(analyticsDaily.sessions)))
        .limit(8),

      // 5. Device split (current)
      db
        .select({
          device: analyticsDaily.device,
          sessions: sum(analyticsDaily.sessions),
        })
        .from(analyticsDaily)
        .where(and(siteFilter, currentRange))
        .groupBy(analyticsDaily.device)
        .orderBy(desc(sum(analyticsDaily.sessions))),

      // 6. Daily time series (current)
      db
        .select({
          date: analyticsDaily.eventDate,
          sessions: sum(analyticsDaily.sessions),
          users: sum(analyticsDaily.users),
        })
        .from(analyticsDaily)
        .where(and(siteFilter, currentRange))
        .groupBy(analyticsDaily.eventDate)
        .orderBy(analyticsDaily.eventDate),
    ]);

  const cur = currentTotals[0];
  const pri = priorTotals[0];

  return {
    headline: {
      current: {
        sessions: n(cur?.sessions),
        users: n(cur?.users),
        engagedSessions: n(cur?.engagedSessions),
        conversions: n(cur?.conversions),
        revenue: n(cur?.revenue),
        avgEngagementSeconds: n(cur?.avgEngagement),
      },
      prior: {
        sessions: n(pri?.sessions),
        users: n(pri?.users),
        engagedSessions: n(pri?.engagedSessions),
        conversions: n(pri?.conversions),
        revenue: n(pri?.revenue),
        avgEngagementSeconds: n(pri?.avgEngagement),
      },
    },
    channels: channelRows.map((row) => ({
      channel: row.channel,
      sessions: n(row.sessions),
      users: n(row.users),
      conversions: n(row.conversions),
      revenue: n(row.revenue),
    })),
    topPages: topPageRows.map((row) => ({
      pageId: row.pageId!,
      title: row.title?.trim() || row.url,
      url: row.url,
      sessions: n(row.sessions),
    })),
    devices: deviceRows
      .filter((row) => row.device != null)
      .map((row) => ({
        device: row.device!,
        sessions: n(row.sessions),
      })),
    daily: dailyRows.map((row) => ({
      date: row.date,
      sessions: n(row.sessions),
      users: n(row.users),
    })),
  };
}

/* ---------------------------------------------------------------------------
 * Backlinks
 * --------------------------------------------------------------------------- */

export type BacklinksResult = {
  existing: Array<{
    id: number;
    siteId: number;
    sourceDomain: string;
    sourceUrl: string | null;
    sourceTitle: string | null;
    targetUrl: string;
    targetPageId: number | null;
    targetPageTitle: string | null;
    anchorText: string | null;
    relAttr: string | null;
    linkType: string | null;
    relevanceScore: string | null;
    authorityScore: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    verifiedAt: string | null;
    status: string;
  }>;
  competitor: Array<{
    id: number;
    siteCompetitorId: number;
    competitorLabel: string;
    competitorDomain: string;
    sourceDomain: string;
    sourceUrl: string | null;
    sourceTitle: string | null;
    targetUrl: string;
    anchorText: string | null;
    relAttr: string | null;
    linkType: string | null;
    relevanceScore: string | null;
    authorityScore: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    status: string;
  }>;
  opportunities: Array<{
    id: number;
    siteId: number;
    sourceDomain: string;
    sourceUrl: string;
    sourceTitle: string | null;
    targetPageId: number;
    targetPageTitle: string | null;
    targetPageUrl: string | null;
    opportunityType: string;
    discoveredFrom: string;
    whyThisFits: string;
    suggestedAnchorText: string | null;
    relevanceScore: string | null;
    authorityScore: string | null;
    confidenceScore: string | null;
    riskScore: string | null;
    status: string;
    firstSeenAt: string | null;
    lastReviewedAt: string | null;
    prospectId: number | null;
    prospectName: string | null;
    siteCompetitorId: number | null;
    competitorLabel: string | null;
    brandMentionId: number | null;
  }>;
  summary: {
    referringDomains: number;
    liveBacklinks: number;
    moneyPagesLinked: number;
    avgAuthority: number;
    competitorDomainsTracked: number;
    competitorBacklinksTracked: number;
    linkGapCount: number;
    newOpportunities: number;
    highConfidenceOpportunities: number;
    approvedForOutreach: number;
    rejectedOpportunities: number;
  };
};

export async function getBacklinksData(
  db: Database,
  siteId: number,
): Promise<BacklinksResult> {
  // Get competitor IDs for this site
  const siteCompetitorRows = await db
    .select({
      id: siteCompetitors.id,
      label: siteCompetitors.label,
      domain: siteCompetitors.competitorDomain,
    })
    .from(siteCompetitors)
    .where(eq(siteCompetitors.siteId, siteId));

  const competitorIds = siteCompetitorRows.map((c) => c.id);
  const competitorById = new Map(siteCompetitorRows.map((c) => [c.id, c]));

  const [existingRows, competitorRows, opportunityRows] = await Promise.all([
    // 1. Our backlinks
    db
      .select({
        id: backlinkSources.id,
        siteId: backlinkSources.siteId,
        sourceDomain: backlinkSources.sourceDomain,
        sourceUrl: backlinkSources.sourceUrl,
        sourceTitle: backlinkSources.sourceTitle,
        targetUrl: backlinkSources.targetUrl,
        targetPageId: backlinkSources.targetPageId,
        targetPageTitle: pages.titleTag,
        anchorText: backlinkSources.anchorText,
        relAttr: backlinkSources.relAttr,
        linkType: backlinkSources.linkType,
        relevanceScore: backlinkSources.relevanceScore,
        authorityScore: backlinkSources.authorityScore,
        firstSeenAt: backlinkSources.firstSeenAt,
        lastSeenAt: backlinkSources.lastSeenAt,
        verifiedAt: backlinkSources.verifiedAt,
        status: backlinkSources.status,
      })
      .from(backlinkSources)
      .leftJoin(pages, eq(backlinkSources.targetPageId, pages.id))
      .where(eq(backlinkSources.siteId, siteId)),

    // 2. Competitor backlinks
    competitorIds.length > 0
      ? db
          .select({
            id: competitorBacklinkSources.id,
            siteCompetitorId: competitorBacklinkSources.siteCompetitorId,
            sourceDomain: competitorBacklinkSources.sourceDomain,
            sourceUrl: competitorBacklinkSources.sourceUrl,
            sourceTitle: competitorBacklinkSources.sourceTitle,
            targetUrl: competitorBacklinkSources.targetUrl,
            anchorText: competitorBacklinkSources.anchorText,
            relAttr: competitorBacklinkSources.relAttr,
            linkType: competitorBacklinkSources.linkType,
            relevanceScore: competitorBacklinkSources.relevanceScore,
            authorityScore: competitorBacklinkSources.authorityScore,
            firstSeenAt: competitorBacklinkSources.firstSeenAt,
            lastSeenAt: competitorBacklinkSources.lastSeenAt,
            status: competitorBacklinkSources.status,
          })
          .from(competitorBacklinkSources)
          .where(
            sql`${competitorBacklinkSources.siteCompetitorId} IN (${sql.join(
              competitorIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : Promise.resolve([]),

    // 3. Opportunities
    db
      .select({
        id: linkOpportunities.id,
        siteId: linkOpportunities.siteId,
        sourceDomain: linkOpportunities.sourceDomain,
        sourceUrl: linkOpportunities.sourceUrl,
        sourceTitle: linkOpportunities.sourceTitle,
        targetPageId: linkOpportunities.targetPageId,
        targetPageTitle: pages.titleTag,
        targetPageUrl: pages.url,
        opportunityType: linkOpportunities.opportunityType,
        discoveredFrom: linkOpportunities.discoveredFrom,
        whyThisFits: linkOpportunities.whyThisFits,
        suggestedAnchorText: linkOpportunities.suggestedAnchorText,
        relevanceScore: linkOpportunities.relevanceScore,
        authorityScore: linkOpportunities.authorityScore,
        confidenceScore: linkOpportunities.confidenceScore,
        riskScore: linkOpportunities.riskScore,
        status: linkOpportunities.status,
        firstSeenAt: linkOpportunities.firstSeenAt,
        lastReviewedAt: linkOpportunities.lastReviewedAt,
        prospectId: linkOpportunities.prospectId,
        prospectName: outreachProspects.organizationName,
        siteCompetitorId: linkOpportunities.siteCompetitorId,
        brandMentionId: linkOpportunities.brandMentionId,
      })
      .from(linkOpportunities)
      .leftJoin(pages, eq(linkOpportunities.targetPageId, pages.id))
      .leftJoin(outreachProspects, eq(linkOpportunities.prospectId, outreachProspects.id))
      .where(eq(linkOpportunities.siteId, siteId)),
  ]);

  // Enrich competitor backlinks with labels
  const enrichedCompetitorRows = competitorRows.map((row) => {
    const comp = competitorById.get(row.siteCompetitorId);
    return {
      ...row,
      competitorLabel: comp?.label ?? "Unknown",
      competitorDomain: comp?.domain ?? "",
    };
  });

  // Enrich opportunities with competitor labels
  const enrichedOpportunities = opportunityRows.map((row) => {
    const comp = row.siteCompetitorId ? competitorById.get(row.siteCompetitorId) : null;
    return {
      ...row,
      competitorLabel: comp?.label ?? null,
    };
  });

  // Compute our referring domains (unique source domains from existing)
  const ownDomains = new Set(existingRows.map((r) => r.sourceDomain));
  const liveBacklinks = existingRows.filter((r) => r.status === "live").length;

  // Money pages linked — pages that are target of backlinks and are money pages
  const linkedTargetPageIds = new Set(
    existingRows.map((r) => r.targetPageId).filter((id): id is number => id !== null),
  );
  // We don't have isMoneyPage join here, so approximate with count of distinct target pages
  const moneyPagesLinked = linkedTargetPageIds.size;

  // Avg authority
  const authorityValues = existingRows
    .map((r) => (r.authorityScore ? Number(r.authorityScore) : null))
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  const avgAuthority =
    authorityValues.length > 0
      ? authorityValues.reduce((s, v) => s + v, 0) / authorityValues.length
      : 0;

  // Competitor stats
  const competitorDomainSet = new Set(siteCompetitorRows.map((c) => c.domain));

  // Link gap: competitor backlink source domains we don't have
  const competitorSourceDomains = new Set(enrichedCompetitorRows.map((r) => r.sourceDomain));
  const linkGapCount = [...competitorSourceDomains].filter((d) => !ownDomains.has(d)).length;

  // Opportunity stats
  const newOpportunities = enrichedOpportunities.filter((r) => r.status === "new").length;
  const highConfidenceOpportunities = enrichedOpportunities.filter((r) => {
    const score = r.confidenceScore ? Number(r.confidenceScore) : 0;
    return score >= 70;
  }).length;
  const approvedForOutreach = enrichedOpportunities.filter((r) => r.status === "approved").length;
  const rejectedOpportunities = enrichedOpportunities.filter((r) => r.status === "rejected").length;

  return {
    existing: existingRows,
    competitor: enrichedCompetitorRows,
    opportunities: enrichedOpportunities,
    summary: {
      referringDomains: ownDomains.size,
      liveBacklinks,
      moneyPagesLinked,
      avgAuthority: Math.round(avgAuthority * 10) / 10,
      competitorDomainsTracked: competitorDomainSet.size,
      competitorBacklinksTracked: enrichedCompetitorRows.length,
      linkGapCount,
      newOpportunities,
      highConfidenceOpportunities,
      approvedForOutreach,
      rejectedOpportunities,
    },
  };
}

export async function updateOpportunityStatus(
  db: Database,
  opportunityId: number,
  status: string,
): Promise<void> {
  await db
    .update(linkOpportunities)
    .set({
      status,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(linkOpportunities.id, opportunityId));
}
