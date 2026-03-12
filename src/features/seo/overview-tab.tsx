import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PageVisibilityFilter, SeoCluster, SeoPage, SeoSite } from "./types";
import { FilterChip, InfoTile, InlineEmptyState } from "./shared";
import {
  formatDate,
  formatNumber,
  getDisplayPath,
  getPageRole,
  getPageStatusDotClass,
  getPriorityStatus,
  getVisibilityStatus,
  toTitleCase,
} from "./utils";

export function OverviewTab({
  selectedSite,
  filteredPages,
  filteredClusters,
  selectedVisibility,
  onVisibilityChange,
  selectedPageType,
  onPageTypeChange,
  pageTypeOptions,
  pageSearch,
  onPageSearchChange,
  selectedPageId,
  onSelectPage,
  activeCluster,
  selectedIntent,
  onIntentChange,
  intentOptions,
  clusterSearch,
  onClusterSearchChange,
  selectedClusterId,
  onSelectCluster,
}: {
  selectedSite: SeoSite | null;
  filteredPages: SeoPage[];
  filteredClusters: SeoCluster[];
  selectedVisibility: PageVisibilityFilter;
  onVisibilityChange: (value: PageVisibilityFilter) => void;
  selectedPageType: string;
  onPageTypeChange: (value: string) => void;
  pageTypeOptions: string[];
  pageSearch: string;
  onPageSearchChange: (value: string) => void;
  selectedPageId: string | null;
  onSelectPage: (value: string) => void;
  activeCluster: SeoCluster | null;
  selectedIntent: string;
  onIntentChange: (value: string) => void;
  intentOptions: string[];
  clusterSearch: string;
  onClusterSearchChange: (value: string) => void;
  selectedClusterId: string | null;
  onSelectCluster: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-6">
        <Card className="overflow-hidden border-border/70 bg-card/95">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <div>
              <CardTitle className="text-xl">Pages Overview</CardTitle>
              <CardDescription className="mt-1">
                Every tracked page, its role, and how clearly it is aligned
                with keyword coverage.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                value={pageSearch}
                onChange={(event) => onPageSearchChange(event.target.value)}
                placeholder="Search pages by title, URL, type, or keyword cluster"
                className="h-10 bg-background/75"
              />
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={selectedVisibility === "all"}
                  onClick={() => onVisibilityChange("all")}
                  label="All visibility"
                />
                <FilterChip
                  active={selectedVisibility === "searchable"}
                  onClick={() => onVisibilityChange("searchable")}
                  label="Can appear in search"
                />
                <FilterChip
                  active={selectedVisibility === "hidden"}
                  onClick={() => onVisibilityChange("hidden")}
                  label="Hidden from search"
                />
                <FilterChip
                  active={selectedVisibility === "attention"}
                  onClick={() => onVisibilityChange("attention")}
                  label="Needs attention"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={selectedPageType === "all"}
                  onClick={() => onPageTypeChange("all")}
                  label="All page types"
                />
                {pageTypeOptions.map((pageType) => (
                  <FilterChip
                    key={pageType}
                    active={selectedPageType === pageType}
                    onClick={() => onPageTypeChange(pageType)}
                    label={toTitleCase(pageType)}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {filteredPages.length === 0 ? (
              <InlineEmptyState
                title="No pages match these filters"
                description="Try a broader search or switch back to all page types and visibility."
              />
            ) : (
              <div className="px-5 pb-5">
                <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/85 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Showing {formatNumber(filteredPages.length)} page
                        {filteredPages.length !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Scroll to browse the full page inventory
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {selectedSite?.name}
                    </Badge>
                  </div>
                  <div className="max-h-[720px] overflow-y-auto">
                    {filteredPages.map((page, index) => {
                      const visibility = getVisibilityStatus(
                        page.indexability,
                        page.statusCode,
                      );
                      const pageRole = getPageRole(
                        page.pageType,
                        page.isMoneyPage,
                        page.isAuthorityAsset,
                      );

                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => onSelectPage(page.id)}
                          className={cn(
                            "flex w-full items-center gap-4 px-6 py-6 text-left transition-colors hover:bg-muted/20",
                            index !== filteredPages.length - 1 &&
                              "border-b border-border/50",
                            selectedPageId === page.id && "bg-primary/5",
                          )}
                        >
                          <div
                            className={cn(
                              "size-4 shrink-0 rounded-full border-2 border-background shadow-sm",
                              getPageStatusDotClass(visibility.filter),
                            )}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[1.05rem] font-semibold text-foreground">
                              {page.displayTitle}
                            </div>
                            <div className="mt-1 truncate text-sm text-muted-foreground">
                              {getDisplayPath(page.url)}
                            </div>
                          </div>

                          <div className="hidden shrink-0 lg:block">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
                                pageRole.tone,
                              )}
                            >
                              {pageRole.label}
                            </Badge>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <ChevronRight className="size-6 text-muted-foreground/55" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.5fr)]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <CardTitle className="text-lg">Cluster focus</CardTitle>
            <CardDescription>
              The selected keyword cluster and the terms connected to it.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {activeCluster ? (
              <ClusterDetailCard cluster={activeCluster} />
            ) : (
              <InlineEmptyState
                title="Choose a cluster"
                description="Select a cluster card to inspect its keywords and linked pages."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">Keyword clusters</CardTitle>
                <CardDescription className="mt-1">
                  Topic groups and the keywords that belong to each one.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {formatNumber(filteredClusters.length)} shown
              </Badge>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                value={clusterSearch}
                onChange={(event) => onClusterSearchChange(event.target.value)}
                placeholder="Search by cluster name, intent, or keyword"
                className="h-10 bg-background/75"
              />
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={selectedIntent === "all"}
                  onClick={() => onIntentChange("all")}
                  label="All intents"
                />
                {intentOptions.map((intent) => (
                  <FilterChip
                    key={intent}
                    active={selectedIntent === intent}
                    onClick={() => onIntentChange(intent)}
                    label={toTitleCase(intent)}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredClusters.length === 0 ? (
              <InlineEmptyState
                title="No clusters match these filters"
                description="Clear the search or switch back to all intents to see more."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredClusters.map((cluster) => {
                  const priority = getPriorityStatus(cluster.priorityScore);
                  return (
                    <button
                      key={cluster.id}
                      type="button"
                      onClick={() => onSelectCluster(cluster.id)}
                      className={cn(
                        "rounded-3xl border p-5 text-left transition-all",
                        selectedClusterId === cluster.id
                          ? "border-primary/20 bg-primary/6 shadow-sm"
                          : "border-border/70 bg-background/75 hover:border-primary/15 hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-foreground">
                            {cluster.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {cluster.siteName} · {cluster.siteDomain}
                          </div>
                        </div>
                        <Badge variant={priority.variant} className="rounded-full px-3 py-1">
                          {priority.label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          {toTitleCase(cluster.primaryIntent)}
                        </Badge>
                        {cluster.funnelStage ? (
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {toTitleCase(cluster.funnelStage)}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-4 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {cluster.primaryKeyword ?? "No lead keyword"}
                        </span>
                        {" · "}
                        {formatNumber(cluster.keywordCount)} keyword
                        {cluster.keywordCount !== 1 ? "s" : ""}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {cluster.keywords.slice(0, 4).map((keyword) => (
                          <Badge
                            key={keyword}
                            variant="outline"
                            className="rounded-full px-3 py-1"
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {cluster.keywords.length > 4 ? (
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            +{cluster.keywords.length - 4} more
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function PageDetailCard({ page }: { page: SeoPage }) {
  const visibility = getVisibilityStatus(page.indexability, page.statusCode);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="text-xl font-semibold text-foreground">{page.displayTitle}</div>
        <div className="break-all text-sm text-muted-foreground">{page.url}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {toTitleCase(page.pageType)}
        </Badge>
        <Badge variant="outline" className="rounded-full px-3 py-1">
          {getPageRole(page.pageType, page.isMoneyPage, page.isAuthorityAsset).label}
        </Badge>
        <Badge variant={visibility.variant} className="rounded-full px-3 py-1">
          {visibility.label}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile label="Content status" value={toTitleCase(page.contentStatus)} />
        <InfoTile label="Last crawl" value={formatDate(page.lastCrawledAt)} />
        <InfoTile label="HTTP status" value={`HTTP ${page.statusCode ?? "unknown"}`} />
        <InfoTile
          label="Keyword coverage"
          value={
            page.clusterNames.length > 0
              ? `${formatNumber(page.clusterNames.length)} clusters linked`
              : "No clusters linked yet"
          }
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          H1
        </div>
        <div className="rounded-2xl bg-muted/35 p-4 text-sm text-foreground">
          {page.h1 ?? "No H1 stored yet."}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          Meta description
        </div>
        <div className="rounded-2xl bg-muted/35 p-4 text-sm text-foreground">
          {page.metaDescription ?? "No meta description stored yet."}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          Connected clusters
        </div>
        {page.clusterNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {page.clusterNames.map((clusterName) => (
              <Badge key={clusterName} variant="outline" className="rounded-full px-3 py-1">
                {clusterName}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            This page has not been mapped to a keyword cluster yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ClusterDetailCard({ cluster }: { cluster: SeoCluster }) {
  const priority = getPriorityStatus(cluster.priorityScore);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="text-xl font-semibold text-foreground">{cluster.name}</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {toTitleCase(cluster.primaryIntent)}
          </Badge>
          {cluster.funnelStage ? (
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {toTitleCase(cluster.funnelStage)}
            </Badge>
          ) : null}
          <Badge variant={priority.variant} className="rounded-full px-3 py-1">
            {priority.label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile
          label="Lead keyword"
          value={cluster.primaryKeyword ?? "Not selected yet"}
        />
        <InfoTile
          label="Keywords in cluster"
          value={`${formatNumber(cluster.keywordCount)} total`}
        />
        <InfoTile
          label="Linked pages"
          value={`${formatNumber(cluster.pageUrls.length)} pages`}
        />
        <InfoTile
          label="Priority score"
          value={cluster.priorityScore ?? "Not set"}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          Included keywords
        </div>
        {cluster.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {cluster.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="rounded-full px-3 py-1">
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No keywords have been attached to this cluster yet.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          Connected pages
        </div>
        {cluster.pageUrls.length > 0 ? (
          <div className="space-y-2">
            {cluster.pageUrls.map((pageUrl) => (
              <div
                key={pageUrl}
                className="rounded-2xl bg-muted/35 px-4 py-3 text-sm text-foreground"
              >
                {pageUrl}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No page has been linked to this cluster yet.
          </div>
        )}
      </div>
    </div>
  );
}
