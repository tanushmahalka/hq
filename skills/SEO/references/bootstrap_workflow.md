# SEO Bootstrap Workflow

Use this workflow to bootstrap a site into the SEO operational schema.

## Principle

- Use scripts for deterministic crawl and extraction work.
- Use Markdown playbooks for interview steps, MCP-driven syncs, and reasoning-heavy mapping work.
- Do not write to the database until the required inputs for the current step exist.

## Execution order

1. Follow [bootstrap_site_profile.md](bootstrap_site_profile.md).
2. Save one `sites` row once the business interview is complete.
3. Review [bootstrap_crawl_run.md](bootstrap_crawl_run.md).
4. Run [crawl_site_facts.py](../scripts/crawl_site_facts.py) to generate payloads for:
   - `pages`
   - `crawl_runs`
   - `crawl_page_facts`
5. Save the `crawl_runs` payload first.
6. Save the `pages` payload next.
7. Save the `crawl_page_facts` payload after `pages` so `page_id` resolution is possible.
8. Follow [bootstrap_search_console_daily.md](bootstrap_search_console_daily.md).
9. Follow [bootstrap_analytics_daily.md](bootstrap_analytics_daily.md).
10. Follow [bootstrap_query_clusters.md](bootstrap_query_clusters.md).
11. Follow [bootstrap_queries.md](bootstrap_queries.md).
12. Follow [bootstrap_page_cluster_targets.md](bootstrap_page_cluster_targets.md).

## What `crawl_runs` means

`crawl_runs` is the historical log of crawl executions.

- One row per crawl or import execution.
- Not a page inventory table.
- The parent record for many `crawl_page_facts` rows.
- Required even when the `pages` table already exists, because each crawl captures a new observation of the site.

Minimum `crawl_runs` fields:

- `id`
- `site_id`
- `source`
- `started_at`
- `finished_at`
- `status`
- `notes`

## Stop conditions

Stop and ask the user before continuing if:

- the business interview is incomplete
- the site row does not exist
- the crawl payload cannot be tied back to a site
- Search Console MCP access is unavailable
- Analytics MCP access is unavailable
- query clustering would require choosing between multiple plausible primary pages with low confidence
