# Bootstrap `page_cluster_targets`

Use this playbook for bootstrap step 9.

## Goal

Map pages to query clusters with a target role and confidence score.

## Preconditions

Do not start until all of these are true:

- `pages` exists
- `query_clusters` exists
- `queries` exists

## Required columns

Each mapping row must include:

- `page_id`
- `cluster_id`
- `target_role`
- `confidence_score`

## Mapping rules

- choose one primary page per main cluster whenever possible
- use supporting pages for subtopics, comparisons, FAQs, and long-tail variants
- use secondary only when a page can rank but should not be the main target
- `target_role` must be one of `primary | supporting | secondary`

## Confidence guidance

- use high confidence when intent, page type, and existing ranking signals align
- lower confidence when two pages overlap or the page is only a partial fit

## Agent steps

1. Review the page inventory, query clusters, and Search Console evidence together.
2. Pick the best primary page for each cluster.
3. Add supporting or secondary mappings only when they are justified.
4. Save the rows into `page_cluster_targets`.

## Stop condition

Stop and ask for help if:

- more than one page looks like the primary target
- the page is clearly ranking but should not be the target
- the mapping confidence is low for a revenue-driving cluster
