/**
 * FindAll run worker + in-process event hub.
 *
 * One upstream SSE connection per active run (the worker) parses Parallel's
 * events, persists matched candidates into agent_list_rows, keeps findall_runs
 * status/metrics/lastEventId fresh, and on terminal status reconciles against
 * /result for guaranteed completeness. Each event is also published to an
 * in-process hub so any number of connected browsers can forward it live.
 *
 * The worker is decoupled from the browser: it runs under waitUntil and keeps
 * persisting even if the user closes the tab. On server restart the SSE route
 * lazily restarts it (resuming from the stored lastEventId).
 */
import { EventEmitter } from "node:events";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  agentLists,
  agentListRows,
  findallRuns,
  FINDALL_STATUSES,
  type FindallMatchCondition,
} from "../../drizzle/schema/custom.ts";
import { ParallelFindAllClient } from "./parallel-findall.ts";
import {
  buildListJsonSchema,
  candidateToRowData,
  rowCandidateId,
  type FindallSchemaInput,
  type FindallRowMeta,
  type ParallelCandidate,
} from "./findall-mapping.ts";

type FindallRunRow = typeof findallRuns.$inferSelect;
type RowData = Record<string, unknown>;

export interface ParallelConfig {
  apiKey: string;
  baseUrl: string;
}

const FINDALL_STATUS_SET = new Set<string>(FINDALL_STATUSES);

// ---- Hub: fan out events to connected browsers ----

export interface FindallStreamEvent {
  type: string; // findall.* event type
  raw: string; // pre-serialized SSE block ready to forward
  eventId?: string;
}

const hub = new EventEmitter();
hub.setMaxListeners(0);

export function publishFindallEvent(findallId: string, ev: FindallStreamEvent): void {
  hub.emit(findallId, ev);
}

export function subscribeFindall(
  findallId: string,
  fn: (ev: FindallStreamEvent) => void,
): () => void {
  hub.on(findallId, fn);
  return () => hub.off(findallId, fn);
}

// ---- Worker lifecycle (one per findallId) ----

const activeWorkers = new Map<string, AbortController>();

export function ensureFindallRunWorker(args: {
  db: Database;
  parallel: ParallelConfig;
  findallId: string;
}): void {
  if (activeWorkers.has(args.findallId)) return;
  void startFindallRunWorker(args);
}

export async function startFindallRunWorker(args: {
  db: Database;
  parallel: ParallelConfig;
  findallId: string;
}): Promise<void> {
  const { db, parallel, findallId } = args;
  if (activeWorkers.has(findallId)) return;
  const controller = new AbortController();
  activeWorkers.set(findallId, controller);

  const client = new ParallelFindAllClient(parallel);
  try {
    const run = await db.query.findallRuns.findFirst({
      where: eq(findallRuns.findallId, findallId),
    });
    if (!run || run.status !== "running") return;

    const upstream = await client.streamEvents(findallId, {
      lastEventId: run.lastEventId ?? undefined,
      signal: controller.signal,
    });
    await consumeUpstream({ upstream, db, client, run, controller });
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error("[findall worker] failed:", findallId, error);
    }
  } finally {
    activeWorkers.delete(findallId);
  }
}

// ---- Upstream SSE consumption ----

async function consumeUpstream(args: {
  upstream: Response;
  db: Database;
  client: ParallelFindAllClient;
  run: FindallRunRow;
  controller: AbortController;
}): Promise<void> {
  const { upstream, db, client, run, controller } = args;
  if (!upstream.body) return;

  // Seed candidate_id → rowId so streamed events upsert idempotently.
  const rowIdByCandidate = new Map<string, number>();
  const existingRows = await db.query.agentListRows.findMany({
    where: eq(agentListRows.listId, run.listId),
  });
  for (const row of existingRows) {
    const cid = rowCandidateId(row.data as RowData);
    if (cid) rowIdByCandidate.set(cid, row.id);
  }

  let schema: FindallSchemaInput = {
    matchConditions: run.matchConditions ?? [],
    enrichments: run.enrichments ?? [],
  };
  let lastEventId = run.lastEventId ?? undefined;

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const separator = /\r?\n\r?\n/;
  let buffer = "";
  let stopped = false;

  const handleBlock = async (block: string): Promise<void> => {
    const payloadLines: string[] = [];
    let blockEventId: string | undefined;
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("data:")) payloadLines.push(line.slice(5).trimStart());
      else if (line.startsWith("id:")) blockEventId = line.slice(3).trim();
    }
    if (payloadLines.length === 0) return; // heartbeat / comment line

    const payload = payloadLines.join("\n");
    let event: { type?: string; event_id?: string; data?: unknown };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    const type = typeof event.type === "string" ? event.type : "";
    const eventId = event.event_id ?? blockEventId;
    if (eventId) lastEventId = eventId;

    // Forward to any connected browsers verbatim.
    publishFindallEvent(run.findallId, {
      type,
      raw: `event: ${type}\ndata: ${payload}\n\n`,
      eventId,
    });

    const data = (event.data ?? {}) as Record<string, unknown>;
    switch (type) {
      case "findall.candidate.matched":
        await upsertCandidate(db, run.listId, schema, data as unknown as ParallelCandidate, rowIdByCandidate);
        break;
      case "findall.candidate.enriched":
        await mergeCandidate(db, run.listId, schema, data as unknown as ParallelCandidate, rowIdByCandidate);
        break;
      case "findall.schema.updated": {
        const conditions = normalizeConditions(data.match_conditions) ?? schema.matchConditions;
        schema = { matchConditions: conditions, enrichments: schema.enrichments };
        await db
          .update(agentLists)
          .set({ jsonSchema: buildListJsonSchema(schema), updatedAt: new Date() })
          .where(eq(agentLists.id, run.listId));
        await db
          .update(findallRuns)
          .set({
            matchConditions: conditions,
            ...(typeof data.entity_type === "string" ? { entityType: data.entity_type } : {}),
            updatedAt: new Date(),
          })
          .where(eq(findallRuns.id, run.id));
        break;
      }
      case "findall.status": {
        const rawStatus = extractStatusString(data);
        const status =
          rawStatus && FINDALL_STATUS_SET.has(rawStatus)
            ? (rawStatus as FindallRunRow["status"])
            : null;
        const metrics = extractMetrics(data);
        await db
          .update(findallRuns)
          .set({
            ...(status ? { status } : {}),
            ...(metrics ? { metrics } : {}),
            lastEventId: lastEventId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(findallRuns.id, run.id));
        if (status && status !== "running") {
          await reconcileRunResult(db, client, { ...run, matchConditions: schema.matchConditions });
          stopped = true;
        }
        break;
      }
      default:
        break; // generated / unmatched — forwarded only
    }
  };

  try {
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let match = separator.exec(buffer);
      while (match) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        await handleBlock(block);
        if (stopped) break;
        match = separator.exec(buffer);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    // Persist the resume cursor even if the stream closed without a terminal status.
    if (!stopped && lastEventId && lastEventId !== run.lastEventId) {
      await db
        .update(findallRuns)
        .set({ lastEventId, updatedAt: new Date() })
        .where(eq(findallRuns.id, run.id))
        .catch(() => {});
    }
    controller.abort();
  }
}

async function upsertCandidate(
  db: Database,
  listId: number,
  schema: FindallSchemaInput,
  candidate: ParallelCandidate,
  rowIdByCandidate: Map<string, number>,
): Promise<void> {
  if (!candidate || typeof candidate.candidate_id !== "string") return;
  const data = candidateToRowData(candidate, schema);
  const existingId = rowIdByCandidate.get(candidate.candidate_id);
  if (existingId) {
    await db
      .update(agentListRows)
      .set({ data, updatedAt: new Date() })
      .where(eq(agentListRows.id, existingId));
    return;
  }
  const [row] = await db
    .insert(agentListRows)
    .values({ listId, data, sortOrder: rowIdByCandidate.size })
    .returning();
  if (row) rowIdByCandidate.set(candidate.candidate_id, row.id);
}

async function mergeCandidate(
  db: Database,
  listId: number,
  schema: FindallSchemaInput,
  candidate: ParallelCandidate,
  rowIdByCandidate: Map<string, number>,
): Promise<void> {
  if (!candidate || typeof candidate.candidate_id !== "string") return;
  const newData = candidateToRowData(candidate, schema);
  const existingId = rowIdByCandidate.get(candidate.candidate_id);
  if (!existingId) {
    // Enriched before we saw the match (rare) — insert fresh.
    const [row] = await db
      .insert(agentListRows)
      .values({ listId, data: newData, sortOrder: rowIdByCandidate.size })
      .returning();
    if (row) rowIdByCandidate.set(candidate.candidate_id, row.id);
    return;
  }

  const existing = await db.query.agentListRows.findFirst({
    where: eq(agentListRows.id, existingId),
  });
  const existingData = (existing?.data as RowData) ?? {};
  const merged: RowData = { ...existingData, ...newData };
  merged.__findall = mergeMeta(
    existingData.__findall as FindallRowMeta | undefined,
    newData.__findall as FindallRowMeta,
  );
  await db
    .update(agentListRows)
    .set({ data: merged, updatedAt: new Date() })
    .where(eq(agentListRows.id, existingId));
}

/** Pull the full /result set and replace the list's rows. Authoritative. */
export async function reconcileRunResult(
  db: Database,
  client: ParallelFindAllClient,
  run: Pick<
    FindallRunRow,
    "id" | "findallId" | "listId" | "matchConditions" | "enrichments"
  >,
): Promise<void> {
  const result = await client.getResult(run.findallId);
  const schema: FindallSchemaInput = {
    matchConditions: run.matchConditions ?? [],
    enrichments: run.enrichments ?? [],
  };
  const matched = (result.candidates ?? []).filter(
    (c) => c.match_status === "matched",
  );

  await db.transaction(async (tx) => {
    await tx.delete(agentListRows).where(eq(agentListRows.listId, run.listId));
    if (matched.length > 0) {
      await tx.insert(agentListRows).values(
        matched.map((candidate, index) => ({
          listId: run.listId,
          data: candidateToRowData(candidate, schema),
          sortOrder: index,
        })),
      );
    }
  });

  const status = result.status?.status;
  await db
    .update(findallRuns)
    .set({
      ...(status && FINDALL_STATUS_SET.has(status)
        ? { status: status as FindallRunRow["status"] }
        : {}),
      metrics: {
        ...(result.status?.metrics ?? {}),
        termination_reason: result.status?.termination_reason,
      },
      ...(result.last_event_id ? { lastEventId: result.last_event_id } : {}),
      updatedAt: new Date(),
    })
    .where(eq(findallRuns.id, run.id));
}

// ---- small helpers ----

function mergeMeta(
  existing: FindallRowMeta | undefined,
  incoming: FindallRowMeta,
): FindallRowMeta {
  const basisByField = new Map<string, FindallRowMeta["basis"][number]>();
  for (const basis of existing?.basis ?? []) basisByField.set(basis.field, basis);
  for (const basis of incoming.basis ?? []) basisByField.set(basis.field, basis);
  return {
    candidate_id: incoming.candidate_id ?? existing?.candidate_id ?? "",
    match_status: incoming.match_status ?? existing?.match_status ?? "matched",
    basis: [...basisByField.values()],
  };
}

function normalizeConditions(value: unknown): FindallMatchCondition[] | null {
  if (!Array.isArray(value)) return null;
  const conditions = value
    .filter(
      (item): item is { name: unknown; description?: unknown } =>
        typeof item === "object" && item !== null && "name" in item,
    )
    .map((item) => ({
      name: String(item.name),
      description: typeof item.description === "string" ? item.description : "",
    }))
    .filter((item) => item.name.length > 0);
  return conditions.length > 0 ? conditions : null;
}

function extractStatusString(data: Record<string, unknown>): string | null {
  const raw = data.status;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "status" in raw) {
    const inner = (raw as { status?: unknown }).status;
    return typeof inner === "string" ? inner : null;
  }
  return null;
}

function extractMetrics(
  data: Record<string, unknown>,
): FindallRunRow["metrics"] | null {
  const direct = data.metrics;
  const nested =
    data.status && typeof data.status === "object"
      ? (data.status as { metrics?: unknown }).metrics
      : undefined;
  const metrics = direct ?? nested;
  if (!metrics || typeof metrics !== "object") return null;
  const m = metrics as Record<string, unknown>;
  return {
    generated_candidates_count:
      typeof m.generated_candidates_count === "number"
        ? m.generated_candidates_count
        : undefined,
    matched_candidates_count:
      typeof m.matched_candidates_count === "number"
        ? m.matched_candidates_count
        : undefined,
    termination_reason:
      typeof data.termination_reason === "string"
        ? data.termination_reason
        : undefined,
  };
}
