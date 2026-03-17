import { useState } from "react";
import { ChevronRight, Globe, Link2, Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEmptyState } from "./shared";
import { formatNumber, formatPercent, toTitleCase } from "./utils";
import type {
  GeoVisibilityCluster,
  GeoVisibilityClusterProvider,
  GeoVisibilityData,
} from "./types";

/* ---------------------------------------------------------------------------
 * Metric card — top-level KPI
 * --------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-normal text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[13px] text-muted-foreground">{hint}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Provider visibility bar
 * --------------------------------------------------------------------------- */

function ProviderBar({
  platform,
  mentionRate,
  citationRate,
}: {
  platform: string;
  mentionRate: number;
  citationRate: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 shrink-0 text-sm text-foreground truncate">
        {platform}
      </span>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-border/30 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(mentionRate * 100)}%`,
              background:
                "linear-gradient(90deg, var(--swarm-violet), color-mix(in oklab, var(--swarm-violet) 60%, var(--swarm-blue)))",
            }}
          />
        </div>
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {formatPercent(mentionRate)}
        </span>
      </div>
      {citationRate > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <Link2 className="size-3" />
          {formatPercent(citationRate)}
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Visibility cell — dot indicator for cluster × provider
 * --------------------------------------------------------------------------- */

function VisibilityCell({
  cell,
}: {
  cell: GeoVisibilityClusterProvider;
}) {
  if (!cell.mentioned && !cell.cited && cell.competitors.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <span className="size-2 rounded-full bg-border/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        {cell.mentioned && (
          <span
            className="size-2.5 rounded-full"
            title="Brand mentioned"
            style={{ background: "var(--swarm-violet)" }}
          />
        )}
        {cell.cited && (
          <Link2
            className="size-3"
            title="Brand cited with link"
            style={{ color: "var(--swarm-violet)" }}
          />
        )}
        {!cell.mentioned && !cell.cited && (
          <span className="size-2 rounded-full bg-border/40" />
        )}
      </div>
      {cell.competitors.length > 0 && (
        <div className="flex items-center gap-0.5" title={cell.competitors.map((c) => c.label).join(", ")}>
          {cell.competitors.slice(0, 3).map((comp) => (
            <span
              key={comp.domain}
              className="size-1.5 rounded-full bg-red-400/70"
            />
          ))}
          {cell.competitors.length > 3 && (
            <span className="text-[9px] text-muted-foreground/40">
              +{cell.competitors.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Expandable cluster row
 * --------------------------------------------------------------------------- */

function ClusterRow({
  cluster,
  platforms,
}: {
  cluster: GeoVisibilityCluster;
  platforms: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const mentionCount = cluster.providers.filter((p) => p.mentioned).length;

  return (
    <>
      <tr
        className="group border-b border-border/30 last:border-b-0 hover:bg-muted/10 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "size-3.5 text-muted-foreground/40 transition-transform",
                expanded && "rotate-90",
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {cluster.clusterName}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mt-0.5">
                {cluster.intent && <span>{toTitleCase(cluster.intent)}</span>}
                {cluster.funnelStage && (
                  <>
                    <span className="text-muted-foreground/30">&middot;</span>
                    <span>{toTitleCase(cluster.funnelStage)}</span>
                  </>
                )}
                <span className="text-muted-foreground/30">&middot;</span>
                <span>
                  {formatNumber(cluster.promptCount)}{" "}
                  {cluster.promptCount === 1 ? "prompt" : "prompts"}
                </span>
              </div>
            </div>
          </div>
        </td>
        {platforms.map((platform) => {
          const cell = cluster.providers.find((p) => p.platform === platform);
          return (
            <td key={platform} className="py-3 px-3 text-center">
              {cell ? (
                <VisibilityCell cell={cell} />
              ) : (
                <span className="size-2 rounded-full bg-border/40 inline-block" />
              )}
            </td>
          );
        })}
        <td className="py-3 pr-4 pl-2 text-right">
          <span className="text-xs tabular-nums text-muted-foreground/60">
            {mentionCount} of {platforms.length}
          </span>
        </td>
      </tr>
      {expanded && cluster.prompts.length > 0 && (
        <tr className="border-b border-border/30">
          <td colSpan={platforms.length + 2} className="py-0">
            <div className="py-3 pl-10 pr-4 space-y-1.5 bg-muted/5">
              <div className="text-xs text-muted-foreground/50 mb-2">
                Prompts in this group
              </div>
              {cluster.prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="text-[13px] text-muted-foreground py-1"
                >
                  {prompt.prompt}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Legend
 * --------------------------------------------------------------------------- */

function Legend() {
  return (
    <div className="flex items-center gap-5 text-xs text-muted-foreground/50">
      <span className="flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-full"
          style={{ background: "var(--swarm-violet)" }}
        />
        Mentioned
      </span>
      <span className="flex items-center gap-1.5">
        <Link2 className="size-3" style={{ color: "var(--swarm-violet)" }} />
        Cited with link
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-border/40" />
        Not present
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-red-400/70" />
        Competitor mentioned
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Empty / no-results state
 * --------------------------------------------------------------------------- */

function NoResultsState() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/40 bg-card p-8 text-center">
        <Radio className="size-8 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="font-display text-2xl font-normal text-foreground mb-2">
          No AI visibility data yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Once GEO prompts have been run against AI providers, this view will
          show where your brand appears in AI-generated answers and how you
          compare to competitors.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main GEO tab
 * --------------------------------------------------------------------------- */

export function GeoTab({ siteId }: { siteId: number }) {
  const query = trpc.seo.geoVisibility.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const data = query.data as GeoVisibilityData | undefined;

  if (query.isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <InlineEmptyState
        title="Couldn't load GEO visibility"
        description={query.error?.message ?? "Please try again in a moment."}
      />
    );
  }

  if (!data || !data.hasResults) {
    return <NoResultsState />;
  }

  return (
    <div className="space-y-8">
      {/* --- KPI cards --- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          icon={Globe}
          label="Brand mentioned"
          value={formatPercent(data.summary.brandMentionRate)}
          hint={`Across ${formatNumber(data.summary.totalPromptsRun)} prompts run against AI providers`}
        />
        <MetricCard
          icon={Link2}
          label="Brand cited"
          value={formatPercent(data.summary.brandCitationRate)}
          hint="Answers that linked back to your site"
        />
        <MetricCard
          icon={Radio}
          label="Provider coverage"
          value={`${data.summary.providersWithMentions} of ${data.summary.totalProviders}`}
          hint="AI providers that mention your brand"
        />
      </section>

      {/* --- Provider visibility bars --- */}
      {data.providers.length > 0 && (
        <section className="rounded-xl border border-border/40 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              Mention rate by provider
            </h2>
          </div>
          <div className="space-y-3">
            {data.providers.map((provider) => (
              <ProviderBar
                key={provider.platform}
                platform={provider.platform}
                mentionRate={provider.mentionRate}
                citationRate={provider.citationRate}
              />
            ))}
          </div>
        </section>
      )}

      {/* --- Cluster × Provider matrix --- */}
      {data.clusters.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">
                Visibility by prompt group
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground/50">
                Each row is a query cluster. Expand to see the prompts tracked
                in each group.
              </p>
            </div>
            <Legend />
          </div>

          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="py-2.5 pl-4 pr-2 text-xs font-medium text-muted-foreground/60 w-[280px]">
                      Prompt group
                    </th>
                    {data.platforms.map((platform) => (
                      <th
                        key={platform}
                        className="py-2.5 px-3 text-xs font-medium text-muted-foreground/60 text-center whitespace-nowrap"
                      >
                        {platform}
                      </th>
                    ))}
                    <th className="py-2.5 pr-4 pl-2 text-xs font-medium text-muted-foreground/60 text-right whitespace-nowrap">
                      Coverage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.clusters.map((cluster) => (
                    <ClusterRow
                      key={cluster.clusterId}
                      cluster={cluster}
                      platforms={data.platforms}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
