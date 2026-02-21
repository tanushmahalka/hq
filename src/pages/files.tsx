import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, User } from "lucide-react";
import { useGateway, type Agent } from "@/hooks/use-gateway";
import { useAgentFiles } from "@/hooks/use-agent-files";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function AgentItem({
  agent,
  selected,
  onClick,
}: {
  agent: Agent;
  selected: boolean;
  onClick: () => void;
}) {
  const label = agent.identity?.name ?? agent.name ?? agent.id;
  const emoji = agent.identity?.emoji;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {emoji ? (
        <span className="text-base shrink-0">{emoji}</span>
      ) : (
        <User className="size-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function Files() {
  const { agents, connected } = useGateway();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { files, selectedFile, fileContent, loadingFiles, loadingContent, selectFile } =
    useAgentFiles(selectedAgentId);

  // Auto-select first agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  return (
    <div className="flex h-full">
      {/* Agents panel */}
      <div className="w-[200px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Agents
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {!connected ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No agents</p>
          ) : (
            agents.map((agent) => (
              <AgentItem
                key={agent.id}
                agent={agent}
                selected={selectedAgentId === agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Files panel */}
      <div className="w-[240px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Files
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {!selectedAgentId ? (
            <p className="text-xs text-muted-foreground p-3">Select an agent</p>
          ) : loadingFiles ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No files</p>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => selectFile(file.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors",
                  selectedFile === file.name
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b flex items-center gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedFile ?? "Content"}
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {!selectedFile ? (
            <p className="text-sm text-muted-foreground">Select a file to view its content</p>
          ) : loadingContent ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : fileContent === null ? (
            <p className="text-sm text-muted-foreground">Failed to load file content</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{fileContent}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
