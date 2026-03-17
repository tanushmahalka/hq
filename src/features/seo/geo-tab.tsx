import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  FileText,
  Radar,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChip, InlineEmptyState } from "./shared";
import {
  formatNumber,
  formatOptionalDecimal,
  formatPercent,
  toTitleCase,
} from "./utils";
import type {
  GeoClusterPrompt,
  GeoClusterRow,
  GeoOverviewData,
  GeoRecommendation,
} from "./types";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="text-2xl font-normal text-foreground tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground/60">{label}</div>
      <div className="mt-2 text-[13px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MetaPill({
  tone,
  label,
}: {
  tone: "default" | "success" | "warning";
  label: string;
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-border/50 bg-muted/40 text-muted-foreground";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]", className)}>
      {label}
    </span>
  );
}

function PromptSourcePill({ prompt }: { prompt: GeoClusterPrompt }) {
  const label =
    prompt.source === "geo_prompt"
      ? "Saved prompt"
      : prompt.isPrimaryQuerySeed
        ? "Primary query seed"
        : "Query seed";
  const tone =
    prompt.source === "geo_prompt"
      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200"
      : "border-border/50 bg-muted/40 text-muted-foreground";

  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", tone)}>{label}</span>;
}

function PromptTonePill({ conversational }: { conversational: boolean }) {
  const className = conversational
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", className)}>
      {conversational ? "Conversational" : "Search-style"}
    </span>
  );
}

function ClusterPromptCard({ cluster }: { cluster: GeoClusterRow }) {
  const visiblePrompts = cluster.prompts.slice(0, 6);
  const hiddenPromptCount = Math.max(cluster.prompts.length - visiblePrompts.length, 0);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-4 swarm-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{cluster.clusterName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground/60">
            {cluster.intent ? <span>{toTitleCase(cluster.intent)}</span> : null}
            {cluster.funnelStage ? (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{toTitleCase(cluster.funnelStage)}</span>
              </>
            ) : null}
            {cluster.priorityScore != null ? (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>Priority {formatOptionalDecimal(cluster.priorityScore)}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <MetaPill tone={cluster.promptCount > 0 ? "success" : "warning"} label={`${formatNumber(cluster.promptCount)} prompts`} />
          <MetaPill
            tone={cluster.conversationalPromptCount > 0 ? "success" : "warning"}
            label={`${formatNumber(cluster.conversationalPromptCount)} conversational`}
          />
        </div>
      </div>

      {cluster.mappedPageUrl ? (
        <div className="mt-4 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-[13px] text-muted-foreground">
          <span className="text-muted-foreground/60">Mapped page:</span>{" "}
          <a
            href={cluster.mappedPageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground hover:underline"
          >
            {cluster.mappedPageTitle ?? cluster.mappedPageUrl}
          </a>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border/50 px-3 py-2 text-[13px] text-muted-foreground">
          No owned page is mapped to this cluster yet.
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-muted-foreground/60">Prompts under this query cluster</div>
          {hiddenPromptCount > 0 ? (
            <div className="text-xs text-muted-foreground/50">+{formatNumber(hiddenPromptCount)} more</div>
          ) : null}
        </div>

        {visiblePrompts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 px-3 py-3 text-[13px] text-muted-foreground">
            No prompts yet. Start by turning the cluster intent into a few longer, friend-style questions.
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePrompts.map((prompt) => (
              <div
                key={prompt.id ?? `${cluster.clusterId}-${prompt.prompt}`}
                className="rounded-lg border border-border/50 bg-background/60 px-3 py-3"
              >
                <div className="text-sm text-foreground">{prompt.prompt}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PromptSourcePill prompt={prompt} />
                  <PromptTonePill conversational={prompt.isConversational} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: GeoRecommendation }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{recommendation.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground/60">
            <span>{toTitleCase(recommendation.type)}</span>
            {recommendation.clusterName ? (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{recommendation.clusterName}</span>
              </>
            ) : null}
          </div>
        </div>
        <FilterChip active label={toTitleCase(recommendation.status)} onClick={() => undefined} />
      </div>

      <p className="mt-3 text-[13px] text-muted-foreground">{recommendation.rationale}</p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground/60">
        <span>
          Impact:{" "}
          <span className="text-foreground">
            {recommendation.impactScore != null ? formatOptionalDecimal(recommendation.impactScore) : "Open"}
          </span>
        </span>
        <span>
          Effort:{" "}
          <span className="text-foreground">
            {recommendation.effortScore != null ? formatOptionalDecimal(recommendation.effortScore) : "Open"}
          </span>
        </span>
      </div>

      {recommendation.prompt || recommendation.pageUrl ? (
        <div className="mt-4 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-[13px] text-muted-foreground">
          {recommendation.prompt ? (
            <div className="mb-1">
              <span className="text-muted-foreground/60">Prompt seed:</span> {recommendation.prompt}
            </div>
          ) : null}
          {recommendation.pageUrl ? (
            <a
              href={recommendation.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              {recommendation.pageTitle ?? recommendation.pageUrl}
              <ArrowUpRight className="size-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function GeoTab({ siteId }: { siteId: number }) {
  const [promptSearch, setPromptSearch] = useState("");
  const deferredPromptSearch = useDeferredValue(promptSearch);

  const query = trpc.seo.geoOverview.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const data = query.data as GeoOverviewData | undefined;

  const filteredClusters = useMemo(() => {
    if (!data) return [];

    const search = deferredPromptSearch.trim().toLowerCase();
    if (!search) return data.clusters;

    return data.clusters.filter((cluster) =>
      [
        cluster.clusterName,
        cluster.intent ?? "",
        cluster.funnelStage ?? "",
        cluster.mappedPageTitle ?? "",
        cluster.mappedPageUrl ?? "",
        ...cluster.prompts.map((prompt) => prompt.prompt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [data, deferredPromptSearch]);

  if (query.isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <Skeleton className="h-[520px] w-full rounded-xl" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <InlineEmptyState
        title="We couldn't load GEO yet"
        description={query.error?.message ?? "Please try again in a moment."}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-5 swarm-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in oklab, var(--swarm-violet) 14%, transparent) 0%, transparent 42%), radial-gradient(circle at bottom left, color-mix(in oklab, var(--swarm-blue) 10%, transparent) 0%, transparent 44%)",
          }}
        />

        <div className="relative flex flex-col gap-5">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MetaPill tone="success" label="Cluster-driven GEO" />
              <MetaPill
                tone={data.setup.hasSavedPrompts ? "success" : "default"}
                label={data.setup.hasSavedPrompts ? "Saved prompts active" : "Seeded from queries"}
              />
              <MetaPill
                tone={data.summary.mappedClusterCount > 0 ? "success" : "warning"}
                label={`${formatNumber(data.summary.mappedClusterCount)} mapped clusters`}
              />
            </div>

            <h2 className="font-display text-4xl font-normal text-foreground">{data.setup.headline}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.setup.description}</p>
            <p className="mt-3 text-[13px] text-muted-foreground/70">{data.setup.nextStep}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground/60">
              <span className="inline-flex items-center gap-1.5">
                <Radar className="size-3.5" />
                {formatNumber(data.summary.clusterCount)} query clusters
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Target className="size-3.5" />
                {formatNumber(data.summary.totalPrompts)} total prompts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                {formatNumber(data.summary.conversationalPromptCount)} conversational prompts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5" />
                {formatNumber(data.site.pageCount)} tracked pages
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Query clusters"
          value={formatNumber(data.summary.clusterCount)}
          hint="Each cluster is now the home for its own GEO prompt variants"
        />
        <MetricCard
          label="Prompt library"
          value={formatNumber(data.summary.totalPrompts)}
          hint="Saved prompts plus seed prompts derived from the underlying queries"
        />
        <MetricCard
          label="Cluster coverage"
          value={formatPercent(data.summary.clusterCoverage)}
          hint="How many clusters currently have at least one prompt variant"
        />
        <MetricCard
          label="Conversational prompts"
          value={formatNumber(data.summary.conversationalPromptCount)}
          hint="Prompts that already sound closer to AI chat than classic search"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Cluster Prompt Map</h2>
              <p className="mt-0.5 text-xs text-muted-foreground/50">
                GEO lives under query clusters now, so prompts stay attached to the same strategic topic buckets.
              </p>
            </div>
            <span className="text-xs text-muted-foreground/60">
              {formatNumber(filteredClusters.length)} shown
            </span>
          </div>

          <div className="mb-4 relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={promptSearch}
              onChange={(event) => setPromptSearch(event.target.value)}
              placeholder="Search by cluster, prompt, intent, or mapped page..."
              className="w-full rounded-md border border-border/50 bg-card py-2 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/20"
            />
          </div>

          {filteredClusters.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-card">
              <InlineEmptyState
                title="No clusters match this search"
                description="Try a broader query or clear the search to inspect the full GEO prompt library."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClusters.map((cluster) => (
                <ClusterPromptCard key={cluster.clusterId} cluster={cluster} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">Recommendation Queue</h2>
            <p className="mt-0.5 text-xs text-muted-foreground/50">
              The next GEO actions HQ can hand to content, SEO, or strategy agents.
            </p>
          </div>

          {data.recommendations.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-card">
              <InlineEmptyState
                title="Recommendations will appear here"
                description="Once query clusters and prompts exist, HQ will highlight the thin spots in the GEO library."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {data.recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id ?? `${recommendation.type}-${recommendation.title}`}
                  recommendation={recommendation}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border/40 bg-card p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">How GEO prompts should sound</div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              GEO prompts should read like a person talking to an assistant, not like a terse search box query. Start with the SEO query, then add context, constraints, and the outcome the buyer actually wants.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-3">
                <div className="text-xs text-muted-foreground/60">Search-style</div>
                <div className="mt-1 text-sm text-foreground">best crm for agencies</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-3">
                <div className="text-xs text-muted-foreground/60">GEO-ready</div>
                <div className="mt-1 text-sm text-foreground">
                  I run a growing agency and need a CRM that helps with sales follow-up and client onboarding. Which options should I shortlist and why?
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
