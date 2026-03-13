import { useDeferredValue, useState } from "react";
import {
  BarChart3,
  Building2,
  FileText,
  Globe,
  Layers3,
  Search,
  Target,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitorsTab } from "@/features/seo/competitors-tab";
import { OverviewTab, PageDetailCard } from "@/features/seo/overview-tab";
import {
  EmptyState,
  InlineEmptyState,
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
  const summary =
    rawOverview?.summary && typeof rawOverview.summary === "object"
      ? rawOverview.summary
      : null;

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
  const siteCount =
    summary && "siteCount" in summary && typeof summary.siteCount === "number"
      ? summary.siteCount
      : sites.length;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,var(--swarm-violet-dim),transparent_28%),radial-gradient(circle_at_top_right,var(--swarm-mint-dim),transparent_24%),linear-gradient(180deg,var(--color-background)_0%,color-mix(in_oklab,var(--color-background)_96%,var(--swarm-blue-dim))_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-8 lg:p-10">
        <Card className="relative overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <div
            className="pointer-events-none absolute -left-20 top-0 size-72 rounded-full blur-3xl"
            style={{ background: "var(--swarm-violet-dim)" }}
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 size-72 rounded-full blur-3xl"
            style={{ background: "var(--swarm-mint-dim)" }}
          />
          <CardHeader className="relative gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">SEO Workspace</CardTitle>
                <CardDescription className="text-sm">
                  {siteCount
                    ? `${formatNumber(siteCount)} site${siteCount !== 1 ? "s" : ""} available`
                    : "Loading site summary"}
                </CardDescription>
              </div>
              {sites.length ? (
                <div className="w-full max-w-[320px]">
                  <Select
                    value={effectiveSelectedSiteId?.toString()}
                    onValueChange={(value) => setSelectedSiteId(Number(value))}
                  >
                    <SelectTrigger className="h-11 w-full rounded-full bg-background/80 px-4">
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
                </div>
              ) : (
                <Skeleton className="h-11 w-full max-w-[320px] rounded-full" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <SeoTabButton
                active={activeTab === "overview"}
                label="Overview"
                description="Pages and keyword clusters"
                onClick={() => setActiveTab("overview")}
              />
              <SeoTabButton
                active={activeTab === "competitors"}
                label="Competitors"
                description={`${formatNumber(siteCompetitors.length)} tracked for this site`}
                onClick={() => setActiveTab("competitors")}
              />
            </div>

            {overviewQuery.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full rounded-3xl" />
                ))}
              </div>
            ) : selectedSite ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {activeTab === "overview" ? (
                  <>
                    <SummaryCard
                      icon={FileText}
                      label="Pages"
                      value={selectedSite.pageCount}
                      hint="Tracked URLs in this site"
                    />
                    <SummaryCard
                      icon={Layers3}
                      label="Keyword clusters"
                      value={selectedSite.clusterCount}
                      hint="Topic groups to organize search demand"
                    />
                    <SummaryCard
                      icon={Search}
                      label="Keywords"
                      value={selectedSite.keywordCount}
                      hint="Search terms already grouped into clusters"
                    />
                    <SummaryCard
                      icon={Target}
                      label="Mapped pages"
                      value={selectedSite.mappedPageCount}
                      hint="Pages already connected to keyword themes"
                    />
                  </>
                ) : (
                  <>
                    <SummaryCard
                      icon={Building2}
                      label="Competitors"
                      value={siteCompetitors.length}
                      hint="Tracked domains for this site"
                    />
                    <SummaryCard
                      icon={BarChart3}
                      label="Latest ranked keywords"
                      value={competitorLatestKeywordCount}
                      hint="Keywords in each competitor's most recent capture"
                    />
                  </>
                )}
              </div>
            ) : null}
          </CardHeader>
        </Card>

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
            title="No SEO sites are available yet"
            description="Once pages and keyword clusters are stored in the main workspace database, this tab will start populating automatically."
          />
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
      </div>

      <Sheet
        open={selectedPageId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPageId(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(94vw,64rem)] max-w-none overflow-y-auto border-l border-border/70 bg-background/98 p-0 backdrop-blur-xl"
        >
          <SheetHeader className="border-b border-border/70 bg-muted/20 px-8 py-6 text-left">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full px-3 py-1">
                <FileText className="size-3.5" />
                Page focus
              </Badge>
              {activePage ? (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {selectedSite?.name}
                </Badge>
              ) : null}
            </div>
            <SheetTitle className="text-2xl">
              {activePage?.displayTitle ?? "Page details"}
            </SheetTitle>
            <SheetDescription className="max-w-2xl">
              {activePage
                ? "A larger, presentation-ready view of the selected page and its SEO context."
                : "Choose a page from the overview list to inspect it here."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-8">
            {activePage ? (
              <PageDetailCard page={activePage} />
            ) : (
              <InlineEmptyState
                title="Choose a page"
                description="Pick a page from the overview tab to inspect its details here."
              />
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
