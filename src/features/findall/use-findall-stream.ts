import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type {
  FindallColumn,
  FindallStatus,
  LiveRow,
  ParallelCandidateLite,
  RunSnapshot,
} from "./types";
import {
  buildColumns,
  candidateToLiveRow,
  mergeLiveRows,
  rowToLiveRow,
} from "./utils";

export interface FindallStreamState {
  run: RunSnapshot | null;
  columns: FindallColumn[];
  rows: LiveRow[];
  status: FindallStatus;
  scanned: number;
  matched: number;
  isStreaming: boolean;
  error: string | null;
}

/**
 * Subscribe to a run's SSE stream. The backend worker is authoritative; this
 * hook just accumulates the live view (keyed by candidate id) and reconciles
 * the persisted list on completion.
 */
export function useFindallStream(
  runId: number | null,
  reconnectKey = 0,
): FindallStreamState {
  const utils = trpc.useUtils();
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [status, setStatus] = useState<FindallStatus>("running");
  const [scanned, setScanned] = useState(0);
  const [matched, setMatched] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [columns, setColumns] = useState<FindallColumn[]>([]);

  const rowsRef = useRef<Map<string, LiveRow>>(new Map());
  const columnsRef = useRef<FindallColumn[]>([]);
  const listIdRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    setRows([...rowsRef.current.values()]);
  }, []);

  useEffect(() => {
    if (!runId) return;

    // Reset the view when the subscription target changes, then (re)subscribe
    // to the external SSE source below.
    rowsRef.current = new Map();
    columnsRef.current = [];
    /* eslint-disable react-hooks/set-state-in-effect */
    setRows([]);
    setColumns([]);
    setError(null);
    setIsStreaming(true);
    setStatus("running");
    /* eslint-enable react-hooks/set-state-in-effect */

    const source = new EventSource(`/api/findall/runs/${runId}/stream`, {
      withCredentials: true,
    });

    const finish = (next: FindallStatus) => {
      setStatus(next);
      setIsStreaming(false);
      source.close();
      if (listIdRef.current) {
        void utils.custom.agentList.get.invalidate({ id: listIdRef.current });
      }
      void utils.custom.findall.list.invalidate();
    };

    source.addEventListener("snapshot", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          run: RunSnapshot;
          rows: Array<{ data: Record<string, unknown> }>;
        };
        setRun(parsed.run);
        setStatus(parsed.run.status);
        listIdRef.current = parsed.run.listId;
        setScanned(parsed.run.metrics?.generated_candidates_count ?? 0);
        setMatched(parsed.run.metrics?.matched_candidates_count ?? 0);

        const cols = buildColumns(parsed.run);
        columnsRef.current = cols;
        setColumns(cols);

        const map = new Map<string, LiveRow>();
        for (const row of parsed.rows ?? []) {
          const liveRow = rowToLiveRow(row);
          map.set(liveRow.candidateId, liveRow);
        }
        rowsRef.current = map;
        flush();

        if (parsed.run.status !== "running") finish(parsed.run.status);
      } catch {
        // ignore malformed snapshot
      }
    });

    const onCandidate = (event: Event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          data?: ParallelCandidateLite;
        };
        const candidate = parsed.data;
        if (!candidate?.candidate_id) return;
        const liveRow = candidateToLiveRow(candidate, columnsRef.current);
        const existing = rowsRef.current.get(liveRow.candidateId);
        rowsRef.current.set(
          liveRow.candidateId,
          existing ? mergeLiveRows(existing, liveRow) : liveRow,
        );
        flush();
      } catch {
        // ignore malformed candidate
      }
    };

    source.addEventListener("findall.candidate.matched", onCandidate);
    source.addEventListener("findall.candidate.enriched", onCandidate);

    source.addEventListener("findall.status", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          data?: Record<string, unknown>;
        };
        const data = parsed.data ?? {};
        const statusValue =
          typeof data.status === "string"
            ? (data.status as FindallStatus)
            : ((data.status as { status?: FindallStatus } | undefined)?.status ??
              null);
        const metrics =
          (data.metrics as
            | {
                generated_candidates_count?: number;
                matched_candidates_count?: number;
              }
            | undefined) ?? undefined;
        if (metrics) {
          setScanned(metrics.generated_candidates_count ?? 0);
          setMatched(metrics.matched_candidates_count ?? 0);
        }
        if (statusValue) {
          if (statusValue !== "running") finish(statusValue);
          else setStatus(statusValue);
        }
      } catch {
        // ignore malformed status
      }
    });

    source.addEventListener("findall.schema.updated", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          data?: { match_conditions?: RunSnapshot["matchConditions"] };
        };
        const conditions = parsed.data?.match_conditions;
        if (!conditions) return;
        setRun((prev) => {
          if (!prev) return prev;
          const next = { ...prev, matchConditions: conditions };
          const cols = buildColumns(next);
          columnsRef.current = cols;
          setColumns(cols);
          return next;
        });
      } catch {
        // ignore malformed schema update
      }
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
        setError("Connection lost. Reopen the list to resume.");
      }
    };

    return () => {
      source.close();
      setIsStreaming(false);
    };
  }, [runId, reconnectKey, flush, utils]);

  return { run, columns, rows, status, scanned, matched, isStreaming, error };
}
