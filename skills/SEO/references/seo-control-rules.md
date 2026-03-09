# SEO Control Rules

This file defines what SEO agents may do automatically, what requires human approval, what is never allowed, and how rollback and escalation work.

## 1. Allowed automatically

Agents may do these actions without human approval:

- read from the SEO operational database
- create and update `tasks`
- create and update `alerts`
- create and update `experiments`
- create and update non-destructive crawl records in `crawl_runs` and `crawl_page_facts`
- sync Search Console data into `search_console_daily`
- sync Analytics data into `analytics_daily`
- create and update `query_clusters`, `queries`, and `page_cluster_targets`
- create and update the canonical page inventory in `pages` when the action is additive or metadata-only
- generate content briefs
- generate title, meta description, H1, and internal link recommendations
- create internal link recommendations from `internal_links`
- create outreach prospect lists and campaign drafts
- sync backlink, mention, review, and profile data into their tables
- request approvals for risky actions

## 2. Requires human approval

Agents must create an `approvals` row and wait for approval before:

- publishing new pages
- materially rewriting live money pages
- changing redirects
- adding `noindex`
- changing `robots.txt`
- changing canonicals in a way that changes preferred URLs
- deleting or archiving pages
- making sitewide template changes
- sending outreach emails
- posting review responses
- editing external business profiles
- changing conversion definitions or attribution logic

## 3. Never allowed

Agents must never do these actions automatically or manually:

- promise rankings
- buy links
- create doorway pages
- mass-produce thin pages
- use `robots.txt` as a deindexing mechanism
- deploy schema that does not match visible content
- repeatedly request recrawls to force indexing
- misuse the Indexing API for unsupported page types
- overwrite large sections of the page inventory without a crawl-backed reason
- delete historical performance data from the operational tables
- modify production data outside the defined schema process

## 4. Rollback rules

Every risky SEO change must be reversible.

Minimum rollback requirements:

- record the related `task_id`
- record what changed
- record who approved it
- record when it changed
- record the previous value or previous state
- define the rollback owner

Rollback triggers:

- critical traffic drop alert
- indexing collapse
- widespread canonical drift
- unexpected deindexation
- conversion drop tied to the release
- severe template regression

Rollback expectation:

- revert the last risky change first
- verify impacted URLs with a fresh crawl
- re-check Search Console and Analytics baselines after rollback

## 5. Escalation rules

Escalate immediately when:

- an agent has low confidence on a page-cluster mapping
- a page may affect legal, medical, or financial claims
- multiple pages appear to cannibalize the same cluster
- a technical fix would affect many URLs
- the crawl and live page disagree on canonical/indexability in a high-impact area
- Search Console and Analytics show conflicting signals on a revenue page
- local profile data appears inconsistent across platforms
- outreach contains brand-sensitive messaging

Escalation path:

- create or update a `tasks` row with `status = blocked` or `awaiting_approval`
- create an `alerts` row if there is active risk
- attach the impacted `site`, `page`, `campaign`, or `profile` entity
- stop downstream automation until the owner resolves the blocker

## 6. Operating principle

Agents are allowed to automate analysis, syncing, classification, and recommendations.

Humans retain control over publication, deindexing, redirects, robots changes, outreach sends, business-profile edits, and any other action that is hard to reverse or brand-sensitive.
