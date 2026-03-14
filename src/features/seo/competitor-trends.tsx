import { useState } from "react";
import { axisClasses, LineChart } from "@mui/x-charts";
import { lineElementClasses, markElementClasses } from "@mui/x-charts/LineChart";
import { cn } from "@/lib/utils";
import type { SeoCompetitor, SeoCompetitorHistoryPoint, SeoSite } from "./types";
import { InlineEmptyState } from "./shared";
import { formatNumber } from "./utils";

const COMPETITOR_SERIES_COLOR = "#7c3aed";
const PRIMARY_SERIES_COLOR = "#dc2626";

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

export function CompetitorTrends({
  competitors,
  site,
}: {
  competitors: SeoCompetitor[];
  site: SeoSite | null;
}) {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricKey>("estimatedOrganicTraffic");

  const metric = METRIC_OPTIONS.find((option) => option.key === selectedMetric) ?? METRIC_OPTIONS[0];
  const ownSeries = buildSiteSeries(site, selectedMetric);
  const competitorSeries = buildCompetitorSeries(competitors, selectedMetric);
  const visibleSeries = ownSeries
    ? [ownSeries, ...competitorSeries.slice(0, DISPLAY_SERIES_LIMIT - 1)]
    : competitorSeries.slice(0, DISPLAY_SERIES_LIMIT);
  const totalComparableSeries = competitorSeries.length + (ownSeries ? 1 : 0);
  const xAxisData = getXAxisData(visibleSeries);

  if (visibleSeries.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Trends</h2>
          <div className="flex items-center gap-0 border-b">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedMetric(option.key)}
                className={cn(
                  "px-3 py-2 text-xs transition-colors border-b-2 -mb-px",
                  selectedMetric === option.key
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {option.title}
              </button>
            ))}
          </div>
        </div>
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
        <span className="text-xs text-muted-foreground/50">
          {formatNumber(visibleSeries.length)} of {formatNumber(totalComparableSeries)} series
        </span>
      </div>

      <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
        <div className="h-[360px] w-full">
          <LineChart
            height={360}
            hideLegend
            margin={{ top: 12, right: 52, bottom: 26, left: 0 }}
            axisHighlight={{ x: "line" }}
            grid={{ horizontal: true }}
            xAxis={[
              {
                data: xAxisData,
                scaleType: "time",
                min: getTimeDomainBoundary(visibleSeries, "min"),
                max: getTimeDomainBoundary(visibleSeries, "max"),
                tickNumber: 5,
                valueFormatter: (value) => formatTimelineLabel(value),
              },
            ]}
            yAxis={[
              {
                position: "right",
                width: 60,
                domainLimit: (min, max) => {
                  const span = Math.max(max - min, max * 0.12, 1);
                  return {
                    min: Math.max(0, min - span * 0.08),
                    max: max + span * 0.08,
                  };
                },
                valueFormatter: (value: number) => formatCompactNumber(Number(value ?? 0)),
              },
            ]}
            series={visibleSeries.map((entry) => {
              return {
                id: entry.id,
                label: entry.label,
                color: entry.color,
                curve: "stepAfter" as const,
                connectNulls: false,
                data: buildSteppedSeriesData(entry, xAxisData),
                showMark: false,
                highlightScope: { highlight: "series" as const, fade: "global" as const },
                valueFormatter: (value: number | null) =>
                  value === null ? null : `${entry.label}: ${formatNumber(value)}`,
              };
            })}
            slotProps={{
              tooltip: {
                trigger: "axis",
                position: "top",
              },
            }}
            sx={{
              [`& .${axisClasses.line}`]: {
                stroke: "rgba(100, 116, 139, 0.12)",
              },
              [`& .${axisClasses.tick}`]: {
                stroke: "rgba(100, 116, 139, 0.12)",
              },
              [`& .${axisClasses.tickLabel}`]: {
                fill: "rgba(71, 85, 105, 0.7)",
                fontFamily: "inherit",
                fontSize: 11,
              },
              [`& .${lineElementClasses.root}`]: {
                strokeWidth: 1.5,
              },
              [`& .${markElementClasses.root}`]: {
                fill: "rgba(221, 214, 254, 0.95)",
                stroke: "rgba(109, 40, 217, 0.95)",
                strokeWidth: 2,
              },
              [`& .${lineElementClasses.series}-__self__`]: {
                strokeWidth: 2,
              },
              [`& .${markElementClasses.series}-__self__`]: {
                fill: "rgba(216, 180, 254, 0.98)",
                stroke: "rgba(88, 28, 135, 0.98)",
                strokeWidth: 2,
              },
              "& .MuiChartsGrid-line": {
                stroke: "rgba(100, 116, 139, 0.08)",
              },
              "& .MuiChartsAxisHighlight-root": {
                stroke: "rgba(37, 99, 235, 0.2)",
                strokeDasharray: "6 6",
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}

function buildCompetitorSeries(
  competitors: SeoCompetitor[],
  metricKey: MetricKey,
): MetricSeries[] {
  const series: MetricSeries[] = [];

  competitors.forEach((competitor) => {
    const points = getCompetitorTimeline(competitor)
      .map((point) => {
        const rawValue = point[metricKey];
        if (rawValue === null || rawValue === undefined) {
          return null;
        }

        return {
          capturedAt:
            point.capturedAt instanceof Date ? point.capturedAt : new Date(point.capturedAt),
          value: rawValue,
        };
      })
      .filter((point): point is MetricPoint => point !== null)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

    if (points.length === 0) {
      return;
    }

    series.push({
      id: competitor.id,
      label: competitor.label,
      color: COMPETITOR_SERIES_COLOR,
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
  if (!site) {
    return null;
  }

  const points = getSiteTimeline(site)
    .map((point) => {
      const rawValue = point[metricKey];
      if (rawValue === null || rawValue === undefined) {
        return null;
      }

      return {
        capturedAt:
          point.capturedAt instanceof Date ? point.capturedAt : new Date(point.capturedAt),
        value: rawValue,
      };
    })
    .filter((point): point is MetricPoint => point !== null)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  if (points.length === 0) {
    return null;
  }

  return {
    id: "__self__",
    label: "You",
    color: PRIMARY_SERIES_COLOR,
    latestValue: points[points.length - 1]?.value ?? 0,
    points,
    isPrimary: true,
  };
}

function buildSteppedSeriesData(series: MetricSeries, xAxisData: Date[]) {
  let nextPointIndex = 0;
  let currentValue: number | null = null;

  return xAxisData.map((timestamp) => {
    while (
      nextPointIndex < series.points.length &&
      series.points[nextPointIndex]!.capturedAt.getTime() <= timestamp.getTime()
    ) {
      currentValue = series.points[nextPointIndex]!.value;
      nextPointIndex += 1;
    }

    return currentValue;
  });
}

function getXAxisData(series: MetricSeries[]) {
  const timestamps = Array.from(
    new Set(
      series.flatMap((entry) => entry.points.map((point) => point.capturedAt.getTime())),
    ),
  ).sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return [];
  }

  const maxTimestamp = timestamps[timestamps.length - 1]!;
  const previousTimestamp = timestamps[timestamps.length - 2] ?? maxTimestamp - 60_000;
  const trailingGap = Math.max(maxTimestamp - previousTimestamp, 60_000);

  return [...timestamps, maxTimestamp + trailingGap].map(
    (timestamp) => new Date(timestamp),
  );
}

function getTimeDomainBoundary(series: MetricSeries[], direction: "min" | "max") {
  const timestamps = series.flatMap((entry) =>
    entry.points.map((point) => point.capturedAt.getTime()),
  );
  if (timestamps.length === 0) {
    return undefined;
  }

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const span = Math.max(max - min, 60_000);
  const padding = span * 0.06;

  return direction === "min" ? new Date(min - padding) : new Date(max + padding);
}

function getCompetitorTimeline(competitor: SeoCompetitor): SeoCompetitorHistoryPoint[] {
  if (Array.isArray(competitor.history) && competitor.history.length > 0) {
    return competitor.history;
  }

  if (competitor.latestFootprint) {
    return [
      {
        estimatedOrganicTraffic: competitor.latestFootprint.estimatedOrganicTraffic,
        rankedKeywordsCount: competitor.latestFootprint.rankedKeywordsCount,
        capturedAt: competitor.latestFootprint.capturedAt,
      },
    ];
  }

  return [];
}

function getSiteTimeline(site: SeoSite): SeoCompetitorHistoryPoint[] {
  if (Array.isArray(site.history) && site.history.length > 0) {
    return site.history;
  }

  if (site.latestFootprint) {
    return [
      {
        estimatedOrganicTraffic: site.latestFootprint.estimatedOrganicTraffic,
        rankedKeywordsCount: site.latestFootprint.rankedKeywordsCount,
        capturedAt: site.latestFootprint.capturedAt,
      },
    ];
  }

  return [];
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatTimelineLabel(value: Date | string | null) {
  if (!value) {
    return "Not available";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
