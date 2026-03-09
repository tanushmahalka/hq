# SEO Schema

Use one operational database with these SEO tables.

## 1) `sites`

One row per managed site.

```sql
sites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  business_type TEXT NOT NULL,           -- local | saas | ecommerce | publisher | other
  cms TEXT,                              -- wordpress | shopify | webflow | custom | etc
  default_locale TEXT,
  timezone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
```

## 2) `pages`

Canonical page inventory. This is the core SEO object.

```sql
pages (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  canonical_url TEXT,
  page_type TEXT NOT NULL,               -- homepage | service | category | product | article | local_landing | tool | other
  title_tag TEXT,
  meta_description TEXT,
  h1 TEXT,
  status_code INTEGER,
  indexability TEXT,                     -- indexable | noindex | blocked | duplicate | error
  canonical_target_url TEXT,
  last_crawled_at TIMESTAMP,
  last_published_at TIMESTAMP,
  is_money_page BOOLEAN NOT NULL DEFAULT false,
  is_authority_asset BOOLEAN NOT NULL DEFAULT false,
  content_status TEXT NOT NULL,          -- live | draft | archived | redirected | deleted
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(site_id, url)
)
```

## 3) `query_clusters`

Search demand grouped by intent/topic.

```sql
query_clusters (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  primary_intent TEXT NOT NULL,          -- transactional | commercial | informational | navigational | local
  funnel_stage TEXT,                     -- bofu | mofu | tofu
  priority_score NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
```

## 4) `queries`

Individual search queries inside a cluster.

```sql
queries (
  id UUID PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES query_clusters(id),
  query TEXT NOT NULL,
  locale TEXT,
  search_engine TEXT DEFAULT 'google',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(cluster_id, query)
)
```

## 5) `page_cluster_targets`

Maps pages to query clusters.

```sql
page_cluster_targets (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id),
  cluster_id UUID NOT NULL REFERENCES query_clusters(id),
  target_role TEXT NOT NULL,             -- primary | supporting | secondary
  confidence_score NUMERIC(5,2),
  created_at TIMESTAMP NOT NULL,
  UNIQUE(page_id, cluster_id)
)
```

## 6) `search_console_daily`

Daily page/query performance. Grain: one row per site/page/query/date/device/country.

```sql
search_console_daily (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  page_id UUID REFERENCES pages(id),
  query_id UUID REFERENCES queries(id),
  event_date DATE NOT NULL,
  device TEXT,                           -- desktop | mobile | tablet
  country_code TEXT,
  clicks INTEGER NOT NULL,
  impressions INTEGER NOT NULL,
  ctr NUMERIC(8,6) NOT NULL,
  avg_position NUMERIC(8,3),
  created_at TIMESTAMP NOT NULL,
  UNIQUE(site_id, page_id, query_id, event_date, device, country_code)
)
```

## 7) `analytics_daily`

Post-click business outcome data. Grain: one row per page/date/channel/device.

```sql
analytics_daily (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  page_id UUID REFERENCES pages(id),
  event_date DATE NOT NULL,
  channel TEXT NOT NULL,                 -- organic_search | referral | direct | etc
  device TEXT,
  sessions INTEGER NOT NULL,
  users INTEGER,
  engaged_sessions INTEGER,
  conversions INTEGER,
  revenue NUMERIC(14,2),
  avg_engagement_seconds NUMERIC(12,2),
  created_at TIMESTAMP NOT NULL,
  UNIQUE(site_id, page_id, event_date, channel, device)
)
```

## 8) `crawl_runs`

One row per crawl/import.

```sql
crawl_runs (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  source TEXT NOT NULL,                  -- screamer | custom_bot | gsc | manual
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  status TEXT NOT NULL,                  -- running | success | failed
  notes TEXT
)
```

## 9) `crawl_page_facts`

Technical SEO facts captured per crawl per page.

```sql
crawl_page_facts (
  id UUID PRIMARY KEY,
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id),
  page_id UUID REFERENCES pages(id),
  url TEXT NOT NULL,
  status_code INTEGER,
  content_type TEXT,
  robots_indexable BOOLEAN,
  robots_followable BOOLEAN,
  canonical_url TEXT,
  canonical_status TEXT,                 -- self | points_elsewhere | missing | conflicting
  hreflang_status TEXT,
  depth INTEGER,
  inlink_count INTEGER,
  outlink_count INTEGER,
  word_count INTEGER,
  has_schema BOOLEAN,
  schema_types TEXT[],                   -- postgres array
  mobile_parity_ok BOOLEAN,
  core_web_vitals_status TEXT,           -- good | needs_improvement | poor | unknown
  last_modified_header TIMESTAMP,
  created_at TIMESTAMP NOT NULL
)
```

## 10) `internal_links`

Needed for internal linking agent.

```sql
internal_links (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  source_page_id UUID NOT NULL REFERENCES pages(id),
  target_page_id UUID NOT NULL REFERENCES pages(id),
  anchor_text TEXT,
  link_location TEXT,                    -- body | nav | footer | sidebar | related_module
  is_nofollow BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL,
  UNIQUE(site_id, source_page_id, target_page_id, anchor_text, link_location)
)
```

## 11) `backlink_sources`

Referring domains / pages. Core off-page authority table.

```sql
backlink_sources (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  source_domain TEXT NOT NULL,
  source_url TEXT,
  target_page_id UUID REFERENCES pages(id),
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  rel_attr TEXT,                         -- follow | nofollow | sponsored | ugc | unknown
  link_type TEXT,                        -- editorial | directory | partner | press | forum | review | other
  relevance_score NUMERIC(5,2),
  authority_score NUMERIC(5,2),
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  status TEXT NOT NULL,                  -- active | lost | pending_verification
  UNIQUE(site_id, source_url, target_url, anchor_text)
)
```

## 12) `brand_mentions`

For unlinked mention reclamation and reputation tracking.

```sql
brand_mentions (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  source_domain TEXT NOT NULL,
  source_url TEXT NOT NULL,
  mention_text TEXT,
  mentioned_entity TEXT,                 -- brand | founder | product | report
  is_linked BOOLEAN NOT NULL,
  linked_target_url TEXT,
  sentiment TEXT,                        -- positive | neutral | negative | mixed
  discovered_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL,                  -- new | reviewed | outreach_queued | reclaimed | ignored
  UNIQUE(site_id, source_url, mentioned_entity)
)
```

## 13) `outreach_prospects`

The master prospect list for off-page work.

```sql
outreach_prospects (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  organization_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  domain TEXT,
  prospect_type TEXT NOT NULL,           -- journalist | blogger | partner | directory | association | customer | supplier | creator
  relationship_strength TEXT,            -- existing | warm | cold
  relevance_score NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
```

## 14) `outreach_campaigns`

Groups outreach by campaign/asset.

```sql
outreach_campaigns (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,           -- link_reclamation | digital_pr | partner_links | reviews | local_citations
  target_page_id UUID REFERENCES pages(id),
  target_asset_page_id UUID REFERENCES pages(id),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL,                  -- draft | active | paused | completed
  created_at TIMESTAMP NOT NULL
)
```

## 15) `outreach_actions`

Actual sends/follow-ups/results.

```sql
outreach_actions (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id),
  prospect_id UUID NOT NULL REFERENCES outreach_prospects(id),
  action_type TEXT NOT NULL,             -- pitch_sent | followup_sent | replied | won | lost | deferred
  action_date TIMESTAMP NOT NULL,
  outcome TEXT,                          -- positive | negative | no_response | link_added | mention_only
  linked_backlink_source_id UUID REFERENCES backlink_sources(id),
  notes TEXT
)
```

## 16) `reviews`

Necessary for local/service off-page SEO.

```sql
reviews (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  platform TEXT NOT NULL,                -- google_business_profile | trustpilot | g2 | yelp | etc
  external_review_id TEXT,
  reviewer_name TEXT,
  rating NUMERIC(3,1),
  review_text TEXT,
  review_date TIMESTAMP,
  sentiment TEXT,
  response_status TEXT NOT NULL,         -- pending | responded | ignored
  response_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(site_id, platform, external_review_id)
)
```

## 17) `business_profiles`

Only if local presence matters.

```sql
business_profiles (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  platform TEXT NOT NULL,                -- google_business_profile | bing_places | apple_business_connect
  profile_name TEXT,
  profile_url TEXT,
  category TEXT,
  address_line1 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country_code TEXT,
  phone TEXT,
  website_url TEXT,
  is_verified BOOLEAN,
  avg_rating NUMERIC(3,2),
  review_count INTEGER,
  last_synced_at TIMESTAMP,
  UNIQUE(site_id, platform, profile_url)
)
```

## 18) `assets`

Off-page-linkable assets and their performance.

```sql
assets (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  page_id UUID REFERENCES pages(id),
  asset_type TEXT NOT NULL,              -- study | calculator | template | case_study | glossary | tool | statistics_page
  title TEXT NOT NULL,
  launch_date DATE,
  refresh_date DATE,
  promotion_status TEXT NOT NULL,        -- draft | live | retired
  created_at TIMESTAMP NOT NULL
)
```

## Minimum necessary indexes

```sql
CREATE INDEX idx_pages_site_id ON pages(site_id);
CREATE INDEX idx_pages_canonical_url ON pages(canonical_url);

CREATE INDEX idx_scd_site_date ON search_console_daily(site_id, event_date);
CREATE INDEX idx_scd_page_date ON search_console_daily(page_id, event_date);
CREATE INDEX idx_scd_query_date ON search_console_daily(query_id, event_date);

CREATE INDEX idx_analytics_site_date ON analytics_daily(site_id, event_date);
CREATE INDEX idx_analytics_page_date ON analytics_daily(page_id, event_date);

CREATE INDEX idx_crawl_page_facts_url ON crawl_page_facts(url);
CREATE INDEX idx_internal_links_target ON internal_links(target_page_id);
CREATE INDEX idx_internal_links_source ON internal_links(source_page_id);

CREATE INDEX idx_backlink_sources_target_page ON backlink_sources(target_page_id);
CREATE INDEX idx_backlink_sources_source_domain ON backlink_sources(source_domain);
CREATE INDEX idx_brand_mentions_status ON brand_mentions(status);

CREATE INDEX idx_outreach_actions_campaign ON outreach_actions(campaign_id);
CREATE INDEX idx_reviews_platform_date ON reviews(platform, review_date);
```

## What not to add

Do **not** add separate tables for:

* keywords and rankings if you already have `queries` + `search_console_daily`
* raw email bodies
* every crawl HTML snapshot
* every CMS revision

Those are not necessary for the SEO operating core.
