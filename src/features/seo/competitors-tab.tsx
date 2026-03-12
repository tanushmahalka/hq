import { Building2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SeoCompetitor } from "./types";
import { FilterChip, InfoTile, InlineEmptyState } from "./shared";
import {
  formatDate,
  formatNumber,
  formatOptionalDecimal,
  formatOptionalNumber,
  toTitleCase,
} from "./utils";

export function CompetitorsTab({
  siteName,
  competitors,
  competitorSearch,
  onCompetitorSearchChange,
  selectedCompetitorType,
  onCompetitorTypeChange,
  competitorTypeOptions,
  activeCompetitor,
  onSelectCompetitor,
}: {
  siteName: string;
  competitors: SeoCompetitor[];
  competitorSearch: string;
  onCompetitorSearchChange: (value: string) => void;
  selectedCompetitorType: string;
  onCompetitorTypeChange: (value: string) => void;
  competitorTypeOptions: string[];
  activeCompetitor: SeoCompetitor | null;
  onSelectCompetitor: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
      <Card className="border-border/70 bg-card/95">
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
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={selectedCompetitorType === "all"}
                onClick={() => onCompetitorTypeChange("all")}
                label="All types"
              />
              {competitorTypeOptions.map((competitorType) => (
                <FilterChip
                  key={competitorType}
                  active={selectedCompetitorType === competitorType}
                  onClick={() => onCompetitorTypeChange(competitorType)}
                  label={toTitleCase(competitorType)}
                />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {competitors.length === 0 ? (
            <InlineEmptyState
              title="No competitors match these filters"
              description="Add competitor records or clear the filters to inspect the full tracked set."
            />
          ) : (
            <div className="max-h-[860px] overflow-y-auto">
              {competitors.map((competitor, index) => (
                <button
                  key={competitor.id}
                  type="button"
                  onClick={() => onSelectCompetitor(competitor.id)}
                  className={cn(
                    "flex w-full items-start gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/20",
                    index !== competitors.length - 1 && "border-b border-border/50",
                    activeCompetitor?.id === competitor.id && "bg-primary/5",
                  )}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-semibold text-foreground">
                        {competitor.label}
                      </div>
                      <Badge
                        variant={competitor.isActive ? "default" : "secondary"}
                        className="rounded-full px-2.5 py-0.5"
                      >
                        {competitor.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">
                      {competitor.competitorDomain}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {toTitleCase(competitor.competitorType)}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {formatNumber(competitor.latestKeywordCount)} latest keywords
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {formatNumber(competitor.footprintSnapshotCount)} snapshots
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground/55" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <CardTitle className="text-xl">Competitor detail</CardTitle>
          <CardDescription className="mt-1">
            Latest domain footprint plus the strongest keywords from the most recent capture.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {activeCompetitor ? (
            <CompetitorDetailCard competitor={activeCompetitor} />
          ) : (
            <InlineEmptyState
              title="Choose a competitor"
              description="Select a competitor on the left to inspect its latest footprint and ranked keywords."
            />
          )}
        </CardContent>
      </Card>
    </div>
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

        {competitor.topKeywords.length > 0 ? (
          <div className="mt-5 space-y-3">
            {competitor.topKeywords.map((keyword) => (
              <div
                key={`${keyword.keyword}-${keyword.rankingUrl}-${keyword.rank}`}
                className="rounded-2xl border border-border/60 bg-card/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {keyword.keyword}
                    </div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">
                      {keyword.rankingUrl}
                    </div>
                  </div>
                  <Badge className="rounded-full px-3 py-1">#{keyword.rank}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Vol {formatNumber(keyword.searchVolume)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {keyword.location} · {keyword.languageCode}
                  </Badge>
                  {keyword.searchIntent ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {toTitleCase(keyword.searchIntent)}
                    </Badge>
                  ) : null}
                  {keyword.estimatedTraffic ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      Est. traffic {formatOptionalDecimal(keyword.estimatedTraffic)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 text-sm text-muted-foreground">
            No ranked keyword rows are stored for this competitor yet.
          </div>
        )}
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
