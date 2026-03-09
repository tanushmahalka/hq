# Bootstrap `search_console_daily`

Use this playbook for bootstrap step 5.

## Goal

Use the Search Console MCP server to pull baseline page-query performance and save normalized rows into `search_console_daily`.

## Preconditions

Do not start until all of these are true:

- the `sites` row exists
- the canonical `pages` inventory exists
- Search Console MCP access is working

## Required grain

Save one row per:

- `site`
- `page`
- `query`
- `date`
- `device`
- `country`

## Required columns

Each saved row must include:

- `site_id`
- `page_id`
- `query_id`
- `event_date`
- `device`
- `country_code`
- `clicks`
- `impressions`
- `ctr`
- `avg_position`

## Agent steps

1. Pull Search Console data through MCP for the bootstrap baseline window.
2. Normalize URLs before page matching.
3. Match each page URL to an existing `pages.url`.
4. If a query does not exist in `queries`, stop and complete the clustering + query bootstrap first, then resume this step.
5. Save the normalized rows into `search_console_daily`.

## Resolution rules

- `page_id` must resolve from the canonical `pages` inventory.
- `query_id` must resolve from the normalized `queries` table.
- `country_code` should use the Search Console country code as returned.
- `device` should use schema-compatible values such as `desktop | mobile | tablet`.

## Stop condition

Stop and ask for help if:

- Search Console MCP is unavailable
- the returned page URLs do not map to `pages`
- query rows do not exist yet
- the requested date range is unclear
