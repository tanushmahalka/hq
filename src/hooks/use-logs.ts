import { useEffect, useState, useRef, useCallback } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

export type LogEntry = {
  timestamp: string;
  level: string;
  subsystem: string;
  message: string;
  raw: unknown;
};

/**
 * Parse OpenClaw's structured log format.
 *
 * Shape: { "0": subsystemJSON, "1": message|object, "_meta": { logLevelName, date, ... }, "time": ISO }
 * The numbered keys hold the actual content:
 *   "0" = subsystem identifier (JSON string like '{"subsystem":"gateway/ws"}')
 *   "1" = the human-readable message (string or object)
 *   "2"+ = extra context
 */
function parseOpenClawLog(obj: Record<string, unknown>): LogEntry | null {
  const meta = obj._meta as Record<string, unknown> | undefined;
  const time = String(obj.time ?? meta?.date ?? "");
  const level = String(meta?.logLevelName ?? "").toLowerCase();

  // Extract subsystem from key "0"
  let subsystem = "";
  const key0 = obj["0"];
  if (typeof key0 === "string") {
    try {
      const parsed = JSON.parse(key0);
      subsystem =
        parsed.subsystem ?? parsed.module ?? Object.values(parsed).join("/");
    } catch {
      subsystem = key0;
    }
  }

  // Build message from numbered keys starting at "1"
  const parts: string[] = [];
  for (let i = 1; i < 20; i++) {
    const val = obj[String(i)];
    if (val === undefined) break;
    if (typeof val === "string") {
      parts.push(val);
    } else if (val && typeof val === "object") {
      // Inline small objects, skip large blobs
      const str = JSON.stringify(val);
      if (str.length < 200) parts.push(str);
    }
  }

  const message = parts.join(" ").trim();
  if (!message) return null;

  return { timestamp: time, level, subsystem, message, raw: obj };
}

function parseGenericLog(raw: unknown): LogEntry | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parseStructured(parsed);
    } catch {
      return { timestamp: "", level: "", subsystem: "", message: raw, raw };
    }
  }
  if (raw && typeof raw === "object") {
    return parseStructured(raw as Record<string, unknown>);
  }
  return null;
}

function parseStructured(obj: Record<string, unknown>): LogEntry | null {
  // Detect OpenClaw format: has "_meta" key with logLevelName
  if (obj._meta && typeof obj._meta === "object") {
    return parseOpenClawLog(obj);
  }

  // Generic structured log
  return {
    timestamp: String(obj.timestamp ?? obj.ts ?? obj.time ?? ""),
    level: String(obj.level ?? obj.lvl ?? ""),
    subsystem: "",
    message: String(
      obj.message ?? obj.msg ?? obj.text ?? JSON.stringify(obj)
    ),
    raw: obj,
  };
}

export function useLogs(opts: { enabled?: boolean; limit?: number } = {}) {
  const { client, connected, subscribe } = useGateway();
  const { enabled = true, limit = 200 } = opts;
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Subscribe to streaming log events
  useEffect(() => {
    if (!enabled) return;

    return subscribe((evt: EventFrame) => {
      if (
        evt.event !== "log" &&
        evt.event !== "logs" &&
        evt.event !== "logs.tail"
      )
        return;

      const entry = parseGenericLog(evt.payload);
      if (entry) {
        setEntries((prev) => [...prev.slice(-(limit - 1)), entry]);
      }
    });
  }, [subscribe, enabled, limit]);

  // Initial fetch via RPC
  useEffect(() => {
    if (!enabled || !connected || !client || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);

    client
      .request("logs.tail", { limit })
      .then((res: unknown) => {
        setLoading(false);
        if (!res) return;

        let lines: unknown[] = [];

        if (Array.isArray(res)) {
          lines = res;
        } else if (typeof res === "object") {
          const obj = res as Record<string, unknown>;
          if (Array.isArray(obj.lines)) lines = obj.lines;
          else if (Array.isArray(obj.entries)) lines = obj.entries;
          else if (Array.isArray(obj.logs)) lines = obj.logs;
          else if (typeof obj.content === "string") {
            lines = obj.content.split("\n").filter(Boolean);
          } else {
            const entry = parseGenericLog(res);
            if (entry) lines = [res];
          }
        }

        const parsed = lines
          .map(parseGenericLog)
          .filter((e): e is LogEntry => e !== null);

        setEntries(parsed);
      })
      .catch((err: Error) => {
        setLoading(false);
        setError(err.message);
      });
  }, [enabled, connected, client, limit]);

  // Reset on reconnect
  useEffect(() => {
    if (!connected) {
      fetchedRef.current = false;
    }
  }, [connected]);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, error, loading, clear };
}
