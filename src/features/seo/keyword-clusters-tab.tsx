import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, InlineEmptyState, SummaryCard } from "./shared";
import type { SeoKeywordCluster, SeoKeywordClustersData } from "./types";

type SortMode = "importance" | "title";
type DetailTabKey = "overview";

const IMPORTANCE_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const IMPORTANCE_BADGE_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
  low: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/10 dark:text-slate-200",
};

function normalizeImportance(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function importanceRank(value: string | null): number {
  return IMPORTANCE_ORDER[normalizeImportance(value)] ?? 3;
}

function ImportanceBadge({ value }: { value: string | null }) {
  const normalized = normalizeImportance(value);
  if (!normalized) {
    return (
      <span className="inline-flex items-center rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
        Unrated
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        IMPORTANCE_BADGE_STYLES[normalized] ?? "border-border/50 bg-muted/50 text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 rounded-full border px-3 text-xs",
        active
          ? "border-foreground/15 bg-foreground/5 text-foreground hover:bg-foreground/5"
          : "border-border/50 text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      <ArrowUpDown className="mr-1 size-3" />
      {label}
    </Button>
  );
}

function DetailTabs({
  value,
  onValueChange,
}: {
  value: DetailTabKey;
  onValueChange: (next: DetailTabKey) => void;
}) {
  return (
    <div className="border-b border-border/40">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onValueChange("overview")}
          className={cn(
            "border-b-2 px-1 pb-3 pt-1 text-sm transition-colors",
            value === "overview"
              ? "border-foreground text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Overview
        </button>
        <span className="pb-3 pt-1 text-xs text-muted-foreground/50">More tabs coming soon</span>
      </div>
    </div>
  );
}

function ClusterCard({
  cluster,
  active,
  onClick,
}: {
  cluster: SeoKeywordCluster;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="keyword-cluster-card"
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-card p-4 text-left transition-colors",
        active
          ? "border-foreground/20 bg-foreground/[0.03]"
          : "border-border/40 hover:border-border/70 hover:bg-card",
      )}
    >
      {active ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
              opacity: 0.5,
              animation: "swarm-shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{cluster.title}</p>
          {cluster.whyThisMatters ? (
            <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">
              {cluster.whyThisMatters}
            </p>
          ) : null}
        </div>
        <ImportanceBadge value={cluster.mattersForKfd} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/70">
        <span>{cluster.keywordCount} keywords</span>
          {cluster.representativeKeyword ? <span>- {cluster.representativeKeyword}</span> : null}
      </div>
    </button>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function KeywordTable({ cluster }: { cluster: SeoKeywordCluster }) {
  if (cluster.keywords.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground/40 text-center">
        No keywords are attached to this cluster yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Keyword</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cluster.keywords.map((keyword) => (
            <TableRow key={keyword}>
              <TableCell className="text-sm">{keyword}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClusterDetailPanel({
  cluster,
}: {
  cluster: SeoKeywordCluster | null;
}) {
  const [activeTab, setActiveTab] = useState<DetailTabKey>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [cluster?.id]);

  if (!cluster) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-12">
        <p className="text-sm text-muted-foreground/40 text-center">
          Select a keyword cluster to inspect the rationale and keywords here.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="keyword-cluster-detail" className="rounded-2xl border border-border/40 bg-card/60">
      <div className="border-b border-border/40 px-6 py-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            Cluster
          </Badge>
          <ImportanceBadge value={cluster.mattersForKfd} />
        </div>
        <h2 className="font-display text-4xl font-normal text-foreground">
          {cluster.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {cluster.keywordCount} tracked keywords
          {cluster.representativeKeyword ? ` · Representative keyword: ${cluster.representativeKeyword}` : ""}
        </p>
      </div>

      <div className="px-6 pt-4">
        <DetailTabs value={activeTab} onValueChange={setActiveTab} />
      </div>

      <div className="px-6 pb-6 pt-5">
        {activeTab === "overview" ? (
          <>
            <DetailSection title="Why this cluster is important">
              <p className="text-sm leading-6 text-foreground/90">
                {cluster.whyThisMatters ?? "No rationale has been added for this cluster yet."}
              </p>
            </DetailSection>

            <DetailSection title="How this can help">
              <p className="text-sm leading-6 text-foreground/90">
                {cluster.howThisCanHelp ?? "No opportunity notes have been added for this cluster yet."}
              </p>
            </DetailSection>

            <DetailSection title="Keywords">
              <KeywordTable cluster={cluster} />
            </DetailSection>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function KeywordClustersTab({ siteId }: { siteId: number }) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("importance");
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const deferredSearch = useDeferredValue(search);

  const query = trpc.seo.keywordClusters.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
    },
  );

  const data = query.data as SeoKeywordClustersData | undefined;

  const filteredClusters = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const rows = (data?.rows ?? []).filter((cluster) =>
      normalizedSearch.length === 0
        ? true
        : cluster.title.toLowerCase().includes(normalizedSearch),
    );

    return rows.sort((a, b) => {
      if (sortMode === "title") {
        return a.title.localeCompare(b.title);
      }

      const rankDifference = importanceRank(a.mattersForKfd) - importanceRank(b.mattersForKfd);
      if (rankDifference !== 0) return rankDifference;
      return a.title.localeCompare(b.title);
    });
  }, [data?.rows, deferredSearch, sortMode]);

  const activeCluster = filteredClusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  useEffect(() => {
    setSelectedClusterId((current) => {
      if (current === null) return null;
      return filteredClusters.some((cluster) => cluster.id === current) ? current : null;
    });
  }, [filteredClusters]);

  useEffect(() => {
    setSelectedClusterId(null);
    setSearch("");
    setSortMode("importance");
  }, [siteId]);

  const summary = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total: rows.length,
      high: rows.filter((row) => normalizeImportance(row.mattersForKfd) === "high").length,
      medium: rows.filter((row) => normalizeImportance(row.mattersForKfd) === "medium").length,
      low: rows.filter((row) => normalizeImportance(row.mattersForKfd) === "low").length,
    };
  }, [data?.rows]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Skeleton className="h-[580px] rounded-2xl" />
          <Skeleton className="h-[580px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={Search}
        title="We couldn't load keyword clusters"
        description={query.error.message}
      />
    );
  }

  if ((data?.rows.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No reviewed keyword clusters yet"
        description="Once reviewed keyword clusters are stored for this site, they will show up here automatically."
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-4 flex items-center gap-8">
        <SummaryCard label="Clusters" value={summary.total} />
        <SummaryCard label="High importance" value={summary.high} />
        <SummaryCard label="Medium importance" value={summary.medium} />
        <SummaryCard label="Low importance" value={summary.low} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="min-h-0 rounded-2xl border border-border/40 bg-card/60">
          <div className="border-b border-border/40 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-medium text-foreground">Cluster list</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Search by title and sort the reviewed clusters by importance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SortButton
                  active={sortMode === "importance"}
                  label="Importance"
                  onClick={() => setSortMode("importance")}
                />
                <SortButton
                  active={sortMode === "title"}
                  label="Title"
                  onClick={() => setSortMode("title")}
                />
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cluster titles"
                className="pl-9"
                aria-label="Search cluster titles"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto px-4 py-4">
            {filteredClusters.length === 0 ? (
              <InlineEmptyState
                title="No keyword clusters match"
                description="Try a different title search to find the cluster you want."
              />
            ) : (
              <div className="space-y-2">
                {filteredClusters.map((cluster) => (
                  <ClusterCard
                    key={cluster.id}
                    cluster={cluster}
                    active={cluster.id === selectedClusterId}
                    onClick={() => setSelectedClusterId(cluster.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto">
          <ClusterDetailPanel cluster={activeCluster} />
        </section>
      </div>
    </div>
  );
}
