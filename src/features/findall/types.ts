export type FindallGenerator = "preview" | "base" | "core" | "pro";
export type FindallStatus = "running" | "completed" | "cancelled" | "failed";

export interface EditableCondition {
  id: string;
  name: string;
  description: string;
}

export interface EditableEnrichment {
  id: string;
  name: string;
  description: string;
  type?: "string" | "number" | "boolean";
  format?: "uri";
}

export interface FindallColumn {
  key: string;
  title: string;
  uri?: boolean;
  kind: "core" | "condition" | "enrichment";
}

export interface BasisEntry {
  field: string;
  citations?: Array<{ title?: string; url?: string; excerpts?: string[] }>;
  reasoning?: string;
  confidence?: "high" | "medium" | "low";
}

export interface LiveRow {
  candidateId: string;
  cells: Record<string, unknown>;
  basisByField: Record<string, BasisEntry>;
  matchStatus: string;
}

/** Minimal shape of a candidate as it arrives over SSE. */
export interface ParallelCandidateLite {
  candidate_id: string;
  name?: string;
  url?: string;
  description?: string;
  match_status?: string;
  output?: Record<string, { value?: unknown; type?: string; is_matched?: boolean }>;
  basis?: BasisEntry[];
}

/** Run metadata carried in the SSE snapshot event. */
export interface RunSnapshot {
  id: number;
  listId: number;
  findallId: string;
  objective: string;
  entityType?: string | null;
  matchConditions?: Array<{ name: string; description: string }>;
  enrichments?: Array<{
    name: string;
    description: string;
    type?: string;
    format?: string;
  }>;
  generator: FindallGenerator;
  matchLimit: number;
  status: FindallStatus;
  metrics?: {
    generated_candidates_count?: number;
    matched_candidates_count?: number;
  } | null;
}

export interface DepthOption {
  label: string;
  generator: FindallGenerator;
  hint: string;
}

export const DEPTH_OPTIONS: DepthOption[] = [
  { label: "Test", generator: "preview", hint: "Free & fast · about 10 results" },
  { label: "Quick", generator: "base", hint: "Broad, common searches" },
  { label: "Standard", generator: "core", hint: "Best for most lists" },
  { label: "Deep", generator: "pro", hint: "Rare, hard-to-find matches" },
];

export const RESULT_COUNT_PRESETS = [10, 25, 50, 100];
