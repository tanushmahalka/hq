# Bootstrap `crawl_runs` and `crawl_page_facts`

Use this with [crawl_site_facts.py](../scripts/crawl_site_facts.py).

## Goal

Create one historical crawl record and save the related per-URL technical facts.

## What `crawl_runs` is

`crawl_runs` logs a crawl execution.

- One row per crawl or import.
- Not a page table.
- Parent record for many `crawl_page_facts` rows.

## Save order

1. Save the `crawl_runs` row first.
2. Save the `pages` rows if they are new or need metadata refresh.
3. Save the `crawl_page_facts` rows with the new `crawl_run_id`.

## Required `crawl_runs` columns

- `id`
- `site_id`
- `source`
- `started_at`
- `finished_at`
- `status`
- `notes`

## Required `crawl_page_facts` columns

- `crawl_run_id`
- `page_id`
- `url`
- `status_code`
- `content_type`
- `robots_indexable`
- `robots_followable`
- `canonical_url`
- `canonical_status`
- `hreflang_status`
- `depth`
- `inlink_count`
- `outlink_count`
- `word_count`
- `has_schema`
- `schema_types`
- `mobile_parity_ok`
- `core_web_vitals_status`
- `last_modified_header`

## Stop condition

Stop and ask for help if:

- the crawl payload cannot be mapped to an existing site
- page IDs cannot be resolved
- the crawl appears incomplete for a high-impact section of the site
