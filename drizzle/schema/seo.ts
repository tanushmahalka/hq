import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    businessType: text("business_type").notNull(),
    cms: text("cms"),
    defaultLocale: text("default_locale"),
    timezone: text("timezone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("sites_domain_unique").on(table.domain)],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    pageType: text("page_type").notNull(),
    titleTag: text("title_tag"),
    metaDescription: text("meta_description"),
    h1: text("h1"),
    statusCode: integer("status_code"),
    indexability: text("indexability"),
    canonicalTargetUrl: text("canonical_target_url"),
    lastCrawledAt: timestamp("last_crawled_at", { mode: "date" }),
    lastPublishedAt: timestamp("last_published_at", { mode: "date" }),
    isMoneyPage: boolean("is_money_page").notNull().default(false),
    isAuthorityAsset: boolean("is_authority_asset").notNull().default(false),
    contentStatus: text("content_status").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("pages_site_url_unique").on(table.siteId, table.url),
    index("idx_pages_site_id").on(table.siteId),
    index("idx_pages_canonical_url").on(table.canonicalUrl),
  ],
);

export const queryClusters = pgTable("query_clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  name: text("name").notNull(),
  primaryIntent: text("primary_intent").notNull(),
  funnelStage: text("funnel_stage"),
  priorityScore: numeric("priority_score", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const queries = pgTable(
  "queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => queryClusters.id),
    query: text("query").notNull(),
    locale: text("locale"),
    searchEngine: text("search_engine").default("google"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("queries_cluster_query_unique").on(table.clusterId, table.query)],
);

export const pageClusterTargets = pgTable(
  "page_cluster_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => queryClusters.id),
    targetRole: text("target_role").notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("page_cluster_target_unique").on(table.pageId, table.clusterId)],
);

export const searchConsoleDaily = pgTable(
  "search_console_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    pageId: uuid("page_id").references(() => pages.id),
    queryId: uuid("query_id").references(() => queries.id),
    eventDate: date("event_date").notNull(),
    device: text("device"),
    countryCode: text("country_code"),
    clicks: integer("clicks").notNull(),
    impressions: integer("impressions").notNull(),
    ctr: numeric("ctr", { precision: 8, scale: 6 }).notNull(),
    avgPosition: numeric("avg_position", { precision: 8, scale: 3 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("scd_grain_unique").on(
      table.siteId,
      table.pageId,
      table.queryId,
      table.eventDate,
      table.device,
      table.countryCode,
    ),
    index("idx_scd_site_date").on(table.siteId, table.eventDate),
    index("idx_scd_page_date").on(table.pageId, table.eventDate),
    index("idx_scd_query_date").on(table.queryId, table.eventDate),
  ],
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    pageId: uuid("page_id").references(() => pages.id),
    eventDate: date("event_date").notNull(),
    channel: text("channel").notNull(),
    device: text("device"),
    sessions: integer("sessions").notNull(),
    users: integer("users"),
    engagedSessions: integer("engaged_sessions"),
    conversions: integer("conversions"),
    revenue: numeric("revenue", { precision: 14, scale: 2 }),
    avgEngagementSeconds: numeric("avg_engagement_seconds", {
      precision: 12,
      scale: 2,
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("analytics_daily_grain_unique").on(
      table.siteId,
      table.pageId,
      table.eventDate,
      table.channel,
      table.device,
    ),
    index("idx_analytics_site_date").on(table.siteId, table.eventDate),
    index("idx_analytics_page_date").on(table.pageId, table.eventDate),
  ],
);

export const crawlRuns = pgTable("crawl_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
  status: text("status").notNull(),
  notes: text("notes"),
});

export const crawlPageFacts = pgTable(
  "crawl_page_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlRunId: uuid("crawl_run_id")
      .notNull()
      .references(() => crawlRuns.id),
    pageId: uuid("page_id").references(() => pages.id),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    contentType: text("content_type"),
    robotsIndexable: boolean("robots_indexable"),
    robotsFollowable: boolean("robots_followable"),
    canonicalUrl: text("canonical_url"),
    canonicalStatus: text("canonical_status"),
    hreflangStatus: text("hreflang_status"),
    depth: integer("depth"),
    inlinkCount: integer("inlink_count"),
    outlinkCount: integer("outlink_count"),
    wordCount: integer("word_count"),
    hasSchema: boolean("has_schema"),
    schemaTypes: text("schema_types").array(),
    mobileParityOk: boolean("mobile_parity_ok"),
    coreWebVitalsStatus: text("core_web_vitals_status"),
    lastModifiedHeader: timestamp("last_modified_header", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("idx_crawl_page_facts_url").on(table.url)],
);

export const internalLinks = pgTable(
  "internal_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    sourcePageId: uuid("source_page_id")
      .notNull()
      .references(() => pages.id),
    targetPageId: uuid("target_page_id")
      .notNull()
      .references(() => pages.id),
    anchorText: text("anchor_text"),
    linkLocation: text("link_location"),
    isNofollow: boolean("is_nofollow").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("internal_links_unique").on(
      table.siteId,
      table.sourcePageId,
      table.targetPageId,
      table.anchorText,
      table.linkLocation,
    ),
    index("idx_internal_links_target").on(table.targetPageId),
    index("idx_internal_links_source").on(table.sourcePageId),
  ],
);

export const backlinkSources = pgTable(
  "backlink_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url"),
    targetPageId: uuid("target_page_id").references(() => pages.id),
    targetUrl: text("target_url").notNull(),
    anchorText: text("anchor_text"),
    relAttr: text("rel_attr"),
    linkType: text("link_type"),
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    authorityScore: numeric("authority_score", { precision: 5, scale: 2 }),
    firstSeenAt: timestamp("first_seen_at", { mode: "date" }),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("backlink_sources_unique").on(
      table.siteId,
      table.sourceUrl,
      table.targetUrl,
      table.anchorText,
    ),
    index("idx_backlink_sources_target_page").on(table.targetPageId),
    index("idx_backlink_sources_source_domain").on(table.sourceDomain),
  ],
);

export const brandMentions = pgTable(
  "brand_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    sourceDomain: text("source_domain").notNull(),
    sourceUrl: text("source_url").notNull(),
    mentionText: text("mention_text"),
    mentionedEntity: text("mentioned_entity"),
    isLinked: boolean("is_linked").notNull(),
    linkedTargetUrl: text("linked_target_url"),
    sentiment: text("sentiment"),
    discoveredAt: timestamp("discovered_at", { mode: "date" }).notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("brand_mentions_unique").on(table.siteId, table.sourceUrl, table.mentionedEntity),
    index("idx_brand_mentions_status").on(table.status),
  ],
);

export const outreachProspects = pgTable("outreach_prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  organizationName: text("organization_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  domain: text("domain"),
  prospectType: text("prospect_type").notNull(),
  relationshipStrength: text("relationship_strength"),
  relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  name: text("name").notNull(),
  campaignType: text("campaign_type").notNull(),
  targetPageId: uuid("target_page_id").references(() => pages.id),
  targetAssetPageId: uuid("target_asset_page_id").references(() => pages.id),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const outreachActions = pgTable(
  "outreach_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => outreachProspects.id),
    actionType: text("action_type").notNull(),
    actionDate: timestamp("action_date", { mode: "date" }).notNull(),
    outcome: text("outcome"),
    linkedBacklinkSourceId: uuid("linked_backlink_source_id").references(() => backlinkSources.id),
    notes: text("notes"),
  },
  (table) => [index("idx_outreach_actions_campaign").on(table.campaignId)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    platform: text("platform").notNull(),
    externalReviewId: text("external_review_id"),
    reviewerName: text("reviewer_name"),
    rating: numeric("rating", { precision: 3, scale: 1 }),
    reviewText: text("review_text"),
    reviewDate: timestamp("review_date", { mode: "date" }),
    sentiment: text("sentiment"),
    responseStatus: text("response_status").notNull(),
    responseDate: timestamp("response_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("reviews_site_platform_external_unique").on(
      table.siteId,
      table.platform,
      table.externalReviewId,
    ),
    index("idx_reviews_platform_date").on(table.platform, table.reviewDate),
  ],
);

export const businessProfiles = pgTable(
  "business_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    platform: text("platform").notNull(),
    profileName: text("profile_name"),
    profileUrl: text("profile_url"),
    category: text("category"),
    addressLine1: text("address_line1"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    countryCode: text("country_code"),
    phone: text("phone"),
    websiteUrl: text("website_url"),
    isVerified: boolean("is_verified"),
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
  },
  (table) => [uniqueIndex("business_profiles_site_platform_url_unique").on(table.siteId, table.platform, table.profileUrl)],
);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  pageId: uuid("page_id").references(() => pages.id),
  assetType: text("asset_type").notNull(),
  title: text("title").notNull(),
  launchDate: date("launch_date"),
  refreshDate: date("refresh_date"),
  promotionStatus: text("promotion_status").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});
