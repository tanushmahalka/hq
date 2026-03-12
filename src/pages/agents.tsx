import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, CircleDot, FileText, User } from "lucide-react";
import { useGateway, type Agent } from "@/hooks/use-gateway";
import { useAgentFiles } from "@/hooks/use-agent-files";
import { useAgentSkills } from "@/hooks/use-agent-skills";
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

type DirectoryType = "files" | "skills";

function DirectoryItem({
  value,
  selected,
  onClick,
}: {
  value: DirectoryType;
  selected: boolean;
  onClick: () => void;
}) {
  const isFiles = value === "files";
  const Icon = isFiles ? FileText : BookOpen;
  const label = isFiles ? "Files" : "Skills";

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
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SkillStatusDot({
  eligible,
  disabled,
}: {
  eligible: boolean;
  disabled: boolean;
}) {
  if (disabled) {
    return <CircleDot className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return (
    <CircleDot
      className={cn(
        "size-3.5 shrink-0",
        eligible ? "text-emerald-500" : "text-amber-500",
      )}
    />
  );
}

export default function Agents() {
  const { agents, connected } = useGateway();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryType>("files");
  const activeAgentId =
    selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)
      ? selectedAgentId
      : agents[0]?.id ?? null;
  const { files, selectedFile, fileContent, loadingFiles, loadingContent, selectFile } =
    useAgentFiles(activeAgentId);
  const { skills, selectedSkillKey, selectedSkill, loadingSkills, selectSkill } =
    useAgentSkills(activeAgentId);

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
                selected={activeAgentId === agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Directory panel */}
      <div className="w-[160px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          <DirectoryItem
            value="files"
            selected={selectedDirectory === "files"}
            onClick={() => setSelectedDirectory("files")}
          />
          <DirectoryItem
            value="skills"
            selected={selectedDirectory === "skills"}
            onClick={() => setSelectedDirectory("skills")}
          />
        </div>
      </div>

      {/* Item list panel */}
      <div className="w-[240px] shrink-0 border-r flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDirectory === "files" ? "Files" : "Skills"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {!activeAgentId ? (
            <p className="text-xs text-muted-foreground p-3">Select an agent</p>
          ) : selectedDirectory === "files" && loadingFiles ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : selectedDirectory === "skills" && loadingSkills ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : selectedDirectory === "files" && files.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No files</p>
          ) : selectedDirectory === "skills" && skills.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No eligible skills</p>
          ) : selectedDirectory === "files" ? (
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
          ) : (
            skills.map((skill) => (
              <button
                key={skill.skillKey}
                onClick={() => selectSkill(skill.skillKey)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors",
                  selectedSkillKey === skill.skillKey
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {skill.emoji ? (
                  <span className="text-base shrink-0">{skill.emoji}</span>
                ) : (
                  <BookOpen className="size-4 shrink-0" />
                )}
                <span className="truncate">{skill.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b flex items-center gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDirectory === "files"
              ? selectedFile ?? "Content"
              : selectedSkill?.name ?? "Content"}
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {selectedDirectory === "files" && !selectedFile ? (
            <p className="text-sm text-muted-foreground">Select a file to view its content</p>
          ) : selectedDirectory === "skills" && !selectedSkill ? (
            <p className="text-sm text-muted-foreground">Select a skill to view its details</p>
          ) : selectedDirectory === "files" && loadingContent ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : selectedDirectory === "files" && fileContent === null ? (
            <p className="text-sm text-muted-foreground">Failed to load file content</p>
          ) : selectedDirectory === "files" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{fileContent}</Markdown>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <SkillStatusDot
                  eligible={selectedSkill?.eligible ?? false}
                  disabled={selectedSkill?.disabled ?? false}
                />
                <p className="text-sm font-medium">
                  {selectedSkill?.disabled
                    ? "Disabled"
                    : selectedSkill?.eligible
                      ? "Eligible"
                      : "Needs setup"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">{selectedSkill?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedSkill?.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Key</p>
                  <p className="text-sm font-mono">{selectedSkill?.skillKey}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Source</p>
                  <p className="text-sm">{selectedSkill?.source}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Skill File
                  </p>
                  <p className="text-sm break-all">{selectedSkill?.filePath}</p>
                </div>
                {selectedSkill?.homepage ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Homepage
                    </p>
                    <a
                      href={selectedSkill.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline underline-offset-4"
                    >
                      {selectedSkill.homepage}
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Missing Requirements
                </p>
                {((selectedSkill?.missing.bins.length ?? 0) === 0 &&
                  (selectedSkill?.missing.env.length ?? 0) === 0 &&
                  (selectedSkill?.missing.config.length ?? 0) === 0 &&
                  (selectedSkill?.missing.os.length ?? 0) === 0) ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {selectedSkill?.missing.bins.length ? (
                      <p>
                        Binaries: <span className="font-mono">{selectedSkill.missing.bins.join(", ")}</span>
                      </p>
                    ) : null}
                    {selectedSkill?.missing.env.length ? (
                      <p>
                        Env: <span className="font-mono">{selectedSkill.missing.env.join(", ")}</span>
                      </p>
                    ) : null}
                    {selectedSkill?.missing.config.length ? (
                      <p>
                        Config:{" "}
                        <span className="font-mono">{selectedSkill.missing.config.join(", ")}</span>
                      </p>
                    ) : null}
                    {selectedSkill?.missing.os.length ? (
                      <p>
                        OS: <span className="font-mono">{selectedSkill.missing.os.join(", ")}</span>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
