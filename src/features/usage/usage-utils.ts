import type {
  CostUsageDailyEntry,
  CostUsageTotals,
  SessionLogEntry,
  SessionUsageTimePoint,
  UsageAggregates,
  UsageColumnId,
  UsageSessionEntry,
} from "./types";

export const DEFAULT_VISIBLE_COLUMNS: UsageColumnId[] = [
  "channel",
  "agent",
  "provider",
  "model",
  "messages",
  "tools",
  "errors",
  "duration",
];

const CHARS_PER_TOKEN = 4;

const QUERY_KEYS = new Set([
  "agent",
  "channel",
  "chat",
  "provider",
  "model",
  "tool",
  "label",
  "key",
  "session",
  "id",
  "has",
  "mintokens",
  "maxtokens",
  "mincost",
  "maxcost",
  "minmessages",
  "maxmessages",
]);

export type UsageQueryTerm = {
  key?: string;
  value: string;
  raw: string;
};

export type UsageQueryResult<TSession> = {
  sessions: TSession[];
  warnings: string[];
};

export type UsageSessionQueryTarget = {
  key: string;
  label?: string;
  sessionId?: string;
  agentId?: string;
  channel?: string;
  chatType?: string;
  modelProvider?: string;
  providerOverride?: string;
  origin?: { provider?: string };
  model?: string;
  contextWeight?: unknown;
  usage?: {
    totalTokens?: number;
    totalCost?: number;
    messageCounts?: { total?: number; errors?: number };
    toolUsage?: { totalCalls?: number; tools?: Array<{ name: string }> };
    modelUsage?: Array<{ provider?: string; model?: string }>;
  } | null;
};

export type QuerySuggestion = {
  label: string;
  value: string;
};

export type UsageMosaicStats = {
  hasData: boolean;
  totalTokens: number;
  hourTotals: number[];
  weekdayTotals: Array<{ label: string; tokens: number }>;
};

export type UsageInsightStats = {
  durationSumMs: number;
  durationCount: number;
  avgDurationMs: number;
  throughputTokensPerMin?: number;
  throughputCostPerMin?: number;
  errorRate: number;
  peakErrorDay?: { date: string; errors: number; messages: number; rate: number };
};

export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return `${Math.round(value)}`;
}

export function formatCost(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

export function charsToTokens(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN);
}

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function parseYmdDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatDayLabel(dateStr: string): string {
  const date = parseYmdDate(dateStr);
  if (!date) {
    return dateStr;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatFullDate(dateStr: string): string {
  const date = parseYmdDate(dateStr);
  if (!date) {
    return dateStr;
  }
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatHourLabel(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

export type FormatDurationCompactOptions = {
  spaced?: boolean;
};

export function formatDurationCompact(
  ms?: number | null,
  options?: FormatDurationCompactOptions,
): string | undefined {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const separator = options?.spaced ? " " : "";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d${separator}${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${separator}${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m${separator}${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

export function createEmptyUsageTotals(): CostUsageTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
  };
}

export function addUsageTotals(target: CostUsageTotals, source: Partial<CostUsageTotals>) {
  target.input += source.input ?? 0;
  target.output += source.output ?? 0;
  target.cacheRead += source.cacheRead ?? 0;
  target.cacheWrite += source.cacheWrite ?? 0;
  target.totalTokens += source.totalTokens ?? 0;
  target.totalCost += source.totalCost ?? 0;
  target.inputCost += source.inputCost ?? 0;
  target.outputCost += source.outputCost ?? 0;
  target.cacheReadCost += source.cacheReadCost ?? 0;
  target.cacheWriteCost += source.cacheWriteCost ?? 0;
  target.missingCostEntries += source.missingCostEntries ?? 0;
}

function pct(part: number, total: number): number {
  if (!total || total <= 0) {
    return 0;
  }
  return (part / total) * 100;
}

export function getZonedHour(date: Date, zone: "local" | "utc"): number {
  return zone === "utc" ? date.getUTCHours() : date.getHours();
}

function getZonedWeekday(date: Date, zone: "local" | "utc"): number {
  return zone === "utc" ? date.getUTCDay() : date.getDay();
}

export function setToHourEnd(date: Date, zone: "local" | "utc"): Date {
  const next = new Date(date);
  if (zone === "utc") {
    next.setUTCMinutes(59, 59, 999);
  } else {
    next.setMinutes(59, 59, 999);
  }
  return next;
}

export function buildUsageMosaicStats(
  sessions: UsageSessionEntry[],
  timeZone: "local" | "utc",
): UsageMosaicStats {
  const hourTotals = Array.from({ length: 24 }, () => 0);
  const weekdayTotals = Array.from({ length: 7 }, () => 0);
  let totalTokens = 0;
  let hasData = false;

  for (const session of sessions) {
    const usage = session.usage;
    if (!usage || !usage.totalTokens || usage.totalTokens <= 0) {
      continue;
    }
    totalTokens += usage.totalTokens;

    const start = usage.firstActivity ?? session.updatedAt;
    const end = usage.lastActivity ?? session.updatedAt;
    if (!start || !end) {
      continue;
    }
    hasData = true;

    const startMs = Math.min(start, end);
    const endMs = Math.max(start, end);
    const durationMs = Math.max(endMs - startMs, 1);
    const totalMinutes = durationMs / 60000;

    let cursor = startMs;
    while (cursor < endMs) {
      const date = new Date(cursor);
      const hour = getZonedHour(date, timeZone);
      const weekday = getZonedWeekday(date, timeZone);
      const nextHour = setToHourEnd(date, timeZone);
      const nextMs = Math.min(nextHour.getTime(), endMs);
      const minutes = Math.max((nextMs - cursor) / 60000, 0);
      const share = minutes / totalMinutes;
      hourTotals[hour] += usage.totalTokens * share;
      weekdayTotals[weekday] += usage.totalTokens * share;
      cursor = nextMs + 1;
    }
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    hasData,
    totalTokens,
    hourTotals,
    weekdayTotals: weekdays.map((label, index) => ({
      label,
      tokens: weekdayTotals[index],
    })),
  };
}

export function buildPeakErrorHours(
  sessions: UsageSessionEntry[],
  timeZone: "local" | "utc",
): Array<{ label: string; value: string; sub?: string }> {
  const hourErrors = Array.from({ length: 24 }, () => 0);
  const hourMessages = Array.from({ length: 24 }, () => 0);

  for (const session of sessions) {
    const usage = session.usage;
    if (!usage?.messageCounts || usage.messageCounts.total === 0) {
      continue;
    }
    const start = usage.firstActivity ?? session.updatedAt;
    const end = usage.lastActivity ?? session.updatedAt;
    if (!start || !end) {
      continue;
    }
    const startMs = Math.min(start, end);
    const endMs = Math.max(start, end);
    const durationMs = Math.max(endMs - startMs, 1);
    const totalMinutes = durationMs / 60000;

    let cursor = startMs;
    while (cursor < endMs) {
      const date = new Date(cursor);
      const hour = getZonedHour(date, timeZone);
      const nextHour = setToHourEnd(date, timeZone);
      const nextMs = Math.min(nextHour.getTime(), endMs);
      const minutes = Math.max((nextMs - cursor) / 60000, 0);
      const share = minutes / totalMinutes;
      hourErrors[hour] += usage.messageCounts.errors * share;
      hourMessages[hour] += usage.messageCounts.total * share;
      cursor = nextMs + 1;
    }
  }

  return hourMessages
    .map((messages, hour) => ({
      hour,
      messages,
      errors: hourErrors[hour],
      rate: messages > 0 ? hourErrors[hour] / messages : 0,
    }))
    .filter((entry) => entry.messages > 0 && entry.errors > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)
    .map((entry) => ({
      label: formatHourLabel(entry.hour),
      value: `${(entry.rate * 100).toFixed(2)}%`,
      sub: `${Math.round(entry.errors)} errors · ${Math.round(entry.messages)} msgs`,
    }));
}

export function buildAggregatesFromSessions(
  sessions: UsageSessionEntry[],
  fallback?: UsageAggregates | null,
): UsageAggregates {
  if (sessions.length === 0) {
    return (
      fallback ?? {
        messages: { total: 0, user: 0, assistant: 0, toolCalls: 0, toolResults: 0, errors: 0 },
        tools: { totalCalls: 0, uniqueTools: 0, tools: [] },
        byModel: [],
        byProvider: [],
        byAgent: [],
        byChannel: [],
        daily: [],
      }
    );
  }

  const messages = {
    total: 0,
    user: 0,
    assistant: 0,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  };
  const toolMap = new Map<string, number>();
  const modelMap = new Map<string, { provider?: string; model?: string; count: number; totals: CostUsageTotals }>();
  const providerMap = new Map<string, { provider?: string; model?: string; count: number; totals: CostUsageTotals }>();
  const agentMap = new Map<string, CostUsageTotals>();
  const channelMap = new Map<string, CostUsageTotals>();
  const dailyMap = new Map<
    string,
    { date: string; tokens: number; cost: number; messages: number; toolCalls: number; errors: number }
  >();

  for (const session of sessions) {
    const usage = session.usage;
    if (!usage) {
      continue;
    }
    if (usage.messageCounts) {
      messages.total += usage.messageCounts.total;
      messages.user += usage.messageCounts.user;
      messages.assistant += usage.messageCounts.assistant;
      messages.toolCalls += usage.messageCounts.toolCalls;
      messages.toolResults += usage.messageCounts.toolResults;
      messages.errors += usage.messageCounts.errors;
    }
    if (usage.toolUsage) {
      for (const tool of usage.toolUsage.tools) {
        toolMap.set(tool.name, (toolMap.get(tool.name) ?? 0) + tool.count);
      }
    }
    if (usage.modelUsage) {
      for (const entry of usage.modelUsage) {
        const modelKey = `${entry.provider ?? "unknown"}::${entry.model ?? "unknown"}`;
        const modelItem = modelMap.get(modelKey) ?? {
          provider: entry.provider,
          model: entry.model,
          count: 0,
          totals: createEmptyUsageTotals(),
        };
        modelItem.count += entry.count;
        addUsageTotals(modelItem.totals, entry.totals);
        modelMap.set(modelKey, modelItem);

        const providerKey = entry.provider ?? "unknown";
        const providerItem = providerMap.get(providerKey) ?? {
          provider: entry.provider,
          model: undefined,
          count: 0,
          totals: createEmptyUsageTotals(),
        };
        providerItem.count += entry.count;
        addUsageTotals(providerItem.totals, entry.totals);
        providerMap.set(providerKey, providerItem);
      }
    }
    if (session.agentId) {
      const totals = agentMap.get(session.agentId) ?? createEmptyUsageTotals();
      addUsageTotals(totals, usage);
      agentMap.set(session.agentId, totals);
    }
    if (session.channel) {
      const totals = channelMap.get(session.channel) ?? createEmptyUsageTotals();
      addUsageTotals(totals, usage);
      channelMap.set(session.channel, totals);
    }
    for (const day of usage.dailyBreakdown ?? []) {
      const daily = dailyMap.get(day.date) ?? {
        date: day.date,
        tokens: 0,
        cost: 0,
        messages: 0,
        toolCalls: 0,
        errors: 0,
      };
      daily.tokens += day.tokens;
      daily.cost += day.cost;
      dailyMap.set(day.date, daily);
    }
    for (const day of usage.dailyMessageCounts ?? []) {
      const daily = dailyMap.get(day.date) ?? {
        date: day.date,
        tokens: 0,
        cost: 0,
        messages: 0,
        toolCalls: 0,
        errors: 0,
      };
      daily.messages += day.total;
      daily.toolCalls += day.toolCalls;
      daily.errors += day.errors;
      dailyMap.set(day.date, daily);
    }
  }

  return {
    messages,
    tools: {
      totalCalls: Array.from(toolMap.values()).reduce((sum, count) => sum + count, 0),
      uniqueTools: toolMap.size,
      tools: Array.from(toolMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    byModel: Array.from(modelMap.values()).sort((a, b) => b.totals.totalCost - a.totals.totalCost),
    byProvider: Array.from(providerMap.values()).sort(
      (a, b) => b.totals.totalCost - a.totals.totalCost,
    ),
    byAgent: Array.from(agentMap.entries())
      .map(([agentId, totals]) => ({ agentId, totals }))
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost),
    byChannel: Array.from(channelMap.entries())
      .map(([channel, totals]) => ({ channel, totals }))
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost),
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function buildUsageInsightStats(
  sessions: UsageSessionEntry[],
  totals: CostUsageTotals | null,
  aggregates: UsageAggregates,
): UsageInsightStats {
  let durationSumMs = 0;
  let durationCount = 0;
  for (const session of sessions) {
    const duration = session.usage?.durationMs ?? 0;
    if (duration > 0) {
      durationSumMs += duration;
      durationCount += 1;
    }
  }

  const avgDurationMs = durationCount ? durationSumMs / durationCount : 0;
  const throughputTokensPerMin =
    totals && durationSumMs > 0 ? totals.totalTokens / (durationSumMs / 60000) : undefined;
  const throughputCostPerMin =
    totals && durationSumMs > 0 ? totals.totalCost / (durationSumMs / 60000) : undefined;
  const errorRate = aggregates.messages.total
    ? aggregates.messages.errors / aggregates.messages.total
    : 0;
  const peakErrorDay = aggregates.daily
    .filter((day) => day.messages > 0 && day.errors > 0)
    .map((day) => ({
      date: day.date,
      errors: day.errors,
      messages: day.messages,
      rate: day.errors / day.messages,
    }))
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)[0];

  return {
    durationSumMs,
    durationCount,
    avgDurationMs,
    throughputTokensPerMin,
    throughputCostPerMin,
    errorRate,
    peakErrorDay,
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsvRow(values: Array<string | number | undefined | null>): string {
  return values
    .map((value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return csvEscape(String(value));
    })
    .join(",");
}

export function downloadTextFile(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildSessionsCsv(sessions: UsageSessionEntry[]): string {
  const rows = [
    toCsvRow([
      "key",
      "label",
      "agentId",
      "channel",
      "provider",
      "model",
      "updatedAt",
      "durationMs",
      "messages",
      "errors",
      "toolCalls",
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
      "totalTokens",
      "totalCost",
    ]),
  ];

  for (const session of sessions) {
    const usage = session.usage;
    rows.push(
      toCsvRow([
        session.key,
        session.label ?? "",
        session.agentId ?? "",
        session.channel ?? "",
        session.modelProvider ?? session.providerOverride ?? "",
        session.model ?? session.modelOverride ?? "",
        session.updatedAt ? new Date(session.updatedAt).toISOString() : "",
        usage?.durationMs ?? "",
        usage?.messageCounts?.total ?? "",
        usage?.messageCounts?.errors ?? "",
        usage?.messageCounts?.toolCalls ?? "",
        usage?.input ?? "",
        usage?.output ?? "",
        usage?.cacheRead ?? "",
        usage?.cacheWrite ?? "",
        usage?.totalTokens ?? "",
        usage?.totalCost ?? "",
      ]),
    );
  }

  return rows.join("\n");
}

export function buildDailyCsv(daily: CostUsageDailyEntry[]): string {
  const rows = [
    toCsvRow([
      "date",
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
      "totalTokens",
      "inputCost",
      "outputCost",
      "cacheReadCost",
      "cacheWriteCost",
      "totalCost",
    ]),
  ];

  for (const day of daily) {
    rows.push(
      toCsvRow([
        day.date,
        day.input,
        day.output,
        day.cacheRead,
        day.cacheWrite,
        day.totalTokens,
        day.inputCost,
        day.outputCost,
        day.cacheReadCost,
        day.cacheWriteCost,
        day.totalCost,
      ]),
    );
  }

  return rows.join("\n");
}

export function normalizeQueryText(value: string): string {
  return value.trim().toLowerCase();
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function parseQueryNumber(value: string): number | null {
  let raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("$")) {
    raw = raw.slice(1);
  }
  let multiplier = 1;
  if (raw.endsWith("k")) {
    multiplier = 1_000;
    raw = raw.slice(0, -1);
  } else if (raw.endsWith("m")) {
    multiplier = 1_000_000;
    raw = raw.slice(0, -1);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed * multiplier;
}

export function extractQueryTerms(query: string): UsageQueryTerm[] {
  const rawTokens = query.match(/"[^"]+"|\S+/g) ?? [];
  return rawTokens.map((token) => {
    const cleaned = token.replace(/^"|"$/g, "");
    const index = cleaned.indexOf(":");
    if (index > 0) {
      return {
        key: cleaned.slice(0, index),
        value: cleaned.slice(index + 1),
        raw: cleaned,
      };
    }
    return { value: cleaned, raw: cleaned };
  });
}

function getSessionText(session: UsageSessionQueryTarget): string[] {
  return [session.label, session.key, session.sessionId]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.toLowerCase());
}

function getSessionProviders(session: UsageSessionQueryTarget): string[] {
  const providers = new Set<string>();
  if (session.modelProvider) {
    providers.add(session.modelProvider.toLowerCase());
  }
  if (session.providerOverride) {
    providers.add(session.providerOverride.toLowerCase());
  }
  if (session.origin?.provider) {
    providers.add(session.origin.provider.toLowerCase());
  }
  for (const entry of session.usage?.modelUsage ?? []) {
    if (entry.provider) {
      providers.add(entry.provider.toLowerCase());
    }
  }
  return Array.from(providers);
}

function getSessionModels(session: UsageSessionQueryTarget): string[] {
  const models = new Set<string>();
  if (session.model) {
    models.add(session.model.toLowerCase());
  }
  for (const entry of session.usage?.modelUsage ?? []) {
    if (entry.model) {
      models.add(entry.model.toLowerCase());
    }
  }
  return Array.from(models);
}

function getSessionTools(session: UsageSessionQueryTarget): string[] {
  return (session.usage?.toolUsage?.tools ?? []).map((tool) => tool.name.toLowerCase());
}

export function matchesUsageQuery(
  session: UsageSessionQueryTarget,
  term: UsageQueryTerm,
): boolean {
  const value = normalizeQueryText(term.value ?? "");
  if (!value) {
    return true;
  }
  if (!term.key) {
    return getSessionText(session).some((text) => text.includes(value));
  }

  const key = normalizeQueryText(term.key);
  switch (key) {
    case "agent":
      return session.agentId?.toLowerCase().includes(value) ?? false;
    case "channel":
      return session.channel?.toLowerCase().includes(value) ?? false;
    case "chat":
      return session.chatType?.toLowerCase().includes(value) ?? false;
    case "provider":
      return getSessionProviders(session).some((provider) => provider.includes(value));
    case "model":
      return getSessionModels(session).some((model) => model.includes(value));
    case "tool":
      return getSessionTools(session).some((tool) => tool.includes(value));
    case "label":
      return session.label?.toLowerCase().includes(value) ?? false;
    case "key":
    case "session":
    case "id":
      if (value.includes("*") || value.includes("?")) {
        const regex = globToRegex(value);
        return regex.test(session.key) || (session.sessionId ? regex.test(session.sessionId) : false);
      }
      return (
        session.key.toLowerCase().includes(value) ||
        (session.sessionId?.toLowerCase().includes(value) ?? false)
      );
    case "has":
      switch (value) {
        case "tools":
          return (session.usage?.toolUsage?.totalCalls ?? 0) > 0;
        case "errors":
          return (session.usage?.messageCounts?.errors ?? 0) > 0;
        case "context":
          return Boolean(session.contextWeight);
        case "usage":
          return Boolean(session.usage);
        case "model":
          return getSessionModels(session).length > 0;
        case "provider":
          return getSessionProviders(session).length > 0;
        default:
          return true;
      }
    case "mintokens": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.totalTokens ?? 0) >= threshold;
    }
    case "maxtokens": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.totalTokens ?? 0) <= threshold;
    }
    case "mincost": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.totalCost ?? 0) >= threshold;
    }
    case "maxcost": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.totalCost ?? 0) <= threshold;
    }
    case "minmessages": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.messageCounts?.total ?? 0) >= threshold;
    }
    case "maxmessages": {
      const threshold = parseQueryNumber(value);
      if (threshold === null) {
        return true;
      }
      return (session.usage?.messageCounts?.total ?? 0) <= threshold;
    }
    default:
      return true;
  }
}

export function filterSessionsByQuery<TSession extends UsageSessionQueryTarget>(
  sessions: TSession[],
  query: string,
): UsageQueryResult<TSession> {
  const terms = extractQueryTerms(query);
  if (terms.length === 0) {
    return { sessions, warnings: [] };
  }

  const warnings: string[] = [];
  for (const term of terms) {
    if (!term.key) {
      continue;
    }
    const normalizedKey = normalizeQueryText(term.key);
    if (!QUERY_KEYS.has(normalizedKey)) {
      warnings.push(`Unknown filter: ${term.key}`);
      continue;
    }
    if (term.value === "") {
      warnings.push(`Missing value for ${term.key}`);
    }
    if (normalizedKey === "has") {
      const allowed = new Set(["tools", "errors", "context", "usage", "model", "provider"]);
      if (term.value && !allowed.has(normalizeQueryText(term.value))) {
        warnings.push(`Unknown has:${term.value}`);
      }
    }
    if (
      ["mintokens", "maxtokens", "mincost", "maxcost", "minmessages", "maxmessages"].includes(
        normalizedKey,
      ) &&
      term.value &&
      parseQueryNumber(term.value) === null
    ) {
      warnings.push(`Invalid number for ${term.key}`);
    }
  }

  return {
    warnings,
    sessions: sessions.filter((session) => terms.every((term) => matchesUsageQuery(session, term))),
  };
}

export function parseToolSummary(content: string) {
  const lines = content.split("\n");
  const toolCounts = new Map<string, number>();
  const nonToolLines: string[] = [];

  for (const line of lines) {
    const match = /^\[Tool:\s*([^\]]+)\]/.exec(line.trim());
    if (match) {
      const name = match[1];
      toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
      continue;
    }
    if (line.trim().startsWith("[Tool Result]")) {
      continue;
    }
    nonToolLines.push(line);
  }

  const tools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]);
  const totalCalls = tools.reduce((sum, [, count]) => sum + count, 0);
  return {
    tools,
    summary:
      tools.length > 0
        ? `Tools: ${tools.map(([name, count]) => `${name}×${count}`).join(", ")} (${totalCalls} calls)`
        : "",
    cleanContent: nonToolLines.join("\n").trim(),
  };
}

export function buildQuerySuggestions(
  query: string,
  sessions: UsageSessionEntry[],
  aggregates?: UsageAggregates | null,
): QuerySuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const tokens = trimmed.length ? trimmed.split(/\s+/) : [];
  const lastToken = tokens.length ? tokens[tokens.length - 1] : "";
  const [rawKey, rawValue] = lastToken.includes(":")
    ? [lastToken.slice(0, lastToken.indexOf(":")), lastToken.slice(lastToken.indexOf(":") + 1)]
    : ["", ""];

  const key = rawKey.toLowerCase();
  const value = rawValue.toLowerCase();

  const unique = (items: Array<string | undefined>): string[] => {
    const set = new Set<string>();
    for (const item of items) {
      if (item) {
        set.add(item);
      }
    }
    return Array.from(set);
  };

  const agents = unique(sessions.map((session) => session.agentId)).slice(0, 6);
  const channels = unique(sessions.map((session) => session.channel)).slice(0, 6);
  const providers = unique([
    ...sessions.map((session) => session.modelProvider),
    ...sessions.map((session) => session.providerOverride),
    ...(aggregates?.byProvider.map((entry) => entry.provider) ?? []),
  ]).slice(0, 6);
  const models = unique([
    ...sessions.map((session) => session.model),
    ...(aggregates?.byModel.map((entry) => entry.model) ?? []),
  ]).slice(0, 6);
  const tools = unique(aggregates?.tools.tools.map((tool) => tool.name) ?? []).slice(0, 6);

  if (!key) {
    return [
      { label: "agent:", value: "agent:" },
      { label: "channel:", value: "channel:" },
      { label: "provider:", value: "provider:" },
      { label: "model:", value: "model:" },
      { label: "tool:", value: "tool:" },
      { label: "has:errors", value: "has:errors" },
      { label: "has:tools", value: "has:tools" },
      { label: "minTokens:", value: "minTokens:" },
      { label: "maxCost:", value: "maxCost:" },
    ];
  }

  const suggestions: QuerySuggestion[] = [];
  const addValues = (prefix: string, values: string[]) => {
    for (const entry of values) {
      if (!value || entry.toLowerCase().includes(value)) {
        suggestions.push({ label: `${prefix}:${entry}`, value: `${prefix}:${entry}` });
      }
    }
  };

  switch (key) {
    case "agent":
      addValues("agent", agents);
      break;
    case "channel":
      addValues("channel", channels);
      break;
    case "provider":
      addValues("provider", providers);
      break;
    case "model":
      addValues("model", models);
      break;
    case "tool":
      addValues("tool", tools);
      break;
    case "has":
      for (const entry of ["errors", "tools", "context", "usage", "model", "provider"]) {
        if (!value || entry.includes(value)) {
          suggestions.push({ label: `has:${entry}`, value: `has:${entry}` });
        }
      }
      break;
    default:
      break;
  }

  return suggestions;
}

export function applySuggestionToQuery(query: string, suggestion: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return `${suggestion} `;
  }
  const tokens = trimmed.split(/\s+/);
  tokens[tokens.length - 1] = suggestion;
  return `${tokens.join(" ")} `;
}

export function addQueryToken(query: string, token: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return `${token} `;
  }
  const tokens = trimmed.split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";
  const tokenKey = token.includes(":") ? token.split(":")[0] : null;
  const lastKey = last.includes(":") ? last.split(":")[0] : null;
  if (last.endsWith(":") && tokenKey && lastKey === tokenKey) {
    tokens[tokens.length - 1] = token;
    return `${tokens.join(" ")} `;
  }
  if (tokens.includes(token)) {
    return `${tokens.join(" ")} `;
  }
  return `${tokens.join(" ")} ${token} `;
}

export function removeQueryToken(query: string, token: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const next = tokens.filter((entry) => entry !== token);
  return next.length ? `${next.join(" ")} ` : "";
}

export function setQueryTokensForKey(query: string, key: string, values: string[]): string {
  const normalizedKey = normalizeQueryText(key);
  const tokens = extractQueryTerms(query)
    .filter((term) => normalizeQueryText(term.key ?? "") !== normalizedKey)
    .map((term) => term.raw);
  const next = [...tokens, ...values.map((value) => `${key}:${value}`)];
  return next.length ? `${next.join(" ")} ` : "";
}

export function normalizeLogTimestamp(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

export function filterLogsByRange(
  logs: SessionLogEntry[],
  rangeStart: number,
  rangeEnd: number,
): SessionLogEntry[] {
  const low = Math.min(rangeStart, rangeEnd);
  const high = Math.max(rangeStart, rangeEnd);
  return logs.filter((log) => {
    if (log.timestamp <= 0) {
      return true;
    }
    const normalized = normalizeLogTimestamp(log.timestamp);
    return normalized >= low && normalized <= high;
  });
}

export function computeFilteredUsage(
  baseUsage: NonNullable<UsageSessionEntry["usage"]>,
  points: SessionUsageTimePoint[],
  rangeStart: number,
  rangeEnd: number,
): UsageSessionEntry["usage"] | undefined {
  const low = Math.min(rangeStart, rangeEnd);
  const high = Math.max(rangeStart, rangeEnd);
  const filtered = points.filter((point) => point.timestamp >= low && point.timestamp <= high);
  if (filtered.length === 0) {
    return undefined;
  }

  let totalTokens = 0;
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let userMessages = 0;
  let assistantMessages = 0;

  for (const point of filtered) {
    totalTokens += point.totalTokens || 0;
    totalCost += point.cost || 0;
    totalInput += point.input || 0;
    totalOutput += point.output || 0;
    totalCacheRead += point.cacheRead || 0;
    totalCacheWrite += point.cacheWrite || 0;
    if (point.input > 0) {
      userMessages += 1;
    }
    if (point.output > 0) {
      assistantMessages += 1;
    }
  }

  return {
    ...baseUsage,
    totalTokens,
    totalCost,
    input: totalInput,
    output: totalOutput,
    cacheRead: totalCacheRead,
    cacheWrite: totalCacheWrite,
    durationMs: filtered[filtered.length - 1].timestamp - filtered[0].timestamp,
    firstActivity: filtered[0].timestamp,
    lastActivity: filtered[filtered.length - 1].timestamp,
    messageCounts: {
      total: filtered.length,
      user: userMessages,
      assistant: assistantMessages,
      toolCalls: 0,
      toolResults: 0,
      errors: 0,
    },
  };
}

export function buildTypeBreakdown(total: CostUsageTotals, mode: "tokens" | "cost") {
  if (mode === "tokens") {
    const totalTokens = total.totalTokens || 1;
    return [
      { key: "output", label: "Output", value: total.output, percentage: pct(total.output, totalTokens) },
      { key: "input", label: "Input", value: total.input, percentage: pct(total.input, totalTokens) },
      {
        key: "cacheWrite",
        label: "Cache write",
        value: total.cacheWrite,
        percentage: pct(total.cacheWrite, totalTokens),
      },
      {
        key: "cacheRead",
        label: "Cache read",
        value: total.cacheRead,
        percentage: pct(total.cacheRead, totalTokens),
      },
    ];
  }

  const totalCost = total.totalCost || 1;
  return [
    {
      key: "output",
      label: "Output",
      value: total.outputCost,
      percentage: pct(total.outputCost, totalCost),
    },
    {
      key: "input",
      label: "Input",
      value: total.inputCost,
      percentage: pct(total.inputCost, totalCost),
    },
    {
      key: "cacheWrite",
      label: "Cache write",
      value: total.cacheWriteCost,
      percentage: pct(total.cacheWriteCost, totalCost),
    },
    {
      key: "cacheRead",
      label: "Cache read",
      value: total.cacheReadCost,
      percentage: pct(total.cacheReadCost, totalCost),
    },
  ];
}
