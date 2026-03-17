import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { EbookCreateDialog } from "@/components/marketing/ebook-create-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type EbookTab = "ebooks";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function EbookTabButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors",
        active
          ? "border-foreground text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground/70">{description}</span>
    </button>
  );
}

export default function Marketing() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<EbookTab>("ebooks");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEbookId, setSelectedEbookId] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

  const ebooksQuery = trpc.marketing.ebook.list.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  const ebookDetailQuery = trpc.marketing.ebook.get.useQuery(
    { id: selectedEbookId ?? 0 },
    { enabled: selectedEbookId !== null },
  );
  const revisionsQuery = trpc.marketing.ebook.revisions.useQuery(
    { id: selectedEbookId ?? 0, limit: 8 },
    { enabled: selectedEbookId !== null },
  );

  const ebooks = ebooksQuery.data ?? [];
  const selectedEbook = ebookDetailQuery.data ?? null;

  useEffect(() => {
    if (selectedEbookId !== null && ebooks.some((ebook) => ebook.id === selectedEbookId)) {
      return;
    }

    setSelectedEbookId(ebooks[0]?.id ?? null);
  }, [ebooks, selectedEbookId]);

  useEffect(() => {
    if (!selectedEbook) {
      setPreviewVersion(null);
      return;
    }

    setPreviewVersion(selectedEbook.currentVersion);
  }, [selectedEbook]);

  useEffect(() => {
    if (!selectedEbookId) {
      setStreamConnected(false);
      return;
    }

    const eventSource = new EventSource(
      `/api/marketing/ebooks/${selectedEbookId}/stream`,
    );

    eventSource.onopen = () => {
      setStreamConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          ebookId: number;
          version: number;
        };

        if (payload.ebookId !== selectedEbookId) {
          return;
        }

        setPreviewVersion(payload.version);
        utils.marketing.ebook.list.invalidate();
        utils.marketing.ebook.get.invalidate({ id: selectedEbookId });
        utils.marketing.ebook.revisions.invalidate({ id: selectedEbookId, limit: 8 });
      } catch {
        // Ignore malformed events and keep the current stream open.
      }
    };

    eventSource.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      setStreamConnected(false);
      eventSource.close();
    };
  }, [selectedEbookId, utils]);

  const previewUrl = useMemo(() => {
    if (!selectedEbook || previewVersion === null) {
      return null;
    }

    return `/api/marketing/ebooks/${selectedEbook.id}/preview?v=${previewVersion}`;
  }, [previewVersion, selectedEbook]);

  return (
    <div className="flex flex-col h-full p-12">
      <div className="flex items-center justify-between pt-4 pb-6">
        <div className="space-y-2">
          <h1 className="font-display text-5xl font-normal text-foreground">
            Marketing
          </h1>
          <p className="text-sm text-muted-foreground">
            Live drafts for AI-managed marketing assets.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Ebook
        </Button>
      </div>

      <div className="flex items-end justify-between border-b mb-6">
        <div className="flex items-center gap-0">
          <EbookTabButton
            active={activeTab === "ebooks"}
            label="Ebooks"
            description={`${ebooks.length} tracked`}
            onClick={() => setActiveTab("ebooks")}
          />
        </div>
        <div className="flex items-center gap-8 pb-2.5">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground/60">Drafts</p>
            <p className="text-sm font-medium">{ebooks.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground/60">Live stream</p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "size-2 rounded-full",
                  streamConnected ? "bg-[var(--swarm-mint)]" : "bg-muted-foreground/30",
                )}
              />
              {streamConnected ? "Connected" : "Waiting"}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "ebooks" ? (
        <div className="flex flex-1 min-h-0 gap-4">
          <div className="w-[360px] shrink-0 rounded-2xl border border-border/40 bg-card/70 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Library</p>
                <p className="text-[13px] text-muted-foreground">
                  Select an ebook to preview the current HTML.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => ebooksQuery.refetch()}
                title="Refresh ebooks"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>

            <div className="space-y-2 p-3 overflow-y-auto h-[calc(100%-72px)]">
              {ebooksQuery.isLoading ? (
                <>
                  <Skeleton className="h-28 rounded-xl" />
                  <Skeleton className="h-28 rounded-xl" />
                  <Skeleton className="h-28 rounded-xl" />
                </>
              ) : ebooks.length === 0 ? (
                <p className="text-sm text-muted-foreground/40 text-center py-12">
                  No ebooks yet.
                </p>
              ) : (
                ebooks.map((ebook) => (
                  <button
                    key={ebook.id}
                    type="button"
                    onClick={() => setSelectedEbookId(ebook.id)}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-xl border border-border/40 bg-card p-4 text-left transition-colors swarm-card",
                      selectedEbookId === ebook.id && "border-foreground/40 bg-muted/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">{ebook.title}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          /{ebook.slug}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {ebook.status}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">
                      {ebook.description ?? "Default live draft template."}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground/60">
                      <span>v{ebook.currentVersion}</span>
                      <span>{formatUpdatedAt(ebook.updatedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-1 min-w-0 flex-col rounded-2xl border border-border/40 bg-card/70 overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border/40 px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {selectedEbook?.title ?? "Preview"}
                  </p>
                  {selectedEbook ? (
                    <Badge variant="secondary" className="capitalize">
                      {selectedEbook.status}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {selectedEbook
                    ? "The frame reloads when the agent publishes a new revision."
                    : "Select an ebook to see the live HTML preview."}
                </p>
              </div>
              {selectedEbook ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1.5",
                      streamConnected && "bg-[var(--swarm-violet-dim)] text-foreground",
                    )}
                  >
                    <Radio className="size-3" />
                    {streamConnected ? "Live" : "Reconnecting"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      if (!selectedEbookId) {
                        return;
                      }
                      utils.marketing.ebook.get.invalidate({ id: selectedEbookId });
                      utils.marketing.ebook.revisions.invalidate({ id: selectedEbookId, limit: 8 });
                    }}
                    title="Refresh preview metadata"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            {!selectedEbook ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground/40">
                  Select an ebook to view details.
                </p>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-r border-border/40 px-6 py-5 overflow-y-auto">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Details</p>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Slug</span>
                          <span className="font-mono text-xs">/{selectedEbook.slug}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Version</span>
                          <span>v{selectedEbook.currentVersion}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Updated</span>
                          <span>{formatUpdatedAt(selectedEbook.updatedAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Source</span>
                          <span className="capitalize">{selectedEbook.lastUpdateSource}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Storage</p>
                      <div className="rounded-xl border border-border/40 bg-background/60 p-3">
                        <p className="text-[13px] text-muted-foreground">
                          The latest HTML is materialized on the server at:
                        </p>
                        <p className="mt-2 break-all font-mono text-xs text-foreground">
                          {selectedEbook.storagePath ?? "Pending write"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-[var(--swarm-violet)]" />
                        <p className="text-sm font-medium">Recent revisions</p>
                      </div>
                      <div className="space-y-2">
                        {revisionsQuery.isLoading ? (
                          <>
                            <Skeleton className="h-24 rounded-xl" />
                            <Skeleton className="h-24 rounded-xl" />
                          </>
                        ) : (
                          revisionsQuery.data?.map((revision) => (
                            <div
                              key={revision.id}
                              className="rounded-xl border border-border/40 bg-background/60 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">
                                  v{revision.version}
                                </p>
                                <Badge variant="secondary" className="capitalize">
                                  {revision.source}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[13px] text-muted-foreground">
                                {revision.summary ?? "Full HTML snapshot updated."}
                              </p>
                              <p className="mt-3 text-xs text-muted-foreground/60">
                                {formatUpdatedAt(revision.createdAt)}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 bg-background/40 p-4">
                  <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-white">
                    <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                      <BookOpen className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Live HTML preview</p>
                      <Badge variant="secondary" className="ml-auto">
                        <FileText className="size-3" />
                        index.html
                      </Badge>
                    </div>
                    <div className="min-h-0 flex-1 bg-white">
                      {previewUrl ? (
                        <iframe
                          key={`${selectedEbook.id}:${previewVersion}`}
                          title={`${selectedEbook.title} preview`}
                          src={previewUrl}
                          sandbox="allow-same-origin"
                          className="h-full w-full bg-white"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-sm text-muted-foreground/40">
                            Preparing preview…
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <EbookCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setSelectedEbookId}
      />
    </div>
  );
}
