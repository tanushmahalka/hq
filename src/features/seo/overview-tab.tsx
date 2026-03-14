import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SeoCluster, SeoPage, SeoSite } from "./types";
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
  filteredPages,
  filteredClusters,
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
  selectedPageType: string;
  onPageTypeChange: (value: string) => void;
  pageTypeOptions: string[];
  pageSearch: string;
  onPageSearchChange: (value: string) => void;
  selectedPageId: number | null;
  onSelectPage: (value: number) => void;
  activeCluster: SeoCluster | null;
  selectedIntent: string;
  onIntentChange: (value: string) => void;
  intentOptions: string[];
  clusterSearch: string;
  onClusterSearchChange: (value: string) => void;
  selectedClusterId: number | null;
  onSelectCluster: (value: number) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Pages section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Pages</h2>
          <span className="text-xs text-muted-foreground/60">
            {formatNumber(filteredPages.length)} shown
          </span>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-2 mb-3">
          <input
            value={pageSearch}
            onChange={(event) => onPageSearchChange(event.target.value)}
            placeholder="Search pages by title, URL, type, or cluster..."
            className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={selectedPageType === "all"}
              onClick={() => onPageTypeChange("all")}
              label="All"
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

        {/* Page list */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          {filteredPages.length === 0 ? (
            <InlineEmptyState
              title="No pages match these filters"
              description="Try a broader search or switch back to all page types."
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredPages.map((page) => {
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
                      "relative w-full text-left px-4 py-3 transition-colors border-b border-border/30 last:border-b-0",
                      selectedPageId === page.id
                        ? "bg-muted/40 border-l-[3px] border-l-[var(--swarm-violet)]"
                        : "hover:bg-muted/20",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          getPageStatusDotClass(visibility.filter),
                        )}
                      />
                      <span className="flex-1 text-sm truncate">
                        {page.displayTitle}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 shrink-0 hidden lg:inline-flex"
                      >
                        {pageRole.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 ml-4">
                      <span className="text-xs text-muted-foreground/50 truncate">
                        {getDisplayPath(page.url)}
                      </span>
                      {page.clusterNames.length > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground/30">·</span>
                          <span className="text-xs text-muted-foreground/50">
                            {page.clusterNames.length} cluster{page.clusterNames.length !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Clusters section */}
      <section>
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
          {/* Cluster focus */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Cluster focus
            </h2>
            <div className="rounded-xl border border-border/40 bg-card p-4">
              {activeCluster ? (
                <ClusterDetailCard cluster={activeCluster} />
              ) : (
                <p className="text-sm text-muted-foreground/40 text-center py-8">
                  Select a cluster to inspect
                </p>
              )}
            </div>
          </div>

          {/* Cluster grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Keyword clusters
              </h2>
              <span className="text-xs text-muted-foreground/60">
                {formatNumber(filteredClusters.length)} shown
              </span>
            </div>

            {/* Search + filters */}
            <div className="flex flex-col gap-2 mb-3">
              <input
                value={clusterSearch}
                onChange={(event) => onClusterSearchChange(event.target.value)}
                placeholder="Search by cluster name, intent, or keyword..."
                className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
              />
              <div className="flex flex-wrap gap-1.5">
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

            {filteredClusters.length === 0 ? (
              <InlineEmptyState
                title="No clusters match these filters"
                description="Clear the search or switch back to all intents."
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filteredClusters.map((cluster) => {
                  const priority = getPriorityStatus(cluster.priorityScore);
                  return (
                    <button
                      key={cluster.id}
                      type="button"
                      onClick={() => onSelectCluster(cluster.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border p-4 text-left transition-all swarm-card",
                        selectedClusterId === cluster.id
                          ? "border-[var(--swarm-violet)]/20 bg-[var(--swarm-violet-dim)]"
                          : "border-border/40 bg-card hover:bg-muted/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {cluster.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-muted-foreground/50">
                              {toTitleCase(cluster.primaryIntent)}
                            </span>
                            {cluster.funnelStage && (
                              <>
                                <span className="text-xs text-muted-foreground/30">·</span>
                                <span className="text-xs text-muted-foreground/50">
                                  {toTitleCase(cluster.funnelStage)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant={priority.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                          {priority.label}
                        </Badge>
                      </div>

                      <div className="mt-3 text-[13px] text-muted-foreground">
                        <span className="text-foreground">
                          {cluster.primaryKeyword ?? "No lead keyword"}
                        </span>
                        {" · "}
                        {formatNumber(cluster.keywordCount)} keyword{cluster.keywordCount !== 1 ? "s" : ""}
                      </div>

                      {cluster.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cluster.keywords.slice(0, 3).map((keyword) => (
                            <span
                              key={keyword}
                              className="text-[10px] text-muted-foreground/60 border border-border/30 rounded px-1.5 py-0.5"
                            >
                              {keyword}
                            </span>
                          ))}
                          {cluster.keywords.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/40 px-1 py-0.5">
                              +{cluster.keywords.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function PageDetailCard({ page }: { page: SeoPage }) {
  const visibility = getVisibilityStatus(page.indexability, page.statusCode);
  const pageRole = getPageRole(page.pageType, page.isMoneyPage, page.isAuthorityAsset);

  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
          {toTitleCase(page.pageType)}
        </Badge>
        <Badge variant="outline" className="text-[11px] px-2 py-0.5">
          {pageRole.label}
        </Badge>
        <Badge variant={visibility.variant} className="text-[11px] px-2 py-0.5">
          {visibility.label}
        </Badge>
      </div>

      {/* Properties */}
      <div className="space-y-0">
        <InfoTile label="Content status" value={toTitleCase(page.contentStatus)} />
        <InfoTile label="Last crawl" value={formatDate(page.lastCrawledAt)} />
        <InfoTile label="HTTP status" value={`${page.statusCode ?? "Unknown"}`} />
        <InfoTile
          label="Keyword coverage"
          value={
            page.clusterNames.length > 0
              ? `${formatNumber(page.clusterNames.length)} clusters linked`
              : "No clusters linked yet"
          }
        />
      </div>

      {/* H1 */}
      <div className="mt-4 border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-2 text-muted-foreground">H1</h4>
        <p className="text-sm">
          {page.h1 ?? <span className="text-muted-foreground/40">No H1 stored yet</span>}
        </p>
      </div>

      {/* Meta description */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-2 text-muted-foreground">Meta description</h4>
        <p className="text-sm leading-relaxed">
          {page.metaDescription ?? <span className="text-muted-foreground/40">No meta description stored yet</span>}
        </p>
      </div>

      {/* Connected clusters */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-2 text-muted-foreground">Connected clusters</h4>
        {page.clusterNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {page.clusterNames.map((clusterName) => (
              <Badge key={clusterName} variant="outline" className="text-[11px] px-2 py-0.5">
                {clusterName}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/40">
            Not mapped to a keyword cluster yet
          </p>
        )}
      </div>
    </div>
  );
}

function ClusterDetailCard({ cluster }: { cluster: SeoCluster }) {
  const priority = getPriorityStatus(cluster.priorityScore);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{cluster.name}</h3>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {toTitleCase(cluster.primaryIntent)}
          </Badge>
          {cluster.funnelStage && (
            <Badge variant="outline" className="text-[11px] px-2 py-0.5">
              {toTitleCase(cluster.funnelStage)}
            </Badge>
          )}
          <Badge variant={priority.variant} className="text-[11px] px-2 py-0.5">
            {priority.label}
          </Badge>
        </div>
      </div>

      {/* Properties */}
      <div className="space-y-0">
        <InfoTile
          label="Lead keyword"
          value={cluster.primaryKeyword ?? "Not selected yet"}
        />
        <InfoTile
          label="Keywords"
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

      {/* Keywords */}
      {cluster.keywords.length > 0 && (
        <div className="border-t border-border/50 pt-3">
          <h4 className="text-sm font-normal mb-2 text-muted-foreground">Keywords</h4>
          <div className="flex flex-wrap gap-1.5">
            {cluster.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-[11px] px-2 py-0.5">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Connected pages */}
      {cluster.pageUrls.length > 0 && (
        <div className="border-t border-border/50 pt-3">
          <h4 className="text-sm font-normal mb-2 text-muted-foreground">Connected pages</h4>
          <div className="space-y-1">
            {cluster.pageUrls.map((pageUrl) => (
              <div
                key={pageUrl}
                className="text-[13px] text-muted-foreground truncate"
              >
                {pageUrl}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
