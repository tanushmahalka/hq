/**
 * Single source of truth for the Agent Lists API.
 *
 * The Zod schemas here are used by:
 *   1. The tRPC router (`agent-list.ts`) for runtime input validation.
 *   2. The `agentList.apiSchema` endpoint, which returns JSON Schema derived
 *      from these via `z.toJSONSchema()` — so the agent always gets the live shape.
 *   3. The doc generator (`scripts/generate-agent-list-api-doc.ts`), which emits
 *      `docs/agent-lists-api.md` from the same definitions.
 *
 * Keep this module dependency-light (zod only) so the doc script can import it
 * without pulling in the DB/auth layer.
 */
import { z } from "zod";

/** A freeform JSON object — a list's `json_schema` or a row's `data`. */
const jsonObject = z.record(z.string(), z.unknown());

// ---- List operations ----

export const listListInput = z.object({
  agentId: z.string().optional(),
});

export const listGetInput = z.object({
  id: z.number().int().positive(),
});

export const listCreateInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  /** JSON Schema-style object defining the row columns. See `docs/agent-lists.md`. */
  jsonSchema: jsonObject,
  agentId: z.string().optional(),
  /** Only honored for agent (bearer) callers; session users are scoped to their org. */
  organizationId: z.string().optional(),
});

export const listUpdateInput = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  jsonSchema: jsonObject.optional(),
});

export const listDeleteInput = z.object({
  id: z.number().int().positive(),
});

// ---- Row operations ----

export const rowAddInput = z.object({
  listId: z.number().int().positive(),
  /** Row values keyed by the list's json_schema property keys. */
  data: jsonObject,
  sortOrder: z.number().int().optional(),
});

export const rowAddManyInput = z.object({
  listId: z.number().int().positive(),
  rows: z
    .array(
      z.object({
        data: jsonObject,
        sortOrder: z.number().int().optional(),
      }),
    )
    .min(1),
});

export const rowUpdateInput = z.object({
  id: z.number().int().positive(),
  data: jsonObject.optional(),
  sortOrder: z.number().int().optional(),
});

export const rowDeleteInput = z.object({
  id: z.number().int().positive(),
});

export interface AgentListOperation {
  method: string;
  type: "query" | "mutation";
  summary: string;
  input: z.ZodType;
}

/** Ordered list of every operation in the Agent Lists API. */
export const AGENT_LIST_API: AgentListOperation[] = [
  {
    method: "custom.agentList.list",
    type: "query",
    summary: "List all lists (optionally filter by agentId). Returns list metadata without rows.",
    input: listListInput,
  },
  {
    method: "custom.agentList.get",
    type: "query",
    summary: "Get one list including its rows, ordered by sortOrder.",
    input: listGetInput,
  },
  {
    method: "custom.agentList.create",
    type: "mutation",
    summary: "Create a new list. Define columns in jsonSchema.properties.",
    input: listCreateInput,
  },
  {
    method: "custom.agentList.update",
    type: "mutation",
    summary: "Update a list's title, description, or jsonSchema.",
    input: listUpdateInput,
  },
  {
    method: "custom.agentList.delete",
    type: "mutation",
    summary: "Delete a list and all of its rows (cascade).",
    input: listDeleteInput,
  },
  {
    method: "custom.agentList.addRow",
    type: "mutation",
    summary: "Add a single row to a list. Keep data aligned with the list's jsonSchema.",
    input: rowAddInput,
  },
  {
    method: "custom.agentList.addRows",
    type: "mutation",
    summary: "Add many rows to a list in one call.",
    input: rowAddManyInput,
  },
  {
    method: "custom.agentList.updateRow",
    type: "mutation",
    summary: "Update a single row's data and/or sortOrder.",
    input: rowUpdateInput,
  },
  {
    method: "custom.agentList.deleteRow",
    type: "mutation",
    summary: "Delete a single row.",
    input: rowDeleteInput,
  },
];
