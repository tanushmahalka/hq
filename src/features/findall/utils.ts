import type {
  BasisEntry,
  FindallColumn,
  LiveRow,
  ParallelCandidateLite,
  RunSnapshot,
} from "./types";

/** Snake_case a free-text name into a stable column key (mirrors the backend). */
export function toColumnKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Columns in display order: name | url | description | conditions | enrichments. */
export function buildColumns(run: RunSnapshot | null): FindallColumn[] {
  const columns: FindallColumn[] = [
    { key: "name", title: "Name", kind: "core" },
    { key: "url", title: "URL", uri: true, kind: "core" },
    { key: "description", title: "Description", kind: "core" },
  ];
  for (const condition of run?.matchConditions ?? []) {
    columns.push({
      key: toColumnKey(condition.name),
      title: condition.name,
      kind: "condition",
    });
  }
  for (const enrichment of run?.enrichments ?? []) {
    columns.push({
      key: toColumnKey(enrichment.name),
      title: enrichment.name,
      uri: enrichment.format === "uri",
      kind: "enrichment",
    });
  }
  return columns;
}

function basisToMap(basis: BasisEntry[] | undefined): Record<string, BasisEntry> {
  const map: Record<string, BasisEntry> = {};
  for (const entry of basis ?? []) {
    if (entry?.field) map[entry.field] = entry;
  }
  return map;
}

export function candidateToLiveRow(
  candidate: ParallelCandidateLite,
  columns: FindallColumn[],
): LiveRow {
  const cells: Record<string, unknown> = {
    name: candidate.name ?? "",
    url: candidate.url ?? "",
    description: candidate.description ?? "",
  };
  for (const column of columns) {
    if (column.kind === "core") continue;
    const out = candidate.output?.[column.title] ?? candidate.output?.[column.key];
    if (out !== undefined) cells[column.key] = out?.value ?? "";
  }
  return {
    candidateId: candidate.candidate_id,
    cells,
    basisByField: basisToMap(candidate.basis),
    matchStatus: candidate.match_status ?? "matched",
  };
}

interface PersistedRow {
  data: Record<string, unknown>;
}

export function rowToLiveRow(row: PersistedRow): LiveRow {
  const data = row.data ?? {};
  const meta = (data.__findall ?? {}) as {
    candidate_id?: string;
    match_status?: string;
    basis?: BasisEntry[];
  };
  const cells: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "__findall") cells[key] = value;
  }
  return {
    candidateId: meta.candidate_id ?? makeId("row"),
    cells,
    basisByField: basisToMap(meta.basis),
    matchStatus: meta.match_status ?? "matched",
  };
}

/** Merge a freshly streamed row into an existing one without clobbering with blanks. */
export function mergeLiveRows(existing: LiveRow, incoming: LiveRow): LiveRow {
  const cells = { ...existing.cells };
  for (const [key, value] of Object.entries(incoming.cells)) {
    if (value !== "" && value != null) cells[key] = value;
    else if (!(key in cells)) cells[key] = value;
  }
  return {
    candidateId: incoming.candidateId,
    cells,
    basisByField: { ...existing.basisByField, ...incoming.basisByField },
    matchStatus: incoming.matchStatus || existing.matchStatus,
  };
}

export function confidenceDotClass(confidence?: string): string {
  if (confidence === "high") return "text-[var(--swarm-mint)]";
  if (confidence === "medium") return "text-[var(--swarm-violet)]";
  return "text-gray-400";
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
