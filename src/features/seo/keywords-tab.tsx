import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChip, InlineEmptyState, SummaryCard } from "./shared";
import { formatNumber, toTitleCase } from "./utils";
import type { KeywordRow, KeywordsData } from "./types";

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

const PAGE_SIZE = 50;

type SourceFilter = "all" | "ours" | "shared" | "competitor_only";

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
        className={cn(
          "size-3 opacity-45",
          isSorted && "opacity-100 text-foreground",
        )}
      />
    </Button>
  );
}

function ScorePill({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/40">--</span>;
  const num = Number(value);
  if (Number.isNaN(num)) return <span className="text-muted-foreground/40">--</span>;
  const pct = num / 100;
  const color =
    pct > 0.7
      ? "text-red-500"
      : pct > 0.4
        ? "text-amber-500"
        : "text-emerald-500";
  return <span className={cn("tabular-nums text-sm", color)}>{num.toFixed(0)}</span>;
}

const INTENT_COLORS: Record<string, string> = {
  informational: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200",
  commercial: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
  transactional: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  navigational: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200",
};

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-muted-foreground/40">--</span>;
  const color = INTENT_COLORS[intent.toLowerCase()] ?? "border-border/50 bg-muted/50 text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", color)}>
      {toTitleCase(intent)}
    </span>
  );
}

function SourceBadge({ row }: { row: KeywordRow }) {
  if (row.isOurs && row.competitorCount > 0) {
    return <span className="text-[11px] text-amber-600 dark:text-amber-400">Shared</span>;
  }
  if (row.isOurs) {
    return <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Ours</span>;
  }
  return <span className="text-[11px] text-muted-foreground">Competitor</span>;
}

/* ---------------------------------------------------------------------------
 * Columns
 * --------------------------------------------------------------------------- */

const columns: Array<ColumnDef<KeywordRow, unknown>> = [
  {
    accessorKey: "keyword",
    header: ({ column }) => (
      <SortHeader
        label="Keyword"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <span className="text-sm truncate max-w-[280px] block" title={row.original.keyword}>
        {row.original.keyword}
      </span>
    ),
  },
  {
    accessorKey: "searchVolume",
    header: ({ column }) => (
      <SortHeader
        label="Volume"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-right block">
        {row.original.searchVolume != null ? formatNumber(row.original.searchVolume) : "--"}
      </span>
    ),
    meta: { className: "text-right" },
  },
  {
    accessorKey: "keywordDifficulty",
    header: ({ column }) => (
      <SortHeader
        label="KD"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => <ScorePill value={row.original.keywordDifficulty} />,
    meta: { className: "text-right" },
  },
  {
    accessorKey: "searchIntent",
    header: "Intent",
    cell: ({ row }) => <IntentBadge intent={row.original.searchIntent} />,
    enableSorting: false,
  },
  {
    accessorKey: "ourPosition",
    header: ({ column }) => (
      <SortHeader
        label="Our Position"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {row.original.ourPosition != null ? row.original.ourPosition.toFixed(1) : "--"}
      </span>
    ),
  },
  {
    accessorKey: "bestCompetitorRank",
    header: ({ column }) => (
      <SortHeader
        label="Best Competitor"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => {
      const { bestCompetitorRank, bestCompetitorLabel } = row.original;
      if (bestCompetitorRank == null) return <span className="text-muted-foreground/40">--</span>;
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm truncate max-w-[140px]" title={bestCompetitorLabel ?? undefined}>
            {bestCompetitorLabel ?? "Unknown"}
          </span>
          <span className="shrink-0 inline-flex items-center rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {bestCompetitorRank}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "competitorCount",
    header: ({ column }) => (
      <SortHeader
        label="Competitors"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.competitorCount}
      </span>
    ),
  },
  {
    id: "source",
    header: "Source",
    cell: ({ row }) => <SourceBadge row={row.original} />,
    enableSorting: false,
  },
];

/* ---------------------------------------------------------------------------
 * KeywordsTab
 * --------------------------------------------------------------------------- */

export function KeywordsTab({ siteId }: { siteId: number }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "searchVolume", desc: true }]);
  const [intentFilter, setIntentFilter] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const deferredSearch = useDeferredValue(search);
  const activeSort = sorting[0] ?? { id: "searchVolume", desc: true };

  const queryInput = useMemo(
    () => ({
      siteId,
      page,
      pageSize: PAGE_SIZE,
      search: deferredSearch || undefined,
      sortBy: activeSort.id as "keyword" | "searchVolume" | "keywordDifficulty" | "ourPosition" | "bestCompetitorRank" | "competitorCount",
      sortDirection: activeSort.desc ? ("desc" as const) : ("asc" as const),
      intentFilter,
      sourceFilter,
    }),
    [siteId, page, deferredSearch, activeSort.id, activeSort.desc, intentFilter, sourceFilter],
  );

  const query = trpc.seo.keywords.useQuery(queryInput, {
    enabled: siteId > 0,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const data = query.data as KeywordsData | undefined;

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [deferredSearch, intentFilter, sourceFilter]);
  useEffect(() => { setPage(1); setSearch(""); setIntentFilter(undefined); setSourceFilter("all"); }, [siteId]);

  const handleSortingChange = (next: SortingState) => {
    setSorting(next);
    setPage(1);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto pb-4">
      {/* Summary strip */}
      {query.isLoading ? (
        <div className="flex items-center gap-8 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
      ) : data?.summary ? (
        <div className="flex items-center gap-8 mb-4">
          <SummaryCard label="Total keywords" value={data.summary.totalKeywords} />
          <SummaryCard label="Our keywords" value={data.summary.ourKeywords} />
          <SummaryCard label="Shared" value={data.summary.sharedKeywords} />
          <SummaryCard label="Competitor only" value={data.summary.competitorOnlyKeywords} />
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords…"
            className="w-full rounded-md border border-border/50 bg-transparent pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
          />
        </div>

        {/* Intent filter chips */}
        <div className="flex items-center gap-1.5">
          {["informational", "commercial", "transactional", "navigational"].map((intent) => (
            <FilterChip
              key={intent}
              active={intentFilter === intent}
              label={toTitleCase(intent)}
              onClick={() => setIntentFilter(intentFilter === intent ? undefined : intent)}
            />
          ))}
        </div>

        {/* Source filter chips */}
        <div className="flex items-center gap-1.5 ml-2 border-l border-border/50 pl-3">
          {(
            [
              { key: "all", label: "All" },
              { key: "ours", label: "Ours" },
              { key: "shared", label: "Shared" },
              { key: "competitor_only", label: "Competitor" },
            ] as const
          ).map((sf) => (
            <FilterChip
              key={sf.key}
              active={sourceFilter === sf.key}
              label={sf.label}
              onClick={() => setSourceFilter(sf.key)}
            />
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <InlineEmptyState
          title="No keywords found"
          description="Try adjusting your search or filters, or make sure competitor keyword data has been captured."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data.rows}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            manualSorting
          />

          {/* Pagination */}
          {data.pageInfo.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-2">
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {formatNumber((page - 1) * PAGE_SIZE + 1)}–
                {formatNumber(Math.min(page * PAGE_SIZE, data.pageInfo.total))} of{" "}
                {formatNumber(data.pageInfo.total)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!data.pageInfo.hasPreviousPage}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!data.pageInfo.hasNextPage}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
