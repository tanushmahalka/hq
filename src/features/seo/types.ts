export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type SeoViewTab = "overview" | "competitors" | "keywords" | "geo" | "analytics" | "backlinks";

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
  lastAuditedOn: Date | null;
  auditJson: unknown;
  clusterCount: number;
  clusterNames: string[];
};

export type PageAuditItem = {
  url: string;
  meta: {
    title: string | null;
    description: string | null;
    description_length: number | null;
    title_length: number | null;
    canonical: string | null;
    favicon: string | null;
    htags: Record<string, string[]> | null;
    content: {
      plain_text_size: number | null;
      plain_text_word_count: number | null;
      plain_text_rate: number | null;
      flesch_kincaid_readability_index: number | null;
      title_to_content_consistency: number | null;
      description_to_content_consistency: number | null;
    } | null;
    images_count: number | null;
    images_size: number | null;
    scripts_count: number | null;
    scripts_size: number | null;
    stylesheets_count: number | null;
    stylesheets_size: number | null;
    internal_links_count: number | null;
    external_links_count: number | null;
    inbound_links_count: number | null;
    social_media_tags: Record<string, string> | null;
  } | null;
  checks: Record<string, boolean> | null;
  size: number | null;
  encoded_size: number | null;
  onpage_score: number | null;
  status_code: number | null;
  page_timing: {
    duration_time: number | null;
    waiting_time: number | null;
    download_time: number | null;
    time_to_interactive: number | null;
    largest_contentful_paint: number | null;
    first_input_delay: number | null;
    cumulative_layout_shift?: number | null;
  } | null;
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
  isRelevant: boolean | null;
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
 * GEO
 * --------------------------------------------------------------------------- */

export type GeoSetupState = {
  hasSchema: boolean;
  hasSavedPrompts: boolean;
  headline: string;
  description: string;
  nextStep: string;
};

export type GeoSummary = {
  clusterCount: number;
  totalPrompts: number;
  clusterCoverage: number;
  mappedClusterCount: number;
  conversationalPromptCount: number;
  activeRecommendations: number;
};

export type GeoClusterPrompt = {
  id: number | null;
  prompt: string;
  source: "geo_prompt" | "query_seed";
  isPrimaryQuerySeed: boolean;
  isConversational: boolean;
};

export type GeoClusterRow = {
  clusterId: number;
  clusterName: string;
  intent: string | null;
  funnelStage: string | null;
  priorityScore: number | null;
  promptCount: number;
  conversationalPromptCount: number;
  mappedPageTitle: string | null;
  mappedPageUrl: string | null;
  prompts: GeoClusterPrompt[];
};

export type GeoRecommendation = {
  id: number | null;
  type: string;
  title: string;
  rationale: string;
  status: string;
  impactScore: number | null;
  effortScore: number | null;
  clusterId: number | null;
  clusterName: string | null;
  prompt: string | null;
  pageTitle: string | null;
  pageUrl: string | null;
};

export type GeoOverviewData = {
  site: {
    id: number;
    name: string;
    domain: string;
    businessType: string;
    pageCount: number;
    clusterCount: number;
  };
  setup: GeoSetupState;
  summary: GeoSummary;
  clusters: GeoClusterRow[];
  recommendations: GeoRecommendation[];
};

/* ---------------------------------------------------------------------------
 * GEO Visibility
 * --------------------------------------------------------------------------- */

export type GeoVisibilityProvider = {
  platform: string;
  mentionRate: number;
  citationRate: number;
  totalResults: number;
};

export type GeoVisibilityClusterProvider = {
  platform: string;
  mentioned: boolean;
  cited: boolean;
  competitors: Array<{ domain: string; label: string }>;
};

export type GeoVisibilityCluster = {
  clusterId: number;
  clusterName: string;
  intent: string | null;
  funnelStage: string | null;
  promptCount: number;
  providers: GeoVisibilityClusterProvider[];
  prompts: Array<{ id: number; prompt: string }>;
};

export type GeoVisibilityData = {
  hasResults: boolean;
  summary: {
    totalPromptsRun: number;
    brandMentionRate: number;
    brandCitationRate: number;
    providersWithMentions: number;
    totalProviders: number;
  };
  providers: GeoVisibilityProvider[];
  clusters: GeoVisibilityCluster[];
  platforms: string[];
};

/* ---------------------------------------------------------------------------
 * GEO Prompt Results (detailed per-provider answers)
 * --------------------------------------------------------------------------- */

export type GeoProviderAnswer = {
  runId: number;
  platform: string;
  modelName: string;
  answerText: string;
  citations: Array<{ url: string; title: string; isOwned: boolean; isCompetitor: boolean }>;
  brandMentioned: boolean;
  brandCited: boolean;
  webSearch: boolean;
  cost: number | null;
  capturedAt: string;
};

export type GeoPromptWithResults = {
  promptId: number;
  promptText: string;
  results: GeoProviderAnswer[];
};

export type GeoResultsClusterGroup = {
  clusterId: number;
  clusterName: string;
  intent: string | null;
  funnelStage: string | null;
  prompts: GeoPromptWithResults[];
};

export type GeoPromptResultsData = {
  hasResults: boolean;
  clusters: GeoResultsClusterGroup[];
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
  bestCompetitorLabel: string | null;
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
