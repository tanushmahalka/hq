import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { SeoCompetitor, SeoCompetitorHistoryPoint, SeoSite } from "./types";
import { InlineEmptyState } from "./shared";
import { formatNumber } from "./utils";

const DISPLAY_SERIES_LIMIT = 6;

type MetricKey = "estimatedOrganicTraffic" | "rankedKeywordsCount";

type MetricOption = {
  key: MetricKey;
  title: string;
};

type MetricPoint = {
  capturedAt: Date;
  value: number;
};

type MetricSeries = {
  id: number | string;
  label: string;
  color: string;
  latestValue: number;
  points: MetricPoint[];
  isPrimary: boolean;
};

const METRIC_OPTIONS: MetricOption[] = [
  { key: "estimatedOrganicTraffic", title: "Organic traffic" },
  { key: "rankedKeywordsCount", title: "Ranked keywords" },
];

/** Curated palette — warm-leaning, distinguishable in both modes */
const SERIES_PALETTE = [
  "var(--swarm-violet)",
  "#f97316",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#a855f7",
];

const PRIMARY_COLOR = "#dc2626";

/* ---------------------------------------------------------------------------
 * Smooth monotone cubic spline
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

/* ---------------------------------------------------------------------------
 * CompetitorTrends
 * --------------------------------------------------------------------------- */

export function CompetitorTrends({
  competitors,
  site,
}: {
  competitors: SeoCompetitor[];
  site: SeoSite | null;
}) {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricKey>("estimatedOrganicTraffic");
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | number | null>(null);
  const [hoveredX, setHoveredX] = useState<number | null>(null);

  const metric = METRIC_OPTIONS.find((o) => o.key === selectedMetric) ?? METRIC_OPTIONS[0];
  const ownSeries = buildSiteSeries(site, selectedMetric);
  const competitorSeries = buildCompetitorSeries(competitors, selectedMetric);
  const visibleSeries = ownSeries
    ? [ownSeries, ...competitorSeries.slice(0, DISPLAY_SERIES_LIMIT - 1)]
    : competitorSeries.slice(0, DISPLAY_SERIES_LIMIT);
  const totalComparableSeries = competitorSeries.length + (ownSeries ? 1 : 0);

  const header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Trends</h2>
        <div className="flex items-center gap-0">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedMetric(option.key)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full transition-colors",
                selectedMetric === option.key
                  ? "bg-foreground/5 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>
      {visibleSeries.length > 0 && (
        <span className="text-xs text-muted-foreground/50">
          {formatNumber(visibleSeries.length)} of {formatNumber(totalComparableSeries)} series
        </span>
      )}
    </div>
  );

  if (visibleSeries.length === 0) {
    return (
      <section>
        {header}
        <div className="rounded-xl border border-border/40 bg-card">
          <InlineEmptyState
            title={`No ${metric.title.toLowerCase()} history yet`}
            description="Run site and competitor footprint captures to start plotting trends."
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div className="rounded-xl border border-border/40 bg-card p-5 swarm-card">
        <TrendsChart
          series={visibleSeries}
          hoveredSeriesId={hoveredSeriesId}
          onHoverSeries={setHoveredSeriesId}
          hoveredX={hoveredX}
          onHoverX={setHoveredX}
        />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * TrendsChart — custom SVG multi-line chart with integrated legend
 * --------------------------------------------------------------------------- */

const W = 800;
const H = 320;
const PAD = { top: 16, right: 56, bottom: 32, left: 8 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

type HoveredPoint = {
  seriesId: number | string;
  label: string;
  color: string;
  value: number;
  cx: number;
  cy: number;
  date: Date;
};

function TrendsChart({
  series,
  hoveredSeriesId,
  onHoverSeries,
  hoveredX,
  onHoverX,
}: {
  series: MetricSeries[];
  hoveredSeriesId: string | number | null;
  onHoverSeries: (id: string | number | null) => void;
  hoveredX: number | null;
  onHoverX: (x: number | null) => void;
}) {
  // Compute time domain
  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const p of s.points) {
        const t = p.capturedAt.getTime();
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
    const span = Math.max(max - min, 60_000);
    return { minTime: min - span * 0.04, maxTime: max + span * 0.04 };
  }, [series]);

  // Compute value domain
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const p of s.points) {
        if (p.value < min) min = p.value;
        if (p.value > max) max = p.value;
      }
    }
    const span = Math.max(max - min, max * 0.12, 1);
    return {
      minVal: Math.max(0, min - span * 0.08),
      maxVal: max + span * 0.08,
    };
  }, [series]);

  const xScale = useCallback(
    (t: number) => PAD.left + ((t - minTime) / (maxTime - minTime)) * CHART_W,
    [minTime, maxTime],
  );

  const yScale = useCallback(
    (v: number) => PAD.top + CHART_H - ((v - minVal) / (maxVal - minVal)) * CHART_H,
    [minVal, maxVal],
  );

  // Y ticks
  const yTicks = useMemo(() => {
    const range = maxVal - minVal;
    const step = niceStep(range, 4);
    const ticks: number[] = [];
    let tick = Math.ceil(minVal / step) * step;
    while (tick <= maxVal) {
      ticks.push(tick);
      tick += step;
    }
    return ticks;
  }, [minVal, maxVal]);

  // X ticks
  const xTicks = useMemo(() => {
    const span = maxTime - minTime;
    const count = 5;
    const step = span / count;
    const ticks: Date[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(new Date(minTime + step * i));
    }
    return ticks;
  }, [minTime, maxTime]);

  // Build SVG paths + screen points
  const seriesPaths = useMemo(() => {
    return series.map((s) => {
      const pts = s.points.map((p) => ({
        x: xScale(p.capturedAt.getTime()),
        y: yScale(p.value),
      }));
      return { ...s, path: smoothPath(pts), screenPoints: pts };
    });
  }, [series, xScale, yScale]);

  // Find nearest data point to mouse X for each series
  const hoveredPoints: HoveredPoint[] | null = useMemo(() => {
    if (hoveredX === null) return null;
    const t = minTime + ((hoveredX - PAD.left) / CHART_W) * (maxTime - minTime);

    return seriesPaths.map((s) => {
      let nearest = s.points[0];
      let nearestDist = Infinity;
      for (const p of s.points) {
        const dist = Math.abs(p.capturedAt.getTime() - t);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }
      return {
        seriesId: s.id,
        label: s.label,
        color: s.color,
        value: nearest?.value ?? 0,
        cx: nearest ? xScale(nearest.capturedAt.getTime()) : 0,
        cy: nearest ? yScale(nearest.value) : 0,
        date: nearest?.capturedAt ?? new Date(),
      };
    });
  }, [hoveredX, seriesPaths, minTime, maxTime, xScale, yScale]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      if (svgX >= PAD.left && svgX <= W - PAD.right) {
        onHoverX(svgX);
      } else {
        onHoverX(null);
      }
    },
    [onHoverX],
  );

  // Build a lookup: seriesId → hovered value (for legend)
  const hoveredValueMap = useMemo(() => {
    if (!hoveredPoints) return null;
    const map = new Map<string | number, number>();
    for (const p of hoveredPoints) {
      map.set(p.seriesId, p.value);
    }
    return map;
  }, [hoveredPoints]);

  const isHovering = hoveredX !== null;

  return (
    <div className="w-full">
      {/* Integrated legend — shows latest values at rest, hovered values on hover */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        {isHovering && hoveredPoints && (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums mr-1">
            {formatTimelineLabel(hoveredPoints[0]?.date)}
          </span>
        )}
        {series.map((s) => {
          const dimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
          const displayValue = isHovering && hoveredValueMap
            ? (hoveredValueMap.get(s.id) ?? s.latestValue)
            : s.latestValue;
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                "flex items-center gap-1.5 text-xs transition-opacity duration-200 hover:opacity-100",
                dimmed ? "opacity-30" : "opacity-100",
              )}
              onMouseEnter={() => onHoverSeries(s.id)}
              onMouseLeave={() => onHoverSeries(null)}
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

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          onHoverX(null);
          onHoverSeries(null);
        }}
      >
        <defs>
          <filter id="trends-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="currentColor"
            className="text-border/20"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={W - PAD.right + 8}
            y={yScale(tick)}
            dominantBaseline="central"
            className="fill-muted-foreground/40 text-[9px]"
          >
            {formatCompactNumber(tick)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={tick.getTime()}
            x={xScale(tick.getTime())}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground/40 text-[9px]"
          >
            {formatTimelineLabel(tick)}
          </text>
        ))}

        {/* Series lines + single-point dots */}
        {seriesPaths.map((s) => {
          const dimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
          const highlighted = hoveredSeriesId === s.id;

          // Single data point → render a dot instead of a line
          if (s.screenPoints.length === 1) {
            return (
              <circle
                key={s.id}
                cx={s.screenPoints[0].x}
                cy={s.screenPoints[0].y}
                r={4}
                fill={s.color}
                vectorEffect="non-scaling-stroke"
                className={cn(
                  "transition-opacity duration-200",
                  dimmed ? "opacity-15" : "opacity-100",
                )}
                onMouseEnter={() => onHoverSeries(s.id)}
                onMouseLeave={() => onHoverSeries(null)}
              />
            );
          }

          return (
            <g key={s.id}>
              <path
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth={s.isPrimary || highlighted ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={cn(
                  "transition-all duration-200",
                  dimmed ? "opacity-15" : "opacity-100",
                )}
                onMouseEnter={() => onHoverSeries(s.id)}
                onMouseLeave={() => onHoverSeries(null)}
              />
              {/* Small dots at each data point for multi-point series */}
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
            y1={PAD.top}
            y2={PAD.top + CHART_H}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
          />
        )}

        {/* Hover dots — larger, glowing */}
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
              filter="url(#trends-dot-glow)"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Data helpers
 * --------------------------------------------------------------------------- */

function buildCompetitorSeries(
  competitors: SeoCompetitor[],
  metricKey: MetricKey,
): MetricSeries[] {
  const series: MetricSeries[] = [];

  competitors.forEach((competitor, i) => {
    const points = getCompetitorTimeline(competitor)
      .map((point) => {
        const rawValue = point[metricKey];
        if (rawValue === null || rawValue === undefined) return null;
        return {
          capturedAt:
            point.capturedAt instanceof Date ? point.capturedAt : new Date(point.capturedAt),
          value: rawValue,
        };
      })
      .filter((point): point is MetricPoint => point !== null)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

    if (points.length === 0) return;

    series.push({
      id: competitor.id,
      label: competitor.label,
      color: SERIES_PALETTE[i % SERIES_PALETTE.length],
      latestValue: points[points.length - 1]?.value ?? 0,
      points,
      isPrimary: false,
    });
  });

  return series.sort((a, b) => b.latestValue - a.latestValue);
}

function buildSiteSeries(
  site: SeoSite | null,
  metricKey: MetricKey,
): MetricSeries | null {
  if (!site) return null;

  const points = getSiteTimeline(site)
    .map((point) => {
      const rawValue = point[metricKey];
      if (rawValue === null || rawValue === undefined) return null;
      return {
        capturedAt:
          point.capturedAt instanceof Date ? point.capturedAt : new Date(point.capturedAt),
        value: rawValue,
      };
    })
    .filter((point): point is MetricPoint => point !== null)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  if (points.length === 0) return null;

  return {
    id: "__self__",
    label: "You",
    color: PRIMARY_COLOR,
    latestValue: points[points.length - 1]?.value ?? 0,
    points,
    isPrimary: true,
  };
}

function getCompetitorTimeline(competitor: SeoCompetitor): SeoCompetitorHistoryPoint[] {
  if (Array.isArray(competitor.history) && competitor.history.length > 0) {
    return competitor.history;
  }
  if (competitor.latestFootprint) {
    return [{
      estimatedOrganicTraffic: competitor.latestFootprint.estimatedOrganicTraffic,
      rankedKeywordsCount: competitor.latestFootprint.rankedKeywordsCount,
      capturedAt: competitor.latestFootprint.capturedAt,
    }];
  }
  return [];
}

function getSiteTimeline(site: SeoSite): SeoCompetitorHistoryPoint[] {
  if (Array.isArray(site.history) && site.history.length > 0) {
    return site.history;
  }
  if (site.latestFootprint) {
    return [{
      estimatedOrganicTraffic: site.latestFootprint.estimatedOrganicTraffic,
      rankedKeywordsCount: site.latestFootprint.rankedKeywordsCount,
      capturedAt: site.latestFootprint.capturedAt,
    }];
  }
  return [];
}

/* ---------------------------------------------------------------------------
 * Formatting helpers
 * --------------------------------------------------------------------------- */

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatTimelineLabel(value: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
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
