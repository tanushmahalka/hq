export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type SeoViewTab = "overview" | "competitors" | "keywords" | "analytics" | "backlinks";

export type SeoSite = {
  id: number;
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
};

export type SeoCluster = {
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
  history: SeoCompetitorHistoryPoint[];
  topKeywords: SeoCompetitorKeyword[];
};

/* ---------------------------------------------------------------------------
 * Backlinks
 * --------------------------------------------------------------------------- */

export type BacklinkSource = {
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
};

export type CompetitorBacklink = {
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
};

export type LinkOpportunity = {
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
};

export type BacklinkHistoryPoint = {
  capturedAt: string;
  backlinksCount: number;
  newBacklinksCount: number;
  lostBacklinksCount: number;
  liveBacklinksCount: number;
  referringDomainsCount: number;
  newReferringDomainsCount: number;
  lostReferringDomainsCount: number;
  brokenBacklinksCount: number;
};

export type BacklinksData = {
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
    subview: BacklinksSubview;
    search: string;
    statusFilter: string;
    sortBy: string;
    sortDirection: "asc" | "desc";
  };
  existing: BacklinkSource[];
  competitor: CompetitorBacklink[];
  opportunities: LinkOpportunity[];
  history: {
    site: BacklinkHistoryPoint[];
    competitors: Array<{
      siteCompetitorId: number;
      competitorLabel: string;
      competitorDomain: string;
      history: BacklinkHistoryPoint[];
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

export type BacklinkLink = {
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
  links: Array<BacklinkLink & {
    competitorLabel: string;
    competitorDomain: string;
  }>;
  hasMoreLinks: boolean;
};

export type BacklinksByDomainPageInfo = {
  page: number;
  pageSize: number;
  totalDomains: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type BacklinksSubview = "existing" | "competitors" | "opportunities";

/* ---------------------------------------------------------------------------
 * Keywords
 * --------------------------------------------------------------------------- */

export type KeywordRow = {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: string | null;
  searchIntent: string | null;
  ourPosition: number | null;
  ourClicks: number | null;
  ourImpressions: number | null;
  isOurs: boolean;
  bestCompetitorRank: number | null;
  competitorCount: number;
};

export type KeywordsData = {
  rows: KeywordRow[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  summary: {
    totalKeywords: number;
    ourKeywords: number;
    sharedKeywords: number;
    competitorOnlyKeywords: number;
  };
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
