import { ArrowUpDown, Building2, Link2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
        <div className="flex min-w-[240px] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm truncate">{competitor.label}</span>
              <a
                href={`https://${competitor.competitorDomain}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${competitor.competitorDomain}`}
                className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
                onClick={(event) => event.stopPropagation()}
              >
                <Link2 className="size-3" />
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
      <span className="text-sm text-muted-foreground">
        {formatOptionalNumber(row.original.latestFootprint?.estimatedOrganicTraffic)}
      </span>
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
      <span className="text-sm text-muted-foreground">
        {formatOptionalNumber(row.original.latestFootprint?.rankedKeywordsCount)}
      </span>
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
    <div className="space-y-8">
      <CompetitorTrends competitors={trendCompetitors} site={selectedSite} />

      {/* Competitor table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Competitor set</h2>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Domains tied to {siteName}
            </p>
          </div>
          <span className="text-xs text-muted-foreground/60">
            {formatNumber(competitors.length)} shown
          </span>
        </div>

        <div className="mb-3">
          <input
            value={competitorSearch}
            onChange={(event) => onCompetitorSearchChange(event.target.value)}
            placeholder="Search by competitor, domain, type, or keyword..."
            className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
          />
        </div>

        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <DataTable
            columns={competitorColumns}
            data={competitors}
            initialSorting={[{ id: "label", desc: false }]}
            onRowClick={(row) => onSelectCompetitor(row.original.id)}
            getRowClassName={(row) =>
              cn(activeCompetitor?.id === row.original.id && "bg-muted/40")
            }
            tableClassName="min-w-[720px]"
            emptyState={
              <div className="py-12 px-6">
                <InlineEmptyState
                  title={
                    hasActiveFilters && totalCompetitorCount > 0
                      ? "Competitors hidden by filters"
                      : "No competitors match"
                  }
                  description={
                    hasActiveFilters && totalCompetitorCount > 0
                      ? `${formatNumber(totalCompetitorCount)} competitors are tracked but none match the current search.`
                      : "Add competitor records or clear the filters."
                  }
                />
                {hasActiveFilters && totalCompetitorCount > 0 && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="ghost" size="sm" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </section>

      {/* Competitor detail sheet */}
      <Sheet
        open={activeCompetitor !== null}
        onOpenChange={(open) => {
          if (!open) onSelectCompetitor(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton
          className="w-full sm:max-w-[720px] p-0 flex flex-col overflow-hidden gap-0"
        >
          <SheetDescription className="sr-only">
            View competitor details
          </SheetDescription>

          {/* Header */}
          <div className="px-6 pt-14 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                <Building2 className="size-3 mr-1" />
                Competitor
              </Badge>
              {selectedSite && (
                <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                  {selectedSite.name}
                </Badge>
              )}
            </div>
            <SheetTitle className="font-display text-4xl font-normal">
              {activeCompetitor?.label ?? "Competitor details"}
            </SheetTitle>
            {activeCompetitor && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeCompetitor.competitorDomain}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {activeCompetitor ? (
              <CompetitorDetailCard competitor={activeCompetitor} />
            ) : (
              <p className="text-sm text-muted-foreground/40 text-center py-12">
                Select a competitor from the table to inspect.
              </p>
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
      className="-ml-3 h-8 px-3 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown
        className={cn("size-3 opacity-45", isSorted && "opacity-100 text-foreground")}
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
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[11px] px-2 py-0.5">
          {toTitleCase(competitor.competitorType)}
        </Badge>
        <Badge
          variant={competitor.isActive ? "default" : "secondary"}
          className="text-[11px] px-2 py-0.5"
        >
          {competitor.isActive ? "Active" : "Inactive"}
        </Badge>
        {competitor.latestFootprint && (
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {competitor.latestFootprint.location} · {competitor.latestFootprint.languageCode}
          </Badge>
        )}
      </div>

      {/* Properties */}
      <div className="space-y-0">
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

      {/* Latest keyword capture */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-1 text-muted-foreground">Latest keyword capture</h4>
        <p className="text-sm">
          {competitor.latestKeywordCapturedAt
            ? `${formatNumber(competitor.latestKeywordCount)} keyword${competitor.latestKeywordCount !== 1 ? "s" : ""} from ${formatDate(competitor.latestKeywordCapturedAt)}`
            : "No keyword capture stored yet"}
        </p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          {formatNumber(competitor.keywordRowCount)} total rows
        </p>
      </div>

      {/* Notes */}
      <div className="border-t border-border/50 pt-4">
        <h4 className="text-sm font-normal mb-1 text-muted-foreground">Notes</h4>
        <p className="text-sm leading-relaxed">
          {competitor.notes?.trim() || (
            <span className="text-muted-foreground/40">No notes saved yet</span>
          )}
        </p>
      </div>
    </div>
  );
}
