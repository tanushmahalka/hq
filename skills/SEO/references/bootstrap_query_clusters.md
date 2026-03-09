# Bootstrap `query_clusters`

Use this playbook for bootstrap step 7.

## Goal

Create initial `query_clusters` only after the page inventory and Search Console baseline exist.

## Preconditions

Do not start until all of these are true:

- the `sites` row exists
- `pages` exists
- `search_console_daily` baseline data exists

## Required columns

Each cluster row must include:

- `site_id`
- `name`
- `primary_intent`
- `funnel_stage`
- `priority_score`
- `notes`

## Reasoning rules

- Group queries by shared intent and the page that should rank for them.
- Use `primary_intent` from `transactional | commercial | informational | navigational | local`.
- Use `funnel_stage` from `bofu | mofu | tofu`.
- Base `priority_score` on business value, impression volume, conversion value, ranking distance, and technical blockers.

## Agent steps

1. Review page inventory and Search Console baseline together.
2. Create topic-level clusters, not one cluster per query.
3. Name each cluster so the target topic is obvious.
4. Save the cluster rows into `query_clusters`.

## Stop condition

Stop and ask for help if:

- multiple pages appear equally suitable as the primary target
- the intent is mixed enough that the cluster boundary is unclear
- the business value of a topic is unknown
