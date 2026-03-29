import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowDownUp, ChevronRight } from "lucide-react";
import type { AiAuditItem, SeoCluster, SeoPage, SeoSite } from "./types";
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

type PageSort = "default" | "issues-desc" | "issues-asc";

export function getPageAuditSummary(page: SeoPage): { issueCount: number } {
  return { issueCount: extractAiAudit(page.auditJson).length };
}

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
  selectedIntent: string;
  onIntentChange: (value: string) => void;
  intentOptions: string[];
  clusterSearch: string;
  onClusterSearchChange: (value: string) => void;
  selectedClusterId: number | null;
  onSelectCluster: (value: number) => void;
}) {
  const [pageSort, setPageSort] = useState<PageSort>("default");

  // Precompute audit summaries and sort
  const sortedPages = useMemo(() => {
    const withAudit = filteredPages.map((page) => ({
      page,
      audit: getPageAuditSummary(page),
    }));

    if (pageSort === "default") return withAudit;

    return [...withAudit].sort((a, b) => {
      if (pageSort === "issues-desc")
        return b.audit.issueCount - a.audit.issueCount;
      if (pageSort === "issues-asc")
        return a.audit.issueCount - b.audit.issueCount;
      return 0;
    });
  }, [filteredPages, pageSort]);

  function cycleSort() {
    setPageSort((prev) =>
      prev === "issues-desc" ? "issues-asc" : "issues-desc"
    );
  }

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
          <div className="flex flex-wrap items-center gap-1.5">
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

            {/* Sort controls */}
            <span className="w-px h-4 bg-border/40 mx-1" />
            <button
              type="button"
              onClick={cycleSort}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                pageSort.startsWith("issues")
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <ArrowDownUp className="size-3" />
              AI audit{" "}
              {pageSort === "issues-asc"
                ? "↑"
                : pageSort === "issues-desc"
                ? "↓"
                : ""}
            </button>
          </div>
        </div>

        {/* Page list */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          {sortedPages.length === 0 ? (
            <InlineEmptyState
              title="No pages match these filters"
              description="Try a broader search or switch back to all page types."
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {sortedPages.map(({ page, audit }) => {
                const visibility = getVisibilityStatus(
                  page.indexability,
                  page.statusCode
                );
                const pageRole = getPageRole(
                  page.pageType,
                  page.isMoneyPage,
                  page.isAuthorityAsset
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
                        : "hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          getPageStatusDotClass(visibility.filter)
                        )}
                      />
                      <span className="flex-1 text-sm truncate">
                        {page.displayTitle}
                      </span>

                      {/* Inline audit indicators */}
                      {audit.issueCount > 0 && (
                        <span className="text-[11px] tabular-nums text-red-500/70 shrink-0">
                          {audit.issueCount} issue
                          {audit.issueCount !== 1 ? "s" : ""}
                        </span>
                      )}

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
                          <span className="text-xs text-muted-foreground/30">
                            ·
                          </span>
                          <span className="text-xs text-muted-foreground/50">
                            {page.clusterNames.length} cluster
                            {page.clusterNames.length !== 1 ? "s" : ""}
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
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            {filteredClusters.map((cluster) => (
              <ClusterRow
                key={cluster.id}
                cluster={cluster}
                isOpen={selectedClusterId === cluster.id}
                onToggle={() => onSelectCluster(cluster.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function extractAiAudit(auditJson: unknown): AiAuditItem[] {
  if (!auditJson || typeof auditJson !== "object") return [];
  const json = auditJson as Record<string, unknown>;
  const aiAudit = json.aiAudit;
  return Array.isArray(aiAudit)
    ? aiAudit.filter(
        (item): item is AiAuditItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as AiAuditItem).problem_title === "string" &&
          typeof (item as AiAuditItem).problem_description === "string"
      )
    : [];
}

function CheckItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2.5">
      <p className="text-sm">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
function PageAuditSection({ audits }: { audits: AiAuditItem[] }) {
  const issueCount = audits.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2.5">
        <p className="text-sm">AI audit findings</p>
        <p className="text-xs tabular-nums text-muted-foreground/60">
          {issueCount} issue{issueCount !== 1 ? "s" : ""}
        </p>
      </div>

      {audits.length > 0 && (
        <div className="space-y-2">
          {audits.map((item, index) => (
            <CheckItem
              key={`${item.problem_title}-${index}`}
              title={item.problem_title}
              description={item.problem_description}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageDetailCard({ page }: { page: SeoPage }) {
  const visibility = getVisibilityStatus(page.indexability, page.statusCode);
  const pageRole = getPageRole(
    page.pageType,
    page.isMoneyPage,
    page.isAuthorityAsset
  );
  const aiAudit = extractAiAudit(page.auditJson);

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
        <InfoTile
          label="Content status"
          value={toTitleCase(page.contentStatus)}
        />
        <InfoTile label="Last crawl" value={formatDate(page.lastCrawledAt)} />
        <InfoTile
          label="HTTP status"
          value={`${page.statusCode ?? "Unknown"}`}
        />
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
          {page.h1 ?? (
            <span className="text-muted-foreground/40">No H1 stored yet</span>
          )}
        </p>
      </div>

      {/* Meta description */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-2 text-muted-foreground">
          Meta description
        </h4>
        <p className="text-sm leading-relaxed">
          {page.metaDescription ?? (
            <span className="text-muted-foreground/40">
              No meta description stored yet
            </span>
          )}
        </p>
      </div>

      {/* Connected clusters */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-2 text-muted-foreground">
          Connected clusters
        </h4>
        {page.clusterNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {page.clusterNames.map((clusterName) => (
              <Badge
                key={clusterName}
                variant="outline"
                className="text-[11px] px-2 py-0.5"
              >
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

      {/* Page audit */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-normal text-muted-foreground">
            Page audit
          </h4>
          {page.lastAuditedOn && (
            <span className="text-xs text-muted-foreground/50">
              {formatDate(page.lastAuditedOn)}
            </span>
          )}
        </div>
        {aiAudit.length > 0 ? (
          <PageAuditSection audits={aiAudit} />
        ) : (
          <p className="text-sm text-muted-foreground/40">
            No AI audit findings available yet
          </p>
        )}
      </div>
    </div>
  );
}

function ClusterRow({
  cluster,
  isOpen,
  onToggle,
}: {
  cluster: SeoCluster;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const priority = getPriorityStatus(cluster.priorityScore);
  const priorityDotColor =
    priority.label === "High priority"
      ? "bg-red-400"
      : priority.label === "Medium priority"
      ? "bg-amber-400"
      : "bg-gray-400";

  return (
    <div
      className={cn(
        "border-b border-border/30 last:border-b-0 transition-colors",
        isOpen && "bg-muted/20"
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/10 transition-colors"
      >
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground/40 shrink-0 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <span
          className={cn("size-1.5 rounded-full shrink-0", priorityDotColor)}
        />
        <span className="flex-1 text-sm truncate">{cluster.name}</span>
        <span className="text-xs text-muted-foreground/50 tabular-nums shrink-0">
          {formatNumber(cluster.keywordCount)} keyword
          {cluster.keywordCount !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Expanded detail */}
      {isOpen && (
        <div className="px-4 pb-4 pl-11 space-y-4">
          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
            <span>{toTitleCase(cluster.primaryIntent)}</span>
            {cluster.funnelStage && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{toTitleCase(cluster.funnelStage)}</span>
              </>
            )}
            <span className="text-muted-foreground/30">·</span>
            <span>{priority.label}</span>
            {cluster.primaryKeyword && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-foreground text-xs">
                  Lead: {cluster.primaryKeyword}
                </span>
              </>
            )}
          </div>

          {/* Keywords */}
          {cluster.keywords.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground/50 mb-2">
                Keywords
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {cluster.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="text-[11px] text-muted-foreground border border-border/30 rounded-md px-2 py-0.5"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connected pages */}
          {cluster.pageUrls.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground/50 mb-2">
                {formatNumber(cluster.pageUrls.length)} connected page
                {cluster.pageUrls.length !== 1 ? "s" : ""}
              </h4>
              <div className="space-y-1">
                {cluster.pageUrls.map((pageUrl) => (
                  <div
                    key={pageUrl}
                    className="text-[13px] text-muted-foreground/60 truncate"
                  >
                    {pageUrl}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
