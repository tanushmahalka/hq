import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ListDetailPanel } from "@/components/lists/list-detail-panel";

interface ListSummary {
  id: number;
  title: string;
  description: string | null;
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

export default function Lists() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  const { data: lists, isLoading } = trpc.custom.agentList.list.useQuery();

  // If the selected list disappears, return to the overview.
  useEffect(() => {
    if (
      selectedListId &&
      lists &&
      !lists.find((l) => l.id === selectedListId)
    ) {
      setSelectedListId(null);
    }
  }, [lists, selectedListId]);

  // Full-page detail view
  if (selectedListId) {
    return (
      <ListDetailPanel
        key={selectedListId}
        listId={selectedListId}
        onBack={() => setSelectedListId(null)}
      />
    );
  }

  // Overview: list of lists
  return (
    <div className="flex flex-col h-full p-12">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 pb-8">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Lists
        </h1>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!lists || lists.length === 0) && (
        <p className="text-sm text-muted-foreground/40 text-center py-20">
          No lists yet.
        </p>
      )}

      {/* List of lists */}
      {!isLoading && lists && lists.length > 0 && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          {lists.map((list) => (
            <ListListRow
              key={list.id}
              list={list}
              onClick={() => setSelectedListId(list.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
