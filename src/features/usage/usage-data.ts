import type { GatewayClient } from "@/lib/gateway-client";
import type {
  CostUsageSummary,
  SessionLogEntry,
  SessionUsageTimeSeries,
  SessionsUsageResult,
} from "./types";

type DateInterpretationMode = "utc" | "gateway" | "specific";

type UsageDateInterpretationParams = {
  mode: DateInterpretationMode;
  utcOffset?: string;
};

type UsageGatewayClient = Pick<GatewayClient, "request">;

const LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY = "hq.usage.date-params.v1";
const LEGACY_USAGE_DATE_PARAMS_DEFAULT_GATEWAY_KEY = "__default__";
const LEGACY_USAGE_DATE_PARAMS_MODE_RE = /unexpected property ['"]mode['"]/i;
const LEGACY_USAGE_DATE_PARAMS_OFFSET_RE = /unexpected property ['"]utcoffset['"]/i;
const LEGACY_USAGE_DATE_PARAMS_INVALID_RE = /invalid sessions\.usage params/i;

let legacyUsageDateParamsCache: Set<string> | null = null;

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return null;
}

function loadLegacyUsageDateParamsCache(): Set<string> {
  const storage = getLocalStorage();
  if (!storage) {
    return new Set<string>();
  }
  try {
    const raw = storage.getItem(LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw) as { unsupportedGatewayKeys?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.unsupportedGatewayKeys)) {
      return new Set<string>();
    }
    return new Set(
      parsed.unsupportedGatewayKeys
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

function persistLegacyUsageDateParamsCache(cache: Set<string>) {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY,
      JSON.stringify({ unsupportedGatewayKeys: Array.from(cache) }),
    );
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}

function getLegacyUsageDateParamsCache(): Set<string> {
  if (!legacyUsageDateParamsCache) {
    legacyUsageDateParamsCache = loadLegacyUsageDateParamsCache();
  }
  return legacyUsageDateParamsCache;
}

export function normalizeGatewayCompatibilityKey(gatewayUrl?: string): string {
  const trimmed = gatewayUrl?.trim();
  if (!trimmed) {
    return LEGACY_USAGE_DATE_PARAMS_DEFAULT_GATEWAY_KEY;
  }
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function shouldSendLegacyDateInterpretation(gatewayUrl?: string): boolean {
  return !getLegacyUsageDateParamsCache().has(normalizeGatewayCompatibilityKey(gatewayUrl));
}

export function rememberLegacyDateInterpretation(gatewayUrl?: string) {
  const cache = getLegacyUsageDateParamsCache();
  cache.add(normalizeGatewayCompatibilityKey(gatewayUrl));
  persistLegacyUsageDateParamsCache(cache);
}

export function toErrorMessage(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error && typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  if (err && typeof err === "object") {
    try {
      const serialized = JSON.stringify(err);
      if (serialized) {
        return serialized;
      }
    } catch {
      // Ignore serialization failures.
    }
  }
  return "request failed";
}

export function isLegacyDateInterpretationUnsupportedError(err: unknown): boolean {
  const message = toErrorMessage(err);
  return (
    LEGACY_USAGE_DATE_PARAMS_INVALID_RE.test(message) &&
    (LEGACY_USAGE_DATE_PARAMS_MODE_RE.test(message) ||
      LEGACY_USAGE_DATE_PARAMS_OFFSET_RE.test(message))
  );
}

export function formatUtcOffset(timezoneOffsetMinutes: number): string {
  const offsetFromUtcMinutes = -timezoneOffsetMinutes;
  const sign = offsetFromUtcMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetFromUtcMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
}

export function buildDateInterpretationParams(
  timeZone: "local" | "utc",
  includeDateInterpretation: boolean,
): UsageDateInterpretationParams | undefined {
  if (!includeDateInterpretation) {
    return undefined;
  }
  if (timeZone === "utc") {
    return { mode: "utc" };
  }
  return {
    mode: "specific",
    utcOffset: formatUtcOffset(new Date().getTimezoneOffset()),
  };
}

export async function loadUsageSnapshot({
  client,
  gatewayUrl,
  startDate,
  endDate,
  timeZone,
}: {
  client: UsageGatewayClient;
  gatewayUrl?: string;
  startDate: string;
  endDate: string;
  timeZone: "local" | "utc";
}): Promise<{
  usageResult: SessionsUsageResult;
  costSummary: CostUsageSummary;
}> {
  const runUsageRequests = async (includeDateInterpretation: boolean) => {
    const dateInterpretation = buildDateInterpretationParams(timeZone, includeDateInterpretation);
    return Promise.all([
      client.request<SessionsUsageResult>("sessions.usage", {
        startDate,
        endDate,
        ...dateInterpretation,
        limit: 1000,
        includeContextWeight: true,
      }),
      client.request<CostUsageSummary>("usage.cost", {
        startDate,
        endDate,
        ...dateInterpretation,
      }),
    ]);
  };

  const includeDateInterpretation = shouldSendLegacyDateInterpretation(gatewayUrl);
  try {
    const [usageResult, costSummary] = await runUsageRequests(includeDateInterpretation);
    return { usageResult, costSummary };
  } catch (err) {
    if (includeDateInterpretation && isLegacyDateInterpretationUnsupportedError(err)) {
      rememberLegacyDateInterpretation(gatewayUrl);
      const [usageResult, costSummary] = await runUsageRequests(false);
      return { usageResult, costSummary };
    }
    throw err;
  }
}

export async function loadSessionTimeSeries(
  client: UsageGatewayClient,
  sessionKey: string,
  methods?: string[],
): Promise<SessionUsageTimeSeries | null> {
  if (methods && methods.length > 0 && !methods.includes("sessions.usage.timeseries")) {
    return null;
  }
  try {
    return await client.request<SessionUsageTimeSeries>("sessions.usage.timeseries", {
      key: sessionKey,
    });
  } catch {
    return null;
  }
}

export async function loadSessionLogs(
  client: UsageGatewayClient,
  sessionKey: string,
  methods?: string[],
): Promise<SessionLogEntry[] | null> {
  if (methods && methods.length > 0 && !methods.includes("sessions.usage.logs")) {
    return null;
  }
  try {
    const result = await client.request<{ logs?: SessionLogEntry[] }>("sessions.usage.logs", {
      key: sessionKey,
      limit: 1000,
    });
    return Array.isArray(result.logs) ? result.logs : null;
  } catch {
    return null;
  }
}

export const __test = {
  buildDateInterpretationParams,
  formatUtcOffset,
  isLegacyDateInterpretationUnsupportedError,
  normalizeGatewayCompatibilityKey,
  rememberLegacyDateInterpretation,
  resetLegacyUsageDateParamsCache: () => {
    legacyUsageDateParamsCache = null;
  },
  shouldSendLegacyDateInterpretation,
  toErrorMessage,
};
