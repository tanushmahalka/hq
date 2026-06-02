/**
 * Pure mapping helpers shared by the tRPC procedures and the SSE worker.
 *
 * Keep this module dependency-light (type-only imports) so it never pulls in
 * the DB/auth layer. It converts between our list representation and Parallel
 * FindAll shapes, producing jsonSchema/row data that the existing
 * `list-detail-panel.tsx` renders without modification.
 */
import type {
  FindallMatchCondition,
  FindallEnrichment,
} from "../../drizzle/schema/custom.ts";

/** A field value from a candidate's `output`. */
export interface ParallelOutputValue {
  value: unknown;
  type: "match_condition" | "enrichment";
  is_matched?: boolean;
}

/** Per-field reasoning + sources from a candidate's `basis`. */
export interface ParallelBasis {
  field: string;
  citations?: Array<{ title?: string; url?: string; excerpts?: string[] }>;
  reasoning?: string;
  confidence?: "high" | "medium" | "low";
}

/** A FindAll candidate (entity), exactly as returned by Parallel. */
export interface ParallelCandidate {
  candidate_id: string;
  name: string;
  url: string;
  description?: string;
  match_status: "matched" | "unmatched" | "generated";
  output?: Record<string, ParallelOutputValue>;
  basis?: ParallelBasis[];
}

export interface FindallSchemaInput {
  matchConditions: FindallMatchCondition[];
  enrichments: FindallEnrichment[];
}

/** Snake_case a free-text name into a stable property/data key. */
export function toColumnKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface JsonSchemaProperty {
  type: string;
  title: string;
  format?: string;
}

/**
 * Build the list jsonSchema. Columns, in display order:
 *   name (string) | url (uri) | description (string) | <match conditions> | <enrichments>
 * Matches docs/agent-lists.md conventions; `url` uses format:"uri" so the
 * existing list-detail-panel renders a clickable link.
 */
export function buildListJsonSchema(
  input: FindallSchemaInput,
): Record<string, unknown> {
  const properties: Record<string, JsonSchemaProperty> = {
    name: { type: "string", title: "Name" },
    url: { type: "string", title: "URL", format: "uri" },
    description: { type: "string", title: "Description" },
  };

  for (const condition of input.matchConditions) {
    properties[toColumnKey(condition.name)] = {
      type: "string",
      title: condition.name,
    };
  }
  for (const enrichment of input.enrichments) {
    properties[toColumnKey(enrichment.name)] = {
      type: enrichment.type ?? "string",
      title: enrichment.name,
      ...(enrichment.format ? { format: enrichment.format } : {}),
    };
  }

  return {
    type: "object",
    properties,
    required: ["name", "url"],
  };
}

/** Build the Parallel `/enrich` output_schema from our enrichment columns. */
export function buildEnrichSchema(enrichments: FindallEnrichment[]): {
  type: "json";
  json_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
  };
} {
  const properties: Record<string, { type: string; description: string }> = {};
  for (const enrichment of enrichments) {
    properties[toColumnKey(enrichment.name)] = {
      type: enrichment.type ?? "string",
      description: enrichment.description,
    };
  }
  return { type: "json", json_schema: { type: "object", properties } };
}

/** Metadata stashed on each row under the reserved `__findall` key. */
export interface FindallRowMeta {
  candidate_id: string;
  match_status: ParallelCandidate["match_status"];
  basis: ParallelBasis[];
}

/**
 * Map a Parallel candidate to `agent_list_rows.data`.
 *
 * Scalar column values are stored at top-level data[key] so the generic
 * list-detail-panel renders them. Audit metadata (candidate_id, per-field
 * basis/citations/confidence, match_status) lives under the reserved
 * `data.__findall` key, which the generic view ignores (its column loop only
 * iterates jsonSchema.properties) but the builder view renders.
 */
export function candidateToRowData(
  candidate: ParallelCandidate,
  schema: FindallSchemaInput,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: candidate.name ?? "",
    url: candidate.url ?? "",
    description: candidate.description ?? "",
  };

  const columnNames = [
    ...schema.matchConditions.map((c) => c.name),
    ...schema.enrichments.map((e) => e.name),
  ];
  for (const columnName of columnNames) {
    const key = toColumnKey(columnName);
    // Parallel keys `output` by the condition/enrichment name; try name then key.
    const cell = candidate.output?.[columnName] ?? candidate.output?.[key];
    if (cell !== undefined) {
      data[key] = cell.value ?? "";
    }
  }

  const meta: FindallRowMeta = {
    candidate_id: candidate.candidate_id,
    match_status: candidate.match_status,
    basis: candidate.basis ?? [],
  };
  data.__findall = meta;
  return data;
}

/** Read the reserved candidate id from a row's data (or null). */
export function rowCandidateId(data: Record<string, unknown>): string | null {
  const meta = data.__findall as FindallRowMeta | undefined;
  return meta?.candidate_id ?? null;
}
