import type { Database } from "../db/client.ts";
import {
  competitorDomainFootprints,
  competitorRankedKeywords,
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
    competitorKeywordRows,
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
    db
      .select({
        siteCompetitorId: competitorRankedKeywords.siteCompetitorId,
        keyword: competitorRankedKeywords.keyword,
        location: competitorRankedKeywords.location,
        languageCode: competitorRankedKeywords.languageCode,
        rank: competitorRankedKeywords.rank,
        searchVolume: competitorRankedKeywords.searchVolume,
        keywordDifficulty: competitorRankedKeywords.keywordDifficulty,
        searchIntent: competitorRankedKeywords.searchIntent,
        rankingUrl: competitorRankedKeywords.rankingUrl,
        serpItemType: competitorRankedKeywords.serpItemType,
        estimatedTraffic: competitorRankedKeywords.estimatedTraffic,
        capturedAt: competitorRankedKeywords.capturedAt,
      })
      .from(competitorRankedKeywords),
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

  const normalizedCompetitorKeywordRows = competitorKeywordRows.map((row) => ({
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

  const keywordsByCompetitor = new Map<
    number,
    Array<(typeof normalizedCompetitorKeywordRows)[number]>
  >();
  for (const row of normalizedCompetitorKeywordRows) {
    const existing = keywordsByCompetitor.get(row.siteCompetitorId) ?? [];
    existing.push(row);
    keywordsByCompetitor.set(row.siteCompetitorId, existing);
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

      const competitorKeywords = [...(keywordsByCompetitor.get(competitor.id) ?? [])].sort(
        (a, b) => {
          if (a.capturedAt.getTime() !== b.capturedAt.getTime()) {
            return b.capturedAt.getTime() - a.capturedAt.getTime();
          }
          if (a.rank !== b.rank) return a.rank - b.rank;
          if (a.searchVolume !== b.searchVolume) {
            return b.searchVolume - a.searchVolume;
          }
          return a.keyword.localeCompare(b.keyword);
        },
      );

      const latestKeywordCapturedAt = competitorKeywords[0]?.capturedAt ?? null;
      const latestKeywordTime = latestKeywordCapturedAt?.getTime() ?? null;
      const latestKeywordSnapshot = latestKeywordTime
        ? competitorKeywords.filter(
            (row) => row.capturedAt.getTime() === latestKeywordTime,
          )
        : [];

      return {
        id: competitor.id,
        siteId: competitor.siteId,
        label: competitor.label,
        competitorDomain: competitor.competitorDomain,
        competitorType: competitor.competitorType,
        isActive: competitor.isActive,
        notes: competitor.notes,
        footprintSnapshotCount: competitorFootprints.length,
        keywordRowCount: competitorKeywords.length,
        latestKeywordCount: latestKeywordSnapshot.length,
        latestKeywordCapturedAt,
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
        topKeywords: latestKeywordSnapshot.slice(0, 8),
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
