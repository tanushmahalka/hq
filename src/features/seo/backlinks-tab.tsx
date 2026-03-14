import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Link2,
  RefreshCw,
  Shield,
  Users,
  X,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChip, InlineEmptyState, SummaryCard } from "./shared";
import {
  formatDate,
  formatNumber,
  formatOptionalDecimal,
  toTitleCase,
} from "./utils";
import type {
  BacklinkHistoryPoint,
  BacklinksData,
  BacklinkSource,
  BacklinksSubview,
  CompetitorBacklink,
  LinkOpportunity,
} from "./types";

/* ---------------------------------------------------------------------------
 * Status helpers
 * --------------------------------------------------------------------------- */

const STATUS_DOT: Record<string, string> = {
  live: "bg-emerald-400",
  lost: "bg-red-400",
  unverified: "bg-amber-400",
  unknown: "bg-slate-300",
  new: "bg-sky-400",
  reviewed: "bg-violet-400",
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
  thread_open: "bg-amber-400",
  won: "bg-emerald-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "swarm-status-dot inline-block",
        STATUS_DOT[status] ?? "bg-slate-300",
      )}
    />
  );
}

function ScorePill({
  value,
  max = 100,
  variant = "default",
}: {
  value: string | null;
  max?: number;
  variant?: "default" | "risk";
}) {
  if (!value) return <span className="text-muted-foreground/40">--</span>;
  const num = Number(value);
  if (Number.isNaN(num)) return <span className="text-muted-foreground/40">--</span>;
  const pct = num / max;
  const color =
    variant === "risk"
      ? pct > 0.6
        ? "text-red-500"
        : pct > 0.3
          ? "text-amber-500"
          : "text-emerald-500"
      : pct > 0.7
        ? "text-emerald-500"
        : pct > 0.4
          ? "text-amber-500"
          : "text-muted-foreground/50";
  return <span className={cn("tabular-nums text-sm", color)}>{num.toFixed(0)}</span>;
}

/* ---------------------------------------------------------------------------
 * Sort header (reused)
 * --------------------------------------------------------------------------- */

function SortHeader({
  label,
  isSorted,
  onClick,
}: {
  label: string;
  isSorted: false | "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 px-3 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 opacity-45",
          isSorted && "opacity-100 text-foreground",
        )}
      />
    </Button>
  );
}

/* ---------------------------------------------------------------------------
 * BacklinksTab
 * --------------------------------------------------------------------------- */

export function BacklinksTab({ siteId }: { siteId: number }) {
  const [subview, setSubview] = useState<BacklinksSubview>("existing");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const deferredSearch = useDeferredValue(search);
  const utils = trpc.useUtils();

  const query = trpc.seo.backlinks.useQuery(
    { siteId },
    { enabled: siteId > 0 },
  );
  const captureSnapshot = trpc.seo.captureBacklinkSnapshot.useMutation({
    onSuccess: (result) => {
      utils.seo.backlinks.invalidate({ siteId });
      toast.success("Backlink snapshot captured", {
        description: `${formatNumber(result.siteBacklinksCount)} site backlinks saved for ${formatDate(result.capturedAt)}.`,
      });
    },
    onError: (error) => {
      toast.error("Could not capture backlink snapshot", {
        description: error.message,
      });
    },
  });

  const data = query.data as BacklinksData | undefined;
  const summary = data?.summary;

  const subviewCounts = useMemo(
    () => ({
      existing: data?.existing.length ?? 0,
      competitors: data?.competitor.length ?? 0,
      opportunities: data?.opportunities.length ?? 0,
    }),
    [data],
  );

  // Reset selection when switching subviews
  const handleSubviewChange = (sv: BacklinksSubview) => {
    setSubview(sv);
    setSelectedId(null);
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Subtab bar */}
      <div className="flex items-center justify-between gap-4 border-b mb-4">
        <div className="flex items-center gap-0">
          {(
            [
              { key: "existing", label: "Existing", count: subviewCounts.existing },
              { key: "competitors", label: "Competitors", count: subviewCounts.competitors },
              { key: "opportunities", label: "Opportunities", count: subviewCounts.opportunities },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSubviewChange(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px",
                subview === tab.key
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="text-[11px] text-muted-foreground font-normal">
                {query.isLoading ? "" : formatNumber(tab.count)}
              </span>
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-2"
          disabled={captureSnapshot.isPending || siteId <= 0}
          onClick={() => captureSnapshot.mutate({ siteId })}
        >
          <RefreshCw
            className={cn("size-3.5", captureSnapshot.isPending && "animate-spin")}
          />
          Capture snapshot
        </Button>
      </div>

      {/* Summary strip */}
      {query.isLoading ? (
        <div className="flex items-center gap-8 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
      ) : summary ? (
        <SummaryStrip subview={subview} summary={summary} />
      ) : null}

      {!query.isLoading && data && subview !== "opportunities" ? <BacklinkTrends data={data} /> : null}

      {/* Loading */}
      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : !data ? (
        <InlineEmptyState
          title="Could not load backlink data"
          description="Try refreshing the page."
        />
      ) : (
        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left: table */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Search + filters */}
            <div className="mb-3 flex items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by domain, URL, anchor, or type..."
                className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 flex-1"
              />
              <StatusFilters
                subview={subview}
                active={statusFilter}
                onChange={setStatusFilter}
              />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex-1 min-h-0">
              {subview === "existing" ? (
                <ExistingTable
                  rows={data.existing}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : subview === "competitors" ? (
                <CompetitorTable
                  rows={data.competitor}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <OpportunityTable
                  rows={data.opportunities}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <DetailPanel
            subview={subview}
            selectedId={selectedId}
            data={data}
            siteId={siteId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Summary strip
 * --------------------------------------------------------------------------- */

function NetBadge({ gained, lost }: { gained: number; lost: number }) {
  if (gained === 0 && lost === 0) return null;
  return (
    <span className="text-[11px] tabular-nums text-muted-foreground/60 mt-0.5 inline-block">
      <span className="text-emerald-500">+{gained}</span>
      {" / "}
      <span className="text-red-400">-{lost}</span>
    </span>
  );
}

function SummaryStrip({
  subview,
  summary,
}: {
  subview: BacklinksSubview;
  summary: BacklinksData["summary"];
}) {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-8">
        {subview === "existing" ? (
          <>
            <div className="flex flex-col">
              <span className="text-2xl font-normal text-foreground tabular-nums">
                {formatNumber(summary.referringDomains)}
              </span>
              <span className="text-xs text-muted-foreground/60">Referring domains</span>
              <NetBadge gained={summary.newBacklinks} lost={summary.lostBacklinks} />
            </div>
            <SummaryCard label="Live backlinks" value={summary.liveBacklinks} />
            <SummaryCard label="Pages linked" value={summary.moneyPagesLinked} />
            <SummaryCard label="Avg authority" value={summary.avgAuthority} />
          </>
        ) : subview === "competitors" ? (
          <>
            <SummaryCard label="Competitors tracked" value={summary.competitorDomainsTracked} />
            <SummaryCard label="Backlinks tracked" value={summary.competitorBacklinksTracked} />
            <SummaryCard label="Link gap" value={summary.linkGapCount} />
          </>
        ) : (
          <>
            <SummaryCard label="New" value={summary.newOpportunities} />
            <SummaryCard label="High confidence" value={summary.highConfidenceOpportunities} />
            <SummaryCard label="Approved" value={summary.approvedForOutreach} />
            <SummaryCard label="Rejected" value={summary.rejectedOpportunities} />
          </>
        )}
      </div>

      {/* Broken backlinks callout */}
      {subview === "existing" && summary.brokenBacklinks > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3.5 py-2">
          <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">
            {formatNumber(summary.brokenBacklinks)} broken backlink{summary.brokenBacklinks !== 1 ? "s" : ""} detected — these are returning errors and losing value.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Smooth monotone cubic spline (shared with competitor-trends)
 * --------------------------------------------------------------------------- */

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  if (points.length === 2)
    return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  const n = points.length;
  const d: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    d[i] = (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x || 1);
  }

  m[0] = d[0];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  m[n - 1] = d[n - 2];

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const mag = alpha * alpha + beta * beta;
      if (mag > 9) {
        const tau = 3 / Math.sqrt(mag);
        m[i] = tau * alpha * d[i];
        m[i + 1] = tau * beta * d[i];
      }
    }
  }

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (points[i + 1].x - points[i].x) / 3;
    const cp1x = points[i].x + dx;
    const cp1y = points[i].y + m[i] * dx;
    const cp2x = points[i + 1].x - dx;
    const cp2y = points[i + 1].y - m[i + 1] * dx;
    path += `C${cp1x},${cp1y},${cp2x},${cp2y},${points[i + 1].x},${points[i + 1].y}`;
  }
  return path;
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  let nice: number;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3) nice = 2;
  else if (frac <= 7) nice = 5;
  else nice = 10;
  return nice * pow;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatShortDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(d);
}

/* ---------------------------------------------------------------------------
 * Backlink trends — smooth chart with competitor toggle + combobox
 * --------------------------------------------------------------------------- */

type TrendMetric = "backlinks" | "referringDomains";

const TREND_METRICS: { key: TrendMetric; title: string }[] = [
  { key: "backlinks", title: "Backlinks" },
  { key: "referringDomains", title: "Referring domains" },
];

function extractMetricValue(point: BacklinkHistoryPoint, metric: TrendMetric): number {
  switch (metric) {
    case "backlinks":
      return point.backlinksCount ?? 0;
    case "referringDomains":
      return point.referringDomainsCount ?? 0;
  }
}

type BacklinkTrendSeries = {
  id: string | number;
  label: string;
  color: string;
  isPrimary: boolean;
  points: Array<{ date: Date; value: number }>;
};

const TREND_COLORS = [
  "var(--swarm-violet)",
  "#f97316",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#a855f7",
];

const PRIMARY_COLOR = "#dc2626";

type CompetitorOption = {
  id: number;
  label: string;
  domain: string;
  latestValue: number;
};

function BacklinkTrends({ data }: { data: BacklinksData }) {
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<Set<number>>(new Set());
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>("backlinks");

  // Build competitor options for the combobox
  const competitorOptions = useMemo<CompetitorOption[]>(() => {
    return data.history.competitors
      .map((c) => {
        const points = c.history
          .map((p) => ({ date: new Date(p.capturedAt), value: extractMetricValue(p, selectedMetric) }))
          .filter((p) => !Number.isNaN(p.date.getTime()));
        return {
          id: c.siteCompetitorId,
          label: c.competitorLabel,
          domain: c.competitorDomain,
          latestValue: points[points.length - 1]?.value ?? 0,
        };
      })
      .sort((a, b) => b.latestValue - a.latestValue);
  }, [data.history.competitors, selectedMetric]);

  const toggleCompetitor = useCallback((id: number) => {
    setSelectedCompetitorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build series
  const series = useMemo<BacklinkTrendSeries[]>(() => {
    const siteSeries: BacklinkTrendSeries = {
      id: "site",
      label: "You",
      color: PRIMARY_COLOR,
      isPrimary: true,
      points: data.history.site
        .map((p) => ({ date: new Date(p.capturedAt), value: extractMetricValue(p, selectedMetric) }))
        .filter((p) => !Number.isNaN(p.date.getTime())),
    };

    const result: BacklinkTrendSeries[] = siteSeries.points.length > 0 ? [siteSeries] : [];

    if (showCompetitors) {
      const activeIds = selectedCompetitorIds.size > 0
        ? selectedCompetitorIds
        : new Set(competitorOptions.slice(0, 3).map((c) => c.id));

      let colorIdx = 0;
      for (const comp of data.history.competitors) {
        if (!activeIds.has(comp.siteCompetitorId)) continue;
        const points = comp.history
          .map((p) => ({ date: new Date(p.capturedAt), value: extractMetricValue(p, selectedMetric) }))
          .filter((p) => !Number.isNaN(p.date.getTime()));
        if (points.length === 0) continue;
        result.push({
          id: comp.siteCompetitorId,
          label: comp.competitorLabel,
          color: TREND_COLORS[colorIdx % TREND_COLORS.length],
          isPrimary: false,
          points,
        });
        colorIdx++;
      }
    }

    return result;
  }, [data.history, showCompetitors, selectedCompetitorIds, competitorOptions, selectedMetric]);

  // Determine effective selected set for combobox display
  const effectiveSelectedIds = useMemo(() => {
    if (selectedCompetitorIds.size > 0) return selectedCompetitorIds;
    return new Set(competitorOptions.slice(0, 3).map((c) => c.id));
  }, [selectedCompetitorIds, competitorOptions]);

  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card mb-4">
        <InlineEmptyState
          title="No backlink history yet"
          description="Capture snapshots over time to see your backlink growth here."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card mb-4 p-5 swarm-card">
      {/* Header with metric toggle + competitor controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">Backlink trends</h2>
          <div className="flex items-center gap-0">
            {TREND_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMetric(m.key)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full transition-colors",
                  selectedMetric === m.key
                    ? "bg-foreground/5 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Competitor combobox — shown when toggle is on */}
          {showCompetitors && competitorOptions.length > 0 && (
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-border/50 text-xs font-normal"
                >
                  {effectiveSelectedIds.size} competitor{effectiveSelectedIds.size !== 1 ? "s" : ""}
                  <ChevronsUpDown className="size-3 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search competitors..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>
                      <span className="text-xs text-muted-foreground/50">No competitors found</span>
                    </CommandEmpty>
                    <CommandGroup>
                      {competitorOptions.map((opt) => {
                        const selected = effectiveSelectedIds.has(opt.id);
                        return (
                          <CommandItem
                            key={opt.id}
                            value={`${opt.label} ${opt.domain}`}
                            onSelect={() => toggleCompetitor(opt.id)}
                            className="text-xs"
                          >
                            <div className={cn(
                              "size-3.5 rounded border flex items-center justify-center mr-1.5 shrink-0",
                              selected ? "bg-foreground border-foreground" : "border-border",
                            )}>
                              {selected && <Check className="size-2.5 text-background" />}
                            </div>
                            <span className="truncate flex-1">{opt.label}</span>
                            <span className="text-muted-foreground/50 tabular-nums ml-2">
                              {formatCompactNumber(opt.latestValue)}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {/* Compare toggle */}
          {competitorOptions.length > 0 && (
            <Button
              variant={showCompetitors ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 gap-1.5 text-xs font-normal",
                !showCompetitors && "border-border/50",
              )}
              onClick={() => setShowCompetitors((v) => !v)}
            >
              <Users className="size-3" />
              Compare
            </Button>
          )}
        </div>
      </div>

      {/* Chart */}
      <BacklinkTrendChart series={series} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * BacklinkTrendChart — smooth curves, gradient fill, hover interaction
 * --------------------------------------------------------------------------- */

const CHART_W_TOTAL = 820;
const CHART_H_TOTAL = 260;
const CHART_PAD = { top: 16, right: 56, bottom: 32, left: 8 };
const INNER_W = CHART_W_TOTAL - CHART_PAD.left - CHART_PAD.right;
const INNER_H = CHART_H_TOTAL - CHART_PAD.top - CHART_PAD.bottom;

function BacklinkTrendChart({ series }: { series: BacklinkTrendSeries[] }) {
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | number | null>(null);
  const [hoveredX, setHoveredX] = useState<number | null>(null);

  // Domains
  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const p of s.points) {
        const t = p.date.getTime();
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
    const span = Math.max(max - min, 86_400_000);
    return { minTime: min - span * 0.04, maxTime: max + span * 0.04 };
  }, [series]);

  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const p of s.points) {
        if (p.value < min) min = p.value;
        if (p.value > max) max = p.value;
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    if (min === max) { min -= 1; max += 1; }
    const span = Math.max(max - min, 1);
    // For metrics that are always positive (backlinks, referring domains), floor at 0
    const flooredMin = min < 0 ? min - span * 0.08 : 0;
    return { minVal: flooredMin, maxVal: max + span * 0.08 };
  }, [series]);

  const xScale = useCallback(
    (t: number) => CHART_PAD.left + ((t - minTime) / (maxTime - minTime)) * INNER_W,
    [minTime, maxTime],
  );
  const yScale = useCallback(
    (v: number) => CHART_PAD.top + INNER_H - ((v - minVal) / (maxVal - minVal)) * INNER_H,
    [minVal, maxVal],
  );

  // Ticks
  const yTicks = useMemo(() => {
    const range = maxVal - minVal;
    const step = niceStep(range, 4);
    const ticks: number[] = [];
    let tick = 0;
    while (tick <= maxVal) {
      ticks.push(tick);
      tick += step;
    }
    return ticks;
  }, [minVal, maxVal]);

  const xTicks = useMemo(() => {
    const span = maxTime - minTime;
    const count = 5;
    const step = span / count;
    return Array.from({ length: count + 1 }, (_, i) => new Date(minTime + step * i));
  }, [minTime, maxTime]);

  // Paths
  const seriesPaths = useMemo(() => {
    return series.map((s) => {
      const pts = s.points.map((p) => ({
        x: xScale(p.date.getTime()),
        y: yScale(p.value),
      }));
      const linePath = smoothPath(pts);
      // Close area path for primary (gradient fill)
      let areaPath = "";
      if (s.isPrimary && linePath) {
        const lastPt = pts[pts.length - 1];
        const firstPt = pts[0];
        areaPath = `${linePath}L${lastPt.x},${yScale(0)}L${firstPt.x},${yScale(0)}Z`;
      }
      return { ...s, linePath, areaPath, screenPoints: pts };
    });
  }, [series, xScale, yScale]);

  // Hover nearest
  const hoveredPoints = useMemo(() => {
    if (hoveredX === null) return null;
    const t = minTime + ((hoveredX - CHART_PAD.left) / INNER_W) * (maxTime - minTime);

    return seriesPaths.map((s) => {
      let nearest = s.points[0];
      let nearestDist = Infinity;
      for (const p of s.points) {
        const dist = Math.abs(p.date.getTime() - t);
        if (dist < nearestDist) { nearestDist = dist; nearest = p; }
      }
      return {
        seriesId: s.id,
        label: s.label,
        color: s.color,
        isPrimary: s.isPrimary,
        value: nearest?.value ?? 0,
        cx: nearest ? xScale(nearest.date.getTime()) : 0,
        cy: nearest ? yScale(nearest.value) : 0,
        date: nearest?.date ?? new Date(),
      };
    });
  }, [hoveredX, seriesPaths, minTime, maxTime, xScale, yScale]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * CHART_W_TOTAL;
      if (svgX >= CHART_PAD.left && svgX <= CHART_W_TOTAL - CHART_PAD.right) {
        setHoveredX(svgX);
      } else {
        setHoveredX(null);
      }
    },
    [],
  );

  // Legend value map for hover
  const hoveredValueMap = useMemo(() => {
    if (!hoveredPoints) return null;
    const map = new Map<string | number, number>();
    for (const p of hoveredPoints) map.set(p.seriesId, p.value);
    return map;
  }, [hoveredPoints]);

  const isHovering = hoveredX !== null;

  return (
    <div className="w-full">
      {/* Legend — updates values on hover */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">
        {isHovering && hoveredPoints && (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums mr-1">
            {formatShortDate(hoveredPoints[0]?.date)}
          </span>
        )}
        {series.map((s) => {
          const dimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
          const displayValue = isHovering && hoveredValueMap
            ? (hoveredValueMap.get(s.id) ?? s.points[s.points.length - 1]?.value ?? 0)
            : s.points[s.points.length - 1]?.value ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                "flex items-center gap-1.5 text-xs transition-opacity duration-200 hover:opacity-100",
                dimmed ? "opacity-30" : "opacity-100",
              )}
              onMouseEnter={() => setHoveredSeriesId(s.id)}
              onMouseLeave={() => setHoveredSeriesId(null)}
            >
              <span
                className={cn("shrink-0 rounded-full", s.isPrimary ? "size-2.5" : "size-2")}
                style={{ backgroundColor: s.color }}
              />
              <span className={cn(s.isPrimary && "font-medium")}>{s.label}</span>
              <span className="text-muted-foreground/50 tabular-nums">
                {formatCompactNumber(displayValue)}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${CHART_W_TOTAL} ${CHART_H_TOTAL}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredX(null); setHoveredSeriesId(null); }}
      >
        <defs>
          <linearGradient id="bl-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY_COLOR} stopOpacity="0.12" />
            <stop offset="100%" stopColor={PRIMARY_COLOR} stopOpacity="0.01" />
          </linearGradient>
          <filter id="bl-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={CHART_PAD.left}
            x2={CHART_W_TOTAL - CHART_PAD.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="currentColor"
            className="text-border/20"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Y labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={CHART_W_TOTAL - CHART_PAD.right + 8}
            y={yScale(tick)}
            dominantBaseline="central"
            className="fill-muted-foreground/40 text-[9px]"
          >
            {formatCompactNumber(tick)}
          </text>
        ))}

        {/* X labels */}
        {xTicks.map((tick, i) => (
          <text
            key={tick.getTime()}
            x={xScale(tick.getTime())}
            y={CHART_H_TOTAL - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground/40 text-[9px]"
          >
            {formatShortDate(tick)}
          </text>
        ))}

        {/* Area fill for primary */}
        {seriesPaths.map((s) =>
          s.isPrimary && s.areaPath ? (
            <path
              key={`area-${s.id}`}
              d={s.areaPath}
              fill="url(#bl-area-gradient)"
              className="analytics-area-fade"
            />
          ) : null,
        )}

        {/* Lines + dots */}
        {seriesPaths.map((s) => {
          const dimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
          const highlighted = hoveredSeriesId === s.id;

          if (s.screenPoints.length === 1) {
            return (
              <circle
                key={s.id}
                cx={s.screenPoints[0].x}
                cy={s.screenPoints[0].y}
                r={4}
                fill={s.color}
                className={cn("transition-opacity duration-200", dimmed ? "opacity-15" : "opacity-100")}
              />
            );
          }

          return (
            <g key={s.id}>
              <path
                d={s.linePath}
                fill="none"
                stroke={s.color}
                strokeWidth={s.isPrimary || highlighted ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={cn("transition-all duration-200", dimmed ? "opacity-15" : "opacity-100")}
                onMouseEnter={() => setHoveredSeriesId(s.id)}
                onMouseLeave={() => setHoveredSeriesId(null)}
              />
              {s.screenPoints.map((pt, j) => (
                <circle
                  key={j}
                  cx={pt.x}
                  cy={pt.y}
                  r={highlighted ? 3 : 2}
                  fill={s.color}
                  vectorEffect="non-scaling-stroke"
                  className={cn(
                    "transition-all duration-200",
                    dimmed ? "opacity-0" : highlighted ? "opacity-100" : "opacity-40",
                  )}
                />
              ))}
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hoveredX !== null && (
          <line
            x1={hoveredX}
            x2={hoveredX}
            y1={CHART_PAD.top}
            y2={CHART_PAD.top + INNER_H}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
          />
        )}

        {/* Hover dots */}
        {hoveredPoints?.map((p) => {
          const dimmed = hoveredSeriesId !== null && hoveredSeriesId !== p.seriesId;
          if (dimmed) return null;
          return (
            <circle
              key={p.seriesId}
              cx={p.cx}
              cy={p.cy}
              r={5}
              fill={p.color}
              filter="url(#bl-dot-glow)"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Status filters
 * --------------------------------------------------------------------------- */

function StatusFilters({
  subview,
  active,
  onChange,
}: {
  subview: BacklinksSubview;
  active: string;
  onChange: (status: string) => void;
}) {
  const statuses =
    subview === "existing"
      ? ["all", "live", "lost", "unverified"]
      : subview === "competitors"
        ? ["all", "live", "lost", "unknown"]
        : ["all", "new", "reviewed", "approved", "rejected"];

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {statuses.map((s) => (
        <FilterChip
          key={s}
          active={active === s}
          label={s === "all" ? "All" : toTitleCase(s)}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Search helper
 * --------------------------------------------------------------------------- */

function matchesSearch(search: string, ...fields: Array<string | null | undefined>): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

/* ---------------------------------------------------------------------------
 * Existing backlinks table
 * --------------------------------------------------------------------------- */

const existingColumns: ColumnDef<BacklinkSource>[] = [
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[200px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceUrl || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetPage",
    accessorFn: (r) => r.targetPageTitle ?? r.targetUrl,
    header: "Target page",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[180px]">
        {row.original.targetPageTitle || row.original.targetUrl}
      </p>
    ),
  },
  {
    id: "anchor",
    accessorKey: "anchorText",
    header: "Anchor",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[140px]">
        {row.original.anchorText || <span className="text-muted-foreground/30">--</span>}
      </p>
    ),
  },
  {
    id: "rel",
    accessorKey: "relAttr",
    header: "Rel",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{row.original.relAttr ?? "--"}</span>
    ),
  },
  {
    id: "authority",
    accessorFn: (r) => Number(r.authorityScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Authority" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.authorityScore} />,
  },
  {
    id: "lastSeen",
    accessorFn: (r) => r.lastSeenAt ?? "",
    header: ({ column }) => (
      <SortHeader label="Last seen" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{formatDate(row.original.lastSeenAt)}</span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <StatusDot status={row.original.status} />
        <span className="text-xs text-muted-foreground capitalize">{row.original.status}</span>
      </div>
    ),
  },
];

function ExistingTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: BacklinkSource[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(search, r.sourceDomain, r.sourceUrl, r.sourceTitle, r.targetUrl, r.anchorText);
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={existingColumns}
      data={filtered}
      initialSorting={[{ id: "lastSeen", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[800px]"
      emptyState={
        <InlineEmptyState
          title="No backlinks tracked yet"
          description="Once backlinks are imported or verified, they'll appear here."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Competitor backlinks table
 * --------------------------------------------------------------------------- */

const competitorBLColumns: ColumnDef<CompetitorBacklink>[] = [
  {
    id: "competitor",
    accessorFn: (r) => r.competitorLabel,
    header: ({ column }) => (
      <SortHeader label="Competitor" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-sm truncate">{row.original.competitorLabel}</span>
    ),
  },
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetUrl",
    accessorFn: (r) => r.targetUrl,
    header: "Target URL",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[180px]">{row.original.targetUrl}</p>
    ),
  },
  {
    id: "anchor",
    accessorKey: "anchorText",
    header: "Anchor",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[120px]">
        {row.original.anchorText || <span className="text-muted-foreground/30">--</span>}
      </p>
    ),
  },
  {
    id: "authority",
    accessorFn: (r) => Number(r.authorityScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Authority" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.authorityScore} />,
  },
  {
    id: "relevance",
    accessorFn: (r) => Number(r.relevanceScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Relevance" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.relevanceScore} />,
  },
  {
    id: "lastSeen",
    accessorFn: (r) => r.lastSeenAt ?? "",
    header: ({ column }) => (
      <SortHeader label="Last seen" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{formatDate(row.original.lastSeenAt)}</span>
    ),
  },
];

function CompetitorTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: CompetitorBacklink[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(search, r.competitorLabel, r.competitorDomain, r.sourceDomain, r.sourceUrl, r.sourceTitle, r.targetUrl, r.anchorText);
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={competitorBLColumns}
      data={filtered}
      initialSorting={[{ id: "authority", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[900px]"
      emptyState={
        <InlineEmptyState
          title="No competitor backlinks imported yet"
          description="They'll appear here after competitor backlink discovery runs."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Opportunities table
 * --------------------------------------------------------------------------- */

const opportunityColumns: ColumnDef<LinkOpportunity>[] = [
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetPage",
    accessorFn: (r) => r.targetPageTitle ?? r.targetPageUrl ?? "",
    header: "Target page",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[160px]">
        {row.original.targetPageTitle || row.original.targetPageUrl || "--"}
      </p>
    ),
  },
  {
    id: "type",
    accessorKey: "opportunityType",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{toTitleCase(row.original.opportunityType)}</span>
    ),
  },
  {
    id: "whyFit",
    accessorKey: "whyThisFits",
    header: "Why fit",
    cell: ({ row }) => (
      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.original.whyThisFits}</p>
    ),
  },
  {
    id: "confidence",
    accessorFn: (r) => Number(r.confidenceScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Confidence" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.confidenceScore} />,
  },
  {
    id: "risk",
    accessorFn: (r) => Number(r.riskScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Risk" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.riskScore} variant="risk" />,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <StatusDot status={row.original.status} />
        <span className="text-xs text-muted-foreground capitalize">{row.original.status}</span>
      </div>
    ),
  },
];

function OpportunityTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: LinkOpportunity[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(
          search,
          r.sourceDomain,
          r.sourceUrl,
          r.sourceTitle,
          r.opportunityType,
          r.whyThisFits,
          r.targetPageTitle,
          r.targetPageUrl,
          r.competitorLabel,
          r.prospectName,
        );
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={opportunityColumns}
      data={filtered}
      initialSorting={[{ id: "confidence", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[950px]"
      emptyState={
        <InlineEmptyState
          title="No opportunities available yet"
          description="They'll appear here after discovery runs or competitor-gap analysis."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel (right side)
 * --------------------------------------------------------------------------- */

function DetailPanel({
  subview,
  selectedId,
  data,
  siteId,
  onClose,
}: {
  subview: BacklinksSubview;
  selectedId: number | null;
  data: BacklinksData;
  siteId: number;
  onClose: () => void;
}) {
  if (selectedId === null) {
    return (
      <div className="w-[340px] shrink-0 border-l border-border/40 flex items-center justify-center">
        <p className="text-sm text-muted-foreground/40 text-center px-6">
          Select a row to inspect details
        </p>
      </div>
    );
  }

  if (subview === "existing") {
    const item = data.existing.find((r) => r.id === selectedId);
    if (!item) return null;
    return <ExistingDetail item={item} onClose={onClose} />;
  }

  if (subview === "competitors") {
    const item = data.competitor.find((r) => r.id === selectedId);
    if (!item) return null;
    return <CompetitorDetail item={item} onClose={onClose} />;
  }

  const item = data.opportunities.find((r) => r.id === selectedId);
  if (!item) return null;
  return <OpportunityDetail item={item} siteId={siteId} onClose={onClose} />;
}

/* ---------------------------------------------------------------------------
 * Detail panel: Existing backlink
 * --------------------------------------------------------------------------- */

function ExistingDetail({
  item,
  onClose,
}: {
  item: BacklinkSource;
  onClose: () => void;
}) {
  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5 break-all">{item.sourceDomain}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Target URL" value={item.targetUrl} link />
          <DetailRow label="Target page" value={item.targetPageTitle} />
          <DetailRow label="Anchor text" value={item.anchorText} />
          <DetailRow label="Rel" value={item.relAttr} />
          <DetailRow label="Link type" value={item.linkType ? toTitleCase(item.linkType) : null} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last seen" value={formatDate(item.lastSeenAt)} />
          <DetailRow label="Verified at" value={formatDate(item.verifiedAt)} />
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {item.sourceUrl && (
          <div className="mt-4">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel: Competitor backlink
 * --------------------------------------------------------------------------- */

function CompetitorDetail({
  item,
  onClose,
}: {
  item: CompetitorBacklink;
  onClose: () => void;
}) {
  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">{item.competitorLabel} ({item.competitorDomain})</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Source title" value={item.sourceTitle} />
          <DetailRow label="Target URL" value={item.targetUrl} link />
          <DetailRow label="Anchor text" value={item.anchorText} />
          <DetailRow label="Rel" value={item.relAttr} />
          <DetailRow label="Link type" value={item.linkType ? toTitleCase(item.linkType) : null} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last seen" value={formatDate(item.lastSeenAt)} />
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {item.sourceUrl && (
          <div className="mt-4">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel: Opportunity
 * --------------------------------------------------------------------------- */

function OpportunityDetail({
  item,
  siteId,
  onClose,
}: {
  item: LinkOpportunity;
  siteId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const mutation = trpc.seo.updateOpportunityStatus.useMutation({
    onSuccess: () => {
      utils.seo.backlinks.invalidate({ siteId });
    },
  });

  const handleAction = (status: string) => {
    mutation.mutate({ opportunityId: item.id, status: status as "approved" | "rejected" | "reviewed" });
  };

  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5 break-all">{item.sourceDomain}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Why this fits — prominent */}
        <div className="rounded-lg bg-[var(--swarm-violet-dim)] px-3.5 py-3 mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="size-3.5 text-[var(--swarm-violet)]" />
            <span className="text-xs font-medium text-[var(--swarm-violet)]">Why this fits</span>
          </div>
          <p className="text-sm leading-relaxed">{item.whyThisFits}</p>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Target page" value={item.targetPageTitle || item.targetPageUrl} />
          <DetailRow label="Type" value={toTitleCase(item.opportunityType)} />
          <DetailRow label="Discovered from" value={toTitleCase(item.discoveredFrom)} />
          <DetailRow label="Suggested anchor" value={item.suggestedAnchorText} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="Confidence" value={formatOptionalDecimal(item.confidenceScore)} />
          <DetailRow label="Risk" value={formatOptionalDecimal(item.riskScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last reviewed" value={formatDate(item.lastReviewedAt)} />
          {item.prospectName && <DetailRow label="Prospect" value={item.prospectName} />}
          {item.competitorLabel && <DetailRow label="Competitor" value={item.competitorLabel} />}
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-2">
          {item.status !== "approved" && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={mutation.isPending}
              onClick={() => handleAction("approved")}
            >
              <Check className="size-3" />
              Approve for outreach
            </Button>
          )}
          {item.status !== "rejected" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={mutation.isPending}
              onClick={() => handleAction("rejected")}
            >
              <X className="size-3" />
              Reject
            </Button>
          )}
          {item.status === "new" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              disabled={mutation.isPending}
              onClick={() => handleAction("reviewed")}
            >
              Mark reviewed
            </Button>
          )}
        </div>

        {/* Secondary links */}
        <div className="mt-4 flex items-center gap-4">
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          )}
          {item.targetPageUrl && (
            <a
              href={item.targetPageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link2 className="size-3" />
              Open target page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail row helper
 * --------------------------------------------------------------------------- */

function DetailRow({
  label,
  value,
  link,
  children,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 min-w-0 text-sm break-all">
        {children ??
          (value && link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:underline underline-offset-2 text-foreground/80 break-all"
            >
              {value}
            </a>
          ) : (
            <span>{value || <span className="text-muted-foreground/40">Not available</span>}</span>
          ))}
      </div>
    </div>
  );
}
