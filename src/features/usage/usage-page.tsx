import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { axisClasses, BarChart, LineChart } from "@mui/x-charts";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Download,
  Filter,
  LoaderCircle,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useGateway } from "@/hooks/use-gateway";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  loadSessionLogs,
  loadSessionTimeSeries,
  loadUsageSnapshot,
  toErrorMessage,
} from "./usage-data";
import type {
  CostUsageDailyEntry,
  CostUsageTotals,
  SessionLogEntry,
  SessionLogRole,
  SessionUsageTimePoint,
  SessionUsageTimeSeries,
  UsageAggregates,
  UsageChartMode,
  UsageColumnId,
  UsageDailyChartMode,
  UsageSessionEntry,
  UsageSessionSort,
  UsageSessionsTab,
  UsageTimeSeriesBreakdownMode,
  UsageTimeSeriesMode,
} from "./types";
import {
  DEFAULT_VISIBLE_COLUMNS,
  addQueryToken,
  addUsageTotals,
  applySuggestionToQuery,
  buildAggregatesFromSessions,
  buildDailyCsv,
  buildPeakErrorHours,
  buildQuerySuggestions,
  buildSessionsCsv,
  buildTypeBreakdown,
  buildUsageInsightStats,
  buildUsageMosaicStats,
  charsToTokens,
  computeFilteredUsage,
  createEmptyUsageTotals,
  downloadTextFile,
  extractQueryTerms,
  filterLogsByRange,
  filterSessionsByQuery,
  formatCost,
  formatDayLabel,
  formatDurationCompact,
  formatFullDate,
  formatIsoDate,
  formatTokens,
  getZonedHour,
  normalizeQueryText,
  parseToolSummary,
  removeQueryToken,
  setQueryTokensForKey,
  setToHourEnd,
} from "./usage-utils";

type UsageViewState = {
  loading: boolean;
  usageResult: { sessions: UsageSessionEntry[]; totals: CostUsageTotals; aggregates: UsageAggregates } | null;
  costSummary: { daily: CostUsageDailyEntry[]; totals: CostUsageTotals } | null;
  error: string | null;
  startDate: string;
  endDate: string;
  selectedSessions: string[];
  selectedDays: string[];
  selectedHours: number[];
  chartMode: UsageChartMode;
  dailyChartMode: UsageDailyChartMode;
  timeSeriesMode: UsageTimeSeriesMode;
  timeSeriesBreakdownMode: UsageTimeSeriesBreakdownMode;
  timeSeries: SessionUsageTimeSeries | null;
  timeSeriesLoading: boolean;
  timeSeriesCursorStart: number | null;
  timeSeriesCursorEnd: number | null;
  sessionLogs: SessionLogEntry[] | null;
  sessionLogsLoading: boolean;
  sessionLogsExpanded: boolean;
  query: string;
  queryDraft: string;
  sessionSort: UsageSessionSort;
  sessionSortDir: "asc" | "desc";
  recentSessions: string[];
  timeZone: "local" | "utc";
  contextExpanded: boolean;
  headerPinned: boolean;
  sessionsTab: UsageSessionsTab;
  visibleColumns: UsageColumnId[];
  logFilterRoles: SessionLogRole[];
  logFilterTools: string[];
  logFilterHasTools: boolean;
  logFilterQuery: string;
};

const DEFAULT_RECENT_LIMIT = 8;
const DEFAULT_DETAIL_STATE = {
  timeSeries: null,
  timeSeriesLoading: false,
  timeSeriesCursorStart: null,
  timeSeriesCursorEnd: null,
  sessionLogs: null,
  sessionLogsLoading: false,
  sessionLogsExpanded: false,
  contextExpanded: false,
  logFilterRoles: [],
  logFilterTools: [],
  logFilterHasTools: false,
  logFilterQuery: "",
} satisfies Partial<UsageViewState>;

const CHART_SX = {
  [`& .${axisClasses.line}`]: {
    stroke: "rgba(100, 116, 139, 0.18)",
  },
  [`& .${axisClasses.tick}`]: {
    stroke: "rgba(100, 116, 139, 0.18)",
  },
  [`& .${axisClasses.tickLabel}`]: {
    fill: "rgba(71, 85, 105, 0.9)",
    fontFamily: "inherit",
    fontSize: 11,
  },
  "& .MuiChartsGrid-line": {
    stroke: "rgba(100, 116, 139, 0.14)",
  },
  "& .MuiChartsAxisHighlight-root": {
    stroke: "rgba(59, 130, 246, 0.25)",
    strokeDasharray: "6 6",
  },
};

function createInitialState(): UsageViewState {
  const today = formatIsoDate(new Date());
  return {
    loading: false,
    usageResult: null,
    costSummary: null,
    error: null,
    startDate: today,
    endDate: today,
    selectedSessions: [],
    selectedDays: [],
    selectedHours: [],
    chartMode: "tokens",
    dailyChartMode: "by-type",
    timeSeriesMode: "per-turn",
    timeSeriesBreakdownMode: "by-type",
    timeSeries: null,
    timeSeriesLoading: false,
    timeSeriesCursorStart: null,
    timeSeriesCursorEnd: null,
    sessionLogs: null,
    sessionLogsLoading: false,
    sessionLogsExpanded: false,
    query: "",
    queryDraft: "",
    sessionSort: "recent",
    sessionSortDir: "desc",
    recentSessions: [],
    timeZone: "local",
    contextExpanded: false,
    headerPinned: true,
    sessionsTab: "all",
    visibleColumns: DEFAULT_VISIBLE_COLUMNS,
    logFilterRoles: [],
    logFilterTools: [],
    logFilterHasTools: false,
    logFilterQuery: "",
  };
}

function createClearedFilterState(): Partial<UsageViewState> {
  return {
    selectedSessions: [],
    selectedDays: [],
    selectedHours: [],
    ...DEFAULT_DETAIL_STATE,
  };
}

function UsageSummaryCard({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: string;
  sub: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight",
            tone === "good" && "text-emerald-600",
            tone === "warn" && "text-amber-600",
            tone === "bad" && "text-rose-600",
          )}
        >
          {value}
        </div>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function InsightListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; value: string; sub?: string }>;
  emptyLabel: string;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((item) => (
              <div key={`${title}-${item.label}`} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.label}</div>
                  {item.sub ? <div className="text-sm text-muted-foreground">{item.sub}</div> : null}
                </div>
                <div className="shrink-0 text-sm font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="outline" className="gap-2 rounded-full px-3 py-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function QueryFilterMenu({
  label,
  options,
  selectedValues,
  onToggle,
  onSelectAll,
  onClear,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string, nextChecked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (options.length === 0) {
    return null;
  }
  const normalizedSelected = new Set(selectedValues.map((value) => normalizeQueryText(value)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="size-3.5" />
          {label}
          <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
            {selectedValues.length || "All"}
          </Badge>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">{options.length} options</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={onSelectAll}>
          Select all
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={onClear}>
          Clear
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={`${label}-${option}`}
            checked={normalizedSelected.has(normalizeQueryText(option))}
            onCheckedChange={(checked) => onToggle(option, Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UsageMosaicCard({
  sessions,
  timeZone,
  selectedHours,
  onSelectHour,
}: {
  sessions: UsageSessionEntry[];
  timeZone: "local" | "utc";
  selectedHours: number[];
  onSelectHour: (hour: number, shiftKey: boolean) => void;
}) {
  const stats = buildUsageMosaicStats(sessions, timeZone);
  const maxHour = Math.max(...stats.hourTotals, 1);
  const maxWeekday = Math.max(...stats.weekdayTotals.map((entry) => entry.tokens), 1);

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Activity by time</CardTitle>
            <CardDescription>
              Estimated from each session&apos;s first and last activity. Time zone:{" "}
              {timeZone === "utc" ? "UTC" : "Local"}.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            {formatTokens(stats.totalTokens)} tokens
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.4fr]">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Day of week
          </div>
          {stats.hasData ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {stats.weekdayTotals.map((entry) => {
                const intensity = Math.min(entry.tokens / maxWeekday, 1);
                return (
                  <div
                    key={entry.label}
                    className="rounded-2xl border border-rose-200/60 p-3"
                    style={{
                      background: `rgba(244, 63, 94, ${0.08 + intensity * 0.32})`,
                    }}
                  >
                    <div className="text-sm font-medium">{entry.label}</div>
                    <div className="mt-2 text-lg font-semibold">{formatTokens(entry.tokens)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No timeline data yet.
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hours
            </div>
            <div className="text-xs text-muted-foreground">Shift-click to select a range</div>
          </div>
          {stats.hasData ? (
            <>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
                {stats.hourTotals.map((value, hour) => {
                  const intensity = Math.min(value / maxHour, 1);
                  const selected = selectedHours.includes(hour);
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={(event) => onSelectHour(hour, event.shiftKey)}
                      className={cn(
                        "group flex aspect-square min-h-[52px] flex-col items-start justify-between rounded-2xl border p-2 text-left transition-transform hover:-translate-y-0.5",
                        selected
                          ? "border-rose-500 shadow-[0_10px_30px_-18px_rgba(244,63,94,0.85)]"
                          : "border-border/70",
                      )}
                      style={{
                        background: `rgba(244, 63, 94, ${0.05 + intensity * 0.42})`,
                      }}
                      title={`${hour}:00 · ${formatTokens(value)} tokens`}
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {hour.toString().padStart(2, "0")}
                      </span>
                      <span className="text-sm font-semibold">{formatTokens(value)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Midnight</span>
                <span>06:00</span>
                <span>Noon</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No timeline data yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CostBreakdownCard({
  totals,
  mode,
}: {
  totals: CostUsageTotals;
  mode: UsageChartMode;
}) {
  const breakdown = buildTypeBreakdown(totals, mode);
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-xl">{mode === "tokens" ? "Tokens" : "Cost"} by type</CardTitle>
        <CardDescription>
          The mix of output, input, cache writes, and cache reads for the current selection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="flex h-5 overflow-hidden rounded-full bg-muted">
          {breakdown.map((item) => (
            <div
              key={item.key}
              className={cn(
                item.key === "output" && "bg-rose-500",
                item.key === "input" && "bg-sky-500",
                item.key === "cacheWrite" && "bg-amber-500",
                item.key === "cacheRead" && "bg-emerald-500",
              )}
              style={{ width: `${item.percentage.toFixed(1)}%` }}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {breakdown.map((item) => (
            <div key={item.key} className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-2 text-xl font-semibold">
                {mode === "tokens" ? formatTokens(item.value) : formatCost(item.value)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{item.percentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DailyUsageCard({
  daily,
  selectedDays,
  chartMode,
  dailyChartMode,
  onChartModeChange,
  onSelectDay,
}: {
  daily: CostUsageDailyEntry[];
  selectedDays: string[];
  chartMode: UsageChartMode;
  dailyChartMode: UsageDailyChartMode;
  onChartModeChange: (mode: UsageDailyChartMode) => void;
  onSelectDay: (day: string, shiftKey: boolean) => void;
}) {
  const xAxisData = daily.map((entry) => entry.date);
  const highlighted = new Set(selectedDays);
  const onItemClick = (
    event: React.MouseEvent<SVGElement, MouseEvent>,
    item: { dataIndex: number },
  ) => {
    const entry = daily[item.dataIndex];
    if (!entry) {
      return;
    }
    onSelectDay(entry.date, event.shiftKey);
  };

  const totalSeries =
    chartMode === "tokens"
      ? [{ data: daily.map((entry) => entry.totalTokens), label: "Tokens", color: "#e11d48" }]
      : [{ data: daily.map((entry) => entry.totalCost), label: "Cost", color: "#e11d48" }];

  const stackedSeries =
    chartMode === "tokens"
      ? [
          { data: daily.map((entry) => entry.output), label: "Output", color: "#e11d48", stack: "usage" },
          { data: daily.map((entry) => entry.input), label: "Input", color: "#0ea5e9", stack: "usage" },
          {
            data: daily.map((entry) => entry.cacheWrite),
            label: "Cache write",
            color: "#f59e0b",
            stack: "usage",
          },
          {
            data: daily.map((entry) => entry.cacheRead),
            label: "Cache read",
            color: "#10b981",
            stack: "usage",
          },
        ]
      : [
          {
            data: daily.map((entry) => entry.outputCost),
            label: "Output",
            color: "#e11d48",
            stack: "usage",
          },
          {
            data: daily.map((entry) => entry.inputCost),
            label: "Input",
            color: "#0ea5e9",
            stack: "usage",
          },
          {
            data: daily.map((entry) => entry.cacheWriteCost),
            label: "Cache write",
            color: "#f59e0b",
            stack: "usage",
          },
          {
            data: daily.map((entry) => entry.cacheReadCost),
            label: "Cache read",
            color: "#10b981",
            stack: "usage",
          },
        ];

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">
              Daily {chartMode === "tokens" ? "token" : "cost"} usage
            </CardTitle>
            <CardDescription>
              Click a bar to filter a day, or shift-click to select a range of days.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={dailyChartMode === "total" ? "default" : "outline"}
              size="sm"
              onClick={() => onChartModeChange("total")}
            >
              Total
            </Button>
            <Button
              variant={dailyChartMode === "by-type" ? "default" : "outline"}
              size="sm"
              onClick={() => onChartModeChange("by-type")}
            >
              By type
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {daily.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No daily data for the current selection.</div>
        ) : (
          <>
            <div className="h-[300px] w-full overflow-hidden rounded-b-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(248,250,252,0.95))] px-2 pt-4">
              <BarChart
                height={300}
                xAxis={[
                  {
                    data: xAxisData,
                    scaleType: "band",
                    valueFormatter: (value: string | number | Date | null) =>
                      formatDayLabel(String(value ?? "")),
                    tickLabelStyle: {
                      angle: xAxisData.length > 14 ? -35 : 0,
                      textAnchor: xAxisData.length > 14 ? "end" : "middle",
                    },
                  },
                ]}
                yAxis={[
                  {
                    valueFormatter: (value: number | null) =>
                      chartMode === "tokens"
                        ? formatTokens(Number(value ?? 0))
                        : formatCost(Number(value ?? 0), 2),
                  },
                ]}
                grid={{ horizontal: true }}
                hideLegend={dailyChartMode === "total"}
                axisHighlight={{ x: "band" }}
                series={dailyChartMode === "total" ? totalSeries : stackedSeries}
                onItemClick={onItemClick}
                sx={CHART_SX}
              />
            </div>
            {selectedDays.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-6 pb-6">
                {daily
                  .filter((entry) => highlighted.has(entry.date))
                  .map((entry) => (
                    <FilterChip
                      key={entry.date}
                      label={formatFullDate(entry.date)}
                      onRemove={() => onSelectDay(entry.date, false)}
                    />
                  ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SessionLogsCard({
  logs,
  loading,
  expandedAll,
  filters,
  onToggleExpandedAll,
  onRolesChange,
  onToolsChange,
  onHasToolsChange,
  onQueryChange,
  onClearFilters,
  cursorStart,
  cursorEnd,
}: {
  logs: SessionLogEntry[] | null;
  loading: boolean;
  expandedAll: boolean;
  filters: {
    roles: SessionLogRole[];
    tools: string[];
    hasTools: boolean;
    query: string;
  };
  onToggleExpandedAll: () => void;
  onRolesChange: (roles: SessionLogRole[]) => void;
  onToolsChange: (tools: string[]) => void;
  onHasToolsChange: (value: boolean) => void;
  onQueryChange: (query: string) => void;
  onClearFilters: () => void;
  cursorStart: number | null;
  cursorEnd: number | null;
}) {
  const entries = (logs ?? []).map((log) => {
    const toolInfo = parseToolSummary(log.content);
    const cleanContent = toolInfo.cleanContent || log.content;
    return { log, toolInfo, cleanContent };
  });
  const toolOptions = Array.from(
    new Set(entries.flatMap((entry) => entry.toolInfo.tools.map(([name]) => name))),
  ).sort((a, b) => a.localeCompare(b));
  const normalizedQuery = filters.query.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    if (cursorStart != null && cursorEnd != null && entry.log.timestamp > 0) {
      const low = Math.min(cursorStart, cursorEnd);
      const high = Math.max(cursorStart, cursorEnd);
      const timestamp = entry.log.timestamp < 1e12 ? entry.log.timestamp * 1000 : entry.log.timestamp;
      if (timestamp < low || timestamp > high) {
        return false;
      }
    }
    if (filters.roles.length > 0 && !filters.roles.includes(entry.log.role)) {
      return false;
    }
    if (filters.hasTools && entry.toolInfo.tools.length === 0) {
      return false;
    }
    if (
      filters.tools.length > 0 &&
      !entry.toolInfo.tools.some(([name]) => filters.tools.includes(name))
    ) {
      return false;
    }
    if (normalizedQuery && !entry.cleanContent.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Conversation log</CardTitle>
            <CardDescription>
              {cursorStart != null && cursorEnd != null
                ? `${filteredEntries.length} of ${logs?.length ?? 0} messages in the selected timeline range`
                : `${filteredEntries.length} message${filteredEntries.length === 1 ? "" : "s"} shown`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onToggleExpandedAll}>
            {expandedAll ? "Collapse tools" : "Expand tools"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <QueryFilterMenu
            label="Role"
            options={["user", "assistant", "tool", "toolResult"]}
            selectedValues={filters.roles}
            onToggle={(value, checked) => {
              const next = checked
                ? [...filters.roles, value as SessionLogRole]
                : filters.roles.filter((role) => role !== value);
              onRolesChange(Array.from(new Set(next)));
            }}
            onSelectAll={() => onRolesChange(["user", "assistant", "tool", "toolResult"])}
            onClear={() => onRolesChange([])}
          />
          <QueryFilterMenu
            label="Tools"
            options={toolOptions}
            selectedValues={filters.tools}
            onToggle={(value, checked) => {
              const next = checked
                ? [...filters.tools, value]
                : filters.tools.filter((tool) => tool !== value);
              onToolsChange(Array.from(new Set(next)));
            }}
            onSelectAll={() => onToolsChange(toolOptions)}
            onClear={() => onToolsChange([])}
          />
          <label className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={filters.hasTools}
              onChange={(event) => onHasToolsChange(event.target.checked)}
            />
            Has tools
          </label>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search conversation"
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear
          </Button>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            Loading conversation…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            No messages match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const roleTone =
                entry.log.role === "user"
                  ? "border-sky-200/70 bg-sky-50/60"
                  : entry.log.role === "assistant"
                    ? "border-emerald-200/70 bg-emerald-50/60"
                    : "border-amber-200/70 bg-amber-50/70";
              const roleLabel =
                entry.log.role === "user"
                  ? "User"
                  : entry.log.role === "assistant"
                    ? "Assistant"
                    : entry.log.role === "toolResult"
                      ? "Tool result"
                      : "Tool";
              return (
                <div key={`${entry.log.timestamp}-${entry.log.role}`} className={cn("rounded-2xl border p-4", roleTone)}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">
                      {roleLabel}
                    </Badge>
                    <span>{new Date(entry.log.timestamp).toLocaleString()}</span>
                    {entry.log.tokens ? <span>{formatTokens(entry.log.tokens)} tokens</span> : null}
                    {entry.log.cost ? <span>{formatCost(entry.log.cost, 4)}</span> : null}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                    {entry.cleanContent || entry.log.content}
                  </pre>
                  {entry.toolInfo.tools.length > 0 ? (
                    <details open={expandedAll} className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-3">
                      <summary className="cursor-pointer text-sm font-medium">{entry.toolInfo.summary}</summary>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.toolInfo.tools.map(([name, count]) => (
                          <Badge key={`${entry.log.timestamp}-${name}`} variant="secondary" className="rounded-full px-3 py-1">
                            {name} × {count}
                          </Badge>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContextBreakdownCard({
  contextWeight,
  usage,
  expanded,
  onToggleExpanded,
}: {
  contextWeight: UsageSessionEntry["contextWeight"];
  usage: UsageSessionEntry["usage"];
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  if (!contextWeight) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-xl">System prompt breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-sm text-muted-foreground">No context data for this session.</CardContent>
      </Card>
    );
  }

  const systemTokens = charsToTokens(contextWeight.systemPrompt.chars);
  const skillsTokens = charsToTokens(contextWeight.skills.promptChars);
  const toolsTokens = charsToTokens(contextWeight.tools.listChars + contextWeight.tools.schemaChars);
  const filesTokens = charsToTokens(
    contextWeight.injectedWorkspaceFiles.reduce((sum, file) => sum + file.injectedChars, 0),
  );
  const totalTokens = systemTokens + skillsTokens + toolsTokens + filesTokens || 1;
  const inputTokens = usage ? usage.input + usage.cacheRead : 0;
  const contextPct =
    inputTokens > 0 ? `~${Math.min((totalTokens / inputTokens) * 100, 100).toFixed(0)}% of input` : "Base context per message";

  const defaultLimit = 4;
  const skills = [...contextWeight.skills.entries].sort((a, b) => b.blockChars - a.blockChars);
  const tools = [...contextWeight.tools.entries].sort(
    (a, b) => b.summaryChars + b.schemaChars - (a.summaryChars + a.schemaChars),
  );
  const files = [...contextWeight.injectedWorkspaceFiles].sort(
    (a, b) => b.injectedChars - a.injectedChars,
  );
  const visibleSkills = expanded ? skills : skills.slice(0, defaultLimit);
  const visibleTools = expanded ? tools : tools.slice(0, defaultLimit);
  const visibleFiles = expanded ? files : files.slice(0, defaultLimit);

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">System prompt breakdown</CardTitle>
            <CardDescription>{contextPct}</CardDescription>
          </div>
          {(skills.length > defaultLimit || tools.length > defaultLimit || files.length > defaultLimit) ? (
            <Button variant="outline" size="sm" onClick={onToggleExpanded}>
              {expanded ? "Collapse" : "Expand all"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="flex h-5 overflow-hidden rounded-full bg-muted">
          <div className="bg-rose-500" style={{ width: `${((systemTokens / totalTokens) * 100).toFixed(1)}%` }} />
          <div className="bg-sky-500" style={{ width: `${((skillsTokens / totalTokens) * 100).toFixed(1)}%` }} />
          <div className="bg-amber-500" style={{ width: `${((toolsTokens / totalTokens) * 100).toFixed(1)}%` }} />
          <div className="bg-emerald-500" style={{ width: `${((filesTokens / totalTokens) * 100).toFixed(1)}%` }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
            System ~{formatTokens(systemTokens)}
          </Badge>
          <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
            Skills ~{formatTokens(skillsTokens)}
          </Badge>
          <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
            Tools ~{formatTokens(toolsTokens)}
          </Badge>
          <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
            Files ~{formatTokens(filesTokens)}
          </Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <InsightListCard
            title={`Skills (${skills.length})`}
            items={visibleSkills.map((entry) => ({
              label: entry.name,
              value: `~${formatTokens(charsToTokens(entry.blockChars))}`,
            }))}
            emptyLabel="No injected skills"
          />
          <InsightListCard
            title={`Tools (${tools.length})`}
            items={visibleTools.map((entry) => ({
              label: entry.name,
              value: `~${formatTokens(charsToTokens(entry.summaryChars + entry.schemaChars))}`,
            }))}
            emptyLabel="No tool schemas"
          />
          <InsightListCard
            title={`Files (${files.length})`}
            items={visibleFiles.map((entry) => ({
              label: entry.name,
              value: `~${formatTokens(charsToTokens(entry.injectedChars))}`,
            }))}
            emptyLabel="No injected files"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function getSessionDisplayLabel(session: UsageSessionEntry): string {
  const raw = session.label || session.key;
  if (raw.startsWith("agent:") && raw.includes("?token=")) {
    return raw.slice(0, raw.indexOf("?token="));
  }
  return raw;
}

function filterTimeSeriesPoints(
  points: SessionUsageTimePoint[],
  startDate: string,
  endDate: string,
  selectedDays: string[],
): SessionUsageTimePoint[] {
  const startTs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
  const endTs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return points.filter((point) => {
    if (point.timestamp < startTs || point.timestamp > endTs) {
      return false;
    }
    if (selectedDays.length > 0) {
      const date = new Date(point.timestamp);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
      return selectedDays.includes(dateStr);
    }
    return true;
  });
}

function findRangeIndices(points: SessionUsageTimePoint[], cursorStart: number, cursorEnd: number) {
  const low = Math.min(cursorStart, cursorEnd);
  const high = Math.max(cursorStart, cursorEnd);
  let startIndex = 0;
  let endIndex = points.length - 1;
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].timestamp >= low) {
      startIndex = index;
      break;
    }
  }
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].timestamp <= high) {
      endIndex = index;
      break;
    }
  }
  return { startIndex, endIndex };
}

function TimeSeriesCard({
  timeSeries,
  loading,
  mode,
  breakdownMode,
  startDate,
  endDate,
  selectedDays,
  cursorStart,
  cursorEnd,
  onModeChange,
  onBreakdownChange,
  onCursorRangeChange,
}: {
  timeSeries: SessionUsageTimeSeries | null;
  loading: boolean;
  mode: UsageTimeSeriesMode;
  breakdownMode: UsageTimeSeriesBreakdownMode;
  startDate: string;
  endDate: string;
  selectedDays: string[];
  cursorStart: number | null;
  cursorEnd: number | null;
  onModeChange: (mode: UsageTimeSeriesMode) => void;
  onBreakdownChange: (mode: UsageTimeSeriesBreakdownMode) => void;
  onCursorRangeChange: (start: number | null, end: number | null) => void;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const visiblePoints = timeSeries ? filterTimeSeriesPoints(timeSeries.points, startDate, endDate, selectedDays) : [];
  const hasSelection = cursorStart != null && cursorEnd != null;
  const selectedPoints =
    hasSelection && cursorStart != null && cursorEnd != null
      ? visiblePoints.filter((point) => {
          const low = Math.min(cursorStart, cursorEnd);
          const high = Math.max(cursorStart, cursorEnd);
          return point.timestamp >= low && point.timestamp <= high;
        })
      : visiblePoints;

  const selectedTypeTotals = selectedPoints.reduce(
    (acc, point) => {
      acc.input += point.input;
      acc.output += point.output;
      acc.cacheRead += point.cacheRead;
      acc.cacheWrite += point.cacheWrite;
      return acc;
    },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  );

  const getIndexFromClientX = (clientX: number) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || visiblePoints.length === 0) {
      return null;
    }
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 0.999999);
    return Math.min(visiblePoints.length - 1, Math.floor(ratio * visiblePoints.length));
  };

  const updateSelectionFromClientX = (clientX: number, startIndex: number) => {
    const nextIndex = getIndexFromClientX(clientX);
    if (nextIndex == null) {
      return;
    }
    const startPoint = visiblePoints[startIndex];
    const endPoint = visiblePoints[nextIndex];
    if (!startPoint || !endPoint) {
      return;
    }
    onCursorRangeChange(startPoint.timestamp, endPoint.timestamp);
  };

  const startBrush = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (visiblePoints.length === 0) {
      return;
    }
    const startIndex = getIndexFromClientX(event.clientX);
    if (startIndex == null) {
      return;
    }
    draggingRef.current = true;
    updateSelectionFromClientX(event.clientX, startIndex);
    const handleMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      updateSelectionFromClientX(moveEvent.clientX, startIndex);
    };
    const handleUp = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  let selectionStyle: { left: string; width: string } | null = null;
  if (hasSelection && visiblePoints.length > 0) {
    const { startIndex, endIndex } = findRangeIndices(visiblePoints, cursorStart, cursorEnd);
    selectionStyle = {
      left: `${(startIndex / visiblePoints.length) * 100}%`,
      width: `${((endIndex - startIndex + 1) / visiblePoints.length) * 100}%`,
    };
  }

  const timeAxis = visiblePoints.map((point) =>
    new Date(point.timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Usage over time</CardTitle>
            <CardDescription>
              Drag across the chart to filter the session detail to a subset of turns.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasSelection ? (
              <Button variant="outline" size="sm" onClick={() => onCursorRangeChange(null, null)}>
                Reset range
              </Button>
            ) : null}
            <Button
              variant={mode === "per-turn" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("per-turn")}
            >
              Per turn
            </Button>
            <Button
              variant={mode === "cumulative" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("cumulative")}
            >
              Cumulative
            </Button>
            {mode === "per-turn" ? (
              <>
                <Button
                  variant={breakdownMode === "total" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onBreakdownChange("total")}
                >
                  Total
                </Button>
                <Button
                  variant={breakdownMode === "by-type" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onBreakdownChange("by-type")}
                >
                  By type
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            Loading session timeline…
          </div>
        ) : visiblePoints.length < 2 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            No timeline data for the current selection.
          </div>
        ) : (
          <>
            <div ref={chartRef} className="relative h-[280px] overflow-hidden rounded-2xl border border-border/70 bg-background/70">
              {selectionStyle ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 rounded-2xl bg-primary/10"
                  style={selectionStyle}
                />
              ) : null}
              <div className="absolute inset-0 z-20 cursor-crosshair" onPointerDown={startBrush} />
              {mode === "cumulative" ? (
                <LineChart
                  height={280}
                  hideLegend
                  grid={{ horizontal: true }}
                  margin={{ top: 16, right: 20, bottom: 30, left: 48 }}
                  xAxis={[
                    {
                      data: visiblePoints.map((point) => new Date(point.timestamp)),
                      scaleType: "time",
                      tickNumber: 5,
                      valueFormatter: (value: Date | number | string | null) =>
                        new Date(value as Date).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                    },
                  ]}
                  yAxis={[
                    { valueFormatter: (value: number | null) => formatTokens(Number(value ?? 0)) },
                  ]}
                  series={[
                    {
                      id: "cumulative",
                      label: "Cumulative tokens",
                      color: "#e11d48",
                      curve: "monotoneX",
                      showMark: false,
                      data: visiblePoints.reduce<number[]>((acc, point) => {
                        const previous = acc.length > 0 ? acc[acc.length - 1] : 0;
                        acc.push(previous + point.totalTokens);
                        return acc;
                      }, []),
                    },
                  ]}
                  sx={CHART_SX}
                />
              ) : (
                <BarChart
                  height={280}
                  grid={{ horizontal: true }}
                  hideLegend={breakdownMode === "total"}
                  axisHighlight={{ x: "band" }}
                  margin={{ top: 16, right: 20, bottom: 30, left: 48 }}
                  xAxis={[
                    {
                      data: timeAxis,
                      scaleType: "band",
                    },
                  ]}
                  yAxis={[
                    { valueFormatter: (value: number | null) => formatTokens(Number(value ?? 0)) },
                  ]}
                  series={
                    breakdownMode === "total"
                      ? [{ data: visiblePoints.map((point) => point.totalTokens), label: "Tokens", color: "#e11d48" }]
                      : [
                          {
                            data: visiblePoints.map((point) => point.output),
                            label: "Output",
                            color: "#e11d48",
                            stack: "usage",
                          },
                          {
                            data: visiblePoints.map((point) => point.input),
                            label: "Input",
                            color: "#0ea5e9",
                            stack: "usage",
                          },
                          {
                            data: visiblePoints.map((point) => point.cacheWrite),
                            label: "Cache write",
                            color: "#f59e0b",
                            stack: "usage",
                          },
                          {
                            data: visiblePoints.map((point) => point.cacheRead),
                            label: "Cache read",
                            color: "#10b981",
                            stack: "usage",
                          },
                        ]
                  }
                  sx={CHART_SX}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
              <div className="text-muted-foreground">
                {hasSelection ? "Timeline range active" : `${visiblePoints.length} turns in range`}
              </div>
              <div className="flex flex-wrap gap-4 font-medium">
                <span>{formatTokens(selectedPoints.reduce((sum, point) => sum + point.totalTokens, 0))} tokens</span>
                <span>{formatCost(selectedPoints.reduce((sum, point) => sum + point.cost, 0), 4)}</span>
              </div>
            </div>
            {mode === "per-turn" && breakdownMode === "by-type" ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-sm font-medium">Tokens by type</div>
                <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                  {[
                    { key: "output", value: selectedTypeTotals.output, color: "bg-rose-500" },
                    { key: "input", value: selectedTypeTotals.input, color: "bg-sky-500" },
                    { key: "cacheWrite", value: selectedTypeTotals.cacheWrite, color: "bg-amber-500" },
                    { key: "cacheRead", value: selectedTypeTotals.cacheRead, color: "bg-emerald-500" },
                  ].map((entry) => {
                    const total =
                      selectedTypeTotals.output +
                      selectedTypeTotals.input +
                      selectedTypeTotals.cacheWrite +
                      selectedTypeTotals.cacheRead;
                    return (
                      <div
                        key={entry.key}
                        className={entry.color}
                        style={{ width: `${total > 0 ? (entry.value / total) * 100 : 0}%` }}
                      />
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
                    Output {formatTokens(selectedTypeTotals.output)}
                  </Badge>
                  <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
                    Input {formatTokens(selectedTypeTotals.input)}
                  </Badge>
                  <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
                    Cache write {formatTokens(selectedTypeTotals.cacheWrite)}
                  </Badge>
                  <Badge variant="outline" className="justify-start rounded-full px-3 py-1">
                    Cache read {formatTokens(selectedTypeTotals.cacheRead)}
                  </Badge>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SessionDetailPanel({
  session,
  timeSeries,
  timeSeriesLoading,
  timeSeriesMode,
  timeSeriesBreakdownMode,
  timeSeriesCursorStart,
  timeSeriesCursorEnd,
  sessionLogs,
  sessionLogsLoading,
  sessionLogsExpanded,
  logFilters,
  startDate,
  endDate,
  selectedDays,
  contextExpanded,
  onTimeSeriesModeChange,
  onTimeSeriesBreakdownChange,
  onTimeSeriesCursorRangeChange,
  onToggleSessionLogsExpanded,
  onLogFilterRolesChange,
  onLogFilterToolsChange,
  onLogFilterHasToolsChange,
  onLogFilterQueryChange,
  onLogFilterClear,
  onToggleContextExpanded,
}: {
  session: UsageSessionEntry;
  timeSeries: SessionUsageTimeSeries | null;
  timeSeriesLoading: boolean;
  timeSeriesMode: UsageTimeSeriesMode;
  timeSeriesBreakdownMode: UsageTimeSeriesBreakdownMode;
  timeSeriesCursorStart: number | null;
  timeSeriesCursorEnd: number | null;
  sessionLogs: SessionLogEntry[] | null;
  sessionLogsLoading: boolean;
  sessionLogsExpanded: boolean;
  logFilters: {
    roles: SessionLogRole[];
    tools: string[];
    hasTools: boolean;
    query: string;
  };
  startDate: string;
  endDate: string;
  selectedDays: string[];
  contextExpanded: boolean;
  onTimeSeriesModeChange: (mode: UsageTimeSeriesMode) => void;
  onTimeSeriesBreakdownChange: (mode: UsageTimeSeriesBreakdownMode) => void;
  onTimeSeriesCursorRangeChange: (start: number | null, end: number | null) => void;
  onToggleSessionLogsExpanded: () => void;
  onLogFilterRolesChange: (roles: SessionLogRole[]) => void;
  onLogFilterToolsChange: (tools: string[]) => void;
  onLogFilterHasToolsChange: (value: boolean) => void;
  onLogFilterQueryChange: (query: string) => void;
  onLogFilterClear: () => void;
  onToggleContextExpanded: () => void;
}) {
  const baseUsage = session.usage;
  const filteredUsage =
    timeSeries &&
    baseUsage &&
    timeSeriesCursorStart != null &&
    timeSeriesCursorEnd != null
      ? computeFilteredUsage(baseUsage, timeSeries.points, timeSeriesCursorStart, timeSeriesCursorEnd)
      : undefined;
  const filteredLogs =
    sessionLogs && timeSeriesCursorStart != null && timeSeriesCursorEnd != null
      ? filterLogsByRange(sessionLogs, timeSeriesCursorStart, timeSeriesCursorEnd)
      : sessionLogs;

  const badges = [
    session.channel ? `channel:${session.channel}` : null,
    session.agentId ? `agent:${session.agentId}` : null,
    session.modelProvider || session.providerOverride
      ? `provider:${session.modelProvider ?? session.providerOverride}`
      : null,
    session.model ? `model:${session.model}` : null,
  ].filter(Boolean) as string[];

  const summaryUsage = filteredUsage ?? baseUsage;
  const toolSummary = (() => {
    if (!filteredLogs || filteredLogs.length === 0) {
      return summaryUsage?.toolUsage?.tools.slice(0, 6).map((tool) => ({
        label: tool.name,
        value: `${tool.count}`,
        sub: "calls",
      })) ?? [];
    }
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      for (const [name] of parseToolSummary(log.content).tools) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        label: name,
        value: `${count}`,
        sub: "calls",
      }));
  })();
  const modelMix =
    summaryUsage?.modelUsage?.slice(0, 6).map((entry) => ({
      label: entry.model ?? "unknown",
      value: formatCost(entry.totals.totalCost),
      sub: `${formatTokens(entry.totals.totalTokens)} · ${entry.count} msgs`,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{getSessionDisplayLabel(session)}</CardTitle>
              <CardDescription>{session.key}</CardDescription>
              {badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <Badge key={badge} variant="outline" className="rounded-full px-3 py-1">
                      {badge}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            {summaryUsage ? (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {formatTokens(summaryUsage.totalTokens)} tokens
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {formatCost(summaryUsage.totalCost)} cost
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <UsageSummaryCard
            title="Messages"
            value={`${summaryUsage?.messageCounts?.total ?? 0}`}
            sub={`${summaryUsage?.messageCounts?.user ?? 0} user · ${summaryUsage?.messageCounts?.assistant ?? 0} assistant`}
          />
          <UsageSummaryCard
            title="Tool calls"
            value={`${
              summaryUsage?.toolUsage?.totalCalls ??
              toolSummary.reduce((sum: number, entry) => sum + Number(entry.value), 0)
            }`}
            sub={`${summaryUsage?.toolUsage?.uniqueTools ?? toolSummary.length} tools`}
          />
          <UsageSummaryCard
            title="Errors"
            value={`${summaryUsage?.messageCounts?.errors ?? 0}`}
            sub={`${summaryUsage?.messageCounts?.toolResults ?? 0} tool results`}
          />
          <UsageSummaryCard
            title="Duration"
            value={formatDurationCompact(summaryUsage?.durationMs, { spaced: true }) ?? "—"}
            sub={
              summaryUsage?.firstActivity && summaryUsage?.lastActivity
                ? `${new Date(summaryUsage.firstActivity).toLocaleString()} → ${new Date(
                    summaryUsage.lastActivity,
                  ).toLocaleString()}`
                : "No timing data"
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <InsightListCard title="Top tools" items={toolSummary} emptyLabel="No tool calls" />
        <InsightListCard title="Model mix" items={modelMix} emptyLabel="No model data" />
      </div>

      <TimeSeriesCard
        timeSeries={timeSeries}
        loading={timeSeriesLoading}
        mode={timeSeriesMode}
        breakdownMode={timeSeriesBreakdownMode}
        startDate={startDate}
        endDate={endDate}
        selectedDays={selectedDays}
        cursorStart={timeSeriesCursorStart}
        cursorEnd={timeSeriesCursorEnd}
        onModeChange={onTimeSeriesModeChange}
        onBreakdownChange={onTimeSeriesBreakdownChange}
        onCursorRangeChange={onTimeSeriesCursorRangeChange}
      />

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <SessionLogsCard
          logs={sessionLogs}
          loading={sessionLogsLoading}
          expandedAll={sessionLogsExpanded}
          filters={logFilters}
          onToggleExpandedAll={onToggleSessionLogsExpanded}
          onRolesChange={onLogFilterRolesChange}
          onToolsChange={onLogFilterToolsChange}
          onHasToolsChange={onLogFilterHasToolsChange}
          onQueryChange={onLogFilterQueryChange}
          onClearFilters={onLogFilterClear}
          cursorStart={timeSeriesCursorStart}
          cursorEnd={timeSeriesCursorEnd}
        />
        <ContextBreakdownCard
          contextWeight={session.contextWeight}
          usage={summaryUsage}
          expanded={contextExpanded}
          onToggleExpanded={onToggleContextExpanded}
        />
      </div>
    </div>
  );
}

export function UsagePage() {
  const { client, connected, methods } = useGateway();
  const [state, setState] = useState<UsageViewState>(() => createInitialState());
  const dateReloadTimerRef = useRef<number | null>(null);
  const queryTimerRef = useRef<number | null>(null);
  const usageRequestIdRef = useRef(0);
  const sessionDetailsRequestIdRef = useRef(0);

  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:18789";
  const sessions = state.usageResult?.sessions ?? [];
  const totalSessions = sessions.length;

  const updateState = (
    updater:
      | Partial<UsageViewState>
      | ((prev: UsageViewState) => Partial<UsageViewState>),
  ) => {
    setState((prev) => ({
      ...prev,
      ...(typeof updater === "function" ? updater(prev) : updater),
    }));
  };

  const clearDateReloadTimer = () => {
    if (dateReloadTimerRef.current) {
      window.clearTimeout(dateReloadTimerRef.current);
      dateReloadTimerRef.current = null;
    }
  };

  const clearQueryTimer = () => {
    if (queryTimerRef.current) {
      window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
  };

  const loadUsageRef = useRef<
    (overrides?: { startDate?: string; endDate?: string; timeZone?: "local" | "utc" }) => Promise<void>
  >(async () => {});
  loadUsageRef.current = async (overrides) => {
    if (!client || !connected) {
      return;
    }
    const requestId = usageRequestIdRef.current + 1;
    usageRequestIdRef.current = requestId;
    const startDate = overrides?.startDate ?? state.startDate;
    const endDate = overrides?.endDate ?? state.endDate;
    const timeZone = overrides?.timeZone ?? state.timeZone;
    updateState({ loading: true, error: null });
    try {
      const result = await loadUsageSnapshot({
        client,
        gatewayUrl,
        startDate,
        endDate,
        timeZone,
      });
      if (usageRequestIdRef.current !== requestId) {
        return;
      }
      updateState({
        loading: false,
        usageResult: result.usageResult,
        costSummary: result.costSummary,
        error: null,
      });
    } catch (error) {
      if (usageRequestIdRef.current !== requestId) {
        return;
      }
      updateState({
        loading: false,
        error: toErrorMessage(error),
      });
    }
  };

  const loadSessionDetailsRef = useRef<(sessionKey: string) => Promise<void>>(async () => {});
  loadSessionDetailsRef.current = async (sessionKey: string) => {
    if (!client || !connected) {
      return;
    }
    const requestId = sessionDetailsRequestIdRef.current + 1;
    sessionDetailsRequestIdRef.current = requestId;
    updateState({
      timeSeriesLoading: true,
      sessionLogsLoading: true,
      timeSeries: null,
      sessionLogs: null,
    });
    const [timeSeries, sessionLogs] = await Promise.all([
      loadSessionTimeSeries(client, sessionKey, methods),
      loadSessionLogs(client, sessionKey, methods),
    ]);
    if (sessionDetailsRequestIdRef.current !== requestId) {
      return;
    }
    updateState({
      timeSeriesLoading: false,
      sessionLogsLoading: false,
      timeSeries,
      sessionLogs,
    });
  };

  useEffect(() => {
    if (!client || !connected) {
      return;
    }
    void loadUsageRef.current();
  }, [client, connected]);

  useEffect(() => {
    return () => {
      clearDateReloadTimer();
      clearQueryTimer();
    };
  }, []);

  const scheduleDateReload = (nextStartDate: string, nextEndDate: string, nextTimeZone = state.timeZone) => {
    clearDateReloadTimer();
    dateReloadTimerRef.current = window.setTimeout(() => {
      void loadUsageRef.current({
        startDate: nextStartDate,
        endDate: nextEndDate,
        timeZone: nextTimeZone,
      });
    }, 400);
  };

  const applyQueryDraft = (value: string) => {
    clearQueryTimer();
    queryTimerRef.current = window.setTimeout(() => {
      updateState({ query: value });
      queryTimerRef.current = null;
    }, 250);
  };

  const costDaily = state.costSummary?.daily ?? [];
  const sortedSessions = [...sessions].sort((a, b) => {
    const valueA = state.chartMode === "tokens" ? a.usage?.totalTokens ?? 0 : a.usage?.totalCost ?? 0;
    const valueB = state.chartMode === "tokens" ? b.usage?.totalTokens ?? 0 : b.usage?.totalCost ?? 0;
    return valueB - valueA;
  });

  const dayFilteredSessions =
    state.selectedDays.length > 0
      ? sortedSessions.filter((session) => {
          if (session.usage?.activityDates?.length) {
            return session.usage.activityDates.some((date) => state.selectedDays.includes(date));
          }
          if (!session.updatedAt) {
            return false;
          }
          const sessionDate = formatIsoDate(new Date(session.updatedAt));
          return state.selectedDays.includes(sessionDate);
        })
      : sortedSessions;

  const sessionTouchesHours = (session: UsageSessionEntry, hours: number[]) => {
    if (hours.length === 0) {
      return true;
    }
    const usage = session.usage;
    const start = usage?.firstActivity ?? session.updatedAt;
    const end = usage?.lastActivity ?? session.updatedAt;
    if (!start || !end) {
      return false;
    }
    const startMs = Math.min(start, end);
    const endMs = Math.max(start, end);
    let cursor = startMs;
    while (cursor <= endMs) {
      const date = new Date(cursor);
      const hour = getZonedHour(date, state.timeZone);
      if (hours.includes(hour)) {
        return true;
      }
      const nextHour = setToHourEnd(date, state.timeZone);
      cursor = Math.min(nextHour.getTime(), endMs) + 1;
    }
    return false;
  };

  const hourFilteredSessions =
    state.selectedHours.length > 0
      ? dayFilteredSessions.filter((session) => sessionTouchesHours(session, state.selectedHours))
      : dayFilteredSessions;

  const queryResult = filterSessionsByQuery<UsageSessionEntry>(hourFilteredSessions, state.query);
  const filteredSessions = queryResult.sessions;
  const queryWarnings = queryResult.warnings;
  const querySuggestions = buildQuerySuggestions(
    state.queryDraft,
    sortedSessions,
    state.usageResult?.aggregates,
  );
  const queryTerms = extractQueryTerms(state.query);
  const selectedValuesFor = (key: string) => {
    const normalized = normalizeQueryText(key);
    return queryTerms
      .filter((term) => normalizeQueryText(term.key ?? "") === normalized)
      .map((term) => term.value)
      .filter(Boolean);
  };

  const unique = (items: Array<string | undefined>) => {
    const set = new Set<string>();
    for (const item of items) {
      if (item) {
        set.add(item);
      }
    }
    return Array.from(set);
  };

  const agentOptions = unique(sortedSessions.map((session) => session.agentId)).slice(0, 12);
  const channelOptions = unique(sortedSessions.map((session) => session.channel)).slice(0, 12);
  const providerOptions = unique([
    ...sortedSessions.map((session) => session.modelProvider),
    ...sortedSessions.map((session) => session.providerOverride),
    ...(state.usageResult?.aggregates.byProvider.map((entry) => entry.provider) ?? []),
  ]).slice(0, 12);
  const modelOptions = unique([
    ...sortedSessions.map((session) => session.model),
    ...(state.usageResult?.aggregates.byModel.map((entry) => entry.model) ?? []),
  ]).slice(0, 12);
  const toolOptions = unique(state.usageResult?.aggregates.tools.tools.map((tool) => tool.name) ?? []).slice(
    0,
    12,
  );

  const filteredDaily =
    state.selectedSessions.length > 0
      ? (() => {
          const selectedEntries = filteredSessions.filter((session) =>
            state.selectedSessions.includes(session.key),
          );
          const activityDates = new Set<string>();
          for (const entry of selectedEntries) {
            for (const date of entry.usage?.activityDates ?? []) {
              activityDates.add(date);
            }
          }
          return activityDates.size > 0
            ? costDaily.filter((entry) => activityDates.has(entry.date))
            : costDaily;
        })()
      : costDaily;

  const computeSessionTotals = (usageSessions: UsageSessionEntry[]) =>
    usageSessions.reduce((acc, session) => {
      if (session.usage) {
        addUsageTotals(acc, session.usage);
      }
      return acc;
    }, createEmptyUsageTotals());

  const computeDailyTotals = (days: string[]) =>
    costDaily
      .filter((entry) => days.includes(entry.date))
      .reduce((acc, entry) => {
        addUsageTotals(acc, entry);
        return acc;
      }, createEmptyUsageTotals());

  let displayTotals: CostUsageTotals | null = null;
  let displaySessionCount = totalSessions;
  if (state.selectedSessions.length > 0) {
    const selectedEntries = filteredSessions.filter((session) => state.selectedSessions.includes(session.key));
    displayTotals = computeSessionTotals(selectedEntries);
    displaySessionCount = selectedEntries.length;
  } else if (state.selectedDays.length > 0 && state.selectedHours.length === 0) {
    displayTotals = computeDailyTotals(state.selectedDays);
    displaySessionCount = filteredSessions.length;
  } else if (state.selectedHours.length > 0 || state.query.trim().length > 0) {
    displayTotals = computeSessionTotals(filteredSessions);
    displaySessionCount = filteredSessions.length;
  } else if (state.usageResult) {
    displayTotals = state.usageResult.totals;
    displaySessionCount = totalSessions;
  }

  const aggregateSessions =
    state.selectedSessions.length > 0
      ? filteredSessions.filter((session) => state.selectedSessions.includes(session.key))
      : state.query.trim().length > 0 || state.selectedHours.length > 0
        ? filteredSessions
        : state.selectedDays.length > 0
          ? dayFilteredSessions
          : sortedSessions;

  const activeAggregates = buildAggregatesFromSessions(aggregateSessions, state.usageResult?.aggregates);
  const insightStats = buildUsageInsightStats(aggregateSessions, displayTotals, activeAggregates);
  const hasMissingCost =
    (displayTotals?.missingCostEntries ?? 0) > 0 ||
    Boolean(
      displayTotals &&
        displayTotals.totalTokens > 0 &&
        displayTotals.totalCost === 0 &&
        displayTotals.input + displayTotals.output + displayTotals.cacheRead + displayTotals.cacheWrite > 0,
    );
  const isEmpty = !state.loading && !state.usageResult && sessions.length === 0;

  const getSessionValue = (session: UsageSessionEntry) => {
    const usage = session.usage;
    if (!usage) {
      return 0;
    }
    if (state.selectedDays.length > 0 && usage.dailyBreakdown?.length) {
      const filteredDays = usage.dailyBreakdown.filter((entry) => state.selectedDays.includes(entry.date));
      return state.chartMode === "tokens"
        ? filteredDays.reduce((sum, entry) => sum + entry.tokens, 0)
        : filteredDays.reduce((sum, entry) => sum + entry.cost, 0);
    }
    return state.chartMode === "tokens" ? usage.totalTokens ?? 0 : usage.totalCost ?? 0;
  };

  const sortedFilteredSessions = [...filteredSessions].sort((a, b) => {
    switch (state.sessionSort) {
      case "recent":
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      case "messages":
        return (b.usage?.messageCounts?.total ?? 0) - (a.usage?.messageCounts?.total ?? 0);
      case "errors":
        return (b.usage?.messageCounts?.errors ?? 0) - (a.usage?.messageCounts?.errors ?? 0);
      case "cost":
        return (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0);
      case "tokens":
      default:
        return getSessionValue(b) - getSessionValue(a);
    }
  });
  const displayedSessions =
    state.sessionSortDir === "asc" ? [...sortedFilteredSessions].reverse() : sortedFilteredSessions;
  const sessionMap = new Map(displayedSessions.map((session) => [session.key, session]));
  const recentEntries = state.recentSessions
    .map((key) => sessionMap.get(key))
    .filter((entry): entry is UsageSessionEntry => Boolean(entry));
  const sessionsTableRows = state.sessionsTab === "recent" ? recentEntries : displayedSessions;
  const selectedSet = new Set(state.selectedSessions);
  const selectedSessionEntries = displayedSessions.filter((session) => selectedSet.has(session.key));
  const selectedSession =
    state.selectedSessions.length === 1
      ? sessions.find((session) => session.key === state.selectedSessions[0]) ?? null
      : null;

  const clearDetailState = () => updateState(createClearedFilterState());

  const handleDateChange = (field: "startDate" | "endDate", value: string) => {
    const nextState = {
      [field]: value,
      ...createClearedFilterState(),
    } as Partial<UsageViewState>;
    updateState(nextState);
    scheduleDateReload(field === "startDate" ? value : state.startDate, field === "endDate" ? value : state.endDate);
  };

  const handleTimeZoneChange = (value: "local" | "utc") => {
    clearDateReloadTimer();
    updateState({
      timeZone: value,
      ...createClearedFilterState(),
    });
    void loadUsageRef.current({ timeZone: value });
  };

  const handleQueryDraftChange = (value: string) => {
    updateState({ queryDraft: value });
    applyQueryDraft(value);
  };

  const handleApplyQuery = () => {
    clearQueryTimer();
    updateState({ query: state.queryDraft });
  };

  const handleClearQuery = () => {
    clearQueryTimer();
    updateState({ queryDraft: "", query: "" });
  };

  const handleSelectHour = (hour: number, shiftKey: boolean) => {
    const allHours = Array.from({ length: 24 }, (_, index) => index);
    let nextSelected = state.selectedHours;
    if (shiftKey && state.selectedHours.length > 0) {
      const lastSelected = state.selectedHours[state.selectedHours.length - 1];
      const lastIndex = allHours.indexOf(lastSelected);
      const currentIndex = allHours.indexOf(hour);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const [startIndex, endIndex] =
          lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
        nextSelected = Array.from(
          new Set([...state.selectedHours, ...allHours.slice(startIndex, endIndex + 1)]),
        );
      }
    } else {
      nextSelected = state.selectedHours.includes(hour)
        ? state.selectedHours.filter((entry) => entry !== hour)
        : [...state.selectedHours, hour];
    }
    updateState({
      selectedHours: nextSelected,
      selectedSessions: [],
      timeSeries: null,
      sessionLogs: null,
      timeSeriesCursorStart: null,
      timeSeriesCursorEnd: null,
    });
  };

  const handleSelectDay = (day: string, shiftKey: boolean) => {
    const visibleDays = filteredDaily.map((entry) => entry.date);
    let nextSelected = state.selectedDays;
    if (shiftKey && state.selectedDays.length > 0) {
      const lastSelected = state.selectedDays[state.selectedDays.length - 1];
      const lastIndex = visibleDays.indexOf(lastSelected);
      const currentIndex = visibleDays.indexOf(day);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const [startIndex, endIndex] =
          lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
        nextSelected = Array.from(
          new Set([...state.selectedDays, ...visibleDays.slice(startIndex, endIndex + 1)]),
        );
      }
    } else if (state.selectedDays.includes(day)) {
      nextSelected = state.selectedDays.filter((entry) => entry !== day);
    } else {
      nextSelected = [day];
    }
    updateState({
      selectedDays: nextSelected,
      selectedSessions: [],
      timeSeries: null,
      sessionLogs: null,
      timeSeriesCursorStart: null,
      timeSeriesCursorEnd: null,
    });
  };

  const handleSelectSession = (key: string, shiftKey: boolean) => {
    let nextSelectedSessions: string[];
    if (shiftKey && state.selectedSessions.length > 0) {
      const allKeys = sessionsTableRows.map((session) => session.key);
      const lastSelected = state.selectedSessions[state.selectedSessions.length - 1];
      const lastIndex = allKeys.indexOf(lastSelected);
      const currentIndex = allKeys.indexOf(key);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const [startIndex, endIndex] =
          lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
        nextSelectedSessions = Array.from(
          new Set([...state.selectedSessions, ...allKeys.slice(startIndex, endIndex + 1)]),
        );
      } else {
        nextSelectedSessions = [key];
      }
    } else if (state.selectedSessions.length === 1 && state.selectedSessions[0] === key) {
      nextSelectedSessions = [];
    } else {
      nextSelectedSessions = [key];
    }

    updateState({
      selectedSessions: nextSelectedSessions,
      recentSessions: [key, ...state.recentSessions.filter((entry) => entry !== key)].slice(
        0,
        DEFAULT_RECENT_LIMIT,
      ),
      timeSeries: null,
      timeSeriesLoading: nextSelectedSessions.length === 1,
      timeSeriesCursorStart: null,
      timeSeriesCursorEnd: null,
      sessionLogs: null,
      sessionLogsLoading: nextSelectedSessions.length === 1,
      sessionLogsExpanded: false,
      contextExpanded: false,
      logFilterRoles: [],
      logFilterTools: [],
      logFilterHasTools: false,
      logFilterQuery: "",
    });

    if (nextSelectedSessions.length === 1) {
      void loadSessionDetailsRef.current(nextSelectedSessions[0]);
    }
  };

  const datePresets = [
    { label: "Today", days: 1 },
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
  ];

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const nextStartDate = formatIsoDate(start);
    const nextEndDate = formatIsoDate(end);
    updateState({
      startDate: nextStartDate,
      endDate: nextEndDate,
      ...createClearedFilterState(),
    });
    scheduleDateReload(nextStartDate, nextEndDate);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-[1580px] flex-col gap-6 px-6 py-6">
        <section className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  <Activity className="size-3.5" />
                  Usage
                </Badge>
                {state.loading ? (
                  <Badge variant="outline" className="gap-1 rounded-full px-3 py-1 text-xs">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Refreshing
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                See where tokens go, when sessions spike, and what actually drives cost across the
                latest gateway usage data.
              </p>
            </div>
            {displayTotals ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-sm">
                  {formatTokens(displayTotals.totalTokens)} tokens
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-sm">
                  {formatCost(displayTotals.totalCost)} cost
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-sm">
                  {displaySessionCount} session{displaySessionCount === 1 ? "" : "s"}
                </Badge>
              </div>
            ) : null}
          </div>
        </section>

        <Card
          className={cn(
            "border-border/70 bg-card/95 shadow-sm",
            state.headerPinned && "sticky top-4 z-20 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.55)]",
          )}
        >
          <CardHeader className="border-b border-border/60 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl">Filters</CardTitle>
                <CardDescription>
                  Pick a time range, switch between tokens and cost, then refine with day, hour, and
                  session filters.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateState({ headerPinned: !state.headerPinned })}
                >
                  {state.headerPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  {state.headerPinned ? "Unpin" : "Pin"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="size-3.5" />
                      Export
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        downloadTextFile(
                          `hq-usage-sessions-${formatIsoDate(new Date())}.csv`,
                          buildSessionsCsv(filteredSessions),
                          "text/csv",
                        )
                      }
                      disabled={filteredSessions.length === 0}
                    >
                      Sessions CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        downloadTextFile(
                          `hq-usage-daily-${formatIsoDate(new Date())}.csv`,
                          buildDailyCsv(filteredDaily),
                          "text/csv",
                        )
                      }
                      disabled={filteredDaily.length === 0}
                    >
                      Daily CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              {datePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
              <Input
                type="date"
                value={state.startDate}
                onChange={(event) => handleDateChange("startDate", event.target.value)}
                className="w-[168px]"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={state.endDate}
                onChange={(event) => handleDateChange("endDate", event.target.value)}
                className="w-[168px]"
              />
              <select
                value={state.timeZone}
                onChange={(event) => handleTimeZoneChange(event.target.value as "local" | "utc")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              >
                <option value="local">Local</option>
                <option value="utc">UTC</option>
              </select>
              <div className="flex gap-2">
                <Button
                  variant={state.chartMode === "tokens" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateState({ chartMode: "tokens" })}
                >
                  Tokens
                </Button>
                <Button
                  variant={state.chartMode === "cost" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateState({ chartMode: "cost" })}
                >
                  Cost
                </Button>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => void loadUsageRef.current()}
                disabled={state.loading}
              >
                <RefreshCw className={cn("size-3.5", state.loading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={clearDetailState}>
                Clear filters
              </Button>
            </div>

            {(state.selectedDays.length > 0 ||
              state.selectedHours.length > 0 ||
              state.selectedSessions.length > 0) ? (
              <div className="flex flex-wrap gap-2">
                {state.selectedDays.length > 0 ? (
                  <FilterChip
                    label={
                      state.selectedDays.length === 1
                        ? formatFullDate(state.selectedDays[0])
                        : `${state.selectedDays.length} days`
                    }
                    onRemove={() => updateState({ selectedDays: [], ...DEFAULT_DETAIL_STATE })}
                  />
                ) : null}
                {state.selectedHours.length > 0 ? (
                  <FilterChip
                    label={
                      state.selectedHours.length === 1
                        ? `${state.selectedHours[0]}:00`
                        : `${state.selectedHours.length} hours`
                    }
                    onRemove={() => updateState({ selectedHours: [], ...DEFAULT_DETAIL_STATE })}
                  />
                ) : null}
                {state.selectedSessions.length > 0 ? (
                  <FilterChip
                    label={
                      state.selectedSessions.length === 1
                        ? getSessionDisplayLabel(selectedSession ?? { key: state.selectedSessions[0], usage: null })
                        : `${state.selectedSessions.length} sessions`
                    }
                    onRemove={() =>
                      updateState({ selectedSessions: [], ...DEFAULT_DETAIL_STATE })
                    }
                  />
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[260px] flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={state.queryDraft}
                    onChange={(event) => handleQueryDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleApplyQuery();
                      }
                    }}
                    placeholder="Filter sessions (e.g. key:agent:main:cron* model:gpt-4o has:errors minTokens:2000)"
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleApplyQuery}>
                  Filter (client-side)
                </Button>
                {state.queryDraft || state.query ? (
                  <Button variant="ghost" size="sm" onClick={handleClearQuery}>
                    Clear
                  </Button>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {state.query
                    ? `${filteredSessions.length} of ${totalSessions} sessions match`
                    : `${totalSessions} sessions in range`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <QueryFilterMenu
                  label="Agent"
                  options={agentOptions}
                  selectedValues={selectedValuesFor("agent")}
                  onToggle={(value, checked) =>
                    handleQueryDraftChange(
                      checked
                        ? addQueryToken(state.queryDraft, `agent:${value}`)
                        : removeQueryToken(state.queryDraft, `agent:${value}`),
                    )
                  }
                  onSelectAll={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "agent", agentOptions))}
                  onClear={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "agent", []))}
                />
                <QueryFilterMenu
                  label="Channel"
                  options={channelOptions}
                  selectedValues={selectedValuesFor("channel")}
                  onToggle={(value, checked) =>
                    handleQueryDraftChange(
                      checked
                        ? addQueryToken(state.queryDraft, `channel:${value}`)
                        : removeQueryToken(state.queryDraft, `channel:${value}`),
                    )
                  }
                  onSelectAll={() =>
                    handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "channel", channelOptions))
                  }
                  onClear={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "channel", []))}
                />
                <QueryFilterMenu
                  label="Provider"
                  options={providerOptions}
                  selectedValues={selectedValuesFor("provider")}
                  onToggle={(value, checked) =>
                    handleQueryDraftChange(
                      checked
                        ? addQueryToken(state.queryDraft, `provider:${value}`)
                        : removeQueryToken(state.queryDraft, `provider:${value}`),
                    )
                  }
                  onSelectAll={() =>
                    handleQueryDraftChange(
                      setQueryTokensForKey(state.queryDraft, "provider", providerOptions),
                    )
                  }
                  onClear={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "provider", []))}
                />
                <QueryFilterMenu
                  label="Model"
                  options={modelOptions}
                  selectedValues={selectedValuesFor("model")}
                  onToggle={(value, checked) =>
                    handleQueryDraftChange(
                      checked
                        ? addQueryToken(state.queryDraft, `model:${value}`)
                        : removeQueryToken(state.queryDraft, `model:${value}`),
                    )
                  }
                  onSelectAll={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "model", modelOptions))}
                  onClear={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "model", []))}
                />
                <QueryFilterMenu
                  label="Tool"
                  options={toolOptions}
                  selectedValues={selectedValuesFor("tool")}
                  onToggle={(value, checked) =>
                    handleQueryDraftChange(
                      checked
                        ? addQueryToken(state.queryDraft, `tool:${value}`)
                        : removeQueryToken(state.queryDraft, `tool:${value}`),
                    )
                  }
                  onSelectAll={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "tool", toolOptions))}
                  onClear={() => handleQueryDraftChange(setQueryTokensForKey(state.queryDraft, "tool", []))}
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  Tip: click daily bars, hour blocks, or session rows to refine the view.
                </span>
              </div>
              {queryTerms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {queryTerms.map((term) => (
                    <FilterChip
                      key={term.raw}
                      label={term.raw}
                      onRemove={() => handleQueryDraftChange(removeQueryToken(state.queryDraft, term.raw))}
                    />
                  ))}
                </div>
              ) : null}
              {querySuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {querySuggestions.map((suggestion) => (
                    <button
                      key={suggestion.value}
                      type="button"
                      onClick={() =>
                        handleQueryDraftChange(applySuggestionToQuery(state.queryDraft, suggestion.value))
                      }
                      className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {queryWarnings.length > 0 ? (
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 text-sm text-amber-900">
                  {queryWarnings.join(" · ")}
                </div>
              ) : null}
            </div>

            {state.error ? (
              <div className="rounded-2xl border border-rose-300/70 bg-rose-50/80 p-4 text-sm text-rose-900">
                {state.error}
              </div>
            ) : null}

            {sessions.length >= 1000 ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-900">
                Showing the first 1,000 sessions. Narrow the date range for complete results.
              </div>
            ) : null}

            {isEmpty ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Select a date range and click Refresh to load usage.
              </div>
            ) : null}
          </CardContent>
        </Card>

        {displayTotals ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UsageSummaryCard
              title="Messages"
              value={`${activeAggregates.messages.total}`}
              sub={`${activeAggregates.messages.user} user · ${activeAggregates.messages.assistant} assistant`}
            />
            <UsageSummaryCard
              title="Tool calls"
              value={`${activeAggregates.tools.totalCalls}`}
              sub={`${activeAggregates.tools.uniqueTools} tools used`}
            />
            <UsageSummaryCard
              title="Errors"
              value={`${activeAggregates.messages.errors}`}
              sub={`${activeAggregates.messages.toolResults} tool results`}
            />
            <UsageSummaryCard
              title="Avg tokens / msg"
              value={formatTokens(
                activeAggregates.messages.total
                  ? Math.round(displayTotals.totalTokens / activeAggregates.messages.total)
                  : 0,
              )}
              sub={`Across ${activeAggregates.messages.total || 0} messages`}
            />
            <UsageSummaryCard
              title="Avg cost / msg"
              value={formatCost(
                activeAggregates.messages.total
                  ? displayTotals.totalCost / activeAggregates.messages.total
                  : 0,
                4,
              )}
              sub={
                hasMissingCost
                  ? `${formatCost(displayTotals.totalCost)} total · some cost entries missing`
                  : `${formatCost(displayTotals.totalCost)} total`
              }
            />
            <UsageSummaryCard
              title="Sessions"
              value={`${displaySessionCount}`}
              sub={`of ${totalSessions} in range`}
            />
            <UsageSummaryCard
              title="Throughput"
              value={
                insightStats.throughputTokensPerMin != null
                  ? `${formatTokens(Math.round(insightStats.throughputTokensPerMin))} tok/min`
                  : "—"
              }
              sub={
                insightStats.throughputCostPerMin != null
                  ? `${formatCost(insightStats.throughputCostPerMin, 4)} / min`
                  : "No active-time estimate"
              }
            />
            <UsageSummaryCard
              title="Error rate"
              value={`${(insightStats.errorRate * 100).toFixed(2)}%`}
              sub={`${activeAggregates.messages.errors} errors · ${formatDurationCompact(insightStats.avgDurationMs, {
                spaced: true,
              }) ?? "—"} avg session`}
              tone={
                insightStats.errorRate > 0.05
                  ? "bad"
                  : insightStats.errorRate > 0.01
                    ? "warn"
                    : "good"
              }
            />
            <UsageSummaryCard
              title="Cache hit rate"
              value={
                displayTotals.input + displayTotals.cacheRead > 0
                  ? `${((displayTotals.cacheRead / (displayTotals.input + displayTotals.cacheRead)) * 100).toFixed(
                      1,
                    )}%`
                  : "—"
              }
              sub={`${formatTokens(displayTotals.cacheRead)} cached · ${formatTokens(displayTotals.input + displayTotals.cacheRead)} prompt`}
              tone={
                displayTotals.input + displayTotals.cacheRead > 0 &&
                displayTotals.cacheRead / (displayTotals.input + displayTotals.cacheRead) > 0.6
                  ? "good"
                  : displayTotals.input + displayTotals.cacheRead > 0 &&
                      displayTotals.cacheRead / (displayTotals.input + displayTotals.cacheRead) > 0.3
                    ? "warn"
                    : "bad"
              }
            />
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <InsightListCard
            title="Top models"
            items={activeAggregates.byModel.slice(0, 5).map((entry) => ({
              label: entry.model ?? "unknown",
              value: formatCost(entry.totals.totalCost),
              sub: `${formatTokens(entry.totals.totalTokens)} · ${entry.count} msgs`,
            }))}
            emptyLabel="No model data"
          />
          <InsightListCard
            title="Top providers"
            items={activeAggregates.byProvider.slice(0, 5).map((entry) => ({
              label: entry.provider ?? "unknown",
              value: formatCost(entry.totals.totalCost),
              sub: `${formatTokens(entry.totals.totalTokens)} · ${entry.count} msgs`,
            }))}
            emptyLabel="No provider data"
          />
          <InsightListCard
            title="Top tools"
            items={activeAggregates.tools.tools.slice(0, 6).map((tool) => ({
              label: tool.name,
              value: `${tool.count}`,
              sub: "calls",
            }))}
            emptyLabel="No tool calls"
          />
          <InsightListCard
            title="Top agents"
            items={activeAggregates.byAgent.slice(0, 5).map((entry) => ({
              label: entry.agentId,
              value: formatCost(entry.totals.totalCost),
              sub: formatTokens(entry.totals.totalTokens),
            }))}
            emptyLabel="No agent data"
          />
          <InsightListCard
            title="Top channels"
            items={activeAggregates.byChannel.slice(0, 5).map((entry) => ({
              label: entry.channel,
              value: formatCost(entry.totals.totalCost),
              sub: formatTokens(entry.totals.totalTokens),
            }))}
            emptyLabel="No channel data"
          />
          <InsightListCard
            title="Peak error windows"
            items={[
              ...activeAggregates.daily
                .filter((day) => day.messages > 0 && day.errors > 0)
                .map((day) => ({
                  label: formatDayLabel(day.date),
                  value: `${((day.errors / day.messages) * 100).toFixed(2)}%`,
                  sub: `${day.errors} errors · ${day.messages} msgs`,
                }))
                .sort((a, b) => Number.parseFloat(b.value) - Number.parseFloat(a.value))
                .slice(0, 3),
              ...buildPeakErrorHours(aggregateSessions, state.timeZone).slice(0, 2),
            ]}
            emptyLabel="No error data"
          />
        </div>

        <UsageMosaicCard
          sessions={aggregateSessions}
          timeZone={state.timeZone}
          selectedHours={state.selectedHours}
          onSelectHour={handleSelectHour}
        />

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Sessions</CardTitle>
                  <CardDescription>
                    {filteredSessions.length} shown
                    {filteredSessions.length !== totalSessions ? ` · ${totalSessions} total` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={state.sessionsTab === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateState({ sessionsTab: "all" })}
                  >
                    All
                  </Button>
                  <Button
                    variant={state.sessionsTab === "recent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateState({ sessionsTab: "recent" })}
                  >
                    Recently viewed
                  </Button>
                  <select
                    value={state.sessionSort}
                    onChange={(event) => updateState({ sessionSort: event.target.value as UsageSessionSort })}
                    className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                  >
                    <option value="cost">Cost</option>
                    <option value="errors">Errors</option>
                    <option value="messages">Messages</option>
                    <option value="recent">Recent</option>
                    <option value="tokens">Tokens</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateState({
                        sessionSortDir: state.sessionSortDir === "desc" ? "asc" : "desc",
                      })
                    }
                  >
                    {state.sessionSortDir === "desc" ? "↓" : "↑"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Columns
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {DEFAULT_VISIBLE_COLUMNS.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column}
                          checked={state.visibleColumns.includes(column)}
                          onCheckedChange={(checked) =>
                            updateState({
                              visibleColumns: checked
                                ? [...state.visibleColumns, column]
                                : state.visibleColumns.filter((entry) => entry !== column),
                            })
                          }
                          onSelect={(event) => event.preventDefault()}
                        >
                          {column}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-4">
                  <span>
                    {state.chartMode === "tokens"
                      ? formatTokens(
                          sessionsTableRows.reduce((sum, session) => sum + getSessionValue(session), 0) /
                            Math.max(sessionsTableRows.length, 1),
                        )
                      : formatCost(
                          sessionsTableRows.reduce((sum, session) => sum + getSessionValue(session), 0) /
                            Math.max(sessionsTableRows.length, 1),
                        )}{" "}
                    avg
                  </span>
                  <span>
                    {sessionsTableRows.reduce(
                      (sum, session) => sum + (session.usage?.messageCounts?.errors ?? 0),
                      0,
                    )}{" "}
                    errors
                  </span>
                </div>
                {state.selectedSessions.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateState({ selectedSessions: [], ...DEFAULT_DETAIL_STATE })}
                  >
                    Clear selection
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {state.sessionsTab === "recent" && recentEntries.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No recently viewed sessions yet.</div>
              ) : sessionsTableRows.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No sessions match the current filters.</div>
              ) : (
                <div className="max-h-[760px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                      <TableRow>
                        <TableHead>Session</TableHead>
                        {state.visibleColumns.includes("channel") ? <TableHead>Channel</TableHead> : null}
                        {state.visibleColumns.includes("agent") ? <TableHead>Agent</TableHead> : null}
                        {state.visibleColumns.includes("provider") ? <TableHead>Provider</TableHead> : null}
                        {state.visibleColumns.includes("model") ? <TableHead>Model</TableHead> : null}
                        {state.visibleColumns.includes("messages") ? <TableHead>Messages</TableHead> : null}
                        {state.visibleColumns.includes("tools") ? <TableHead>Tools</TableHead> : null}
                        {state.visibleColumns.includes("errors") ? <TableHead>Errors</TableHead> : null}
                        {state.visibleColumns.includes("duration") ? <TableHead>Duration</TableHead> : null}
                        <TableHead>{state.chartMode === "tokens" ? "Tokens" : "Cost"}</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsTableRows.map((session) => (
                        <TableRow
                          key={session.key}
                          data-state={selectedSet.has(session.key) ? "selected" : undefined}
                          className="cursor-pointer"
                          onClick={(event) => handleSelectSession(session.key, event.shiftKey)}
                        >
                          <TableCell className="max-w-[320px]">
                            <div className="truncate font-medium">{getSessionDisplayLabel(session)}</div>
                            <div className="truncate text-xs text-muted-foreground">{session.key}</div>
                          </TableCell>
                          {state.visibleColumns.includes("channel") ? (
                            <TableCell>{session.channel ?? "—"}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("agent") ? (
                            <TableCell>{session.agentId ?? "—"}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("provider") ? (
                            <TableCell>{session.modelProvider ?? session.providerOverride ?? "—"}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("model") ? <TableCell>{session.model ?? "—"}</TableCell> : null}
                          {state.visibleColumns.includes("messages") ? (
                            <TableCell>{session.usage?.messageCounts?.total ?? 0}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("tools") ? (
                            <TableCell>{session.usage?.toolUsage?.totalCalls ?? 0}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("errors") ? (
                            <TableCell>{session.usage?.messageCounts?.errors ?? 0}</TableCell>
                          ) : null}
                          {state.visibleColumns.includes("duration") ? (
                            <TableCell>{formatDurationCompact(session.usage?.durationMs, { spaced: true }) ?? "—"}</TableCell>
                          ) : null}
                          <TableCell className="font-medium">
                            {state.chartMode === "tokens"
                              ? formatTokens(getSessionValue(session))
                              : formatCost(getSessionValue(session))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {session.updatedAt ? new Date(session.updatedAt).toLocaleString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {state.selectedSessions.length > 1 ? (
                <div className="border-t border-border/60 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Selected ({selectedSessionEntries.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSessionEntries.map((session) => (
                      <Badge key={session.key} variant="outline" className="rounded-full px-3 py-1">
                        {getSessionDisplayLabel(session)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <DailyUsageCard
              daily={filteredDaily}
              selectedDays={state.selectedDays}
              chartMode={state.chartMode}
              dailyChartMode={state.dailyChartMode}
              onChartModeChange={(mode) => updateState({ dailyChartMode: mode })}
              onSelectDay={handleSelectDay}
            />
            {displayTotals ? <CostBreakdownCard totals={displayTotals} mode={state.chartMode} /> : null}
          </div>
        </div>

        {selectedSession ? (
          <SessionDetailPanel
            session={selectedSession}
            timeSeries={state.timeSeries}
            timeSeriesLoading={state.timeSeriesLoading}
            timeSeriesMode={state.timeSeriesMode}
            timeSeriesBreakdownMode={state.timeSeriesBreakdownMode}
            timeSeriesCursorStart={state.timeSeriesCursorStart}
            timeSeriesCursorEnd={state.timeSeriesCursorEnd}
            sessionLogs={state.sessionLogs}
            sessionLogsLoading={state.sessionLogsLoading}
            sessionLogsExpanded={state.sessionLogsExpanded}
            logFilters={{
              roles: state.logFilterRoles,
              tools: state.logFilterTools,
              hasTools: state.logFilterHasTools,
              query: state.logFilterQuery,
            }}
            startDate={state.startDate}
            endDate={state.endDate}
            selectedDays={state.selectedDays}
            contextExpanded={state.contextExpanded}
            onTimeSeriesModeChange={(mode) => updateState({ timeSeriesMode: mode })}
            onTimeSeriesBreakdownChange={(mode) =>
              updateState({ timeSeriesBreakdownMode: mode })
            }
            onTimeSeriesCursorRangeChange={(start, end) =>
              updateState({ timeSeriesCursorStart: start, timeSeriesCursorEnd: end })
            }
            onToggleSessionLogsExpanded={() =>
              updateState({ sessionLogsExpanded: !state.sessionLogsExpanded })
            }
            onLogFilterRolesChange={(roles) => updateState({ logFilterRoles: roles })}
            onLogFilterToolsChange={(tools) => updateState({ logFilterTools: tools })}
            onLogFilterHasToolsChange={(value) => updateState({ logFilterHasTools: value })}
            onLogFilterQueryChange={(query) => updateState({ logFilterQuery: query })}
            onLogFilterClear={() =>
              updateState({
                logFilterRoles: [],
                logFilterTools: [],
                logFilterHasTools: false,
                logFilterQuery: "",
              })
            }
            onToggleContextExpanded={() => updateState({ contextExpanded: !state.contextExpanded })}
          />
        ) : (
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex items-center gap-4 p-6 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" />
              Select a single session to inspect usage over time, logs, and system prompt context.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default UsagePage;
