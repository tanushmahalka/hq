# Bootstrap `queries`

Use this playbook for bootstrap step 8.

## Goal

Insert normalized query rows into `queries` after `query_clusters` exist.

## Preconditions

Do not start until all of these are true:

- `query_clusters` exists
- Search Console baseline data exists

## Required columns

Each query row must include:

- `cluster_id`
- `query`
- `locale`
- `search_engine`
- `is_primary`

## Normalization rules

- trim whitespace
- normalize case consistently
- avoid duplicate query rows inside the same cluster
- preserve locale where it matters
- keep one primary query per cluster when possible

## Agent steps

1. Assign each query to exactly one cluster.
2. Normalize the query string before save.
3. Mark `is_primary = true` only for the main representative query in the cluster.
4. Save the rows into `queries`.

## Stop condition

Stop and ask for help if:

- a query could belong to multiple clusters
- locale cannot be inferred
- there is no confident primary query for the cluster
