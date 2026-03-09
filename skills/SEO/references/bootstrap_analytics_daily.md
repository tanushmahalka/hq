# Bootstrap `analytics_daily`

Use this playbook for bootstrap step 6.

## Goal

Use the Analytics MCP server to establish the post-click baseline and save normalized rows into `analytics_daily`.

## Preconditions

Do not start until all of these are true:

- the `sites` row exists
- the canonical `pages` inventory exists
- Analytics MCP access is working

## Required grain

Save one row per:

- `page`
- `date`
- `channel`
- `device`

## Required columns

Each saved row must include:

- `site_id`
- `page_id`
- `event_date`
- `channel`
- `device`
- `sessions`
- `users`
- `engaged_sessions`
- `conversions`
- `revenue`
- `avg_engagement_seconds`

## Agent steps

1. Pull the Analytics baseline through MCP.
2. Normalize landing-page URLs before matching.
3. Match each URL to `pages.url`.
4. Save the normalized rows into `analytics_daily`.

## Resolution rules

- `page_id` must resolve from the canonical `pages` inventory.
- `channel` should be stored in schema-compatible form such as `organic_search | referral | direct`.
- If Analytics reports a page that is not yet in `pages`, stop and rerun the crawl or ask for a decision.

## Stop condition

Stop and ask for help if:

- Analytics MCP is unavailable
- the page URLs do not map to `pages`
- the conversion or revenue definitions are ambiguous
