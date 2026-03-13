import { ArrowUpDown, Building2, Link2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SeoCompetitor, SeoSite } from "./types";
import { CompetitorTrends } from "./competitor-trends";
import { InfoTile, InlineEmptyState } from "./shared";
import {
  formatDate,
  formatNumber,
  formatOptionalDecimal,
  formatOptionalNumber,
  toTitleCase,
} from "./utils";

const competitorColumns: ColumnDef<SeoCompetitor>[] = [
  {
    id: "label",
    accessorFn: (competitor) => competitor.label.toLowerCase(),
    header: ({ column }) => (
      <SortHeader
        label="Competitor"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => {
      const competitor = row.original;

      return (
        <div className="flex min-w-[240px] items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-semibold text-foreground">{competitor.label}</div>
              <a
                href={`https://${competitor.competitorDomain}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${competitor.competitorDomain}`}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                onClick={(event) => event.stopPropagation()}
              >
                <Link2 className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "organicTraffic",
    accessorFn: (competitor) => competitor.latestFootprint?.estimatedOrganicTraffic ?? -1,
    header: ({ column }) => (
      <SortHeader
        label="Organic traffic"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-sm">
        {formatOptionalNumber(row.original.latestFootprint?.estimatedOrganicTraffic)}
      </div>
    ),
  },
  {
    id: "rankedKeywords",
    accessorFn: (competitor) => competitor.latestFootprint?.rankedKeywordsCount ?? -1,
    header: ({ column }) => (
      <SortHeader
        label="Ranked keywords"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-sm">
        {formatOptionalNumber(row.original.latestFootprint?.rankedKeywordsCount)}
      </div>
    ),
  },
];

export function CompetitorsTab({
  siteName,
  selectedSite,
  competitors,
  trendCompetitors,
  competitorSearch,
  onCompetitorSearchChange,
  totalCompetitorCount,
  hasActiveFilters,
  onClearFilters,
  activeCompetitor,
  onSelectCompetitor,
}: {
  siteName: string;
  selectedSite: SeoSite | null;
  competitors: SeoCompetitor[];
  trendCompetitors: SeoCompetitor[];
  competitorSearch: string;
  onCompetitorSearchChange: (value: string) => void;
  totalCompetitorCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  activeCompetitor: SeoCompetitor | null;
  onSelectCompetitor: (value: number | null) => void;
}) {
  return (
    <div className="space-y-6">
      <CompetitorTrends competitors={trendCompetitors} site={selectedSite} />

      <Card className="flex min-h-[760px] flex-col border-border/70 bg-card/95">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Competitor set</CardTitle>
              <CardDescription className="mt-1">
                Domains tied to {siteName}, with their latest footprint captures.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {formatNumber(competitors.length)} shown
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            <Input
              value={competitorSearch}
              onChange={(event) => onCompetitorSearchChange(event.target.value)}
              placeholder="Search by competitor, domain, type, or keyword"
              className="h-10 bg-background/75"
            />
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <DataTable
            columns={competitorColumns}
            data={competitors}
            initialSorting={[{ id: "label", desc: false }]}
            onRowClick={(row) => onSelectCompetitor(row.original.id)}
            getRowClassName={(row) =>
              cn(activeCompetitor?.id === row.original.id && "bg-primary/5")
            }
            tableClassName="min-w-[720px]"
            emptyState={
              <div className="flex min-h-[520px] flex-col justify-center px-6 py-16">
                <InlineEmptyState
                  title={
                    hasActiveFilters && totalCompetitorCount > 0
                      ? "Competitors are hidden by the current filters"
                      : "No competitors match these filters"
                  }
                  description={
                    hasActiveFilters && totalCompetitorCount > 0
                      ? `${formatNumber(totalCompetitorCount)} competitors are tracked for this site, but none match the current search or type filter.`
                      : "Add competitor records or clear the filters to inspect the full tracked set."
                  }
                />
                {hasActiveFilters && totalCompetitorCount > 0 ? (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>
            }
          />
        </CardContent>
      </Card>

      <Sheet
        open={activeCompetitor !== null}
        onOpenChange={(open) => {
          if (!open) {
            onSelectCompetitor(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(98vw,84rem)] max-w-none sm:max-w-[84rem] overflow-y-auto border-l border-border/70 bg-background/98 p-0 backdrop-blur-xl"
        >
          <SheetHeader className="border-b border-border/70 bg-muted/20 px-8 py-6 text-left">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full px-3 py-1">
                <Building2 className="size-3.5" />
                Competitor focus
              </Badge>
              {activeCompetitor ? (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {selectedSite?.name}
                </Badge>
              ) : null}
            </div>
            <SheetTitle className="text-2xl">
              {activeCompetitor?.label ?? "Competitor details"}
            </SheetTitle>
            <SheetDescription className="max-w-2xl">
              {activeCompetitor
                ? "Latest footprint and summary metrics for the selected competitor."
                : "Choose a competitor from the table to inspect it here."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-8">
            {activeCompetitor ? (
              <CompetitorDetailCard competitor={activeCompetitor} />
            ) : (
              <InlineEmptyState
                title="Choose a competitor"
                description="Select a competitor from the table to inspect its latest footprint and summary details."
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SortHeader({
  label,
  isSorted,
  onClick,
}: {
  label: string;
  isSorted: false | "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown
        className={cn("size-3.5 opacity-45", isSorted && "opacity-100 text-foreground")}
      />
    </Button>
  );
}

function CompetitorDetailCard({
  competitor,
}: {
  competitor: SeoCompetitor;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">{competitor.label}</div>
          <div className="mt-1 break-all text-sm text-muted-foreground">
            {competitor.competitorDomain}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {toTitleCase(competitor.competitorType)}
          </Badge>
          <Badge
            variant={competitor.isActive ? "default" : "secondary"}
            className="rounded-full px-3 py-1"
          >
            {competitor.isActive ? "Active competitor" : "Inactive competitor"}
          </Badge>
          {competitor.latestFootprint ? (
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {competitor.latestFootprint.location} · {competitor.latestFootprint.languageCode}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="Organic traffic"
          value={formatOptionalNumber(competitor.latestFootprint?.estimatedOrganicTraffic)}
        />
        <InfoTile
          label="Ranked keywords"
          value={formatOptionalNumber(competitor.latestFootprint?.rankedKeywordsCount)}
        />
        <InfoTile
          label="Visibility"
          value={formatOptionalDecimal(competitor.latestFootprint?.visibilityScore)}
        />
        <InfoTile
          label="Latest capture"
          value={formatDate(
            competitor.latestFootprint?.capturedAt ?? competitor.latestKeywordCapturedAt,
          )}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="Paid traffic"
          value={formatOptionalNumber(competitor.latestFootprint?.estimatedPaidTraffic)}
        />
        <InfoTile
          label="Top 3 keywords"
          value={formatOptionalNumber(competitor.latestFootprint?.top3KeywordsCount)}
        />
        <InfoTile
          label="Top 10 keywords"
          value={formatOptionalNumber(competitor.latestFootprint?.top10KeywordsCount)}
        />
        <InfoTile
          label="Total snapshots"
          value={formatNumber(competitor.footprintSnapshotCount)}
        />
      </div>

      <div className="rounded-[1.8rem] border border-border/60 bg-background/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Latest ranked keyword capture</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {competitor.latestKeywordCapturedAt
                ? `${formatNumber(competitor.latestKeywordCount)} keyword${competitor.latestKeywordCount !== 1 ? "s" : ""} from ${formatDate(competitor.latestKeywordCapturedAt)}`
                : "No keyword capture stored yet."}
            </div>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {formatNumber(competitor.keywordRowCount)} total rows
          </Badge>
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-border/60 bg-background/70 p-5">
        <div className="text-sm font-semibold text-foreground">Notes</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {competitor.notes?.trim() || "No notes saved for this competitor yet."}
        </div>
      </div>
    </div>
  );
}
