import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Link2,
  Radio,
  Search as SearchIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEmptyState } from "./shared";
import { formatNumber, formatPercent, toTitleCase } from "./utils";
import type {
  GeoPromptResultsData,
  GeoProviderAnswer,
  GeoResultsClusterGroup,
  GeoVisibilityCluster,
  GeoVisibilityClusterProvider,
  GeoVisibilityData,
} from "./types";

/* ---------------------------------------------------------------------------
 * Shared
 * --------------------------------------------------------------------------- */

type GeoView = "visibility" | "results";

function ViewToggle({
  view,
  onChange,
}: {
  view: GeoView;
  onChange: (view: GeoView) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card p-0.5">
      {(["visibility", "results"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-3 py-1.5 text-xs rounded-md transition-colors",
            view === v
              ? "bg-foreground/5 text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "visibility" ? "Visibility" : "Prompt results"}
        </button>
      ))}
    </div>
  );
}

/* ===========================================================================
 * VISIBILITY VIEW
 * =========================================================================== */

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
          <span title="Brand cited with link">
            <Link2
              className="size-3"
              aria-label="Brand cited with link"
              style={{ color: "var(--swarm-violet)" }}
            />
          </span>
        )}
        {!cell.mentioned && !cell.cited && (
          <span className="size-2 rounded-full bg-border/40" />
        )}
      </div>
      {cell.competitors.length > 0 && (
        <div
          className="flex items-center gap-0.5"
          title={cell.competitors.map((c) => c.label).join(", ")}
        >
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
                {cluster.intent && (
                  <span>{toTitleCase(cluster.intent)}</span>
                )}
                {cluster.funnelStage && (
                  <>
                    <span className="text-muted-foreground/30">
                      &middot;
                    </span>
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
          const cell = cluster.providers.find(
            (p) => p.platform === platform,
          );
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

function VisibilityView({ data }: { data: GeoVisibilityData }) {
  return (
    <div className="space-y-8">
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

/* ===========================================================================
 * PROMPT RESULTS VIEW
 * =========================================================================== */

function formatCost(cost: number | null): string {
  if (cost === null) return "";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ProviderAnswerCard({ answer }: { answer: GeoProviderAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const textPreviewLength = 400;
  const isLong = answer.answerText.length > textPreviewLength;
  const displayText =
    expanded || !isLong
      ? answer.answerText
      : `${answer.answerText.slice(0, textPreviewLength)}...`;

  const ownedCitations = answer.citations.filter((c) => c.isOwned);
  const competitorCitations = answer.citations.filter((c) => c.isCompetitor);
  const otherCitations = answer.citations.filter(
    (c) => !c.isOwned && !c.isCompetitor,
  );

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {answer.platform}
          </span>
          {answer.modelName && (
            <span className="text-xs text-muted-foreground/50">
              {answer.modelName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {answer.brandMentioned && (
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2 rounded-full"
                style={{ background: "var(--swarm-violet)" }}
              />
              <span style={{ color: "var(--swarm-violet)" }}>Mentioned</span>
            </span>
          )}
          {answer.brandCited && (
            <span className="flex items-center gap-1.5 text-xs">
              <Link2
                className="size-3"
                style={{ color: "var(--swarm-violet)" }}
              />
              <span style={{ color: "var(--swarm-violet)" }}>Cited</span>
            </span>
          )}
          {!answer.brandMentioned && !answer.brandCited && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/40">
              <span className="size-2 rounded-full bg-border/40" />
              Not present
            </span>
          )}
          {answer.cost !== null && (
            <span className="text-xs text-muted-foreground/40 tabular-nums">
              {formatCost(answer.cost)}
            </span>
          )}
        </div>
      </div>

      {/* Answer text */}
      {answer.answerText && (
        <div className="px-4 py-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {displayText}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Citations */}
      {answer.citations.length > 0 && (
        <div className="px-4 py-3 border-t border-border/30">
          <div className="text-xs text-muted-foreground/50 mb-2">
            {answer.citations.length}{" "}
            {answer.citations.length === 1 ? "source" : "sources"} cited
          </div>
          <div className="space-y-1">
            {ownedCitations.map((cit, i) => (
              <CitationRow key={`own-${i}`} citation={cit} variant="owned" />
            ))}
            {competitorCitations.map((cit, i) => (
              <CitationRow
                key={`comp-${i}`}
                citation={cit}
                variant="competitor"
              />
            ))}
            {otherCitations.slice(0, 5).map((cit, i) => (
              <CitationRow
                key={`other-${i}`}
                citation={cit}
                variant="neutral"
              />
            ))}
            {otherCitations.length > 5 && (
              <span className="text-xs text-muted-foreground/40">
                +{otherCitations.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CitationRow({
  citation,
  variant,
}: {
  citation: { url: string; title: string; isOwned: boolean; isCompetitor: boolean };
  variant: "owned" | "competitor" | "neutral";
}) {
  const dotClass =
    variant === "owned"
      ? "bg-[var(--swarm-mint)]"
      : variant === "competitor"
        ? "bg-red-400/70"
        : "bg-border/60";

  const domain = citation.url ? extractDomain(citation.url) : null;
  const displayTitle = citation.title || domain || "Unknown source";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} />
      <span className="text-muted-foreground truncate" title={displayTitle}>
        {displayTitle}
      </span>
      {domain && domain !== displayTitle && (
        <span className="text-muted-foreground/40 shrink-0">{domain}</span>
      )}
      {citation.url && (
        <a
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground/30 hover:text-foreground transition-colors shrink-0"
        >
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function PromptResultsGroup({
  cluster,
}: {
  cluster: GeoResultsClusterGroup;
}) {
  return (
    <div>
      {/* Cluster header */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">
          {cluster.clusterName}
        </h3>
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
            {cluster.prompts.length}{" "}
            {cluster.prompts.length === 1 ? "prompt" : "prompts"}
          </span>
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-6">
        {cluster.prompts.map((prompt) => (
          <PromptWithAnswers key={prompt.promptId} prompt={prompt} />
        ))}
      </div>
    </div>
  );
}

function PromptWithAnswers({
  prompt,
}: {
  prompt: { promptId: number; promptText: string; results: GeoProviderAnswer[] };
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      {/* Prompt header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/10 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 mt-0.5 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 mt-0.5 text-muted-foreground/40 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground leading-relaxed">
            {prompt.promptText}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            {prompt.results.map((r) => (
              <span
                key={r.runId}
                className="flex items-center gap-1 text-xs text-muted-foreground/50"
              >
                {r.brandMentioned ? (
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: "var(--swarm-violet)" }}
                  />
                ) : (
                  <span className="size-1.5 rounded-full bg-border/40" />
                )}
                {r.platform}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Provider answers */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {prompt.results.map((answer) => (
            <ProviderAnswerCard key={answer.runId} answer={answer} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsView({ siteId }: { siteId: number }) {
  const query = trpc.seo.geoPromptResults.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const data = query.data as GeoPromptResultsData | undefined;

  if (query.isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <InlineEmptyState
        title="Couldn't load prompt results"
        description={query.error?.message ?? "Please try again in a moment."}
      />
    );
  }

  if (!data || !data.hasResults) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-8 text-center">
        <SearchIcon className="size-8 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="font-display text-2xl font-normal text-foreground mb-2">
          No prompt results yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Once prompts have been run against AI providers, each response will
          appear here with the full answer text and sources cited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {data.clusters.map((cluster) => (
        <PromptResultsGroup key={cluster.clusterId} cluster={cluster} />
      ))}
    </div>
  );
}

/* ===========================================================================
 * EMPTY / NO-RESULTS STATE
 * =========================================================================== */

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

/* ===========================================================================
 * MAIN GEO TAB
 * =========================================================================== */

export function GeoTab({ siteId }: { siteId: number }) {
  const [view, setView] = useState<GeoView>("visibility");

  const visibilityQuery = trpc.seo.geoVisibility.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const visibilityData = visibilityQuery.data as
    | GeoVisibilityData
    | undefined;

  // Show loading for initial visibility check
  if (visibilityQuery.isLoading && !visibilityData) {
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

  if (visibilityQuery.isError) {
    return (
      <InlineEmptyState
        title="Couldn't load GEO visibility"
        description={
          visibilityQuery.error?.message ?? "Please try again in a moment."
        }
      />
    );
  }

  if (!visibilityData || !visibilityData.hasResults) {
    return <NoResultsState />;
  }

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Active view */}
      {view === "visibility" ? (
        <VisibilityView data={visibilityData} />
      ) : (
        <ResultsView siteId={siteId} />
      )}
    </div>
  );
}
