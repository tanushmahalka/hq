import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ExternalLink,
  Link2,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChip, InlineEmptyState, SummaryCard } from "./shared";
import {
  formatDate,
  formatNumber,
  formatOptionalDecimal,
  toTitleCase,
} from "./utils";
import type {
  BacklinkSource,
  BacklinksSubview,
  CompetitorBacklink,
  LinkOpportunity,
} from "./types";

/* ---------------------------------------------------------------------------
 * Status helpers
 * --------------------------------------------------------------------------- */

const STATUS_DOT: Record<string, string> = {
  live: "bg-emerald-400",
  lost: "bg-red-400",
  unverified: "bg-amber-400",
  unknown: "bg-slate-300",
  new: "bg-sky-400",
  reviewed: "bg-violet-400",
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
  thread_open: "bg-amber-400",
  won: "bg-emerald-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "swarm-status-dot inline-block",
        STATUS_DOT[status] ?? "bg-slate-300",
      )}
    />
  );
}

function ScorePill({
  value,
  max = 100,
  variant = "default",
}: {
  value: string | null;
  max?: number;
  variant?: "default" | "risk";
}) {
  if (!value) return <span className="text-muted-foreground/40">--</span>;
  const num = Number(value);
  if (Number.isNaN(num)) return <span className="text-muted-foreground/40">--</span>;
  const pct = num / max;
  const color =
    variant === "risk"
      ? pct > 0.6
        ? "text-red-500"
        : pct > 0.3
          ? "text-amber-500"
          : "text-emerald-500"
      : pct > 0.7
        ? "text-emerald-500"
        : pct > 0.4
          ? "text-amber-500"
          : "text-muted-foreground/50";
  return <span className={cn("tabular-nums text-sm", color)}>{num.toFixed(0)}</span>;
}

/* ---------------------------------------------------------------------------
 * Sort header (reused)
 * --------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * BacklinksTab
 * --------------------------------------------------------------------------- */

export function BacklinksTab({ siteId }: { siteId: number }) {
  const [subview, setSubview] = useState<BacklinksSubview>("existing");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const deferredSearch = useDeferredValue(search);

  const query = trpc.seo.backlinks.useQuery(
    { siteId },
    { enabled: siteId > 0 },
  );

  const data = query.data;
  const summary = data?.summary;

  const subviewCounts = useMemo(
    () => ({
      existing: data?.existing.length ?? 0,
      competitors: data?.competitor.length ?? 0,
      opportunities: data?.opportunities.length ?? 0,
    }),
    [data],
  );

  // Reset selection when switching subviews
  const handleSubviewChange = (sv: BacklinksSubview) => {
    setSubview(sv);
    setSelectedId(null);
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Subtab bar */}
      <div className="flex items-center gap-0 border-b mb-4">
        {(
          [
            { key: "existing", label: "Existing", count: subviewCounts.existing },
            { key: "competitors", label: "Competitors", count: subviewCounts.competitors },
            { key: "opportunities", label: "Opportunities", count: subviewCounts.opportunities },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleSubviewChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px",
              subview === tab.key
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="text-[11px] text-muted-foreground font-normal">
              {query.isLoading ? "" : formatNumber(tab.count)}
            </span>
          </button>
        ))}
      </div>

      {/* Summary strip */}
      {query.isLoading ? (
        <div className="flex items-center gap-8 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
      ) : summary ? (
        <SummaryStrip subview={subview} summary={summary} />
      ) : null}

      {/* Loading */}
      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : !data ? (
        <InlineEmptyState
          title="Could not load backlink data"
          description="Try refreshing the page."
        />
      ) : (
        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left: table */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Search + filters */}
            <div className="mb-3 flex items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by domain, URL, anchor, or type..."
                className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 flex-1"
              />
              <StatusFilters
                subview={subview}
                active={statusFilter}
                onChange={setStatusFilter}
              />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex-1 min-h-0">
              {subview === "existing" ? (
                <ExistingTable
                  rows={data.existing}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : subview === "competitors" ? (
                <CompetitorTable
                  rows={data.competitor}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <OpportunityTable
                  rows={data.opportunities}
                  search={deferredSearch}
                  statusFilter={statusFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <DetailPanel
            subview={subview}
            selectedId={selectedId}
            data={data}
            siteId={siteId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Summary strip
 * --------------------------------------------------------------------------- */

function SummaryStrip({
  subview,
  summary,
}: {
  subview: BacklinksSubview;
  summary: NonNullable<ReturnType<typeof trpc.seo.backlinks.useQuery>["data"]>["summary"];
}) {
  return (
    <div className="flex items-center gap-8 mb-4">
      {subview === "existing" ? (
        <>
          <SummaryCard label="Referring domains" value={summary.referringDomains} />
          <SummaryCard label="Live backlinks" value={summary.liveBacklinks} />
          <SummaryCard label="Pages linked" value={summary.moneyPagesLinked} />
          <SummaryCard label="Avg authority" value={summary.avgAuthority} />
        </>
      ) : subview === "competitors" ? (
        <>
          <SummaryCard label="Competitors tracked" value={summary.competitorDomainsTracked} />
          <SummaryCard label="Backlinks tracked" value={summary.competitorBacklinksTracked} />
          <SummaryCard label="Link gap" value={summary.linkGapCount} />
        </>
      ) : (
        <>
          <SummaryCard label="New" value={summary.newOpportunities} />
          <SummaryCard label="High confidence" value={summary.highConfidenceOpportunities} />
          <SummaryCard label="Approved" value={summary.approvedForOutreach} />
          <SummaryCard label="Rejected" value={summary.rejectedOpportunities} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Status filters
 * --------------------------------------------------------------------------- */

function StatusFilters({
  subview,
  active,
  onChange,
}: {
  subview: BacklinksSubview;
  active: string;
  onChange: (status: string) => void;
}) {
  const statuses =
    subview === "existing"
      ? ["all", "live", "lost", "unverified"]
      : subview === "competitors"
        ? ["all", "live", "lost", "unknown"]
        : ["all", "new", "reviewed", "approved", "rejected"];

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {statuses.map((s) => (
        <FilterChip
          key={s}
          active={active === s}
          label={s === "all" ? "All" : toTitleCase(s)}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Search helper
 * --------------------------------------------------------------------------- */

function matchesSearch(search: string, ...fields: Array<string | null | undefined>): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

/* ---------------------------------------------------------------------------
 * Existing backlinks table
 * --------------------------------------------------------------------------- */

const existingColumns: ColumnDef<BacklinkSource>[] = [
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[200px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceUrl || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetPage",
    accessorFn: (r) => r.targetPageTitle ?? r.targetUrl,
    header: "Target page",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[180px]">
        {row.original.targetPageTitle || row.original.targetUrl}
      </p>
    ),
  },
  {
    id: "anchor",
    accessorKey: "anchorText",
    header: "Anchor",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[140px]">
        {row.original.anchorText || <span className="text-muted-foreground/30">--</span>}
      </p>
    ),
  },
  {
    id: "rel",
    accessorKey: "relAttr",
    header: "Rel",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{row.original.relAttr ?? "--"}</span>
    ),
  },
  {
    id: "authority",
    accessorFn: (r) => Number(r.authorityScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Authority" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.authorityScore} />,
  },
  {
    id: "lastSeen",
    accessorFn: (r) => r.lastSeenAt ?? "",
    header: ({ column }) => (
      <SortHeader label="Last seen" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{formatDate(row.original.lastSeenAt)}</span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <StatusDot status={row.original.status} />
        <span className="text-xs text-muted-foreground capitalize">{row.original.status}</span>
      </div>
    ),
  },
];

function ExistingTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: BacklinkSource[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(search, r.sourceDomain, r.sourceUrl, r.sourceTitle, r.targetUrl, r.anchorText);
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={existingColumns}
      data={filtered}
      initialSorting={[{ id: "lastSeen", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[800px]"
      emptyState={
        <InlineEmptyState
          title="No backlinks tracked yet"
          description="Once backlinks are imported or verified, they'll appear here."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Competitor backlinks table
 * --------------------------------------------------------------------------- */

const competitorBLColumns: ColumnDef<CompetitorBacklink>[] = [
  {
    id: "competitor",
    accessorFn: (r) => r.competitorLabel,
    header: ({ column }) => (
      <SortHeader label="Competitor" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-sm truncate">{row.original.competitorLabel}</span>
    ),
  },
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetUrl",
    accessorFn: (r) => r.targetUrl,
    header: "Target URL",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[180px]">{row.original.targetUrl}</p>
    ),
  },
  {
    id: "anchor",
    accessorKey: "anchorText",
    header: "Anchor",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[120px]">
        {row.original.anchorText || <span className="text-muted-foreground/30">--</span>}
      </p>
    ),
  },
  {
    id: "authority",
    accessorFn: (r) => Number(r.authorityScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Authority" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.authorityScore} />,
  },
  {
    id: "relevance",
    accessorFn: (r) => Number(r.relevanceScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Relevance" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.relevanceScore} />,
  },
  {
    id: "lastSeen",
    accessorFn: (r) => r.lastSeenAt ?? "",
    header: ({ column }) => (
      <SortHeader label="Last seen" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60">{formatDate(row.original.lastSeenAt)}</span>
    ),
  },
];

function CompetitorTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: CompetitorBacklink[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(search, r.competitorLabel, r.competitorDomain, r.sourceDomain, r.sourceUrl, r.sourceTitle, r.targetUrl, r.anchorText);
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={competitorBLColumns}
      data={filtered}
      initialSorting={[{ id: "authority", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[900px]"
      emptyState={
        <InlineEmptyState
          title="No competitor backlinks imported yet"
          description="They'll appear here after competitor backlink discovery runs."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Opportunities table
 * --------------------------------------------------------------------------- */

const opportunityColumns: ColumnDef<LinkOpportunity>[] = [
  {
    id: "source",
    accessorFn: (r) => r.sourceDomain,
    header: ({ column }) => (
      <SortHeader label="Source" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="text-sm truncate">{row.original.sourceTitle || row.original.sourceDomain}</p>
        <p className="text-xs text-muted-foreground/50 truncate">{row.original.sourceDomain}</p>
      </div>
    ),
  },
  {
    id: "targetPage",
    accessorFn: (r) => r.targetPageTitle ?? r.targetPageUrl ?? "",
    header: "Target page",
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground truncate max-w-[160px]">
        {row.original.targetPageTitle || row.original.targetPageUrl || "--"}
      </p>
    ),
  },
  {
    id: "type",
    accessorKey: "opportunityType",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{toTitleCase(row.original.opportunityType)}</span>
    ),
  },
  {
    id: "whyFit",
    accessorKey: "whyThisFits",
    header: "Why fit",
    cell: ({ row }) => (
      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.original.whyThisFits}</p>
    ),
  },
  {
    id: "confidence",
    accessorFn: (r) => Number(r.confidenceScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Confidence" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.confidenceScore} />,
  },
  {
    id: "risk",
    accessorFn: (r) => Number(r.riskScore ?? -1),
    header: ({ column }) => (
      <SortHeader label="Risk" isSorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => <ScorePill value={row.original.riskScore} variant="risk" />,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <StatusDot status={row.original.status} />
        <span className="text-xs text-muted-foreground capitalize">{row.original.status}</span>
      </div>
    ),
  },
];

function OpportunityTable({
  rows,
  search,
  statusFilter,
  selectedId,
  onSelect,
}: {
  rows: LinkOpportunity[];
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return matchesSearch(
          search,
          r.sourceDomain,
          r.sourceUrl,
          r.sourceTitle,
          r.opportunityType,
          r.whyThisFits,
          r.targetPageTitle,
          r.targetPageUrl,
          r.competitorLabel,
          r.prospectName,
        );
      }),
    [rows, search, statusFilter],
  );

  return (
    <DataTable
      columns={opportunityColumns}
      data={filtered}
      initialSorting={[{ id: "confidence", desc: true }]}
      onRowClick={(row) => onSelect(row.original.id)}
      getRowClassName={(row) => cn(selectedId === row.original.id && "bg-muted/40")}
      tableClassName="min-w-[950px]"
      emptyState={
        <InlineEmptyState
          title="No opportunities available yet"
          description="They'll appear here after discovery runs or competitor-gap analysis."
        />
      }
    />
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel (right side)
 * --------------------------------------------------------------------------- */

function DetailPanel({
  subview,
  selectedId,
  data,
  siteId,
  onClose,
}: {
  subview: BacklinksSubview;
  selectedId: number | null;
  data: NonNullable<ReturnType<typeof trpc.seo.backlinks.useQuery>["data"]>;
  siteId: number;
  onClose: () => void;
}) {
  if (selectedId === null) {
    return (
      <div className="w-[340px] shrink-0 border-l border-border/40 flex items-center justify-center">
        <p className="text-sm text-muted-foreground/40 text-center px-6">
          Select a row to inspect details
        </p>
      </div>
    );
  }

  if (subview === "existing") {
    const item = data.existing.find((r) => r.id === selectedId);
    if (!item) return null;
    return <ExistingDetail item={item} onClose={onClose} />;
  }

  if (subview === "competitors") {
    const item = data.competitor.find((r) => r.id === selectedId);
    if (!item) return null;
    return <CompetitorDetail item={item} onClose={onClose} />;
  }

  const item = data.opportunities.find((r) => r.id === selectedId);
  if (!item) return null;
  return <OpportunityDetail item={item} siteId={siteId} onClose={onClose} />;
}

/* ---------------------------------------------------------------------------
 * Detail panel: Existing backlink
 * --------------------------------------------------------------------------- */

function ExistingDetail({
  item,
  onClose,
}: {
  item: BacklinkSource;
  onClose: () => void;
}) {
  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5 break-all">{item.sourceDomain}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Target URL" value={item.targetUrl} link />
          <DetailRow label="Target page" value={item.targetPageTitle} />
          <DetailRow label="Anchor text" value={item.anchorText} />
          <DetailRow label="Rel" value={item.relAttr} />
          <DetailRow label="Link type" value={item.linkType ? toTitleCase(item.linkType) : null} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last seen" value={formatDate(item.lastSeenAt)} />
          <DetailRow label="Verified at" value={formatDate(item.verifiedAt)} />
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {item.sourceUrl && (
          <div className="mt-4">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel: Competitor backlink
 * --------------------------------------------------------------------------- */

function CompetitorDetail({
  item,
  onClose,
}: {
  item: CompetitorBacklink;
  onClose: () => void;
}) {
  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">{item.competitorLabel} ({item.competitorDomain})</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Source title" value={item.sourceTitle} />
          <DetailRow label="Target URL" value={item.targetUrl} link />
          <DetailRow label="Anchor text" value={item.anchorText} />
          <DetailRow label="Rel" value={item.relAttr} />
          <DetailRow label="Link type" value={item.linkType ? toTitleCase(item.linkType) : null} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last seen" value={formatDate(item.lastSeenAt)} />
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {item.sourceUrl && (
          <div className="mt-4">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail panel: Opportunity
 * --------------------------------------------------------------------------- */

function OpportunityDetail({
  item,
  siteId,
  onClose,
}: {
  item: LinkOpportunity;
  siteId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const mutation = trpc.seo.updateOpportunityStatus.useMutation({
    onSuccess: () => {
      utils.seo.backlinks.invalidate({ siteId });
    },
  });

  const handleAction = (status: string) => {
    mutation.mutate({ opportunityId: item.id, status: status as "approved" | "rejected" | "reviewed" });
  };

  return (
    <div className="w-[340px] shrink-0 border-l border-border/40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium">{item.sourceTitle || item.sourceDomain}</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5 break-all">{item.sourceDomain}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Why this fits — prominent */}
        <div className="rounded-lg bg-[var(--swarm-violet-dim)] px-3.5 py-3 mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="size-3.5 text-[var(--swarm-violet)]" />
            <span className="text-xs font-medium text-[var(--swarm-violet)]">Why this fits</span>
          </div>
          <p className="text-sm leading-relaxed">{item.whyThisFits}</p>
        </div>

        <div className="space-y-0">
          <DetailRow label="Source URL" value={item.sourceUrl} link />
          <DetailRow label="Target page" value={item.targetPageTitle || item.targetPageUrl} />
          <DetailRow label="Type" value={toTitleCase(item.opportunityType)} />
          <DetailRow label="Discovered from" value={toTitleCase(item.discoveredFrom)} />
          <DetailRow label="Suggested anchor" value={item.suggestedAnchorText} />
          <DetailRow label="Authority" value={formatOptionalDecimal(item.authorityScore)} />
          <DetailRow label="Relevance" value={formatOptionalDecimal(item.relevanceScore)} />
          <DetailRow label="Confidence" value={formatOptionalDecimal(item.confidenceScore)} />
          <DetailRow label="Risk" value={formatOptionalDecimal(item.riskScore)} />
          <DetailRow label="First seen" value={formatDate(item.firstSeenAt)} />
          <DetailRow label="Last reviewed" value={formatDate(item.lastReviewedAt)} />
          {item.prospectName && <DetailRow label="Prospect" value={item.prospectName} />}
          {item.competitorLabel && <DetailRow label="Competitor" value={item.competitorLabel} />}
          <DetailRow label="Status">
            <div className="flex items-center gap-1.5">
              <StatusDot status={item.status} />
              <span className="text-sm capitalize">{item.status}</span>
            </div>
          </DetailRow>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-2">
          {item.status !== "approved" && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={mutation.isPending}
              onClick={() => handleAction("approved")}
            >
              <Check className="size-3" />
              Approve for outreach
            </Button>
          )}
          {item.status !== "rejected" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={mutation.isPending}
              onClick={() => handleAction("rejected")}
            >
              <X className="size-3" />
              Reject
            </Button>
          )}
          {item.status === "new" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              disabled={mutation.isPending}
              onClick={() => handleAction("reviewed")}
            >
              Mark reviewed
            </Button>
          )}
        </div>

        {/* Secondary links */}
        <div className="mt-4 flex items-center gap-4">
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              Open source
            </a>
          )}
          {item.targetPageUrl && (
            <a
              href={item.targetPageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link2 className="size-3" />
              Open target page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detail row helper
 * --------------------------------------------------------------------------- */

function DetailRow({
  label,
  value,
  link,
  children,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 min-w-0 text-sm break-all">
        {children ??
          (value && link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:underline underline-offset-2 text-foreground/80 break-all"
            >
              {value}
            </a>
          ) : (
            <span>{value || <span className="text-muted-foreground/40">Not available</span>}</span>
          ))}
      </div>
    </div>
  );
}
