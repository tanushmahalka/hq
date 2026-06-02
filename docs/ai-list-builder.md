# AI List Builder (Parallel FindAll)

The List Builder is a 1:1 wrapper around [Parallel.ai's FindAll API](https://docs.parallel.ai/findall-api/findall-quickstart). A non-technical user describes the list they want; HQ suggests match conditions and enrichment columns, runs the search with live streaming, and syncs the results into the existing **agent lists** tables so the output is an ordinary list at `/app/lists`.

## Flow

1. **Describe** — the user types an objective (e.g. "AI startups in Europe that raised seed in 2024").
2. **Suggest** — `custom.findall.ingest` calls Parallel `/ingest` to suggest the entity type + match conditions. `custom.findall.suggestEnrichments` asks Hermes for enrichment columns (degrades to manual if Hermes is unconfigured). The user edits conditions, columns, result count, and depth.
3. **Build** — `custom.findall.create`:
   - creates an `agent_lists` row whose `json_schema` columns are `name`, `url`, `description`, one per match condition, one per enrichment;
   - starts a Parallel run (`/runs`), adds enrichments (`/enrich`), and inserts a `findall_runs` row;
   - kicks the background worker via `waitUntil`.
4. **Stream** — the browser connects to `GET /api/findall/runs/:id/stream`. Matched candidates appear live, enrichment cells fill in, each cell carries its sources/confidence.

## Depth → generator

| UI label | Parallel `generator` | Notes |
|---|---|---|
| Test | `preview` | Free/cheap, ~10 results, **not extendable** |
| Quick | `base` | Broad, common searches |
| Standard | `core` | Default — best for most lists |
| Deep | `pro` | Rare, hard-to-find matches |

Rate limit is ~25 runs/hour. Use **Test** while developing.

## Durability (server worker + hub)

`worker/lib/findall-stream.ts` owns one upstream SSE connection per run (`startFindallRunWorker`). It:
- parses Parallel's events, upserting matched candidates into `agent_list_rows` (keyed by candidate id) and keeping `findall_runs.status/metrics/lastEventId` fresh;
- publishes each event to an in-process hub so connected browsers forward it live;
- on terminal status, calls `/result` and **reconciles** (replaces) the list's rows for guaranteed completeness.

The worker runs even if the browser closes. On server restart the stream route lazily restarts it (resuming from `lastEventId`). `custom.findall.sync` is the manual completeness backstop.

## Reserved row key

Each `agent_list_rows.data` carries scalar column values at the top level **plus** a reserved `__findall` key:

```json
{
  "name": "Figure AI",
  "url": "https://figure.ai",
  "khosla_ventures_portfolio_check": "Led the Series B",
  "__findall": {
    "candidate_id": "candidate_...",
    "match_status": "matched",
    "basis": [{ "field": "...", "citations": [...], "reasoning": "...", "confidence": "high" }]
  }
}
```

The generic `list-detail-panel.tsx` ignores `__findall` (it only renders `json_schema.properties`); the builder's live view reads it for the per-cell citation popover and confidence dot.

## Tables

`findall_runs` (in `drizzle/schema/custom.ts`) tracks one run per list: `findallId`, `listId` (→ `agent_lists`, cascade), `objective`, `entityType`, `matchConditions`, `enrichments`, `generator`, `matchLimit`, `status`, `metrics`, `lastEventId`, `organizationId`. Apply schema changes with `npm run db:push`.

## Config

```
PARALLEL_API_KEY=...                          # required
PARALLEL_API_BASE_URL=https://api.parallel.ai # optional override
# HERMES_API_URL / HERMES_API_KEY / HERMES_MODEL — used for enrichment suggestions
```

Auth to Parallel uses `x-api-key` + the `parallel-beta: findall-2025-09-15` header on every request. The live stream route is session-cookie auth (same-origin `EventSource`); agents drive runs via the tRPC procedures instead.
