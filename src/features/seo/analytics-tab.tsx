import { useState, useMemo } from "react";
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

const CHANNEL_COLORS: Record<string, string> = {
  organic: "bg-emerald-500",
  "organic search": "bg-emerald-500",
  paid: "bg-violet-500",
  "paid search": "bg-violet-500",
  social: "bg-sky-500",
  email: "bg-amber-500",
  referral: "bg-rose-500",
  direct: "bg-slate-400",
  display: "bg-indigo-400",
  video: "bg-pink-400",
};

function getChannelColor(channel: string): string {
  const key = channel.toLowerCase();
  return CHANNEL_COLORS[key] ?? "bg-slate-300";
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
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-xl border border-border/40 bg-card p-4"
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
        "text-xs tabular-nums mt-0.5 inline-block",
        isUp ? "text-emerald-600" : "text-red-600",
      )}
    >
      {isUp ? "\u25B2" : "\u25BC"}{" "}
      {formatPercent(Math.abs(delta.value))}
    </span>
  );
}

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

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Channel mix
      </p>
      {/* Proportional bar */}
      {totalSessions > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
          {channels.map((c) => (
            <div
              key={c.channel}
              className={cn("h-full", getChannelColor(c.channel))}
              style={{
                width: `${(c.sessions / totalSessions) * 100}%`,
              }}
            />
          ))}
        </div>
      )}
      {/* Channel rows */}
      <div className="space-y-2.5">
        {channels.map((c) => {
          const pct =
            totalSessions > 0 ? (c.sessions / totalSessions) * 100 : 0;
          return (
            <div key={c.channel} className="flex items-center gap-3">
              <div
                className={cn(
                  "size-2 rounded-full shrink-0",
                  getChannelColor(c.channel),
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
  return (
    <div className="rounded-xl border border-border/40 bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Top pages by visitors
      </p>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground/40 text-center py-6">
          No page-level data available
        </p>
      ) : (
        <div className="space-y-1">
          {pages.map((page) => (
            <div
              key={page.pageId}
              className="flex items-center gap-3 py-2 border-b border-border/30 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{page.title}</p>
                <p className="text-xs text-muted-foreground/50 truncate">
                  {page.url}
                </p>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                {formatNumber(page.sessions)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceSplit({
  devices,
}: {
  devices: Array<{ device: string; sessions: number }>;
}) {
  const totalSessions = devices.reduce((sum, d) => sum + d.sessions, 0);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Device split
      </p>
      {devices.length === 0 ? (
        <p className="text-sm text-muted-foreground/40 text-center py-6">
          No device data available
        </p>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const pct =
              totalSessions > 0 ? (d.sessions / totalSessions) * 100 : 0;
            return (
              <div key={d.device}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize">{d.device}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/20"
                    style={{ width: `${pct}%` }}
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
