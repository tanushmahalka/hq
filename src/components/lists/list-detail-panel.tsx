import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "@/components/data-table";

interface ListDetailPanelProps {
  listId: number;
  onBack: () => void;
}

type RowRecord = Record<string, unknown>;
type ListRow = { id: number; data: RowRecord; sortOrder: number };

interface SchemaProperty {
  title?: string;
  type?: string;
  format?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

export function ListDetailPanel({ listId, onBack }: ListDetailPanelProps) {
  const { data: list, isLoading } = trpc.custom.agentList.get.useQuery({
    id: listId,
  });

  const columns = useMemo<ColumnDef<ListRow>[]>(() => {
    if (!list) return [];

    const schema = (list.jsonSchema ?? {}) as {
      properties?: Record<string, SchemaProperty>;
    };
    let properties = schema.properties ?? {};

    // Fallback: derive columns from the first row's keys if no schema.
    if (Object.keys(properties).length === 0 && list.rows.length > 0) {
      properties = Object.fromEntries(
        Object.keys(list.rows[0].data as RowRecord).map((key) => [key, {}]),
      );
    }

    return Object.entries(properties).map(([key, prop]) => ({
      id: key,
      header: prop.title ?? key,
      accessorFn: (row: ListRow) => (row.data as RowRecord)[key],
      cell: (info) => {
        const value = info.getValue();
        const text = formatValue(value);
        if (prop.format === "uri" && typeof value === "string" && value) {
          return (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--swarm-violet)] hover:underline"
            >
              {text}
            </a>
          );
        }
        return <span>{text}</span>;
      },
    }));
  }, [list]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          Lists
        </button>
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col h-full p-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          Lists
        </button>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground/40">List not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-12">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pb-4"
      >
        <ArrowLeft className="size-4" />
        Lists
      </button>

      {/* Header */}
      <div className="pb-6">
        <h2 className="font-display text-4xl font-normal text-foreground">
          {list.title}
        </h2>
        {list.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {list.description}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground/60">
          {list.rows.length} {list.rows.length === 1 ? "row" : "rows"}
        </p>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/40 overflow-hidden">
        <DataTable
          columns={columns}
          data={list.rows as ListRow[]}
          emptyState={
            <p className="text-sm text-muted-foreground/40 text-center py-12">
              No rows yet
            </p>
          }
        />
      </div>
    </div>
  );
}
