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
  /** Flat cost charged per run, in USD. */
  fixedCost: number;
  /** Cost per matched result, in USD. */
  perMatch: number;
}

export const DEPTH_OPTIONS: DepthOption[] = [
  {
    label: "Test",
    generator: "preview",
    hint: "Fast · about 10 results",
    fixedCost: 0.1,
    perMatch: 0,
  },
  {
    label: "Quick",
    generator: "base",
    hint: "Broad, common searches",
    fixedCost: 0.25,
    perMatch: 0.03,
  },
  {
    label: "Standard",
    generator: "core",
    hint: "Best for most lists",
    fixedCost: 2,
    perMatch: 0.15,
  },
  {
    label: "Deep",
    generator: "pro",
    hint: "Rare, hard-to-find matches",
    fixedCost: 10,
    perMatch: 1,
  },
];

export const RESULT_COUNT_PRESETS = [10, 25, 50, 100];
