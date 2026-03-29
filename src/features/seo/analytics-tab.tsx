import { useState, useMemo, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEmptyState } from "@/features/seo/shared";
import {
  formatCurrency,
  formatPercent,
  formatDuration,
  formatNumber,
  computeDelta,
} from "@/features/seo/utils";

type DatePreset = "7d" | "30d" | "90d" | "custom";

const PRESETS: { key: DatePreset; label: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const CHANNEL_COLORS: Record<string, { bg: string; bar: string }> = {
  organic: { bg: "bg-emerald-500", bar: "from-emerald-400 to-emerald-500" },
  "organic search": { bg: "bg-emerald-500", bar: "from-emerald-400 to-emerald-500" },
  paid: { bg: "bg-violet-500", bar: "from-violet-400 to-violet-500" },
  "paid search": { bg: "bg-violet-500", bar: "from-violet-400 to-violet-500" },
  social: { bg: "bg-sky-500", bar: "from-sky-400 to-sky-500" },
  email: { bg: "bg-amber-500", bar: "from-amber-400 to-amber-500" },
  referral: { bg: "bg-rose-500", bar: "from-rose-400 to-rose-500" },
  direct: { bg: "bg-slate-400", bar: "from-slate-300 to-slate-400" },
  display: { bg: "bg-indigo-400", bar: "from-indigo-300 to-indigo-400" },
  video: { bg: "bg-pink-400", bar: "from-pink-300 to-pink-400" },
};

function getChannelColor(channel: string) {
  const key = channel.toLowerCase();
  return CHANNEL_COLORS[key] ?? { bg: "bg-slate-300", bar: "from-slate-200 to-slate-300" };
}

export function AnalyticsTab({ siteId }: { siteId: number }) {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState(daysAgo(30));
  const [customEnd, setCustomEnd] = useState(today());

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom") {
      return { startDate: customStart, endDate: customEnd };
    }
    const days = PRESETS.find((p) => p.key === preset)?.days ?? 30;
    return { startDate: daysAgo(days), endDate: today() };
  }, [preset, customStart, customEnd]);

  const query = trpc.seo.analytics.useQuery(
    { siteId, startDate, endDate },
    { enabled: siteId > 0 },
  );

  const data = query.data;
  const hasData =
    data && (data.headline.current.sessions > 0 || data.channels.length > 0);

  const presetLabel =
    preset === "custom"
      ? `${customStart} - ${customEnd}`
      : PRESETS.find((p) => p.key === preset)?.label ?? "Last 30 days";

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 gap-1.5 border-border/50 text-sm font-normal"
            >
              <CalendarDays className="size-3.5" />
              {presetLabel}
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "text-sm",
                  preset === p.key && "font-medium",
                )}
              >
                {p.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-2 space-y-2">
              <p className="text-xs text-muted-foreground">Custom range</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setPreset("custom");
                  }}
                  className="h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setPreset("custom");
                  }}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Loading */}
      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : !hasData ? (
        <InlineEmptyState
          title="No analytics data for this period"
          description="Try a different date range, or check that traffic data has been imported for this site."
        />
      ) : (
        <>
          {/* Daily visitors chart */}
          <DailyChart daily={data.daily} />

          {/* Organic views growth */}
          {data.organicDaily.length > 0 && (
            <OrganicGrowthChart daily={data.organicDaily} />
          )}

          {/* Headline metrics */}
          <HeadlineMetrics
            current={data.headline.current}
            prior={data.headline.prior}
          />

          {/* Channel mix */}
          <ChannelMix channels={data.channels} />

          {/* Bottom grid */}
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <TopPages pages={data.topPages} />
            <DeviceSplit devices={data.devices} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Smooth curve helpers
 * --------------------------------------------------------------------------- */

/** Monotone cubic spline — produces a smooth path that passes through all points
 *  without overshooting, ideal for time-series data. */
function smoothPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length < 2) return "";
  if (points.length === 2)
    return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  const n = points.length;

  // Compute tangent slopes using Fritsch-Carlson monotone method
  const d: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    d[i] = (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x || 1);
  }

  m[0] = d[0];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (d[i - 1] + d[i]) / 2;
    }
  }
  m[n - 1] = d[n - 2];

  // Fritsch-Carlson monotonicity correction
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

  // Build cubic bezier segments
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

/* ---------------------------------------------------------------------------
 * DailyChart — smooth area chart with gradient fill & draw-in animation
 * --------------------------------------------------------------------------- */

function DailyChart({
  daily,
}: {
  daily: Array<{ date: string; sessions: number; users: number }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (lineRef.current) {
      const len = lineRef.current.getTotalLength();
      setPathLength(len);
    }
  }, [daily]);

  if (!daily || daily.length === 0) return null;

  const maxSessions = Math.max(...daily.map((d) => d.sessions), 1);
  const W = 800;
  const H = 200;
  const padX = 0;
  const padTop = 12;
  const padBottom = 28;
  const chartH = H - padTop - padBottom;
  const chartW = W - padX * 2;

  function xPos(i: number) {
    return padX + (i / Math.max(daily.length - 1, 1)) * chartW;
  }
  function yPos(val: number) {
    return padTop + chartH - (val / maxSessions) * chartH;
  }

  const points = daily.map((d, i) => ({ x: xPos(i), y: yPos(d.sessions) }));
  const linePath = smoothPath(points);

  // Close the area below the curve
  const areaPath =
    linePath +
    `L${xPos(daily.length - 1)},${padTop + chartH}L${xPos(0)},${padTop + chartH}Z`;

  // Y-axis ticks
  const yTicks = [0, Math.round(maxSessions / 2), maxSessions];

  // X-axis labels
  const xLabelIndices =
    daily.length <= 7
      ? daily.map((_, i) => i)
      : [0, Math.floor(daily.length / 4), Math.floor(daily.length / 2), Math.floor((3 * daily.length) / 4), daily.length - 1];

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const hovered = hoveredIndex !== null ? daily[hoveredIndex] : null;

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          Visitors by day
        </p>
        {hovered ? (
          <div className="flex items-center gap-3 analytics-fade-up" key={hoveredIndex}>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatShortDate(hovered.date)}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-[var(--swarm-violet)]" />
              <p className="text-xs tabular-nums font-medium">
                {formatNumber(hovered.sessions)} sessions
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-foreground/25" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(hovered.users)} users
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/40">
            Hover to explore
          </p>
        )}
      </div>
      <div ref={containerRef} className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Violet gradient for area fill */}
            <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--swarm-violet)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--swarm-violet)" stopOpacity="0.01" />
            </linearGradient>
            {/* Glow filter for hovered dot */}
            <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={padX}
              x2={W - padX}
              y1={yPos(tick)}
              y2={yPos(tick)}
              stroke="currentColor"
              className="text-border/20"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          ))}

          {/* Area fill with gradient */}
          <path
            d={areaPath}
            fill="url(#chart-area-gradient)"
            className="analytics-area-fade"
          />

          {/* Main smooth line */}
          <path
            ref={lineRef}
            d={linePath}
            fill="none"
            stroke="var(--swarm-violet)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={pathLength || undefined}
            strokeDashoffset={0}
            className={pathLength ? "analytics-line-draw" : undefined}
            style={pathLength ? { "--path-length": pathLength } as React.CSSProperties : undefined}
          />

          {/* Hover targets + interaction */}
          {daily.map((d, i) => {
            const cx = xPos(i);
            const cy = yPos(d.sessions);
            const segmentWidth = chartW / Math.max(daily.length - 1, 1);
            const isHovered = hoveredIndex === i;
            return (
              <g key={d.date}>
                {/* Invisible hover area */}
                <rect
                  x={cx - segmentWidth / 2}
                  y={padTop}
                  width={segmentWidth}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
                {/* Hover vertical line */}
                {isHovered && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={padTop}
                    y2={padTop + chartH}
                    stroke="var(--swarm-violet)"
                    strokeWidth={0.5}
                    strokeOpacity={0.3}
                  />
                )}
                {/* Hovered dot with glow */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="var(--swarm-violet)"
                    filter="url(#dot-glow)"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={padX + 4}
              y={yPos(tick) - 5}
              className="fill-muted-foreground/40 text-[9px]"
              dominantBaseline="auto"
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          ))}

          {/* X-axis labels */}
          {xLabelIndices.map((i) => (
            <text
              key={i}
              x={xPos(i)}
              y={H - 6}
              textAnchor={
                i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle"
              }
              className="fill-muted-foreground/40 text-[9px]"
            >
              {formatShortDate(daily[i].date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * OrganicGrowthChart — organic views over time (emerald theme)
 * --------------------------------------------------------------------------- */

function OrganicGrowthChart({
  daily,
}: {
  daily: Array<{ date: string; sessions: number }>;
}) {
  const lineRef = useRef<SVGPathElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (lineRef.current) {
      setPathLength(lineRef.current.getTotalLength());
    }
  }, [daily]);

  if (!daily || daily.length === 0) return null;

  const maxSessions = Math.max(...daily.map((d) => d.sessions), 1);
  const W = 800;
  const H = 200;
  const padX = 0;
  const padTop = 12;
  const padBottom = 28;
  const chartH = H - padTop - padBottom;
  const chartW = W - padX * 2;

  function xPos(i: number) {
    return padX + (i / Math.max(daily.length - 1, 1)) * chartW;
  }
  function yPos(val: number) {
    return padTop + chartH - (val / maxSessions) * chartH;
  }

  const points = daily.map((d, i) => ({ x: xPos(i), y: yPos(d.sessions) }));
  const linePath = smoothPath(points);
  const areaPath =
    linePath +
    `L${xPos(daily.length - 1)},${padTop + chartH}L${xPos(0)},${padTop + chartH}Z`;

  const yTicks = [0, Math.round(maxSessions / 2), maxSessions];
  const xLabelIndices =
    daily.length <= 7
      ? daily.map((_, i) => i)
      : [0, Math.floor(daily.length / 4), Math.floor(daily.length / 2), Math.floor((3 * daily.length) / 4), daily.length - 1];

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const hovered = hoveredIndex !== null ? daily[hoveredIndex] : null;

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          Organic views
        </p>
        {hovered ? (
          <div className="flex items-center gap-3 analytics-fade-up" key={hoveredIndex}>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatShortDate(hovered.date)}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-emerald-500" />
              <p className="text-xs tabular-nums font-medium">
                {formatNumber(hovered.sessions)} sessions
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/40">
            Hover to explore
          </p>
        )}
      </div>
      <div className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="organic-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-emerald-500, #10b981)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--color-emerald-500, #10b981)" stopOpacity="0.01" />
            </linearGradient>
            <filter id="organic-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={padX}
              x2={W - padX}
              y1={yPos(tick)}
              y2={yPos(tick)}
              stroke="currentColor"
              className="text-border/20"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          ))}

          <path
            d={areaPath}
            fill="url(#organic-area-gradient)"
            className="analytics-area-fade"
          />

          <path
            ref={lineRef}
            d={linePath}
            fill="none"
            stroke="var(--color-emerald-500, #10b981)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={pathLength || undefined}
            strokeDashoffset={0}
            className={pathLength ? "analytics-line-draw" : undefined}
            style={pathLength ? { "--path-length": pathLength } as React.CSSProperties : undefined}
          />

          {daily.map((d, i) => {
            const cx = xPos(i);
            const cy = yPos(d.sessions);
            const segmentWidth = chartW / Math.max(daily.length - 1, 1);
            const isHovered = hoveredIndex === i;
            return (
              <g key={d.date}>
                <rect
                  x={cx - segmentWidth / 2}
                  y={padTop}
                  width={segmentWidth}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
                {isHovered && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={padTop}
                    y2={padTop + chartH}
                    stroke="var(--color-emerald-500, #10b981)"
                    strokeWidth={0.5}
                    strokeOpacity={0.3}
                  />
                )}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="var(--color-emerald-500, #10b981)"
                    filter="url(#organic-dot-glow)"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}

          {yTicks.map((tick) => (
            <text
              key={tick}
              x={padX + 4}
              y={yPos(tick) - 5}
              className="fill-muted-foreground/40 text-[9px]"
              dominantBaseline="auto"
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          ))}

          {xLabelIndices.map((i) => (
            <text
              key={i}
              x={xPos(i)}
              y={H - 6}
              textAnchor={
                i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle"
              }
              className="fill-muted-foreground/40 text-[9px]"
            >
              {formatShortDate(daily[i].date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * HeadlineMetrics — stat cards with staggered entrance
 * --------------------------------------------------------------------------- */

function HeadlineMetrics({
  current,
  prior,
}: {
  current: {
    sessions: number;
    users: number;
    engagedSessions: number;
    conversions: number;
    revenue: number;
    avgEngagementSeconds: number;
  };
  prior: {
    sessions: number;
    users: number;
    engagedSessions: number;
    conversions: number;
    revenue: number;
    avgEngagementSeconds: number;
  };
}) {
  const engagementRate =
    current.sessions > 0 ? current.engagedSessions / current.sessions : 0;
  const priorEngagementRate =
    prior.sessions > 0 ? prior.engagedSessions / prior.sessions : 0;

  const metrics = [
    {
      label: "Revenue",
      value: formatCurrency(current.revenue),
      delta: computeDelta(current.revenue, prior.revenue),
    },
    {
      label: "Conversions",
      value: formatNumber(current.conversions),
      delta: computeDelta(current.conversions, prior.conversions),
    },
    {
      label: "Sessions",
      value: formatNumber(current.sessions),
      delta: computeDelta(current.sessions, prior.sessions),
    },
    {
      label: "Engagement rate",
      value: formatPercent(engagementRate),
      delta: computeDelta(engagementRate, priorEngagementRate),
    },
    {
      label: "Avg. time",
      value: formatDuration(current.avgEngagementSeconds),
      delta: computeDelta(
        current.avgEngagementSeconds,
        prior.avgEngagementSeconds,
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="rounded-xl border border-border/40 bg-card p-4 swarm-card analytics-fade-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <p className="text-xs text-muted-foreground/60">{m.label}</p>
          <p className="text-2xl font-normal text-foreground tabular-nums mt-1">
            {m.value}
          </p>
          <DeltaBadge delta={m.delta} />
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({
  delta,
}: {
  delta: { value: number; direction: "up" | "down" | "flat" };
}) {
  if (delta.direction === "flat") return null;

  const isUp = delta.direction === "up";
  return (
    <span
      className={cn(
        "text-xs tabular-nums mt-1 inline-flex items-center gap-0.5",
        isUp
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-500 dark:text-red-400",
      )}
    >
      <svg
        className={cn("size-3", !isUp && "rotate-180")}
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M6 2.5L10 7.5H2L6 2.5Z"
          fill="currentColor"
        />
      </svg>
      {formatPercent(Math.abs(delta.value))}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * ChannelMix — animated proportional bar + hover rows
 * --------------------------------------------------------------------------- */

function ChannelMix({
  channels,
}: {
  channels: Array<{
    channel: string;
    sessions: number;
    users: number;
    conversions: number;
    revenue: number;
  }>;
}) {
  const totalSessions = channels.reduce((sum, c) => sum + c.sessions, 0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Channel mix
      </p>
      {/* Proportional bar */}
      {totalSessions > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-muted/20">
          {channels.map((c, i) => {
            const pct = (c.sessions / totalSessions) * 100;
            return (
              <div
                key={c.channel}
                className={cn(
                  "h-full transition-all duration-700 ease-out",
                  getChannelColor(c.channel).bg,
                )}
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            );
          })}
        </div>
      )}
      {/* Channel rows */}
      <div className="space-y-0.5">
        {channels.map((c) => {
          const pct =
            totalSessions > 0 ? (c.sessions / totalSessions) * 100 : 0;
          return (
            <div
              key={c.channel}
              className="group/row flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div
                className={cn(
                  "size-2 rounded-full shrink-0 transition-transform group-hover/row:scale-125",
                  getChannelColor(c.channel).bg,
                )}
              />
              <span className="text-sm flex-1 capitalize">{c.channel}</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatNumber(c.sessions)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground/60 w-12 text-right">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * TopPages — with relative volume bars
 * --------------------------------------------------------------------------- */

function TopPages({
  pages,
}: {
  pages: Array<{
    pageId: number;
    title: string;
    url: string;
    sessions: number;
  }>;
}) {
  const maxPageSessions = Math.max(...pages.map((p) => p.sessions), 1);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Top pages by visitors
      </p>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground/40 text-center py-6">
          No page-level data available
        </p>
      ) : (
        <div className="space-y-1">
          {pages.map((page, i) => {
            const relPct = (page.sessions / maxPageSessions) * 100;
            return (
              <div
                key={page.pageId}
                className="group/page relative flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/20 transition-colors analytics-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Background volume bar */}
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-[var(--swarm-violet-dim)] analytics-bar-grow"
                  style={{
                    width: `${relPct}%`,
                    animationDelay: `${200 + i * 80}ms`,
                  }}
                />
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm truncate">{page.title}</p>
                  <p className="text-xs text-muted-foreground/50 truncate">
                    {page.url}
                  </p>
                </div>
                <span className="relative text-sm tabular-nums text-muted-foreground shrink-0">
                  {formatNumber(page.sessions)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * DeviceSplit — animated gradient bars
 * --------------------------------------------------------------------------- */

function DeviceSplit({
  devices,
}: {
  devices: Array<{ device: string; sessions: number }>;
}) {
  const totalSessions = devices.reduce((sum, d) => sum + d.sessions, 0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Device split
      </p>
      {devices.length === 0 ? (
        <p className="text-sm text-muted-foreground/40 text-center py-6">
          No device data available
        </p>
      ) : (
        <div className="space-y-4">
          {devices.map((d, i) => {
            const pct =
              totalSessions > 0 ? (d.sessions / totalSessions) * 100 : 0;
            return (
              <div key={d.device} className="analytics-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm capitalize">{d.device}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatNumber(d.sessions)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground/60 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: mounted ? `${pct}%` : "0%",
                      background: "linear-gradient(90deg, var(--swarm-violet), var(--swarm-blue))",
                      transitionDelay: `${i * 120}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
