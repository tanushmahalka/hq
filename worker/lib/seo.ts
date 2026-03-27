import { and, asc, between, desc, eq, ilike, isNotNull, or, sql, sum } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  analyticsDaily,
  backlinkSources,
  competitorBacklinkSources,
  competitorBacklinkFootprints,
  competitorDomainFootprints,
  linkOpportunities,
  outreachProspects,
  pageClusterTargets,
  pages,
  queryClusters,
  queries,
  siteBacklinkFootprints,
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
      isRelevant: boolean | null;
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
    lastAuditedOn: Date | null;
    auditJson: unknown;
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
  isRelevant: boolean | null;
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
        lastAuditedOn: pages.lastAuditedOn,
        auditJson: pages.auditJson,
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
          crk.is_relevant AS "isRelevant",
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
        "isRelevant",
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
    lastAuditedOn: parseOptionalDate(page.lastAuditedOn, "pages.lastAuditedOn"),
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
        lastAuditedOn: page.lastAuditedOn,
        auditJson: page.auditJson,
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
  counts: {
    existing: number;
    competitors: number;
    opportunities: number;
  };
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  applied: {
    subview: "existing" | "competitors" | "opportunities";
    search: string;
    statusFilter: string;
    sortBy: string;
    sortDirection: "asc" | "desc";
  };
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
  history: {
    site: Array<{
      capturedAt: string;
      backlinksCount: number;
      liveBacklinksCount: number;
      referringDomainsCount: number;
    }>;
    competitors: Array<{
      siteCompetitorId: number;
      competitorLabel: string;
      competitorDomain: string;
      history: Array<{
        capturedAt: string;
        backlinksCount: number;
        liveBacklinksCount: number;
        referringDomainsCount: number;
      }>;
    }>;
  };
  summary: {
    referringDomains: number;
    liveBacklinks: number;
    moneyPagesLinked: number;
    avgAuthority: number;
    newBacklinks: number;
    lostBacklinks: number;
    brokenBacklinks: number;
    competitorDomainsTracked: number;
    competitorBacklinksTracked: number;
    linkGapCount: number;
    newOpportunities: number;
    highConfidenceOpportunities: number;
    approvedForOutreach: number;
    rejectedOpportunities: number;
  };
};

type BacklinksQueryInput = {
  siteId: number;
  subview: "existing" | "competitors" | "opportunities";
  search?: string;
  statusFilter?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  summaryOnly?: boolean;
};

function clampPageSize(value: number | undefined): number {
  const next = value ?? 50;
  return Math.min(100, Math.max(25, next));
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim() ?? "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function getBacklinksData(
  db: Database,
  input: BacklinksQueryInput,
): Promise<BacklinksResult> {
  const siteId = input.siteId;
  const subview = input.subview;
  const search = normalizeSearch(input.search);
  const statusFilter = input.statusFilter?.trim() || "all";
  const summaryOnly = input.summaryOnly ?? false;
  const pageSize = clampPageSize(input.pageSize);
  const requestedPage = Math.max(1, input.page ?? 1);
  const sortDirection = input.sortDirection === "asc" ? "asc" : "desc";

  const siteCompetitorRows = await db
    .select({
      id: siteCompetitors.id,
      label: siteCompetitors.label,
      domain: siteCompetitors.competitorDomain,
    })
    .from(siteCompetitors)
    .where(eq(siteCompetitors.siteId, siteId));

  const searchPattern = search ? `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%` : null;

  const existingSearch = searchPattern
    ? or(
        ilike(backlinkSources.sourceDomain, searchPattern),
        ilike(backlinkSources.sourceUrl, searchPattern),
        ilike(backlinkSources.sourceTitle, searchPattern),
        ilike(backlinkSources.targetUrl, searchPattern),
        ilike(backlinkSources.anchorText, searchPattern),
        ilike(pages.titleTag, searchPattern),
      )
    : undefined;
  const competitorSearch = searchPattern
    ? or(
        ilike(siteCompetitors.label, searchPattern),
        ilike(siteCompetitors.competitorDomain, searchPattern),
        ilike(competitorBacklinkSources.sourceDomain, searchPattern),
        ilike(competitorBacklinkSources.sourceUrl, searchPattern),
        ilike(competitorBacklinkSources.sourceTitle, searchPattern),
        ilike(competitorBacklinkSources.targetUrl, searchPattern),
        ilike(competitorBacklinkSources.anchorText, searchPattern),
      )
    : undefined;
  const opportunitySearch = searchPattern
    ? or(
        ilike(linkOpportunities.sourceDomain, searchPattern),
        ilike(linkOpportunities.sourceUrl, searchPattern),
        ilike(linkOpportunities.sourceTitle, searchPattern),
        ilike(linkOpportunities.opportunityType, searchPattern),
        ilike(linkOpportunities.whyThisFits, searchPattern),
        ilike(pages.titleTag, searchPattern),
        ilike(pages.url, searchPattern),
        ilike(siteCompetitors.label, searchPattern),
        ilike(outreachProspects.organizationName, searchPattern),
      )
    : undefined;

  const existingWhere = and(
    eq(backlinkSources.siteId, siteId),
    statusFilter !== "all" ? eq(backlinkSources.status, statusFilter) : undefined,
    existingSearch,
  );
  const competitorWhere = and(
    eq(siteCompetitors.siteId, siteId),
    statusFilter !== "all" ? eq(competitorBacklinkSources.status, statusFilter) : undefined,
    competitorSearch,
  );
  const opportunityWhere = and(
    eq(linkOpportunities.siteId, siteId),
    statusFilter !== "all" ? eq(linkOpportunities.status, statusFilter) : undefined,
    opportunitySearch,
  );

  const [
    existingSummaryRow,
    competitorSummaryRow,
    opportunitySummaryRow,
    linkGapRow,
    siteHistoryRows,
    competitorHistoryRows,
    existingCountRow,
    competitorCountRow,
    opportunityCountRow,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        referringDomains: sql<number>`count(distinct ${backlinkSources.sourceDomain})`,
        liveBacklinks: sql<number>`sum(case when ${backlinkSources.status} = 'live' then 1 else 0 end)`,
        moneyPagesLinked: sql<number>`count(distinct ${backlinkSources.targetPageId})`,
        avgAuthority: sql<string | null>`avg(${backlinkSources.authorityScore})`,
      })
      .from(backlinkSources)
      .where(eq(backlinkSources.siteId, siteId))
      .then((rows) => rows[0]),
    db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(competitorBacklinkSources)
      .innerJoin(
        siteCompetitors,
        eq(competitorBacklinkSources.siteCompetitorId, siteCompetitors.id),
      )
      .where(eq(siteCompetitors.siteId, siteId))
      .then((rows) => rows[0]),
    db
      .select({
        total: sql<number>`count(*)`,
        newOpportunities: sql<number>`sum(case when ${linkOpportunities.status} = 'new' then 1 else 0 end)`,
        highConfidenceOpportunities:
          sql<number>`sum(case when ${linkOpportunities.confidenceScore} >= 70 then 1 else 0 end)`,
        approvedForOutreach:
          sql<number>`sum(case when ${linkOpportunities.status} = 'approved' then 1 else 0 end)`,
        rejectedOpportunities:
          sql<number>`sum(case when ${linkOpportunities.status} = 'rejected' then 1 else 0 end)`,
      })
      .from(linkOpportunities)
      .where(eq(linkOpportunities.siteId, siteId))
      .then((rows) => rows[0]),
    db
      .select({
        linkGapCount: sql<number>`count(distinct ${competitorBacklinkSources.sourceDomain})`,
      })
      .from(competitorBacklinkSources)
      .innerJoin(
        siteCompetitors,
        eq(competitorBacklinkSources.siteCompetitorId, siteCompetitors.id),
      )
      .leftJoin(
        backlinkSources,
        and(
          eq(backlinkSources.siteId, siteId),
          eq(backlinkSources.sourceDomain, competitorBacklinkSources.sourceDomain),
        ),
      )
      .where(and(eq(siteCompetitors.siteId, siteId), sql`${backlinkSources.id} is null`))
      .then((rows) => rows[0]),
    db
      .select({
        capturedAt: siteBacklinkFootprints.capturedAt,
        backlinksCount: siteBacklinkFootprints.backlinksCount,
        newBacklinksCount: siteBacklinkFootprints.newBacklinksCount,
        lostBacklinksCount: siteBacklinkFootprints.lostBacklinksCount,
        liveBacklinksCount: siteBacklinkFootprints.liveBacklinksCount,
        referringDomainsCount: siteBacklinkFootprints.referringDomainsCount,
        newReferringDomainsCount: siteBacklinkFootprints.newReferringDomainsCount,
        lostReferringDomainsCount: siteBacklinkFootprints.lostReferringDomainsCount,
        brokenBacklinksCount: siteBacklinkFootprints.brokenBacklinksCount,
      })
      .from(siteBacklinkFootprints)
      .where(eq(siteBacklinkFootprints.siteId, siteId)),
    db
      .select({
        siteCompetitorId: competitorBacklinkFootprints.siteCompetitorId,
        capturedAt: competitorBacklinkFootprints.capturedAt,
        backlinksCount: competitorBacklinkFootprints.backlinksCount,
        newBacklinksCount: competitorBacklinkFootprints.newBacklinksCount,
        lostBacklinksCount: competitorBacklinkFootprints.lostBacklinksCount,
        liveBacklinksCount: competitorBacklinkFootprints.liveBacklinksCount,
        referringDomainsCount: competitorBacklinkFootprints.referringDomainsCount,
        newReferringDomainsCount: competitorBacklinkFootprints.newReferringDomainsCount,
        lostReferringDomainsCount: competitorBacklinkFootprints.lostReferringDomainsCount,
        brokenBacklinksCount: competitorBacklinkFootprints.brokenBacklinksCount,
      })
      .from(competitorBacklinkFootprints)
      .innerJoin(
        siteCompetitors,
        eq(competitorBacklinkFootprints.siteCompetitorId, siteCompetitors.id),
      )
      .where(eq(siteCompetitors.siteId, siteId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(backlinkSources)
      .leftJoin(pages, eq(backlinkSources.targetPageId, pages.id))
      .where(existingWhere)
      .then((rows) => rows[0]),
    db
      .select({ total: sql<number>`count(*)` })
      .from(competitorBacklinkSources)
      .innerJoin(
        siteCompetitors,
        eq(competitorBacklinkSources.siteCompetitorId, siteCompetitors.id),
      )
      .where(competitorWhere)
      .then((rows) => rows[0]),
    db
      .select({ total: sql<number>`count(*)` })
      .from(linkOpportunities)
      .leftJoin(pages, eq(linkOpportunities.targetPageId, pages.id))
      .leftJoin(siteCompetitors, eq(linkOpportunities.siteCompetitorId, siteCompetitors.id))
      .leftJoin(outreachProspects, eq(linkOpportunities.prospectId, outreachProspects.id))
      .where(opportunityWhere)
      .then((rows) => rows[0]),
  ]);

  const countBySubview = {
    existing: toNumber(existingCountRow?.total),
    competitors: toNumber(competitorCountRow?.total),
    opportunities: toNumber(opportunityCountRow?.total),
  };
  const total = countBySubview[subview];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const existingSortColumn =
    input.sortBy === "authority"
      ? backlinkSources.authorityScore
      : input.sortBy === "source"
        ? backlinkSources.sourceDomain
        : backlinkSources.lastSeenAt;
  const competitorSortColumn =
    input.sortBy === "authority"
      ? competitorBacklinkSources.authorityScore
      : input.sortBy === "relevance"
        ? competitorBacklinkSources.relevanceScore
        : input.sortBy === "source"
          ? competitorBacklinkSources.sourceDomain
          : input.sortBy === "competitor"
            ? siteCompetitors.label
            : competitorBacklinkSources.lastSeenAt;
  const opportunitySortColumn =
    input.sortBy === "risk"
      ? linkOpportunities.riskScore
      : input.sortBy === "status"
        ? linkOpportunities.status
        : input.sortBy === "source"
          ? linkOpportunities.sourceDomain
          : input.sortBy === "targetPage"
            ? pages.titleTag
            : linkOpportunities.confidenceScore;

  const [existingRows, competitorRows, opportunityRows] = summaryOnly
    ? [[], [], []]
    : await Promise.all([
    subview === "existing"
      ? db
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
          .where(existingWhere)
          .orderBy(sortDirection === "asc" ? asc(existingSortColumn) : desc(existingSortColumn))
          .limit(pageSize)
          .offset(offset)
      : Promise.resolve([]),
    subview === "competitors"
      ? db
          .select({
            id: competitorBacklinkSources.id,
            siteCompetitorId: competitorBacklinkSources.siteCompetitorId,
            competitorLabel: siteCompetitors.label,
            competitorDomain: siteCompetitors.competitorDomain,
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
          .innerJoin(
            siteCompetitors,
            eq(competitorBacklinkSources.siteCompetitorId, siteCompetitors.id),
          )
          .where(competitorWhere)
          .orderBy(sortDirection === "asc" ? asc(competitorSortColumn) : desc(competitorSortColumn))
          .limit(pageSize)
          .offset(offset)
      : Promise.resolve([]),
    subview === "opportunities"
      ? db
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
            competitorLabel: siteCompetitors.label,
            brandMentionId: linkOpportunities.brandMentionId,
          })
          .from(linkOpportunities)
          .leftJoin(pages, eq(linkOpportunities.targetPageId, pages.id))
          .leftJoin(siteCompetitors, eq(linkOpportunities.siteCompetitorId, siteCompetitors.id))
          .leftJoin(outreachProspects, eq(linkOpportunities.prospectId, outreachProspects.id))
          .where(opportunityWhere)
          .orderBy(sortDirection === "asc" ? asc(opportunitySortColumn) : desc(opportunitySortColumn))
          .limit(pageSize)
          .offset(offset)
      : Promise.resolve([]),
  ]);

  const mapHistoryRow = (row: typeof siteHistoryRows[number]) => ({
    capturedAt: row.capturedAt,
    backlinksCount: row.backlinksCount,
    newBacklinksCount: row.newBacklinksCount ?? 0,
    lostBacklinksCount: row.lostBacklinksCount ?? 0,
    liveBacklinksCount: row.liveBacklinksCount,
    referringDomainsCount: row.referringDomainsCount,
    newReferringDomainsCount: row.newReferringDomainsCount ?? 0,
    lostReferringDomainsCount: row.lostReferringDomainsCount ?? 0,
    brokenBacklinksCount: row.brokenBacklinksCount ?? 0,
  });

  const siteHistory = [...siteHistoryRows]
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map(mapHistoryRow);

  if (siteHistory.length === 0) {
    siteHistory.push({
      capturedAt: new Date().toISOString(),
      backlinksCount: toNumber(existingSummaryRow?.total),
      newBacklinksCount: 0,
      lostBacklinksCount: 0,
      liveBacklinksCount: toNumber(existingSummaryRow?.liveBacklinks),
      referringDomainsCount: toNumber(existingSummaryRow?.referringDomains),
      newReferringDomainsCount: 0,
      lostReferringDomainsCount: 0,
      brokenBacklinksCount: 0,
    });
  }

  type HistoryPoint = typeof siteHistory[number];

  const competitorHistoryById = new Map<number, HistoryPoint[]>();

  for (const row of competitorHistoryRows) {
    const history = competitorHistoryById.get(row.siteCompetitorId) ?? [];
    history.push({
      capturedAt: row.capturedAt,
      backlinksCount: row.backlinksCount,
      newBacklinksCount: row.newBacklinksCount ?? 0,
      lostBacklinksCount: row.lostBacklinksCount ?? 0,
      liveBacklinksCount: row.liveBacklinksCount,
      referringDomainsCount: row.referringDomainsCount,
      newReferringDomainsCount: row.newReferringDomainsCount ?? 0,
      lostReferringDomainsCount: row.lostReferringDomainsCount ?? 0,
      brokenBacklinksCount: row.brokenBacklinksCount ?? 0,
    });
    competitorHistoryById.set(row.siteCompetitorId, history);
  }

  const competitorHistory = siteCompetitorRows.map((competitor) => {
    const history = [...(competitorHistoryById.get(competitor.id) ?? [])].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );

    if (history.length === 0) {
      history.push({
        capturedAt: new Date().toISOString(),
        backlinksCount: 0,
        newBacklinksCount: 0,
        lostBacklinksCount: 0,
        liveBacklinksCount: 0,
        referringDomainsCount: 0,
        newReferringDomainsCount: 0,
        lostReferringDomainsCount: 0,
        brokenBacklinksCount: 0,
      });
    }

    return {
      siteCompetitorId: competitor.id,
      competitorLabel: competitor.label,
      competitorDomain: competitor.domain,
      history,
    };
  });

  return {
    counts: countBySubview,
    pageInfo: {
      page,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    applied: {
      subview,
      search,
      statusFilter,
      sortBy:
        subview === "existing"
          ? input.sortBy || "lastSeen"
          : subview === "competitors"
            ? input.sortBy || "authority"
            : input.sortBy || "confidence",
      sortDirection,
    },
    existing: existingRows,
    competitor: competitorRows,
    opportunities: opportunityRows,
    history: {
      site: siteHistory,
      competitors: competitorHistory,
    },
    summary: {
      referringDomains: toNumber(existingSummaryRow?.referringDomains),
      liveBacklinks: toNumber(existingSummaryRow?.liveBacklinks),
      moneyPagesLinked: toNumber(existingSummaryRow?.moneyPagesLinked),
      avgAuthority: Math.round(toNumber(existingSummaryRow?.avgAuthority) * 10) / 10,
      newBacklinks: siteHistory[siteHistory.length - 1]?.newBacklinksCount ?? 0,
      lostBacklinks: siteHistory[siteHistory.length - 1]?.lostBacklinksCount ?? 0,
      brokenBacklinks: siteHistory[siteHistory.length - 1]?.brokenBacklinksCount ?? 0,
      competitorDomainsTracked: siteCompetitorRows.length,
      competitorBacklinksTracked: toNumber(competitorSummaryRow?.total),
      linkGapCount: toNumber(linkGapRow?.linkGapCount),
      newOpportunities: toNumber(opportunitySummaryRow?.newOpportunities),
      highConfidenceOpportunities: toNumber(
        opportunitySummaryRow?.highConfidenceOpportunities,
      ),
      approvedForOutreach: toNumber(opportunitySummaryRow?.approvedForOutreach),
      rejectedOpportunities: toNumber(opportunitySummaryRow?.rejectedOpportunities),
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

/* ---------------------------------------------------------------------------
 * Backlinks grouped by domain
 * --------------------------------------------------------------------------- */

type BacklinkLink = {
  id: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  targetUrl: string;
  targetPageTitle: string | null;
  anchorText: string | null;
  relAttr: string | null;
  linkType: string | null;
  authorityScore: string | null;
  relevanceScore: string | null;
  status: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type CompetitorBacklinkLink = BacklinkLink & {
  competitorLabel: string;
  competitorDomain: string;
};

export type BacklinkDomainGroup = {
  sourceDomain: string;
  totalLinks: number;
  liveLinks: number;
  maxAuthority: number | null;
  lastSeenAt: string | null;
  links: BacklinkLink[];
  hasMoreLinks: boolean;
};

export type CompetitorBacklinkDomainGroup = {
  sourceDomain: string;
  totalLinks: number;
  liveLinks: number;
  maxAuthority: number | null;
  lastSeenAt: string | null;
  competitors: Array<{
    competitorId: number;
    competitorLabel: string;
    competitorDomain: string;
    linkCount: number;
  }>;
  links: CompetitorBacklinkLink[];
  hasMoreLinks: boolean;
};

export type BacklinksByDomainResult = {
  existing: BacklinkDomainGroup[];
  competitor: CompetitorBacklinkDomainGroup[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalDomains: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  kind: "existing" | "competitors";
};

const DOMAINS_PER_PAGE = 30;
const LINKS_PER_DOMAIN = 10;

export async function getBacklinksByDomain(
  db: Database,
  siteId: number,
  kind: "existing" | "competitors",
  page: number,
  search?: string,
): Promise<BacklinksByDomainResult> {
  const safePage = Math.max(1, page);
  const searchPattern = search?.trim()
    ? `%${search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
    : null;

  const offset = (safePage - 1) * DOMAINS_PER_PAGE;

  if (kind === "existing") {
    // Step 1: Get paginated domains with aggregate stats (pagination at DB level)
    const domainStatsQuery = sql`
      SELECT
        bs.source_domain AS "sourceDomain",
        COUNT(*)::integer AS "totalLinks",
        SUM(CASE WHEN bs.status = 'live' THEN 1 ELSE 0 END)::integer AS "liveLinks",
        MAX(bs.authority_score::numeric) AS "maxAuthority",
        MAX(bs.last_seen_at) AS "lastSeenAt",
        COUNT(*) OVER ()::integer AS "totalDomains"
      FROM backlink_sources bs
      WHERE bs.site_id = ${siteId}
        ${searchPattern ? sql`AND (
          bs.source_domain ILIKE ${searchPattern}
          OR bs.source_url ILIKE ${searchPattern}
          OR bs.source_title ILIKE ${searchPattern}
          OR bs.target_url ILIKE ${searchPattern}
          OR bs.anchor_text ILIKE ${searchPattern}
        )` : sql``}
      GROUP BY bs.source_domain
      ORDER BY "totalLinks" DESC
      LIMIT ${DOMAINS_PER_PAGE} OFFSET ${offset}
    `;

    const pagedResult = await db.execute(domainStatsQuery);
    const pagedDomains = pagedResult.rows as Array<{
      sourceDomain: string;
      totalLinks: number;
      liveLinks: number;
      maxAuthority: string | null;
      lastSeenAt: string | null;
      totalDomains: number;
    }>;

    const totalDomains = pagedDomains[0]?.totalDomains ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalDomains / DOMAINS_PER_PAGE));
    const clampedPage = Math.min(safePage, totalPages);

    if (pagedDomains.length === 0) {
      return {
        existing: [],
        competitor: [],
        pageInfo: { page: clampedPage, pageSize: DOMAINS_PER_PAGE, totalDomains, totalPages, hasPreviousPage: false, hasNextPage: false },
        kind,
      };
    }

    // Step 2: Fetch top N links per domain using lateral join (limit at DB level)
    const domainNames = pagedDomains.map((d) => d.sourceDomain);
    const linksQuery = sql`
      SELECT l.*
      FROM unnest(ARRAY[${sql.join(domainNames.map((d) => sql`${d}`), sql`, `)}]) AS d(domain_name)
      CROSS JOIN LATERAL (
        SELECT
          bs.id,
          bs.source_domain AS "sourceDomain",
          bs.source_url AS "sourceUrl",
          bs.source_title AS "sourceTitle",
          bs.target_url AS "targetUrl",
          p.title_tag AS "targetPageTitle",
          bs.anchor_text AS "anchorText",
          bs.rel_attr AS "relAttr",
          bs.link_type AS "linkType",
          bs.authority_score AS "authorityScore",
          bs.relevance_score AS "relevanceScore",
          bs.status,
          bs.first_seen_at AS "firstSeenAt",
          bs.last_seen_at AS "lastSeenAt"
        FROM backlink_sources bs
        LEFT JOIN pages p ON p.id = bs.target_page_id
        WHERE bs.site_id = ${siteId}
          AND bs.source_domain = d.domain_name
        ORDER BY bs.last_seen_at DESC
        LIMIT ${LINKS_PER_DOMAIN}
      ) l
    `;

    const allLinks = (await db.execute(linksQuery)).rows as Array<BacklinkLink & { sourceDomain: string }>;

    // Group links by domain
    const linksByDomain = new Map<string, BacklinkLink[]>();
    for (const link of allLinks) {
      const arr = linksByDomain.get(link.sourceDomain) ?? [];
      arr.push(link);
      linksByDomain.set(link.sourceDomain, arr);
    }

    const existingGroups: BacklinkDomainGroup[] = pagedDomains.map((d) => ({
      sourceDomain: d.sourceDomain,
      totalLinks: d.totalLinks,
      liveLinks: d.liveLinks,
      maxAuthority: d.maxAuthority ? Number(d.maxAuthority) : null,
      lastSeenAt: d.lastSeenAt,
      links: linksByDomain.get(d.sourceDomain) ?? [],
      hasMoreLinks: d.totalLinks > LINKS_PER_DOMAIN,
    }));

    return {
      existing: existingGroups,
      competitor: [],
      pageInfo: {
        page: clampedPage,
        pageSize: DOMAINS_PER_PAGE,
        totalDomains,
        totalPages,
        hasPreviousPage: clampedPage > 1,
        hasNextPage: clampedPage < totalPages,
      },
      kind,
    };
  }

  // --- Competitors ---
  const domainStatsQuery = sql`
    SELECT
      cbs.source_domain AS "sourceDomain",
      COUNT(*)::integer AS "totalLinks",
      SUM(CASE WHEN cbs.status = 'live' THEN 1 ELSE 0 END)::integer AS "liveLinks",
      COUNT(DISTINCT cbs.site_competitor_id)::integer AS "competitorCount",
      MAX(cbs.authority_score::numeric) AS "maxAuthority",
      MAX(cbs.last_seen_at) AS "lastSeenAt",
      COUNT(*) OVER ()::integer AS "totalDomains"
    FROM competitor_backlink_sources cbs
    INNER JOIN site_competitors sc ON sc.id = cbs.site_competitor_id
    WHERE sc.site_id = ${siteId}
      ${searchPattern ? sql`AND (
        cbs.source_domain ILIKE ${searchPattern}
        OR cbs.source_url ILIKE ${searchPattern}
        OR cbs.source_title ILIKE ${searchPattern}
        OR cbs.target_url ILIKE ${searchPattern}
        OR cbs.anchor_text ILIKE ${searchPattern}
        OR sc.label ILIKE ${searchPattern}
      )` : sql``}
    GROUP BY cbs.source_domain
    ORDER BY "competitorCount" DESC, "totalLinks" DESC
    LIMIT ${DOMAINS_PER_PAGE} OFFSET ${offset}
  `;

  const pagedResult = await db.execute(domainStatsQuery);
  const pagedDomains = pagedResult.rows as Array<{
    sourceDomain: string;
    totalLinks: number;
    liveLinks: number;
    maxAuthority: string | null;
    lastSeenAt: string | null;
    totalDomains: number;
  }>;

  const totalDomains = pagedDomains[0]?.totalDomains ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDomains / DOMAINS_PER_PAGE));
  const clampedPage = Math.min(safePage, totalPages);

  if (pagedDomains.length === 0) {
    return {
      existing: [],
      competitor: [],
      pageInfo: { page: clampedPage, pageSize: DOMAINS_PER_PAGE, totalDomains, totalPages, hasPreviousPage: false, hasNextPage: false },
      kind,
    };
  }

  // Fetch links + competitor info per domain using lateral join
  const domainNames = pagedDomains.map((d) => d.sourceDomain);
  const linksQuery = sql`
    SELECT l.*
    FROM unnest(ARRAY[${sql.join(domainNames.map((d) => sql`${d}`), sql`, `)}]) AS d(domain_name)
    CROSS JOIN LATERAL (
      SELECT
        cbs.id,
        cbs.source_domain AS "sourceDomain",
        sc.label AS "competitorLabel",
        sc.competitor_domain AS "competitorDomain",
        cbs.source_url AS "sourceUrl",
        cbs.source_title AS "sourceTitle",
        cbs.target_url AS "targetUrl",
        cbs.anchor_text AS "anchorText",
        cbs.rel_attr AS "relAttr",
        cbs.link_type AS "linkType",
        cbs.authority_score AS "authorityScore",
        cbs.relevance_score AS "relevanceScore",
        cbs.status,
        cbs.first_seen_at AS "firstSeenAt",
        cbs.last_seen_at AS "lastSeenAt",
        sc.id AS "siteCompetitorId"
      FROM competitor_backlink_sources cbs
      INNER JOIN site_competitors sc ON sc.id = cbs.site_competitor_id
      WHERE sc.site_id = ${siteId}
        AND cbs.source_domain = d.domain_name
      ORDER BY cbs.last_seen_at DESC
      LIMIT ${LINKS_PER_DOMAIN * 5}
    ) l
  `;

  const allLinks = (await db.execute(linksQuery)).rows as Array<
    CompetitorBacklinkLink & { sourceDomain: string; siteCompetitorId: number }
  >;

  // Group links by domain + build competitor metadata
  const linksByDomain = new Map<string, CompetitorBacklinkLink[]>();
  const competitorsByDomain = new Map<string, Map<number, { competitorId: number; competitorLabel: string; competitorDomain: string; linkCount: number }>>();

  for (const link of allLinks) {
    let compMap = competitorsByDomain.get(link.sourceDomain);
    if (!compMap) {
      compMap = new Map();
      competitorsByDomain.set(link.sourceDomain, compMap);
    }
    const existing = compMap.get(link.siteCompetitorId);
    if (existing) {
      existing.linkCount++;
    } else {
      compMap.set(link.siteCompetitorId, {
        competitorId: link.siteCompetitorId,
        competitorLabel: link.competitorLabel,
        competitorDomain: link.competitorDomain,
        linkCount: 1,
      });
    }

    const arr = linksByDomain.get(link.sourceDomain) ?? [];
    arr.push(link);
    linksByDomain.set(link.sourceDomain, arr);
  }

  const competitorGroups: CompetitorBacklinkDomainGroup[] = pagedDomains.map((d) => ({
    sourceDomain: d.sourceDomain,
    totalLinks: d.totalLinks,
    liveLinks: d.liveLinks,
    maxAuthority: d.maxAuthority ? Number(d.maxAuthority) : null,
    lastSeenAt: d.lastSeenAt,
    competitors: [...(competitorsByDomain.get(d.sourceDomain)?.values() ?? [])],
    links: linksByDomain.get(d.sourceDomain) ?? [],
    hasMoreLinks: d.totalLinks > LINKS_PER_DOMAIN * 5,
  }));

  return {
    existing: [],
    competitor: competitorGroups,
    pageInfo: {
      page: clampedPage,
      pageSize: DOMAINS_PER_PAGE,
      totalDomains,
      totalPages,
      hasPreviousPage: clampedPage > 1,
      hasNextPage: clampedPage < totalPages,
    },
    kind,
  };
}

export async function captureBacklinkFootprints(
  db: Database,
  siteId: number,
): Promise<{
  capturedAt: string;
  siteBacklinksCount: number;
  competitorCount: number;
}> {
  const capturedAt = new Date().toISOString();

  const [siteRows, competitorRows, competitorBacklinkRows] = await Promise.all([
    db
      .select({
        sourceDomain: backlinkSources.sourceDomain,
        status: backlinkSources.status,
      })
      .from(backlinkSources)
      .where(eq(backlinkSources.siteId, siteId)),
    db
      .select({
        id: siteCompetitors.id,
      })
      .from(siteCompetitors)
      .where(eq(siteCompetitors.siteId, siteId)),
    db
      .select({
        siteCompetitorId: competitorBacklinkSources.siteCompetitorId,
        sourceDomain: competitorBacklinkSources.sourceDomain,
        status: competitorBacklinkSources.status,
      })
      .from(competitorBacklinkSources)
      .innerJoin(
        siteCompetitors,
        eq(competitorBacklinkSources.siteCompetitorId, siteCompetitors.id),
      )
      .where(eq(siteCompetitors.siteId, siteId)),
  ]);

  const siteSnapshot = {
    siteId,
    capturedAt,
    backlinksCount: siteRows.length,
    liveBacklinksCount: siteRows.filter((row) => row.status === "live").length,
    referringDomainsCount: new Set(siteRows.map((row) => row.sourceDomain)).size,
  };

  await db.insert(siteBacklinkFootprints).values(siteSnapshot);

  const competitorStats = new Map<
    number,
    {
      backlinksCount: number;
      liveBacklinksCount: number;
      referringDomains: Set<string>;
    }
  >();

  for (const competitor of competitorRows) {
    competitorStats.set(competitor.id, {
      backlinksCount: 0,
      liveBacklinksCount: 0,
      referringDomains: new Set<string>(),
    });
  }

  for (const row of competitorBacklinkRows) {
    const stats = competitorStats.get(row.siteCompetitorId);
    if (!stats) continue;
    stats.backlinksCount += 1;
    if (row.status === "live") {
      stats.liveBacklinksCount += 1;
    }
    stats.referringDomains.add(row.sourceDomain);
  }

  const competitorSnapshots = competitorRows.map((competitor) => {
    const stats = competitorStats.get(competitor.id);
    return {
      siteCompetitorId: competitor.id,
      capturedAt,
      backlinksCount: stats?.backlinksCount ?? 0,
      liveBacklinksCount: stats?.liveBacklinksCount ?? 0,
      referringDomainsCount: stats?.referringDomains.size ?? 0,
    };
  });

  if (competitorSnapshots.length > 0) {
    await db.insert(competitorBacklinkFootprints).values(competitorSnapshots);
  }

  return {
    capturedAt,
    siteBacklinksCount: siteSnapshot.backlinksCount,
    competitorCount: competitorSnapshots.length,
  };
}

/* ---------------------------------------------------------------------------
 * Keywords universe
 * --------------------------------------------------------------------------- */

export async function getKeywordsData(
  db: Database,
  input: {
    siteId: number;
    page: number;
    pageSize: number;
    search?: string;
    sortBy: string;
    sortDirection: "asc" | "desc";
    intentFilter?: string;
    sourceFilter: string;
  },
) {
  const { siteId, page, pageSize, search, sortBy, sortDirection, intentFilter, sourceFilter } = input;
  const offset = (page - 1) * pageSize;

  // Build the base query using raw SQL for the complex aggregation
  const searchCondition = search
    ? sql`AND kw.keyword ILIKE ${"%" + search + "%"}`
    : sql``;

  const intentCondition = intentFilter
    ? sql`AND kw.search_intent = ${intentFilter}`
    : sql``;

  // Source filter applied in WHERE on the final joined result
  const sourceCondition =
    sourceFilter === "ours"
      ? sql`AND kw.our_query_id IS NOT NULL`
      : sourceFilter === "shared"
        ? sql`AND kw.our_query_id IS NOT NULL AND kw.competitor_count > 0`
        : sourceFilter === "competitor_only"
          ? sql`AND kw.our_query_id IS NULL`
          : sql``;

  // Sort mapping
  const sortColumn: Record<string, string> = {
    keyword: "kw.keyword",
    searchVolume: "kw.search_volume",
    keywordDifficulty: "CAST(kw.keyword_difficulty AS numeric)",
    ourPosition: "COALESCE(scd.avg_position, 999999)",
    bestCompetitorRank: "kw.best_rank",
    competitorCount: "COALESCE(kw.competitor_count, 0)",
  };
  const sortCol = sortColumn[sortBy] ?? "kw.search_volume";
  const sortDir = sortDirection === "asc" ? sql`ASC` : sql`DESC`;

  const mainQuery = sql`
    WITH competitor_best AS (
      SELECT DISTINCT ON (crk.keyword)
        crk.keyword,
        crk.rank AS best_rank,
        sc.label AS best_competitor_label
      FROM competitor_ranked_keywords crk
      INNER JOIN site_competitors sc ON sc.id = crk.site_competitor_id
      WHERE sc.site_id = ${siteId}
      ORDER BY crk.keyword, crk.rank ASC
    ),
    competitor_kws AS (
      SELECT
        crk.keyword,
        MAX(crk.search_volume) AS search_volume,
        cb.best_rank,
        cb.best_competitor_label,
        COUNT(DISTINCT crk.site_competitor_id) AS competitor_count,
        (array_agg(crk.search_intent ORDER BY crk.captured_at DESC)
          FILTER (WHERE crk.search_intent IS NOT NULL))[1] AS search_intent,
        (array_agg(crk.keyword_difficulty ORDER BY crk.captured_at DESC)
          FILTER (WHERE crk.keyword_difficulty IS NOT NULL))[1] AS keyword_difficulty
      FROM competitor_ranked_keywords crk
      INNER JOIN site_competitors sc ON sc.id = crk.site_competitor_id
      INNER JOIN competitor_best cb ON cb.keyword = crk.keyword
      WHERE sc.site_id = ${siteId}
      GROUP BY crk.keyword, cb.best_rank, cb.best_competitor_label
    ),
    our_queries AS (
      SELECT q.id, q.query AS keyword
      FROM queries q
      INNER JOIN query_clusters qc ON qc.id = q.cluster_id
      WHERE qc.site_id = ${siteId}
    ),
    all_keywords AS (
      SELECT
        COALESCE(kw.keyword, our_q.keyword) AS keyword,
        kw.search_volume,
        kw.best_rank,
        kw.best_competitor_label,
        kw.competitor_count,
        kw.search_intent,
        kw.keyword_difficulty,
        our_q.id AS our_query_id
      FROM competitor_kws kw
      FULL OUTER JOIN our_queries our_q ON LOWER(kw.keyword) = LOWER(our_q.keyword)
    )
    SELECT
      kw.keyword,
      kw.search_volume AS "searchVolume",
      kw.keyword_difficulty AS "keywordDifficulty",
      kw.search_intent AS "searchIntent",
      kw.our_query_id IS NOT NULL AS "isOurs",
      kw.best_rank AS "bestCompetitorRank",
      kw.best_competitor_label AS "bestCompetitorLabel",
      COALESCE(kw.competitor_count, 0)::int AS "competitorCount",
      scd.avg_position AS "ourPosition",
      scd.clicks AS "ourClicks",
      scd.impressions AS "ourImpressions",
      COUNT(*) OVER() AS "totalCount"
    FROM all_keywords kw
    LEFT JOIN LATERAL (
      SELECT s.avg_position, s.clicks, s.impressions
      FROM search_console_daily s
      WHERE s.query_id = kw.our_query_id AND s.site_id = ${siteId}
      ORDER BY s.event_date DESC
      LIMIT 1
    ) scd ON true
    WHERE 1=1
    ${searchCondition}
    ${intentCondition}
    ${sourceCondition}
    ORDER BY ${sql.raw(sortCol)} ${sortDir} NULLS LAST, kw.keyword ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  const summaryQuery = sql`
    WITH competitor_kws AS (
      SELECT crk.keyword
      FROM competitor_ranked_keywords crk
      INNER JOIN site_competitors sc ON sc.id = crk.site_competitor_id
      WHERE sc.site_id = ${siteId}
      GROUP BY crk.keyword
    ),
    our_queries AS (
      SELECT q.query AS keyword
      FROM queries q
      INNER JOIN query_clusters qc ON qc.id = q.cluster_id
      WHERE qc.site_id = ${siteId}
    )
    SELECT
      (SELECT COUNT(DISTINCT keyword) FROM (
        SELECT keyword FROM competitor_kws
        UNION
        SELECT keyword FROM our_queries
      ) u)::int AS "totalKeywords",
      (SELECT COUNT(*) FROM our_queries)::int AS "ourKeywords",
      (SELECT COUNT(*) FROM our_queries oq WHERE EXISTS (
        SELECT 1 FROM competitor_kws ck WHERE LOWER(ck.keyword) = LOWER(oq.keyword)
      ))::int AS "sharedKeywords",
      (SELECT COUNT(*) FROM competitor_kws ck WHERE NOT EXISTS (
        SELECT 1 FROM our_queries oq WHERE LOWER(oq.keyword) = LOWER(ck.keyword)
      ))::int AS "competitorOnlyKeywords"
  `;

  const [mainRows, summaryRows] = await Promise.all([
    db.execute(mainQuery),
    db.execute(summaryQuery),
  ]);

  const rows = mainRows.rows as Array<{
    keyword: string;
    searchVolume: number | null;
    keywordDifficulty: string | null;
    searchIntent: string | null;
    isOurs: boolean;
    bestCompetitorRank: number | null;
    bestCompetitorLabel: string | null;
    competitorCount: number;
    ourPosition: string | null;
    ourClicks: number | null;
    ourImpressions: number | null;
    totalCount: string;
  }>;

  const total = rows.length > 0 ? Number(rows[0].totalCount) : 0;
  const totalPages = Math.ceil(total / pageSize);

  const summaryRow = (summaryRows.rows[0] ?? {
    totalKeywords: 0,
    ourKeywords: 0,
    sharedKeywords: 0,
    competitorOnlyKeywords: 0,
  }) as {
    totalKeywords: number;
    ourKeywords: number;
    sharedKeywords: number;
    competitorOnlyKeywords: number;
  };

  return {
    rows: rows.map((r) => ({
      keyword: r.keyword,
      searchVolume: r.searchVolume,
      keywordDifficulty: r.keywordDifficulty,
      searchIntent: r.searchIntent,
      ourPosition: r.ourPosition ? Number(r.ourPosition) : null,
      ourClicks: r.ourClicks,
      ourImpressions: r.ourImpressions,
      isOurs: r.isOurs,
      bestCompetitorRank: r.bestCompetitorRank,
      bestCompetitorLabel: r.bestCompetitorLabel,
      competitorCount: r.competitorCount,
    })),
    pageInfo: {
      page,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary: summaryRow,
  };
}
