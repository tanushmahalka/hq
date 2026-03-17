import { useDeferredValue, useMemo, useState } from "react";
import {
  FileText,
  Globe,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsTab } from "@/features/seo/analytics-tab";
import { BacklinksTab } from "@/features/seo/backlinks-tab";
import { CompetitorsTab } from "@/features/seo/competitors-tab";
import { GeoTab } from "@/features/seo/geo-tab";
import { KeywordsTab } from "@/features/seo/keywords-tab";
import { OverviewTab, PageDetailCard, getPageAuditSummary } from "@/features/seo/overview-tab";
import {
  EmptyState,
  SeoLoadingState,
  SeoTabButton,
  SummaryCard,
} from "@/features/seo/shared";
import type {
  SeoCluster,
  SeoCompetitor,
  SeoPage,
  SeoSite,
  SeoViewTab,
} from "@/features/seo/types";
import { formatNumber } from "@/features/seo/utils";

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function Seo() {
  const [activeTab, setActiveTab] = useState<SeoViewTab>("overview");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [pageSearch, setPageSearch] = useState("");
  const [clusterSearch, setClusterSearch] = useState("");
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [selectedPageType, setSelectedPageType] = useState("all");
  const [selectedIntent, setSelectedIntent] = useState("all");
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<number | null>(null);

  const deferredPageSearch = useDeferredValue(pageSearch);
  const deferredClusterSearch = useDeferredValue(clusterSearch);
  const deferredCompetitorSearch = useDeferredValue(competitorSearch);

  const overviewQuery = trpc.seo.overview.useQuery();
  const rawOverview = overviewQuery.data as Record<string, unknown> | undefined;

  const sites = readArray<SeoSite>(rawOverview?.sites);
  const pages = readArray<SeoPage>(rawOverview?.pages);
  const clusters = readArray<SeoCluster>(rawOverview?.clusters);
  const competitors = readArray<SeoCompetitor>(rawOverview?.competitors);

  const effectiveSelectedSiteId =
    selectedSiteId && sites.some((site) => site.id === selectedSiteId)
      ? selectedSiteId
      : sites[0]?.id ?? null;

  const selectedSite = sites.find((site) => site.id === effectiveSelectedSiteId) ?? null;
  const sitePages = pages.filter((page) => page.siteId === effectiveSelectedSiteId);
  const siteClusters = clusters.filter(
    (cluster) => cluster.siteId === effectiveSelectedSiteId,
  );
  const siteCompetitors = competitors.filter(
    (competitor) => competitor.siteId === effectiveSelectedSiteId,
  );

  const pageTypeOptions = Array.from(
    new Set(sitePages.map((page) => page.pageType).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const intentOptions = Array.from(
    new Set(siteClusters.map((cluster) => cluster.primaryIntent).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const hasCompetitorFiltersApplied = deferredCompetitorSearch.trim().length > 0;

  const filteredPages = sitePages.filter((page) => {
    const matchesSearch =
      deferredPageSearch.trim().length === 0 ||
      [
        page.displayTitle,
        page.url,
        page.pageType,
        page.siteName,
        page.clusterNames.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(deferredPageSearch.trim().toLowerCase());
    const matchesType =
      selectedPageType === "all" || page.pageType === selectedPageType;

    return matchesSearch && matchesType;
  });

  const filteredClusters = siteClusters.filter((cluster) => {
    const matchesSearch =
      deferredClusterSearch.trim().length === 0 ||
      [
        cluster.name,
        cluster.primaryIntent,
        cluster.primaryKeyword ?? "",
        cluster.keywords.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(deferredClusterSearch.trim().toLowerCase());
    const matchesIntent =
      selectedIntent === "all" || cluster.primaryIntent === selectedIntent;

    return matchesSearch && matchesIntent;
  });

  const filteredCompetitors = siteCompetitors.filter((competitor) =>
    matchesCompetitorFilters(competitor, deferredCompetitorSearch),
  );

  const activePage = sitePages.find((page) => page.id === selectedPageId) ?? null;
  const activeCluster =
    filteredClusters.find((cluster) => cluster.id === selectedClusterId) ??
    filteredClusters[0] ??
    null;
  const activeCompetitor =
    filteredCompetitors.find((competitor) => competitor.id === selectedCompetitorId) ?? null;

  const competitorLatestKeywordCount = siteCompetitors.reduce(
    (sum, competitor) => sum + competitor.latestKeywordCount,
    0,
  );

  const totalIssueCount = useMemo(
    () => sitePages.reduce((sum, page) => sum + getPageAuditSummary(page).issueCount, 0),
    [sitePages],
  );

  return (
    <div className="flex flex-col h-full p-12">
      {/* Page header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-5xl font-normal text-foreground">
            SEO
          </h1>
          {sites.length > 0 ? (
            <Select
              value={effectiveSelectedSiteId?.toString()}
              onValueChange={(value) => setSelectedSiteId(Number(value))}
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-sm font-medium">
                <SelectValue placeholder="Choose a site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.name} · {site.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : overviewQuery.isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : null}
        </div>
      </div>

      {/* Tabs + summary stats */}
      <div className="flex items-end justify-between border-b mb-6">
        <div className="flex items-center gap-0">
          <SeoTabButton
            active={activeTab === "overview"}
            label="Pages"
            description={selectedSite ? `${formatNumber(sitePages.length)} tracked` : ""}
            onClick={() => setActiveTab("overview")}
          />
          <SeoTabButton
            active={activeTab === "competitors"}
            label="Competitors"
            description={`${formatNumber(siteCompetitors.length)} tracked`}
            onClick={() => setActiveTab("competitors")}
          />
          <SeoTabButton
            active={activeTab === "keywords"}
            label="Keywords"
            description=""
            onClick={() => setActiveTab("keywords")}
          />
          <SeoTabButton
            active={activeTab === "geo"}
            label="GEO"
            description=""
            onClick={() => setActiveTab("geo")}
          />
          <SeoTabButton
            active={activeTab === "backlinks"}
            label="Backlinks"
            description=""
            onClick={() => setActiveTab("backlinks")}
          />
          <SeoTabButton
            active={activeTab === "analytics"}
            label="Analytics"
            description=""
            onClick={() => setActiveTab("analytics")}
          />
        </div>

        {selectedSite && !overviewQuery.isLoading && activeTab !== "analytics" && activeTab !== "backlinks" && activeTab !== "keywords" && activeTab !== "geo" && (
          <div className="flex items-center gap-8 pb-2.5">
            {activeTab === "overview" ? (
              <>
                <SummaryCard label="Pages" value={selectedSite.pageCount} />
                <SummaryCard label="Issues" value={totalIssueCount} />
                <SummaryCard label="Clusters" value={selectedSite.clusterCount} />
                <SummaryCard label="Keywords" value={selectedSite.keywordCount} />
              </>
            ) : (
              <>
                <SummaryCard label="Competitors" value={siteCompetitors.length} />
                <SummaryCard label="Ranked keywords" value={competitorLatestKeywordCount} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {overviewQuery.isError ? (
        <EmptyState
          icon={Search}
          title="We couldn't load the SEO overview"
          description={overviewQuery.error.message}
        />
      ) : overviewQuery.isLoading ? (
        <SeoLoadingState />
      ) : sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No SEO sites available yet"
          description="Once pages and keyword clusters are stored in the workspace database, this tab will populate automatically."
        />
      ) : activeTab === "keywords" ? (
        effectiveSelectedSiteId ? (
          <KeywordsTab siteId={effectiveSelectedSiteId} />
        ) : null
      ) : activeTab === "geo" ? (
        effectiveSelectedSiteId ? (
          <GeoTab siteId={effectiveSelectedSiteId} />
        ) : null
      ) : activeTab === "backlinks" ? (
        effectiveSelectedSiteId ? (
          <BacklinksTab siteId={effectiveSelectedSiteId} />
        ) : null
      ) : activeTab === "analytics" ? (
        effectiveSelectedSiteId ? (
          <AnalyticsTab siteId={effectiveSelectedSiteId} />
        ) : null
      ) : activeTab === "overview" ? (
        <OverviewTab
          selectedSite={selectedSite}
          filteredPages={filteredPages}
          filteredClusters={filteredClusters}
          selectedPageType={selectedPageType}
          onPageTypeChange={setSelectedPageType}
          pageTypeOptions={pageTypeOptions}
          pageSearch={pageSearch}
          onPageSearchChange={setPageSearch}
          selectedPageId={selectedPageId}
          onSelectPage={setSelectedPageId}
          activeCluster={activeCluster}
          selectedIntent={selectedIntent}
          onIntentChange={setSelectedIntent}
          intentOptions={intentOptions}
          clusterSearch={clusterSearch}
          onClusterSearchChange={setClusterSearch}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
        />
      ) : (
        <CompetitorsTab
          siteName={selectedSite?.name ?? "Selected site"}
          selectedSite={selectedSite}
          competitors={filteredCompetitors}
          trendCompetitors={siteCompetitors}
          competitorSearch={competitorSearch}
          onCompetitorSearchChange={(value) => {
            setCompetitorSearch(value);

            const selectedCompetitor = siteCompetitors.find(
              (competitor) => competitor.id === selectedCompetitorId,
            );

            if (
              selectedCompetitor &&
              !matchesCompetitorFilters(selectedCompetitor, value)
            ) {
              setSelectedCompetitorId(null);
            }
          }}
          totalCompetitorCount={siteCompetitors.length}
          hasActiveFilters={hasCompetitorFiltersApplied}
          onClearFilters={() => {
            setCompetitorSearch("");
            setSelectedCompetitorId(null);
          }}
          activeCompetitor={activeCompetitor}
          onSelectCompetitor={setSelectedCompetitorId}
        />
      )}

      {/* Page detail sheet */}
      <Sheet
        open={selectedPageId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPageId(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton
          className="w-full sm:max-w-[720px] p-0 flex flex-col overflow-hidden gap-0"
        >
          <SheetDescription className="sr-only">
            View page SEO details
          </SheetDescription>

          {/* Header */}
          <div className="px-6 pt-14 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                <FileText className="size-3 mr-1" />
                Page
              </Badge>
              {selectedSite && (
                <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                  {selectedSite.name}
                </Badge>
              )}
            </div>
            <SheetTitle className="font-display text-4xl font-normal">
              {activePage?.displayTitle ?? "Page details"}
            </SheetTitle>
            {activePage && (
              <p className="text-sm text-muted-foreground mt-1 break-all">
                {activePage.url}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {activePage ? (
              <PageDetailCard page={activePage} />
            ) : (
              <p className="text-sm text-muted-foreground/40 text-center py-12">
                Choose a page from the overview to inspect it here.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function matchesCompetitorFilters(
  competitor: SeoCompetitor,
  search: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch =
    normalizedSearch.length === 0 ||
    [
      competitor.label,
      competitor.competitorDomain,
      competitor.competitorType,
      competitor.notes ?? "",
      competitor.topKeywords.map((keyword) => keyword.keyword).join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  return matchesSearch;
}
