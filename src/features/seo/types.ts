export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type PageVisibilityFilter = "all" | "searchable" | "hidden" | "attention";
export type SeoViewTab = "overview" | "competitors";

export type SeoSite = {
  id: string;
  name: string;
  domain: string;
  pageCount: number;
  clusterCount: number;
  keywordCount: number;
  mappedPageCount: number;
  footprintSnapshotCount: number;
  latestFootprint: SeoSiteFootprint | null;
  history: SeoCompetitorHistoryPoint[];
};

export type SeoSiteFootprint = {
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
};

export type SeoPage = {
  id: string;
  siteId: string;
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
};

export type SeoCluster = {
  id: string;
  siteId: string;
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
};

export type SeoCompetitorKeyword = {
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
};

export type SeoCompetitorHistoryPoint = {
  estimatedOrganicTraffic: number | null;
  rankedKeywordsCount: number | null;
  capturedAt: Date;
};

export type SeoCompetitor = {
  id: string;
  siteId: string;
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
  history: SeoCompetitorHistoryPoint[];
  topKeywords: SeoCompetitorKeyword[];
};

export type SeoOverviewData = {
  summary: {
    siteCount: number;
    pageCount: number;
    clusterCount: number;
    keywordCount: number;
    mappedPageCount: number;
  };
  sites: SeoSite[];
  pages: SeoPage[];
  clusters: SeoCluster[];
  competitors: SeoCompetitor[];
};
