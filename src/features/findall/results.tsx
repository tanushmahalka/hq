import { useState } from "react";
import { ArrowLeft, Plus, Square, ListPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useFindallStream } from "./use-findall-stream";
import { CitationPopover } from "./citation-popover";
import { formatCell } from "./utils";
import type { FindallColumn, FindallStatus, LiveRow } from "./types";

interface FindallResultsProps {
  runId: number;
  listId: number;
  title: string;
  onBack: () => void;
  onOpenList: (listId: number) => void;
}

const STATUS_META: Record<
  FindallStatus,
  { label: string; dot: string }
> = {
  running: { label: "Building", dot: "text-[var(--swarm-violet)]" },
  completed: { label: "Done", dot: "text-[var(--swarm-mint)]" },
  cancelled: { label: "Cancelled", dot: "text-gray-400" },
  failed: { label: "Failed", dot: "text-red-400" },
};

export function FindallResults({
  runId,
  listId,
  title,
  onBack,
  onOpenList,
}: FindallResultsProps) {
  const [reconnectKey, setReconnectKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const { run, columns, rows, status, scanned, matched, isStreaming } =
    useFindallStream(runId, reconnectKey);

  const cancel = trpc.custom.findall.cancel.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const extend = trpc.custom.findall.extend.useMutation({
    onSuccess: () => setReconnectKey((key) => key + 1),
    onError: (error) => toast.error(error.message),
  });

  const limit = run?.matchLimit ?? 0;
  const progress = limit > 0 ? Math.min(100, (matched / limit) * 100) : 0;
  const statusMeta = STATUS_META[status];
  const isPreview = run?.generator === "preview";

  return (
    <div className="flex flex-col h-full overflow-hidden p-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pb-4"
      >
        <ArrowLeft className="size-4" />
        Lists
      </button>

      {/* Header */}
      <div className="pb-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-4xl font-normal text-foreground">
            {title}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {status === "running" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancel.mutate({ id: runId })}
                disabled={cancel.isPending}
              >
                <Square className="size-3.5" />
                Stop
              </Button>
            )}
            {status === "completed" && !isPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => extend.mutate({ id: runId, additionalMatchLimit: 25 })}
                disabled={extend.isPending}
              >
                <Plus className="size-3.5" />
                Find more
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding((value) => !value)}
            >
              <ListPlus className="size-3.5" />
              Add column
            </Button>
            <Button size="sm" onClick={() => onOpenList(listId)}>
              <ExternalLink className="size-3.5" />
              Open list
            </Button>
          </div>
        </div>

        {/* Status line */}
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full bg-current",
                statusMeta.dot,
                status === "running" && "animate-pulse-soft",
              )}
            />
            {statusMeta.label}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            Scanned {scanned} · Matched {matched}
            {limit > 0 ? ` of ${limit}` : ""}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-[2px] w-full bg-border/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${progress}%`,
              background:
                status === "completed"
                  ? "var(--swarm-mint)"
                  : "var(--swarm-violet)",
            }}
          />
        </div>

        {adding && (
          <AddColumnForm
            runId={runId}
            onDone={() => {
              setAdding(false);
              setReconnectKey((key) => key + 1);
            }}
          />
        )}
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/40 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.title}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={Math.max(1, columns.length)}
                    className="p-0"
                  >
                    <p className="text-sm text-muted-foreground/40 text-center py-12">
                      {isStreaming ? "Searching…" : "No results yet"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.candidateId}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        <ResultCell
                          row={row}
                          column={column}
                          streaming={status === "running"}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ResultCell({
  row,
  column,
  streaming,
}: {
  row: LiveRow;
  column: FindallColumn;
  streaming: boolean;
}) {
  const value = row.cells[column.key];
  const text = formatCell(value);
  const basis = row.basisByField[column.title] ?? row.basisByField[column.key];

  // Enrichment cells that haven't filled yet shimmer while the run is active.
  if (column.kind === "enrichment" && !text && streaming) {
    return (
      <div className="h-3 w-20 rounded bg-muted/50 animate-pulse-soft" />
    );
  }

  return (
    <div className="group/cell flex items-center gap-1.5 min-w-0">
      {column.uri && text ? (
        <a
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-[var(--swarm-violet)] hover:underline"
        >
          {text}
        </a>
      ) : (
        <span className="truncate">{text}</span>
      )}
      {basis && <CitationPopover basis={basis} />}
    </div>
  );
}

function AddColumnForm({
  runId,
  onDone,
}: {
  runId: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const enrich = trpc.custom.findall.enrich.useMutation({
    onSuccess: () => {
      toast.success("Adding column…");
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    if (!name.trim() || !description.trim()) return;
    enrich.mutate({
      id: runId,
      enrichments: [{ name: name.trim(), description: description.trim() }],
    });
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-muted/10 p-3">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Column name (e.g. CEO name)"
        className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-44"
      />
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What to look up for each result"
        className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 flex-1 min-w-[12rem]"
        onKeyDown={(event) => event.key === "Enter" && submit()}
      />
      <Button size="sm" onClick={submit} disabled={enrich.isPending}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </div>
  );
}
