import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowDownUp, ChevronRight } from "lucide-react";
import type { PageAuditItem, SeoCluster, SeoPage, SeoSite } from "./types";
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

type PageSort = "default" | "score-asc" | "score-desc" | "issues-desc" | "issues-asc";

export function getPageAuditSummary(page: SeoPage): { score: number | null; issueCount: number } {
  const audit = extractAuditItem(page.auditJson);
  if (!audit) return { score: null, issueCount: 0 };

  let issueCount = 0;
  if (audit.checks) {
    for (const [key, value] of Object.entries(audit.checks)) {
      if (!CHECK_LABELS[key]) continue;
      if (POSITIVE_CHECKS.has(key) ? !value : value) issueCount++;
    }
  }

  return { score: audit.onpage_score ?? null, issueCount };
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
  const [pageSort, setPageSort] = useState<PageSort>("default");

  // Precompute audit summaries and sort
  const sortedPages = useMemo(() => {
    const withAudit = filteredPages.map((page) => ({
      page,
      audit: getPageAuditSummary(page),
    }));

    if (pageSort === "default") return withAudit;

    return [...withAudit].sort((a, b) => {
      if (pageSort === "score-desc") return (b.audit.score ?? -1) - (a.audit.score ?? -1);
      if (pageSort === "score-asc") return (a.audit.score ?? 101) - (b.audit.score ?? 101);
      if (pageSort === "issues-desc") return b.audit.issueCount - a.audit.issueCount;
      if (pageSort === "issues-asc") return a.audit.issueCount - b.audit.issueCount;
      return 0;
    });
  }, [filteredPages, pageSort]);

  function cycleSort(field: "score" | "issues") {
    if (field === "score") {
      setPageSort((prev) => prev === "score-desc" ? "score-asc" : "score-desc");
    } else {
      setPageSort((prev) => prev === "issues-desc" ? "issues-asc" : "issues-desc");
    }
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
              onClick={() => cycleSort("score")}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                pageSort.startsWith("score")
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <ArrowDownUp className="size-3" />
              Score {pageSort === "score-asc" ? "↑" : pageSort === "score-desc" ? "↓" : ""}
            </button>
            <button
              type="button"
              onClick={() => cycleSort("issues")}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                pageSort.startsWith("issues")
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <ArrowDownUp className="size-3" />
              Issues {pageSort === "issues-asc" ? "↑" : pageSort === "issues-desc" ? "↓" : ""}
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
                  page.statusCode,
                );
                const pageRole = getPageRole(
                  page.pageType,
                  page.isMoneyPage,
                  page.isAuthorityAsset,
                );

                const scoreColor =
                  audit.score != null
                    ? audit.score >= 80
                      ? "text-emerald-500"
                      : audit.score >= 50
                        ? "text-amber-500"
                        : "text-red-500"
                    : null;

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

                      {/* Inline audit indicators */}
                      {audit.issueCount > 0 && (
                        <span className="text-[11px] tabular-nums text-red-500/70 shrink-0">
                          {audit.issueCount} issue{audit.issueCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {audit.score != null && (
                        <span className={cn("text-[11px] tabular-nums font-medium shrink-0", scoreColor)}>
                          {Math.round(audit.score)}
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

function extractAuditItem(auditJson: unknown): PageAuditItem | null {
  if (!auditJson || typeof auditJson !== "object") return null;
  const json = auditJson as Record<string, unknown>;
  const tasks = json.tasks as Record<string, unknown> | undefined;
  const instant = tasks?.instant as Record<string, unknown> | undefined;
  const result = instant?.result as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(result) || result.length === 0) return null;
  const items = result[0].items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0] as unknown as PageAuditItem;
}


function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={cn(
        "size-1.5 rounded-full shrink-0",
        passed ? "bg-emerald-400" : "bg-red-400",
      )} />
      <span className={cn(
        "text-sm",
        passed ? "text-muted-foreground" : "text-foreground",
      )}>
        {label}
      </span>
    </div>
  );
}

const CHECK_LABELS: Record<string, string> = {
  // Negative checks (true = problem)
  no_title: "Missing title tag",
  no_description: "Missing meta description",
  no_h1_tag: "Missing H1 tag",
  no_favicon: "Missing favicon",
  no_doctype: "Missing doctype",
  title_too_long: "Title too long",
  title_too_short: "Title too short",
  no_image_alt: "Images missing alt text",
  no_image_title: "Images missing title attribute",
  low_content_rate: "Low content rate",
  high_content_rate: "High content rate",
  high_loading_time: "High loading time",
  high_waiting_time: "High server wait time",
  is_broken: "Broken page",
  is_redirect: "Redirect",
  is_http: "Not using HTTPS",
  duplicate_title_tag: "Duplicate title",
  duplicate_description: "Duplicate description",
  duplicate_content: "Duplicate content",
  duplicate_meta_tags: "Duplicate meta tags",
  https_to_http_links: "HTTPS to HTTP links",
  has_render_blocking_resources: "Render-blocking resources",
  irrelevant_description: "Irrelevant description",
  irrelevant_title: "Irrelevant title",
  irrelevant_meta_keywords: "Irrelevant meta keywords",
  large_page_size: "Large page size",
  size_greater_than_3mb: "Page larger than 3 MB",
  small_page_size: "Small page size",
  low_character_count: "Low character count",
  high_character_count: "High character count",
  low_readability_rate: "Low readability",
  lorem_ipsum: "Contains placeholder text",
  deprecated_html_tags: "Deprecated HTML tags",
  no_content_encoding: "No content encoding",
  no_encoding_meta_tag: "No encoding meta tag",
  has_meta_refresh_redirect: "Meta refresh redirect",
  flash: "Uses Flash",
  // Positive checks (true = good)
  is_https: "Using HTTPS",
  canonical: "Canonical tag present",
  seo_friendly_url: "SEO-friendly URL",
  has_html_doctype: "HTML doctype present",
  meta_charset_consistency: "Charset is consistent",
  has_micromarkup: "Has structured data",
};

const POSITIVE_CHECKS = new Set([
  "is_https",
  "canonical",
  "seo_friendly_url",
  "has_html_doctype",
  "meta_charset_consistency",
  "has_micromarkup",
  "seo_friendly_url_dynamic_check",
  "seo_friendly_url_keywords_check",
  "seo_friendly_url_characters_check",
  "seo_friendly_url_relative_length_check",
]);


function PageAuditSection({ audit }: { audit: PageAuditItem }) {
  const [passedOpen, setPassedOpen] = useState(false);
  const checks = audit.checks;

  // Separate checks into issues and passes
  const issues: Array<{ label: string; key: string }> = [];
  const passes: Array<{ label: string; key: string }> = [];

  if (checks) {
    for (const [key, value] of Object.entries(checks)) {
      const label = CHECK_LABELS[key];
      if (!label) continue;
      const passed = POSITIVE_CHECKS.has(key) ? value : !value;
      (passed ? passes : issues).push({ label, key });
    }
  }

  const score = audit.onpage_score;
  const scoreColor =
    score != null
      ? score >= 80
        ? "text-emerald-500"
        : score >= 50
          ? "text-amber-500"
          : "text-red-500"
      : null;
  const verdictLabel =
    score != null
      ? score >= 80
        ? "Good"
        : score >= 50
          ? "Needs improvement"
          : "Poor"
      : null;

  return (
    <div className="space-y-4">
      {/* Score hero */}
      {score != null && (
        <div className="flex flex-col items-center gap-1 py-3">
          <span className={cn("text-4xl tabular-nums font-normal", scoreColor)}>
            {Math.round(score)}
          </span>
          <p className="text-sm text-muted-foreground">{verdictLabel}</p>
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            {issues.length > 0 && (
              <span className="text-red-500/70">{issues.length} issue{issues.length !== 1 ? "s" : ""}</span>
            )}
            {issues.length > 0 && passes.length > 0 && " · "}
            {passes.length > 0 && (
              <span>{passes.length} passed</span>
            )}
          </p>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="rounded-lg bg-red-50/50 dark:bg-red-950/20 px-3 py-2.5">
          <div className="space-y-1">
            {issues.map((item) => (
              <CheckItem key={item.key} label={item.label} passed={false} />
            ))}
          </div>
        </div>
      )}

      {/* Passed checks — collapsible */}
      {passes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setPassedOpen(!passedOpen)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", passedOpen && "rotate-90")} />
            <span>{passes.length} check{passes.length !== 1 ? "s" : ""} passed</span>
          </button>
          {passedOpen && (
            <div className="mt-2 pl-5 space-y-0.5">
              {passes.map((item) => (
                <CheckItem key={item.key} label={item.label} passed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PageDetailCard({ page }: { page: SeoPage }) {
  const visibility = getVisibilityStatus(page.indexability, page.statusCode);
  const pageRole = getPageRole(page.pageType, page.isMoneyPage, page.isAuthorityAsset);
  const auditItem = extractAuditItem(page.auditJson);

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

      {/* Page audit */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-normal text-muted-foreground">Page audit</h4>
          {page.lastAuditedOn && (
            <span className="text-xs text-muted-foreground/50">
              {formatDate(page.lastAuditedOn)}
            </span>
          )}
        </div>
        {auditItem ? (
          <PageAuditSection audit={auditItem} />
        ) : (
          <p className="text-sm text-muted-foreground/40">
            No audit data available yet
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
