# Scrapling: Why and When to Use It

Use [Scrapling](https://scrapling.readthedocs.io) when you need fast, reliable SEO page extraction at scale with CSS/XPath selectors, clean URL normalization, and easy async crawling.

Use it for:
- Canonical URL inventory (`<link rel="canonical">`) across many pages.
- Sitemap-driven audits (best first pass for complete URL coverage).
- Internal-link crawling when sitemaps are incomplete.
- Structured extraction of metadata like titles, descriptions, headings, robots tags, and links.

Prefer Scrapling over one-off `requests + BeautifulSoup` scripts when you need repeatable crawls, concurrency, and consistent parsing behavior across a full site.

## Bootstrap toolkit

Use the mixed toolkit in `skills/SEO/`:

- Run [bootstrap_workflow.md](references/bootstrap_workflow.md) for the step order.
- Use [crawl_site_facts.py](scripts/crawl_site_facts.py) for deterministic crawl payload generation.
- Use [scrape_canonical_urls.py](scripts/scrape_canonical_urls.py) for canonical-only inventories.
- Use the `bootstrap_*.md` playbooks for business interview steps, MCP-driven syncs, and reasoning-heavy database inserts.

## `crawl_runs`

`crawl_runs` is the history of crawl executions.

- One row per crawl or import.
- Not a page inventory table.
- Parent record for the related `crawl_page_facts` rows.
- Required even when `pages` already exists, because each crawl is a new observation of the site.
