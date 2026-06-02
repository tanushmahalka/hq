import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ListDetailPanel } from "@/components/lists/list-detail-panel";
import { ListBuilder } from "@/features/findall/builder";
import { FindallResults } from "@/features/findall/results";

interface ListSummary {
  id: number;
  title: string;
  description: string | null;
}

interface ActiveRun {
  id: number;
  listId: number;
  title: string;
}

function ListListRow({
  list,
  onClick,
}: {
  list: ListSummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left px-5 py-4 flex items-center gap-3 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <span className="block text-sm truncate">{list.title}</span>
        {list.description && (
          <span className="mt-1 block text-xs text-muted-foreground/50 line-clamp-1">
            {list.description}
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
    </button>
  );
}

function ActiveRunRow({
  title,
  matched,
  matchLimit,
  onClick,
}: {
  title: string;
  matched: number;
  matchLimit: number;
  onClick: () => void;
}) {
  const progress = matchLimit > 0 ? Math.min(100, (matched / matchLimit) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden text-left px-5 py-4 flex items-center gap-3 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-current text-[var(--swarm-violet)] animate-pulse-soft"
          />
          <span className="block text-sm truncate">{title}</span>
        </div>
        <span className="mt-1 block text-xs text-muted-foreground/50">
          Building · {matched}
          {matchLimit > 0 ? ` of ${matchLimit}` : ""} found
        </span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border/15">
        <div
          className="h-full rounded-r-full transition-[width] duration-500"
          style={{ width: `${progress}%`, background: "var(--swarm-violet)" }}
        />
      </div>
    </button>
  );
}

export default function Lists() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const { data: lists, isLoading } = trpc.custom.agentList.list.useQuery();
  const { data: runs } = trpc.custom.findall.list.useQuery(undefined, {
    // Poll while there may be active runs so completed ones move sections.
    refetchInterval: 15_000,
  });

  const activeRuns = (runs ?? []).filter((run) => run.status === "running");
  const activeListIds = new Set(activeRuns.map((run) => run.listId));
  const titleByListId = new Map((lists ?? []).map((l) => [l.id, l.title]));

  // If the selected list disappeared (e.g. deleted), fall back to the overview.
  const detailListId =
    selectedListId && (!lists || lists.some((l) => l.id === selectedListId))
      ? selectedListId
      : null;

  const openList = (listId: number) => {
    setActiveRun(null);
    setBuilding(false);
    setSelectedListId(listId);
  };

  if (activeRun) {
    return (
      <FindallResults
        key={activeRun.id}
        runId={activeRun.id}
        listId={activeRun.listId}
        title={activeRun.title}
        onBack={() => setActiveRun(null)}
        onOpenList={openList}
      />
    );
  }

  if (building) {
    return (
      <ListBuilder
        onBack={() => setBuilding(false)}
        onOpenList={(listId) => {
          setBuilding(false);
          openList(listId);
        }}
      />
    );
  }

  if (detailListId) {
    return (
      <ListDetailPanel
        key={detailListId}
        listId={detailListId}
        onBack={() => setSelectedListId(null)}
      />
    );
  }

  const visibleLists = (lists ?? []).filter((l) => !activeListIds.has(l.id));
  const hasContent = activeRuns.length > 0 || visibleLists.length > 0;

  return (
    <div className="flex flex-col h-full p-12">
      <div className="flex items-center justify-between pt-4 pb-8">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Lists
        </h1>
        <Button onClick={() => setBuilding(true)}>
          <Sparkles className="size-4" />
          Build with AI
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!isLoading && !hasContent && (
        <p className="text-sm text-muted-foreground/40 text-center py-20">
          No lists yet. Build one with AI to get started.
        </p>
      )}

      {!isLoading && hasContent && (
        <div className="space-y-6">
          {activeRuns.length > 0 && (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              {activeRuns.map((run) => (
                <ActiveRunRow
                  key={run.id}
                  title={titleByListId.get(run.listId) ?? run.objective}
                  matched={run.metrics?.matched_candidates_count ?? 0}
                  matchLimit={run.matchLimit}
                  onClick={() =>
                    setActiveRun({
                      id: run.id,
                      listId: run.listId,
                      title: titleByListId.get(run.listId) ?? run.objective,
                    })
                  }
                />
              ))}
            </div>
          )}

          {visibleLists.length > 0 && (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              {visibleLists.map((list) => (
                <ListListRow
                  key={list.id}
                  list={list}
                  onClick={() => setSelectedListId(list.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
