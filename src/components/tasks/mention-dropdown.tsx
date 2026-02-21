import { useEffect, useRef } from "react";
import type { Agent } from "@/hooks/use-gateway";
import { parseAgentName } from "@/lib/mentions";

interface MentionDropdownProps {
  agents: Agent[];
  query: string;
  selectedIdx: number;
  onSelect: (agentId: string) => void;
}

export function MentionDropdown({
  agents,
  query,
  selectedIdx,
  onSelect,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = agents.filter((agent) => {
    const q = query.toLowerCase();
    if (!q) return true;
    const displayName =
      agent.identity?.name ?? agent.name ?? agent.id;
    return (
      agent.id.toLowerCase().includes(q) ||
      displayName.toLowerCase().includes(q)
    );
  });

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-2 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md z-50"
    >
      {filtered.map((agent, i) => {
        const raw = agent.identity?.name ?? agent.name ?? agent.id;
        const { name } = parseAgentName(raw);
        const emoji = agent.identity?.emoji;
        const isSelected = i === selectedIdx;

        return (
          <button
            key={agent.id}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              onSelect(agent.id);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
              isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            <span className="text-xs shrink-0">{emoji ?? "🤖"}</span>
            <span className="truncate">{name}</span>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {agent.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Get the filtered agents list for a given query (matches MentionDropdown filtering). */
export function getFilteredAgents(agents: Agent[], query: string): Agent[] {
  const q = query.toLowerCase();
  if (!q) return agents;
  return agents.filter((agent) => {
    const displayName = agent.identity?.name ?? agent.name ?? agent.id;
    return (
      agent.id.toLowerCase().includes(q) ||
      displayName.toLowerCase().includes(q)
    );
  });
}
