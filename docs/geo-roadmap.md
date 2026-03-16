# GEO Roadmap For HQ

## Goal

Extend HQ's existing SEO workspace into a GEO layer that helps businesses:

- measure whether they appear in LLM answers and AI search experiences;
- understand which competitor domains and pages are being cited instead;
- prioritize which prompts, pages, and entities matter most;
- turn GEO gaps into concrete content, brand, PR, and local SEO actions;
- re-measure impact after changes.

This should live inside the current SEO product instead of becoming a separate tool.

## What Already Exists In HQ

The current SEO system already gives us most of the primitives we need:

- sites, pages, query clusters, and page-to-cluster mapping;
- competitor tracking and historical domain footprint snapshots;
- backlinks, brand mentions, analytics, and opportunity workflows;
- an existing SEO page with overview, competitors, backlinks, and analytics tabs.

That means GEO can be built as a new AI/GEO section under SEO rather than as a parallel product.

## DataForSEO AI Surface Area To Use

### 1. AI Optimization Overview

DataForSEO's AI Optimization stack is the core foundation. It currently includes:

- `LLM Mentions`
- `AI Keyword Data`
- `LLM Responses`
- `LLM Scraper`

It also documents an AI-optimized response format using the `.ai` suffix, which is worth using in agent-facing worker jobs because it reduces normalization effort.

### 2. LLM Mentions

This is the most important GEO data source for HQ.

Key capabilities:

- `Search Live`: check whether a target brand, domain, entity, or keyword is mentioned for a prompt on a given AI platform.
- `Top Domains Live`: find the domains most often cited across a prompt set.
- `Top Pages Live`: find the pages most often cited across a prompt set.
- `Aggregated Metrics Live`: roll up results by dimensions such as platform, domain, page, and brand entity fields.
- `Cross Aggregated Metrics Live`: compare multiple target sets in one request for richer benchmarking.
- free helper endpoints for filters, locations, and languages.

Important implementation note:

- LLM Mentions is live-first, so HQ should snapshot and cache its own history instead of expecting DataForSEO to retain trend data for us.

Useful response elements from `Search Live` include:

- answer text;
- quoted links / cited sources;
- search results used by the model;
- fan-out queries;
- detected brand entities;
- monthly search volume style demand fields.

Important limitation to design around:

- the docs note that `chat_gpt` coverage is currently limited to United States and English.

### 3. AI Keyword Data

This should power prompt discovery and prioritization.

Useful capabilities:

- AI search volume estimation;
- keyword expansion and related prompts;
- prompt demand modeling based on DataForSEO's PAA-derived dataset.

This is what turns GEO from "track a few prompts manually" into "systematically discover where the brand should exist in AI answers."

### 4. LLM Responses

This is ideal for benchmarking how the brand is presented across models.

Useful product uses:

- run the same business-critical prompt across ChatGPT, Claude, Gemini, and Perplexity support where available;
- compare answer framing, recommended brands, citations, and narrative gaps;
- store benchmark runs for before/after comparisons following content or brand changes.

This is not the main visibility dataset, but it is a strong QA and strategy layer.

### 5. LLM Scraper

This is useful for deeper inspection and debugging.

Useful product uses:

- scrape Search mode style responses from supported LLM platforms;
- keep richer response objects and raw HTML when we need full-fidelity evidence;
- support agent workflows that need to inspect answer structure, not just normalized metrics.

### 6. Google AI Mode SERP

This should be treated as an adjacent GEO signal rather than ignored.

Useful product uses:

- monitor AI Mode visibility separately from classic organic search;
- compare classic SEO performance against AI-native search presence;
- identify prompts where the brand ranks organically but still loses in AI answers.

## HQ Product Direction

The product loop should be:

1. discover important AI prompts;
2. measure brand, domain, page, and entity visibility;
3. inspect citations and answer composition;
4. compare against competitors;
5. generate actions for content, entity cleanup, PR, local SEO, and assets;
6. rerun the same prompts to confirm lift.

That is the main thing HQ can do for businesses: turn GEO from scattered research into an operating system.

## Proposed UX Inside SEO

Add a top-level `GEO` tab inside the existing SEO page.

Recommended sections inside that tab:

### 1. GEO Overview

Primary cards:

- brand mention rate;
- cited domain share;
- cited page share;
- unique cited pages;
- competitor citation gap;
- tracked AI prompt coverage;
- AI search demand covered by mapped pages;
- entity accuracy / consistency score.

Charts:

- visibility trend by platform;
- citation share trend vs competitors;
- AI demand by cluster;
- page-level citation winners and losers.

### 2. Mentions Explorer

This is the core operator workflow.

Filters:

- site;
- platform;
- search scope;
- date range;
- intent / cluster;
- brand vs competitor;
- prompt status;
- mention type.

Per-prompt detail:

- prompt text;
- model/platform;
- answer text;
- whether the brand was mentioned;
- whether a brand page was cited;
- quoted links;
- competitor domains/pages cited;
- brand entities detected;
- source SERP references;
- fan-out queries;
- action suggestions.

### 3. Citation Gap

Show:

- top cited competitor domains;
- top cited competitor pages;
- prompts where competitors are cited but the brand is absent;
- prompts where the brand is mentioned but not cited;
- prompts where the wrong page is cited;
- prompts with no owned page mapped at all.

This should feel like the GEO version of link-gap analysis.

### 4. AI Query Intelligence

Use AI Keyword Data to create:

- prompt clusters;
- AI demand scores;
- related prompt expansions;
- page-to-prompt coverage maps;
- prompt opportunity backlog.

This should connect directly to the existing `queryClusters` and `pageClusterTargets` model instead of inventing a second planning system.

### 5. LLM Benchmarks

Use LLM Responses and optional scraper runs to show:

- answer comparisons across models;
- recommended brand lists;
- citation differences;
- narrative differences;
- factual accuracy issues;
- brand positioning drift.

This is where operators can see how the business is described, not just whether it is present.

### 6. Recommendations / Actions

Every GEO issue should roll into an action queue.

Examples:

- create a new page for an uncovered prompt cluster;
- improve a page so it becomes the most citeable source;
- add FAQ / definition / comparison blocks for answer extraction;
- tighten entity consistency across business profiles and pages;
- publish quote-worthy data points or stats assets;
- pursue unlinked mentions or third-party citations;
- refresh stale pages that competitors are outranking in AI citations.

## Recommended Data Model

Do not overload the current `brand_mentions` table. GEO mentions are a different object from web mentions and backlinks.

Recommended new tables:

### `geo_prompt_sets`

Purpose:

- reusable prompt groups by site, journey, market, or campaign.

Core fields:

- `site_id`
- `name`
- `source`
- `status`
- `notes`
- `created_at`
- `updated_at`

### `geo_prompts`

Purpose:

- canonical prompt inventory.

Core fields:

- `prompt_set_id`
- `query_cluster_id` nullable
- `prompt`
- `normalized_prompt`
- `intent`
- `journey_stage`
- `priority_score`
- `ai_search_volume`
- `location`
- `language_code`
- `status`

### `geo_runs`

Purpose:

- each live pull from DataForSEO.

Core fields:

- `site_id`
- `prompt_id`
- `provider` (`dataforseo`)
- `endpoint` (`llm_mentions_search`, `top_domains`, `top_pages`, `aggregated_metrics`, `llm_responses`, `ai_mode`, etc.)
- `platform`
- `search_scope`
- `match_type`
- `captured_at`
- `request_payload_json`
- `response_payload_json`
- `cost_metadata_json`
- `status`

### `geo_prompt_results`

Purpose:

- normalized result row for one prompt on one platform at one moment.

Core fields:

- `run_id`
- `site_id`
- `prompt_id`
- `platform`
- `brand_mentioned`
- `brand_cited`
- `answer_text`
- `fan_out_queries_json`
- `search_results_json`
- `monthly_searches_json`
- `ai_summary_type`
- `captured_at`

### `geo_citations`

Purpose:

- normalized citation rows for domains/pages inside prompt results.

Core fields:

- `result_id`
- `site_id`
- `site_competitor_id` nullable
- `domain`
- `url`
- `title`
- `citation_type`
- `is_owned`
- `is_competitor`
- `position`

### `geo_entities`

Purpose:

- extracted entities referenced in AI answers.

Core fields:

- `result_id`
- `entity_name`
- `entity_category`
- `sentiment` nullable
- `is_brand_entity`
- `is_competitor_entity`

### `geo_daily_rollups`

Purpose:

- fast dashboards and trend charts.

Core fields:

- `site_id`
- `date`
- `platform`
- `dimension_type`
- `dimension_value`
- `prompts_tracked`
- `brand_mentions`
- `brand_citations`
- `competitor_citations`
- `owned_pages_cited`
- `avg_priority_score`

### `geo_recommendations`

Purpose:

- durable action layer tied to operators and agents.

Core fields:

- `site_id`
- `prompt_id` nullable
- `page_id` nullable
- `site_competitor_id` nullable
- `recommendation_type`
- `title`
- `rationale`
- `impact_score`
- `effort_score`
- `status`
- `owner_agent`
- `created_at`
- `updated_at`

## How GEO Should Connect To Existing SEO Objects

- connect `geo_prompts` to `query_clusters`;
- connect recommendations to `pages`;
- resolve competitor citations through `site_competitors`;
- keep historical rollups similar in spirit to `site_domain_footprints` and `competitor_domain_footprints`;
- allow GEO actions to create downstream tasks, missions, or content briefs.

This keeps GEO embedded in the current SEO mental model instead of fragmenting the product.

## Backend Plan

### 1. DataForSEO Client Layer

Add a dedicated worker client, for example:

- `worker/lib/dataforseo.ts`

Responsibilities:

- auth handling;
- retries and backoff;
- rate-limit awareness;
- consistent request builders;
- `.ai` response support where useful;
- raw payload logging.

### 2. GEO Service Layer

Add a domain service, for example:

- `worker/lib/geo.ts`

Responsibilities:

- prompt expansion from clusters/pages/business context;
- LLM Mentions normalization;
- citation and entity extraction;
- competitor resolution;
- scoring and recommendation generation;
- rollup materialization.

### 3. API Layer

Extend the SEO router or add a dedicated GEO router with queries like:

- `geo.overview`
- `geo.prompts`
- `geo.promptDetail`
- `geo.citationGap`
- `geo.benchmarks`
- `geo.recommendations`
- `geo.runNow`

### 4. Scheduling

Recommended jobs:

- nightly core prompt snapshot per site;
- weekly broader prompt expansion and top domains/pages refresh;
- on-demand benchmark run from the UI;
- post-publish rerun for changed pages;
- post-entity-update rerun for local/brand profile changes.

## Agent Workflows GEO Unlocks

### GEO Analyst Agent

Finds:

- mention gaps;
- citation gaps;
- competitor gains;
- prompt clusters with demand but no owned page;
- entity inconsistencies.

### Content Strategy Agent

Creates:

- GEO briefs;
- FAQ expansions;
- comparison pages;
- definition pages;
- stats-led assets;
- page refresh tasks tied to target prompts.

### Brand / PR Agent

Uses citation gap data to:

- identify third-party sources LLMs rely on;
- pursue expert mentions, stats placements, list inclusions, and profile improvements;
- follow up on unlinked mentions.

### Local / Entity Agent

Focuses on:

- business profile consistency;
- NAP and structured data alignment;
- category consistency;
- review and entity completeness.

## Recommended GEO Scoring

Use a small number of business-readable metrics.

### Mention Rate

`prompts where the brand is mentioned / total tracked prompts`

### Citation Rate

`prompts where an owned URL is cited / total tracked prompts`

### Citation Share

`owned citations / all citations across tracked prompts`

### Competitor Gap

`competitor citation share - owned citation share`

### AI Opportunity Score

A weighted score using:

- AI search volume;
- business priority;
- competitor citation strength;
- page coverage gap;
- existing authority / page fit.

### Entity Integrity Score

How often the business is named, categorized, and described correctly across answers.

## Recommended MVP

Build the first slice around LLM Mentions plus AI Keyword Data.

### MVP scope

- new `GEO` tab in SEO;
- prompt inventory per site;
- nightly snapshots for a curated prompt set;
- mention/citation tracking for owned brand + tracked competitors;
- top cited domains and pages;
- per-prompt detail view with answer text and citations;
- recommendation queue with simple statuses;
- trend charts for mention and citation share.

### What to defer

- full benchmark lab across every model;
- heavy scraper usage for every prompt;
- fully autonomous content generation;
- advanced cross-market orchestration until US/English coverage is solid.

## Implementation Order

### Phase 1. Foundation

- add DataForSEO client;
- add GEO schema and migrations;
- store prompt inventory and raw run payloads;
- build initial snapshot jobs.

### Phase 2. Dashboard MVP

- add `GEO` tab to the SEO page;
- ship overview metrics and mentions explorer;
- ship citation gap views using top domains and top pages;
- connect competitors and clusters.

### Phase 3. Prioritization

- integrate AI Keyword Data;
- compute AI opportunity scores;
- map prompt clusters to pages and page gaps.

### Phase 4. Actions

- create recommendation engine;
- let operators convert recommendations into tasks and missions;
- support rerun-after-change loops.

### Phase 5. Benchmarking

- add LLM Responses and Google AI Mode tracking;
- compare answer quality and narrative positioning across models.

## Repo Touchpoints To Extend

The existing code already gives us a clean set of extension points:

- `/Users/tanushmahalka/Desktop/Programs/psx/hq/drizzle/schema/seo.ts`
- `/Users/tanushmahalka/Desktop/Programs/psx/hq/worker/lib/seo.ts`
- `/Users/tanushmahalka/Desktop/Programs/psx/hq/worker/trpc/procedures/seo.ts`
- `/Users/tanushmahalka/Desktop/Programs/psx/hq/src/pages/seo.tsx`
- `/Users/tanushmahalka/Desktop/Programs/psx/hq/src/features/seo/types.ts`

I would keep GEO under the existing SEO namespace unless we discover a strong reason to split it.

## Product Principles

- GEO should stay tied to pages, clusters, competitors, and business outcomes.
- Every metric should map to a possible action.
- Raw AI responses should always be inspectable for trust and debugging.
- Trends must be persisted in HQ because DataForSEO's live endpoints are not our long-term history layer.
- We should optimize first for actionable US/English coverage, then expand.

## Recommended First Build For This Project

If we want the fastest path to value, the first real build should be:

1. add a `GEO` tab under SEO;
2. ingest 50 to 100 curated prompts per site;
3. run `LLM Mentions Search Live` nightly for owned brand + competitor domains;
4. run `Top Domains Live` and `Top Pages Live` weekly for the same prompt set;
5. show mention rate, citation rate, competitor gap, and prompt-level evidence;
6. create simple recommendations tied to pages and clusters.

That would already let HQ say:

- where the business is missing from AI answers;
- which competitor sources are winning;
- which pages need to be created or improved;
- whether changes lead to better LLM visibility.

## Sources

- [DataForSEO AI Optimization Overview](https://docs.dataforseo.com/v3/ai_optimization/overview/)
- [DataForSEO LLM Mentions Overview](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/overview/)
- [DataForSEO LLM Mentions Search Live](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search/live/)
- [DataForSEO LLM Mentions Top Domains Live](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_domains/live/)
- [DataForSEO LLM Mentions Top Pages Live](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/top_pages/live/)
- [DataForSEO LLM Mentions Aggregated Metrics Live](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/aggregated_metrics/live/)
- [DataForSEO LLM Mentions Cross Aggregated Metrics Live](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live/)
- [DataForSEO AI Keyword Data Overview](https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/overview/)
- [DataForSEO LLM Responses Overview](https://docs.dataforseo.com/v3/ai_optimization/llm_responses/overview/)
- [DataForSEO ChatGPT LLM Scraper Overview](https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/overview/)
- [DataForSEO Gemini LLM Scraper Overview](https://docs.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/overview/)
- [DataForSEO Google AI Mode Overview](https://docs.dataforseo.com/v3/serp/google/ai_mode/overview/)
- [DataForSEO AI-Optimized Response](https://docs.dataforseo.com/v3/appendix-ai_optimized_response/)
