import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  Info,
  Radio,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type EbookTab = "ebooks";

type SelectedEbookPreview = {
  id: number;
  title: string;
  slug: string;
  currentVersion: number;
  updatedAt: string | Date;
  lastUpdateSource: string;
  storagePath: string | null;
};

type EbookRevisionPreview = {
  id: number;
  version: number;
  source: string;
  summary: string | null;
  createdAt: string | Date;
};

function formatUpdatedAt(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function buildPdfFilename(asset: { id: number; slug: string | null | undefined }): string {
  const slug = asset.slug?.trim();
  return `${slug && slug.length > 0 ? slug : `ebook-${asset.id}`}.pdf`;
}

function parseContentDispositionFilename(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = value.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] ?? null;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

function EbookPreviewArea({
  selectedEbook,
  previewUrl,
  previewVersion,
  revisionsQuery,
}: {
  selectedEbook: SelectedEbookPreview;
  previewUrl: string | null;
  previewVersion: number | null;
  revisionsQuery: {
    isLoading: boolean;
    data?: EbookRevisionPreview[];
  };
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative flex min-h-[1160px] flex-1 flex-col">
      <div className="min-h-0 flex-1 bg-background/40 p-4">
        <div className="flex h-full min-w-0 w-full flex-col overflow-hidden rounded-xl border border-border/40 bg-white">
          <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
            <BookOpen className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Live HTML preview</p>
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="secondary">
                <FileText className="size-3" />
                index.html
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setShowDetails(!showDetails)}
                title={showDetails ? "Hide details" : "Show details"}
              >
                <Info className={cn("size-4", showDetails && "text-foreground")} />
              </Button>
            </div>
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

      {/* Collapsible details panel */}
      {showDetails && (
        <div className="border-t border-border/40 px-6 py-5 overflow-y-auto max-h-[280px]">
          <div className="max-w-[680px] mx-auto space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Details</p>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">Slug</span>
                  <span className="text-xs">/{selectedEbook.slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">Version</span>
                  <span>v{selectedEbook.currentVersion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">Updated</span>
                  <span>{formatUpdatedAt(selectedEbook.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">Source</span>
                  <span className="capitalize">{selectedEbook.lastUpdateSource}</span>
                </div>
                {selectedEbook.storagePath && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/60">Path</span>
                    <span className="text-xs break-all">{selectedEbook.storagePath}</span>
                  </div>
                )}
              </div>
            </div>

            {revisionsQuery.data && revisionsQuery.data.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-[var(--swarm-violet)]" />
                  <p className="text-sm font-medium text-muted-foreground">Recent revisions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {revisionsQuery.data.map((revision) => (
                    <div
                      key={revision.id}
                      className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-xs"
                    >
                      <span className="font-medium">v{revision.version}</span>
                      <span className="text-muted-foreground/60 mx-1.5">&middot;</span>
                      <span className="capitalize text-muted-foreground">{revision.source}</span>
                      {revision.summary && (
                        <>
                          <span className="text-muted-foreground/60 mx-1.5">&middot;</span>
                          <span className="text-muted-foreground">{revision.summary}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Marketing() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<EbookTab>("ebooks");
  const [selectedEbookId, setSelectedEbookId] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const ebooksQuery = trpc.marketing.asset.list.useQuery(
    { assetType: "ebook" },
    {
      refetchInterval: 5_000,
    },
  );
  const ebookDetailQuery = trpc.marketing.asset.get.useQuery(
    { id: selectedEbookId ?? 0 },
    { enabled: selectedEbookId !== null },
  );
  const revisionsQuery = trpc.marketing.asset.revisions.useQuery(
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
      `/api/marketing/assets/${selectedEbookId}/stream`,
    );

    eventSource.onopen = () => {
      setStreamConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          assetId: number;
          version: number;
        };

        if (payload.assetId !== selectedEbookId) {
          return;
        }

        setPreviewVersion(payload.version);
        utils.marketing.asset.list.invalidate({ assetType: "ebook" });
        utils.marketing.asset.get.invalidate({ id: selectedEbookId });
        utils.marketing.asset.revisions.invalidate({ id: selectedEbookId, limit: 8 });
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

    return `/api/marketing/assets/${selectedEbook.id}/preview?v=${previewVersion}`;
  }, [previewVersion, selectedEbook]);

  async function handleDownloadPdf() {
    if (!selectedEbook) {
      return;
    }

    setIsDownloadingPdf(true);

    try {
      const response = await fetch(`/api/marketing/assets/${selectedEbook.id}/pdf`, {
        credentials: "include",
      });

      if (!response.ok) {
        let description = "Failed to generate PDF.";

        try {
          const data = await response.json() as { message?: string };
          if (typeof data.message === "string" && data.message.trim().length > 0) {
            description = data.message;
          }
        } catch {
          // Ignore malformed error bodies and use the fallback message.
        }

        throw new Error(description);
      }

      const blob = await response.blob();
      const filename =
        parseContentDispositionFilename(response.headers.get("content-disposition")) ??
        buildPdfFilename(selectedEbook);

      triggerBlobDownload(blob, filename);
    } catch (error) {
      toast.error("Failed to download PDF", {
        description:
          error instanceof Error ? error.message : "Failed to generate PDF.",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <div className="flex flex-col h-full p-12">
      <div className="pt-4 pb-6">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Marketing
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live drafts for AI-managed marketing assets.
        </p>
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

          <div className="flex min-h-[1240px] flex-1 min-w-0 flex-col rounded-2xl border border-border/40 bg-card/70 overflow-hidden">
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                  >
                    <Download className={cn("size-4", isDownloadingPdf && "animate-pulse")} />
                    {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                  </Button>
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
                      utils.marketing.asset.get.invalidate({ id: selectedEbookId });
                      utils.marketing.asset.revisions.invalidate({ id: selectedEbookId, limit: 8 });
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
              <EbookPreviewArea
                selectedEbook={selectedEbook}
                previewUrl={previewUrl}
                previewVersion={previewVersion}
                revisionsQuery={revisionsQuery}
              />
            )}
          </div>
        </div>
      ) : null}

    </div>
  );
}
