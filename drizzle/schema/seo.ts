import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const sites = pgTable(
  "sites",
  {
    name: text().notNull(),
    domain: text().notNull(),
    businessType: text("business_type").notNull(),
    cms: text(),
    defaultLocale: text("default_locale"),
    timezone: text(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "sites_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
  },
  (table) => [
    uniqueIndex("sites_domain_unique").using("btree", table.domain.asc().nullsLast().op("text_ops")),
  ],
);

export const crawlRuns = pgTable(
  "crawl_runs",
  {
    source: text().notNull(),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    finishedAt: timestamp("finished_at", { mode: "string" }),
    status: text().notNull(),
    notes: text(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "crawl_runs_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "crawl_runs_site_id_sites_id_fk",
    }),
  ],
);

export const pages = pgTable(
  "pages",
  {
    url: text().notNull(),
    canonicalUrl: text("canonical_url"),
    pageType: text("page_type").notNull(),
    titleTag: text("title_tag"),
    metaDescription: text("meta_description"),
    h1: text(),
    statusCode: integer("status_code"),
    indexability: text(),
    canonicalTargetUrl: text("canonical_target_url"),
    lastCrawledAt: timestamp("last_crawled_at", { mode: "string" }),
    lastAuditedOn: timestamp("last_audited_on", { mode: "string" }),
    lastPublishedAt: timestamp("last_published_at", { mode: "string" }),
    auditJson: jsonb("audit_json"),
    isMoneyPage: boolean("is_money_page").default(false).notNull(),
    isAuthorityAsset: boolean("is_authority_asset").default(false).notNull(),
    contentStatus: text("content_status").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "pages_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_pages_canonical_url").using("btree", table.canonicalUrl.asc().nullsLast().op("text_ops")),
    index("idx_pages_site_id").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    uniqueIndex("pages_site_url_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.url.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "pages_site_id_sites_id_fk",
    }),
  ],
);

export const siteCompetitors = pgTable(
  "site_competitors",
  {
    competitorDomain: text("competitor_domain").notNull(),
    label: text().notNull(),
    competitorType: text("competitor_type").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "site_competitors_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_site_competitors_site_id").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_site_competitors_type").using("btree", table.competitorType.asc().nullsLast().op("text_ops")),
    uniqueIndex("site_competitors_site_domain_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.competitorDomain.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "site_competitors_site_id_sites_id_fk",
    }),
  ],
);

export const queryClusters = pgTable(
  "query_clusters",
  {
    name: text().notNull(),
    primaryIntent: text("primary_intent").notNull(),
    funnelStage: text("funnel_stage"),
    priorityScore: numeric("priority_score", { precision: 10, scale: 2 }),
    notes: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "query_clusters_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "query_clusters_site_id_sites_id_fk",
    }),
  ],
);

export const queries = pgTable(
  "queries",
  {
    query: text().notNull(),
    locale: text(),
    searchEngine: text("search_engine").default("google"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "queries_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    clusterId: integer("cluster_id").notNull(),
  },
  (table) => [
    uniqueIndex("queries_cluster_query_unique").using(
      "btree",
      table.clusterId.asc().nullsLast().op("int4_ops"),
      table.query.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.clusterId],
      foreignColumns: [queryClusters.id],
      name: "queries_cluster_id_query_clusters_id_fk",
    }),
  ],
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    eventDate: date("event_date").notNull(),
    channel: text().notNull(),
    device: text(),
    sessions: integer().notNull(),
    users: integer(),
    engagedSessions: integer("engaged_sessions"),
    conversions: integer(),
    revenue: numeric({ precision: 14, scale: 2 }),
    avgEngagementSeconds: numeric("avg_engagement_seconds", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "analytics_daily_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    pageId: integer("page_id"),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    uniqueIndex("analytics_daily_grain_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.pageId.asc().nullsLast().op("int4_ops"),
      table.eventDate.asc().nullsLast().op("text_ops"),
      table.channel.asc().nullsLast().op("text_ops"),
      table.device.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_analytics_page_date").using(
      "btree",
      table.pageId.asc().nullsLast().op("date_ops"),
      table.eventDate.asc().nullsLast().op("date_ops"),
    ),
    index("idx_analytics_site_date").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.eventDate.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "analytics_daily_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "analytics_daily_site_id_sites_id_fk",
    }),
  ],
);

export const assets = pgTable(
  "assets",
  {
    assetType: text("asset_type").notNull(),
    title: text().notNull(),
    launchDate: date("launch_date"),
    refreshDate: date("refresh_date"),
    promotionStatus: text("promotion_status").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "assets_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    pageId: integer("page_id"),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "assets_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "assets_site_id_sites_id_fk",
    }),
  ],
);

export const backlinkSources = pgTable(
  "backlink_sources",
  {
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    sourcePageRank: integer("source_page_rank"),
    sourceDomainRank: integer("source_domain_rank"),
    sourceCountry: text("source_country"),
    sourceLanguage: text("source_language"),
    sourceStatusCode: integer("source_status_code"),
    sourceExternalLinksCount: integer("source_external_links_count"),
    sourceInternalLinksCount: integer("source_internal_links_count"),
    targetUrl: text("target_url").notNull(),
    targetStatusCode: integer("target_status_code"),
    targetRedirectUrl: text("target_redirect_url"),
    anchorText: text("anchor_text"),
    relAttr: text("rel_attr"),
    linkType: text("link_type"),
    semanticLocation: text("semantic_location"),
    isDofollow: boolean("is_dofollow"),
    isBroken: boolean("is_broken"),
    isNew: boolean("is_new"),
    isLost: boolean("is_lost"),
    backlinkSpamScore: integer("backlink_spam_score"),
    backlinkRank: integer("backlink_rank"),
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
    firstSeenAt: timestamp("first_seen_at", { mode: "string" }),
    previousSeenAt: timestamp("previous_seen_at", { mode: "string" }),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }),
    verifiedAt: timestamp("verified_at", { mode: "string" }),
    status: text().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "backlink_sources_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    targetPageId: integer("target_page_id"),
  },
  (table) => [
    uniqueIndex("backlink_sources_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.sourceUrl.asc().nullsLast().op("int4_ops"),
      table.targetUrl.asc().nullsLast().op("int4_ops"),
      table.anchorText.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_backlink_sources_source_domain").using(
      "btree",
      table.sourceDomain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_backlink_sources_target_page").using(
      "btree",
      table.targetPageId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "backlink_sources_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.targetPageId],
      foreignColumns: [pages.id],
      name: "backlink_sources_target_page_id_pages_id_fk",
    }),
  ],
);

export const competitorBacklinkSources = pgTable(
  "competitor_backlink_sources",
  {
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    sourcePageRank: integer("source_page_rank"),
    sourceDomainRank: integer("source_domain_rank"),
    sourceCountry: text("source_country"),
    sourceLanguage: text("source_language"),
    sourceStatusCode: integer("source_status_code"),
    sourceExternalLinksCount: integer("source_external_links_count"),
    sourceInternalLinksCount: integer("source_internal_links_count"),
    targetUrl: text("target_url").notNull(),
    targetStatusCode: integer("target_status_code"),
    targetRedirectUrl: text("target_redirect_url"),
    anchorText: text("anchor_text"),
    relAttr: text("rel_attr"),
    linkType: text("link_type"),
    semanticLocation: text("semantic_location"),
    isDofollow: boolean("is_dofollow"),
    isBroken: boolean("is_broken"),
    isNew: boolean("is_new"),
    isLost: boolean("is_lost"),
    backlinkSpamScore: integer("backlink_spam_score"),
    backlinkRank: integer("backlink_rank"),
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
    firstSeenAt: timestamp("first_seen_at", { mode: "string" }),
    previousSeenAt: timestamp("previous_seen_at", { mode: "string" }),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }),
    status: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "competitor_backlink_sources_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteCompetitorId: integer("site_competitor_id").notNull(),
  },
  (table) => [
    uniqueIndex("competitor_backlink_sources_unique").using(
      "btree",
      table.siteCompetitorId.asc().nullsLast().op("int4_ops"),
      table.sourceUrl.asc().nullsLast().op("text_ops"),
      table.targetUrl.asc().nullsLast().op("text_ops"),
      table.anchorText.asc().nullsLast().op("text_ops"),
    ),
    index("idx_competitor_backlink_sources_domain").using(
      "btree",
      table.sourceDomain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_competitor_backlink_sources_competitor").using(
      "btree",
      table.siteCompetitorId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "competitor_backlink_sources_site_competitor_id_site_competito",
    }),
  ],
);

export const brandMentions = pgTable(
  "brand_mentions",
  {
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url").notNull(),
    mentionText: text("mention_text"),
    mentionedEntity: text("mentioned_entity"),
    isLinked: boolean("is_linked").notNull(),
    linkedTargetUrl: text("linked_target_url"),
    sentiment: text(),
    discoveredAt: timestamp("discovered_at", { mode: "string" }).notNull(),
    status: text().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "brand_mentions_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    uniqueIndex("brand_mentions_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("text_ops"),
      table.sourceUrl.asc().nullsLast().op("int4_ops"),
      table.mentionedEntity.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brand_mentions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "brand_mentions_site_id_sites_id_fk",
    }),
  ],
);

export const businessProfiles = pgTable(
  "business_profiles",
  {
    platform: text().notNull(),
    profileName: text("profile_name"),
    profileUrl: text("profile_url"),
    category: text(),
    addressLine1: text("address_line1"),
    city: text(),
    region: text(),
    postalCode: text("postal_code"),
    countryCode: text("country_code"),
    phone: text(),
    websiteUrl: text("website_url"),
    isVerified: boolean("is_verified"),
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "string" }),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "business_profiles_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    uniqueIndex("business_profiles_site_platform_url_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("text_ops"),
      table.platform.asc().nullsLast().op("text_ops"),
      table.profileUrl.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "business_profiles_site_id_sites_id_fk",
    }),
  ],
);

export const competitorDomainFootprints = pgTable(
  "competitor_domain_footprints",
  {
    location: text().notNull(),
    languageCode: text("language_code").notNull(),
    estimatedOrganicTraffic: integer("estimated_organic_traffic"),
    estimatedPaidTraffic: integer("estimated_paid_traffic"),
    rankedKeywordsCount: integer("ranked_keywords_count"),
    top3KeywordsCount: integer("top_3_keywords_count"),
    top10KeywordsCount: integer("top_10_keywords_count"),
    top100KeywordsCount: integer("top_100_keywords_count"),
    visibilityScore: numeric("visibility_score", { precision: 10, scale: 2 }),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "competitor_domain_footprints_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteCompetitorId: integer("site_competitor_id").notNull(),
  },
  (table) => [
    index("idx_competitor_domain_footprints_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_competitor_domain_footprints_competitor").using(
      "btree",
      table.siteCompetitorId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_competitor_domain_footprints_location_language").using(
      "btree",
      table.location.asc().nullsLast().op("text_ops"),
      table.languageCode.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "competitor_domain_footprints_site_competitor_id_site_competitor",
    }),
  ],
);

export const competitorRankedKeywords = pgTable(
  "competitor_ranked_keywords",
  {
    keyword: text().notNull(),
    location: text().notNull(),
    languageCode: text("language_code").notNull(),
    rank: integer().notNull(),
    searchVolume: integer("search_volume").notNull(),
    keywordDifficulty: numeric("keyword_difficulty", { precision: 5, scale: 2 }),
    searchIntent: text("search_intent"),
    rankingUrl: text("ranking_url").notNull(),
    serpItemType: text("serp_item_type"),
    estimatedTraffic: numeric("estimated_traffic", { precision: 12, scale: 2 }),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "competitor_ranked_keywords_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteCompetitorId: integer("site_competitor_id").notNull(),
  },
  (table) => [
    index("idx_competitor_ranked_keywords_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_competitor_ranked_keywords_competitor").using(
      "btree",
      table.siteCompetitorId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_competitor_ranked_keywords_keyword").using(
      "btree",
      table.keyword.asc().nullsLast().op("text_ops"),
    ),
    index("idx_competitor_ranked_keywords_rank").using("btree", table.rank.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "competitor_ranked_keywords_site_competitor_id_site_competitors_",
    }),
  ],
);

export const crawlPageFacts = pgTable(
  "crawl_page_facts",
  {
    url: text().notNull(),
    statusCode: integer("status_code"),
    contentType: text("content_type"),
    robotsIndexable: boolean("robots_indexable"),
    robotsFollowable: boolean("robots_followable"),
    canonicalUrl: text("canonical_url"),
    canonicalStatus: text("canonical_status"),
    hreflangStatus: text("hreflang_status"),
    depth: integer(),
    inlinkCount: integer("inlink_count"),
    outlinkCount: integer("outlink_count"),
    wordCount: integer("word_count"),
    hasSchema: boolean("has_schema"),
    schemaTypes: text("schema_types").array(),
    mobileParityOk: boolean("mobile_parity_ok"),
    coreWebVitalsStatus: text("core_web_vitals_status"),
    lastModifiedHeader: timestamp("last_modified_header", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "crawl_page_facts_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    crawlRunId: integer("crawl_run_id").notNull(),
    pageId: integer("page_id"),
  },
  (table) => [
    index("idx_crawl_page_facts_url").using("btree", table.url.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.crawlRunId],
      foreignColumns: [crawlRuns.id],
      name: "crawl_page_facts_crawl_run_id_crawl_runs_id_fk",
    }),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "crawl_page_facts_page_id_pages_id_fk",
    }),
  ],
);

export const internalLinks = pgTable(
  "internal_links",
  {
    anchorText: text("anchor_text"),
    linkLocation: text("link_location"),
    isNofollow: boolean("is_nofollow").default(false).notNull(),
    firstSeenAt: timestamp("first_seen_at", { mode: "string" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "internal_links_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    sourcePageId: integer("source_page_id").notNull(),
    targetPageId: integer("target_page_id").notNull(),
  },
  (table) => [
    index("idx_internal_links_source").using("btree", table.sourcePageId.asc().nullsLast().op("int4_ops")),
    index("idx_internal_links_target").using("btree", table.targetPageId.asc().nullsLast().op("int4_ops")),
    uniqueIndex("internal_links_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("text_ops"),
      table.sourcePageId.asc().nullsLast().op("int4_ops"),
      table.targetPageId.asc().nullsLast().op("int4_ops"),
      table.anchorText.asc().nullsLast().op("text_ops"),
      table.linkLocation.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "internal_links_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.sourcePageId],
      foreignColumns: [pages.id],
      name: "internal_links_source_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.targetPageId],
      foreignColumns: [pages.id],
      name: "internal_links_target_page_id_pages_id_fk",
    }),
  ],
);

export const outreachProspects = pgTable(
  "outreach_prospects",
  {
    organizationName: text("organization_name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    domain: text(),
    homepageUrl: text("homepage_url"),
    prospectType: text("prospect_type").notNull(),
    relationshipStrength: text("relationship_strength"),
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    status: text().notNull(),
    notes: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "outreach_prospects_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "outreach_prospects_site_id_sites_id_fk",
    }),
  ],
);

export const linkOpportunities = pgTable(
  "link_opportunities",
  {
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title"),
    opportunityType: text("opportunity_type").notNull(),
    discoveredFrom: text("discovered_from").notNull(),
    whyThisFits: text("why_this_fits").notNull(),
    suggestedAnchorText: text("suggested_anchor_text"),
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
    riskScore: numeric("risk_score", { precision: 5, scale: 2 }),
    status: text().notNull(),
    firstSeenAt: timestamp("first_seen_at", { mode: "string" }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "link_opportunities_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    targetPageId: integer("target_page_id").notNull(),
    prospectId: integer("prospect_id"),
    siteCompetitorId: integer("site_competitor_id"),
    brandMentionId: integer("brand_mention_id"),
  },
  (table) => [
    uniqueIndex("link_opportunities_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
      table.sourceUrl.asc().nullsLast().op("text_ops"),
      table.targetPageId.asc().nullsLast().op("int4_ops"),
      table.opportunityType.asc().nullsLast().op("text_ops"),
    ),
    index("idx_link_opportunities_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
    index("idx_link_opportunities_target_page").using(
      "btree",
      table.targetPageId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_link_opportunities_prospect").using(
      "btree",
      table.prospectId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "link_opportunities_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.targetPageId],
      foreignColumns: [pages.id],
      name: "link_opportunities_target_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.prospectId],
      foreignColumns: [outreachProspects.id],
      name: "link_opportunities_prospect_id_outreach_prospects_id_fk",
    }),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "link_opportunities_site_competitor_id_site_competitors_id_fk",
    }),
    foreignKey({
      columns: [table.brandMentionId],
      foreignColumns: [brandMentions.id],
      name: "link_opportunities_brand_mention_id_brand_mentions_id_fk",
    }),
  ],
);

export const outreachContacts = pgTable(
  "outreach_contacts",
  {
    name: text().notNull(),
    role: text(),
    email: text().notNull(),
    linkedinUrl: text("linkedin_url"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
    lastValidatedAt: timestamp("last_validated_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "outreach_contacts_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    prospectId: integer("prospect_id").notNull(),
  },
  (table) => [
    uniqueIndex("outreach_contacts_prospect_email_unique").using(
      "btree",
      table.prospectId.asc().nullsLast().op("int4_ops"),
      table.email.asc().nullsLast().op("text_ops"),
    ),
    index("idx_outreach_contacts_prospect").using("btree", table.prospectId.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.prospectId],
      foreignColumns: [outreachProspects.id],
      name: "outreach_contacts_prospect_id_outreach_prospects_id_fk",
    }),
  ],
);

export const outreachThreads = pgTable(
  "outreach_threads",
  {
    channel: text().notNull(),
    status: text().notNull(),
    subject: text(),
    summary: text(),
    ownerLabel: text("owner_label"),
    lastMessageAt: timestamp("last_message_at", { mode: "string" }),
    lastInboundAt: timestamp("last_inbound_at", { mode: "string" }),
    lastOutboundAt: timestamp("last_outbound_at", { mode: "string" }),
    followUpDueAt: timestamp("follow_up_due_at", { mode: "string" }),
    outcome: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "outreach_threads_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    opportunityId: integer("opportunity_id").notNull(),
    prospectId: integer("prospect_id").notNull(),
    primaryContactId: integer("primary_contact_id"),
    wonBacklinkSourceId: integer("won_backlink_source_id"),
  },
  (table) => [
    index("idx_outreach_threads_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_outreach_threads_opportunity").using(
      "btree",
      table.opportunityId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_outreach_threads_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
    index("idx_outreach_threads_follow_up_due_at").using(
      "btree",
      table.followUpDueAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "outreach_threads_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.opportunityId],
      foreignColumns: [linkOpportunities.id],
      name: "outreach_threads_opportunity_id_link_opportunities_id_fk",
    }),
    foreignKey({
      columns: [table.prospectId],
      foreignColumns: [outreachProspects.id],
      name: "outreach_threads_prospect_id_outreach_prospects_id_fk",
    }),
    foreignKey({
      columns: [table.primaryContactId],
      foreignColumns: [outreachContacts.id],
      name: "outreach_threads_primary_contact_id_outreach_contacts_id_fk",
    }),
    foreignKey({
      columns: [table.wonBacklinkSourceId],
      foreignColumns: [backlinkSources.id],
      name: "outreach_threads_won_backlink_source_id_backlink_sources_id_fk",
    }),
  ],
);

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    direction: text().notNull(),
    messageType: text("message_type").notNull(),
    status: text().notNull(),
    subject: text(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    fromAddress: text("from_address"),
    toAddress: text("to_address").notNull(),
    ccAddresses: text("cc_addresses").array(),
    providerMessageId: text("provider_message_id"),
    providerThreadId: text("provider_thread_id"),
    inReplyToMessageId: integer("in_reply_to_message_id"),
    sentAt: timestamp("sent_at", { mode: "string" }),
    receivedAt: timestamp("received_at", { mode: "string" }),
    createdByAgent: text("created_by_agent"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "outreach_messages_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    threadId: integer("thread_id").notNull(),
  },
  (table) => [
    index("idx_outreach_messages_thread").using("btree", table.threadId.asc().nullsLast().op("int4_ops")),
    index("idx_outreach_messages_provider_message").using(
      "btree",
      table.providerMessageId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_outreach_messages_sent_at").using("btree", table.sentAt.asc().nullsLast().op("timestamp_ops")),
    index("idx_outreach_messages_received_at").using(
      "btree",
      table.receivedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [outreachThreads.id],
      name: "outreach_messages_thread_id_outreach_threads_id_fk",
    }),
    foreignKey({
      columns: [table.inReplyToMessageId],
      foreignColumns: [table.id],
      name: "outreach_messages_in_reply_to_message_id_outreach_messages_id_fk",
    }),
  ],
);

export const pageClusterTargets = pgTable(
  "page_cluster_targets",
  {
    targetRole: text("target_role").notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "page_cluster_targets_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    clusterId: integer("cluster_id").notNull(),
    pageId: integer("page_id").notNull(),
  },
  (table) => [
    uniqueIndex("page_cluster_target_unique").using(
      "btree",
      table.pageId.asc().nullsLast().op("int4_ops"),
      table.clusterId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.clusterId],
      foreignColumns: [queryClusters.id],
      name: "page_cluster_targets_cluster_id_query_clusters_id_fk",
    }),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "page_cluster_targets_page_id_pages_id_fk",
    }),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    platform: text().notNull(),
    externalReviewId: text("external_review_id"),
    reviewerName: text("reviewer_name"),
    rating: numeric({ precision: 3, scale: 1 }),
    reviewText: text("review_text"),
    reviewDate: timestamp("review_date", { mode: "string" }),
    sentiment: text(),
    responseStatus: text("response_status").notNull(),
    responseDate: timestamp("response_date", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "reviews_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_reviews_platform_date").using(
      "btree",
      table.platform.asc().nullsLast().op("timestamp_ops"),
      table.reviewDate.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("reviews_site_platform_external_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("text_ops"),
      table.platform.asc().nullsLast().op("int4_ops"),
      table.externalReviewId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "reviews_site_id_sites_id_fk",
    }),
  ],
);

export const searchConsoleDaily = pgTable(
  "search_console_daily",
  {
    eventDate: date("event_date").notNull(),
    device: text(),
    countryCode: text("country_code"),
    clicks: integer().notNull(),
    impressions: integer().notNull(),
    ctr: numeric({ precision: 8, scale: 6 }).notNull(),
    avgPosition: numeric("avg_position", { precision: 8, scale: 3 }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "search_console_daily_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    pageId: integer("page_id"),
    queryId: integer("query_id"),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_scd_page_date").using(
      "btree",
      table.pageId.asc().nullsLast().op("int4_ops"),
      table.eventDate.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_scd_query_date").using(
      "btree",
      table.queryId.asc().nullsLast().op("int4_ops"),
      table.eventDate.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_scd_site_date").using(
      "btree",
      table.siteId.asc().nullsLast().op("date_ops"),
      table.eventDate.asc().nullsLast().op("date_ops"),
    ),
    uniqueIndex("scd_grain_unique").using(
      "btree",
      table.siteId.asc().nullsLast().op("date_ops"),
      table.pageId.asc().nullsLast().op("text_ops"),
      table.queryId.asc().nullsLast().op("int4_ops"),
      table.eventDate.asc().nullsLast().op("int4_ops"),
      table.device.asc().nullsLast().op("text_ops"),
      table.countryCode.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "search_console_daily_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.queryId],
      foreignColumns: [queries.id],
      name: "search_console_daily_query_id_queries_id_fk",
    }),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "search_console_daily_site_id_sites_id_fk",
    }),
  ],
);

export const siteDomainFootprints = pgTable(
  "site_domain_footprints",
  {
    location: text().notNull(),
    languageCode: text("language_code").notNull(),
    estimatedOrganicTraffic: integer("estimated_organic_traffic"),
    estimatedPaidTraffic: integer("estimated_paid_traffic"),
    rankedKeywordsCount: integer("ranked_keywords_count"),
    top3KeywordsCount: integer("top_3_keywords_count"),
    top10KeywordsCount: integer("top_10_keywords_count"),
    top100KeywordsCount: integer("top_100_keywords_count"),
    visibilityScore: numeric("visibility_score", { precision: 10, scale: 2 }),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "site_domain_footprints_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_site_domain_footprints_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_site_domain_footprints_location_language").using(
      "btree",
      table.location.asc().nullsLast().op("text_ops"),
      table.languageCode.asc().nullsLast().op("text_ops"),
    ),
    index("idx_site_domain_footprints_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "site_domain_footprints_site_id_fkey",
    }),
  ],
);

export const siteBacklinkFootprints = pgTable(
  "site_backlink_footprints",
  {
    backlinksCount: integer("backlinks_count").notNull(),
    newBacklinksCount: integer("new_backlinks_count"),
    lostBacklinksCount: integer("lost_backlinks_count"),
    liveBacklinksCount: integer("live_backlinks_count").notNull(),
    referringDomainsCount: integer("referring_domains_count").notNull(),
    newReferringDomainsCount: integer("new_referring_domains_count"),
    lostReferringDomainsCount: integer("lost_referring_domains_count"),
    brokenBacklinksCount: integer("broken_backlinks_count"),
    rank: integer("rank"),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "site_backlink_footprints_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
  },
  (table) => [
    index("idx_site_backlink_footprints_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_site_backlink_footprints_site").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "site_backlink_footprints_site_id_sites_id_fk",
    }),
  ],
);

export const competitorBacklinkFootprints = pgTable(
  "competitor_backlink_footprints",
  {
    backlinksCount: integer("backlinks_count").notNull(),
    newBacklinksCount: integer("new_backlinks_count"),
    lostBacklinksCount: integer("lost_backlinks_count"),
    liveBacklinksCount: integer("live_backlinks_count").notNull(),
    referringDomainsCount: integer("referring_domains_count").notNull(),
    newReferringDomainsCount: integer("new_referring_domains_count"),
    lostReferringDomainsCount: integer("lost_referring_domains_count"),
    brokenBacklinksCount: integer("broken_backlinks_count"),
    rank: integer("rank"),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "competitor_backlink_footprints_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteCompetitorId: integer("site_competitor_id").notNull(),
  },
  (table) => [
    index("idx_competitor_backlink_footprints_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_competitor_backlink_footprints_competitor").using(
      "btree",
      table.siteCompetitorId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "competitor_backlink_footprints_site_competitor_id_site_compet",
    }),
  ],
);

export const geoPrompts = pgTable(
  "geo_prompts",
  {
    prompt: text().notNull(),
    normalizedPrompt: text("normalized_prompt").notNull(),
    intent: text(),
    journeyStage: text("journey_stage"),
    priorityScore: numeric("priority_score", { precision: 10, scale: 2 }),
    aiSearchVolume: integer("ai_search_volume"),
    location: text(),
    languageCode: text("language_code"),
    status: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "geo_prompts_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    queryClusterId: integer("query_cluster_id").notNull(),
    mappedPageId: integer("mapped_page_id"),
  },
  (table) => [
    index("idx_geo_prompts_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_prompts_cluster").using(
      "btree",
      table.queryClusterId.asc().nullsLast().op("int4_ops"),
    ),
    uniqueIndex("geo_prompts_cluster_prompt_unique").using(
      "btree",
      table.queryClusterId.asc().nullsLast().op("int4_ops"),
      table.normalizedPrompt.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "geo_prompts_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.queryClusterId],
      foreignColumns: [queryClusters.id],
      name: "geo_prompts_query_cluster_id_query_clusters_id_fk",
    }),
    foreignKey({
      columns: [table.mappedPageId],
      foreignColumns: [pages.id],
      name: "geo_prompts_mapped_page_id_pages_id_fk",
    }),
  ],
);

export const geoRuns = pgTable(
  "geo_runs",
  {
    provider: text().notNull(),
    endpoint: text().notNull(),
    platform: text().notNull(),
    searchScope: text("search_scope"),
    matchType: text("match_type"),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    requestPayloadJson: jsonb("request_payload_json"),
    responsePayloadJson: jsonb("response_payload_json"),
    costMetadataJson: jsonb("cost_metadata_json"),
    errorMessage: text("error_message"),
    status: text().notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "geo_runs_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    promptId: integer("prompt_id").notNull(),
  },
  (table) => [
    index("idx_geo_runs_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_runs_prompt").using("btree", table.promptId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_runs_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "geo_runs_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.promptId],
      foreignColumns: [geoPrompts.id],
      name: "geo_runs_prompt_id_geo_prompts_id_fk",
    }),
  ],
);

export const geoPromptResults = pgTable(
  "geo_prompt_results",
  {
    brandMentioned: boolean("brand_mentioned").default(false).notNull(),
    brandCited: boolean("brand_cited").default(false).notNull(),
    answerText: text("answer_text"),
    fanOutQueriesJson: jsonb("fan_out_queries_json"),
    searchResultsJson: jsonb("search_results_json"),
    monthlySearchesJson: jsonb("monthly_searches_json"),
    aiSummaryType: text("ai_summary_type"),
    capturedAt: timestamp("captured_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "geo_prompt_results_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    runId: integer("run_id").notNull(),
    siteId: integer("site_id").notNull(),
    promptId: integer("prompt_id").notNull(),
  },
  (table) => [
    index("idx_geo_prompt_results_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_prompt_results_prompt").using(
      "btree",
      table.promptId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_geo_prompt_results_captured_at").using(
      "btree",
      table.capturedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.runId],
      foreignColumns: [geoRuns.id],
      name: "geo_prompt_results_run_id_geo_runs_id_fk",
    }),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "geo_prompt_results_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.promptId],
      foreignColumns: [geoPrompts.id],
      name: "geo_prompt_results_prompt_id_geo_prompts_id_fk",
    }),
  ],
);

export const geoCitations = pgTable(
  "geo_citations",
  {
    domain: text().notNull(),
    url: text(),
    title: text(),
    citationType: text("citation_type").notNull(),
    isOwned: boolean("is_owned").default(false).notNull(),
    isCompetitor: boolean("is_competitor").default(false).notNull(),
    position: integer(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "geo_citations_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    resultId: integer("result_id").notNull(),
    siteId: integer("site_id").notNull(),
    siteCompetitorId: integer("site_competitor_id"),
  },
  (table) => [
    index("idx_geo_citations_result").using("btree", table.resultId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_citations_site").using("btree", table.siteId.asc().nullsLast().op("int4_ops")),
    index("idx_geo_citations_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.resultId],
      foreignColumns: [geoPromptResults.id],
      name: "geo_citations_result_id_geo_prompt_results_id_fk",
    }),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "geo_citations_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "geo_citations_site_competitor_id_site_competitors_id_fk",
    }),
  ],
);

export const geoRecommendations = pgTable(
  "geo_recommendations",
  {
    recommendationType: text("recommendation_type").notNull(),
    title: text().notNull(),
    rationale: text().notNull(),
    impactScore: numeric("impact_score", { precision: 5, scale: 2 }),
    effortScore: numeric("effort_score", { precision: 5, scale: 2 }),
    status: text().notNull(),
    ownerAgent: text("owner_agent"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "geo_recommendations_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    siteId: integer("site_id").notNull(),
    promptId: integer("prompt_id"),
    pageId: integer("page_id"),
    siteCompetitorId: integer("site_competitor_id"),
  },
  (table) => [
    index("idx_geo_recommendations_site").using(
      "btree",
      table.siteId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_geo_recommendations_status").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.siteId],
      foreignColumns: [sites.id],
      name: "geo_recommendations_site_id_sites_id_fk",
    }),
    foreignKey({
      columns: [table.promptId],
      foreignColumns: [geoPrompts.id],
      name: "geo_recommendations_prompt_id_geo_prompts_id_fk",
    }),
    foreignKey({
      columns: [table.pageId],
      foreignColumns: [pages.id],
      name: "geo_recommendations_page_id_pages_id_fk",
    }),
    foreignKey({
      columns: [table.siteCompetitorId],
      foreignColumns: [siteCompetitors.id],
      name: "geo_recommendations_site_competitor_id_site_competitors_id_fk",
    }),
  ],
);
