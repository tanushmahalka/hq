import { type ReactNode, useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGateway } from "@/hooks/use-gateway";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type FileBrowserPreviewKind = "markdown" | "image" | null;

type FileBrowserEntry = {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  size: number | null;
  updatedAtMs: number | null;
  mimeType: string | null;
  previewKind: FileBrowserPreviewKind;
};

type FileBrowserDirectory = {
  rootLabel: string;
  relativePath: string;
  parentRelativePath: string | null;
  entries: FileBrowserEntry[];
};

type FileBrowserFile = {
  name: string;
  relativePath: string;
  size: number;
  updatedAtMs: number;
  mimeType: string | null;
  previewKind: FileBrowserPreviewKind;
  encoding: "utf8" | "base64";
  content: string;
};

type FileBrowserDownload = {
  name: string;
  kind: "file" | "directory";
  mimeType: string;
  encoding: "base64";
  content: string;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "markdown"; file: FileBrowserFile }
  | { status: "image"; file: FileBrowserFile; src: string }
  | { status: "unsupported" }
  | { status: "too-large"; message: string }
  | { status: "error"; message: string };

const REQUIRED_METHODS = ["file-browser.list", "file-browser.read", "file-browser.download"];

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function decodeBase64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function triggerDownload(download: FileBrowserDownload) {
  const blob = decodeBase64ToBlob(download.content, download.mimeType);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildImageSrc(file: FileBrowserFile): string {
  const mimeType = file.mimeType || "application/octet-stream";
  return `data:${mimeType};base64,${file.content}`;
}

function isTooLargeMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("limit") || normalized.includes("exceeds");
}

function EntryIcon({ entry }: { entry: FileBrowserEntry }) {
  if (entry.kind === "directory") {
    return <Folder className="size-4 shrink-0 text-sky-600" />;
  }
  if (entry.previewKind === "image") {
    return <ImageIcon className="size-4 shrink-0 text-emerald-600" />;
  }
  if (entry.previewKind === "markdown") {
    return <FileText className="size-4 shrink-0 text-amber-700" />;
  }
  return <File className="size-4 shrink-0 text-muted-foreground" />;
}

function PreviewFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export default function Files() {
  const { client, connected, methods } = useGateway();
  const isMobile = useIsMobile();
  const [currentPath, setCurrentPath] = useState("");
  const [directory, setDirectory] = useState<FileBrowserDirectory | null>(null);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const supportsFileBrowser = REQUIRED_METHODS.every((method) => methods.includes(method));
  const selectedEntry =
    directory?.entries.find((entry) => entry.relativePath === selectedEntryPath) ?? null;

  const refreshDirectory = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const navigateTo = useCallback((relativePath: string) => {
    setSelectedEntryPath(null);
    setPreview({ status: "idle" });
    setCurrentPath(relativePath);
  }, []);

  const downloadTarget = useCallback(
    async (relativePath?: string) => {
      if (!client || !connected || !supportsFileBrowser) {
        return;
      }

      const targetPath = relativePath ?? currentPath;
      setDownloadingPath(targetPath || "__root__");

      try {
        const params = targetPath ? { relativePath: targetPath } : undefined;
        const result = await client.request<FileBrowserDownload>("file-browser.download", params);
        triggerDownload(result);
      } finally {
        setDownloadingPath(null);
      }
    },
    [client, connected, currentPath, supportsFileBrowser],
  );

  useEffect(() => {
    if (!client || !connected || !supportsFileBrowser) {
      setDirectory(null);
      setLoadingDirectory(false);
      setDirectoryError(null);
      return;
    }

    let cancelled = false;
    setLoadingDirectory(true);
    setDirectoryError(null);

    const params = currentPath ? { relativePath: currentPath } : undefined;
    client
      .request<FileBrowserDirectory>("file-browser.list", params)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDirectory(result);
        setSelectedEntryPath((previousPath) =>
          previousPath && result.entries.some((entry) => entry.relativePath === previousPath)
            ? previousPath
            : null,
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setDirectory(null);
          setDirectoryError(error instanceof Error ? error.message : "Failed to load files.");
          setSelectedEntryPath(null);
          setPreview({ status: "idle" });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDirectory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, connected, currentPath, refreshToken, supportsFileBrowser]);

  useEffect(() => {
    if (!client || !connected || !supportsFileBrowser) {
      setPreview({ status: "idle" });
      return;
    }

    if (!selectedEntry) {
      setPreview({ status: "idle" });
      return;
    }

    if (selectedEntry.kind === "directory") {
      setPreview({ status: "idle" });
      return;
    }

    if (!selectedEntry.previewKind) {
      setPreview({ status: "unsupported" });
      return;
    }

    let cancelled = false;
    setPreview({ status: "loading" });

    client
      .request<{ file: FileBrowserFile }>("file-browser.read", {
        relativePath: selectedEntry.relativePath,
        encoding: selectedEntry.previewKind === "image" ? "base64" : "utf8",
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.file.previewKind === "image") {
          setPreview({
            status: "image",
            file: result.file,
            src: buildImageSrc(result.file),
          });
          return;
        }
        setPreview({
          status: "markdown",
          file: result.file,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load preview.";
        if (isTooLargeMessage(message)) {
          setPreview({ status: "too-large", message });
          return;
        }
        setPreview({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [client, connected, selectedEntry, supportsFileBrowser]);

  const breadcrumbs = directory?.relativePath
    ? directory.relativePath.split("/").filter(Boolean)
    : [];

  const previewTitle = selectedEntry?.name ?? directory?.rootLabel ?? "Files";
  const previewSubtitle = selectedEntry
    ? selectedEntry.kind === "directory"
      ? "Folder"
      : selectedEntry.mimeType || "File"
    : directory
      ? `${directory.entries.length} item${directory.entries.length === 1 ? "" : "s"}`
      : undefined;

  const renderList = () => {
    if (!connected) {
      return (
        <div className="space-y-2 p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (!supportsFileBrowser) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="size-8 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Files are not configured on the gateway.</p>
            <p className="text-sm text-muted-foreground">
              Enable the `file-browser-rpc` plugin and point it at the `kfd-brands` directory.
            </p>
          </div>
        </div>
      );
    }

    if (loadingDirectory && !directory) {
      return (
        <div className="space-y-2 p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (directoryError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="size-8 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Unable to open this folder.</p>
            <p className="text-sm text-muted-foreground">{directoryError}</p>
          </div>
        </div>
      );
    }

    if (!directory) {
      return null;
    }

    if (directory.entries.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <Folder className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">This folder is empty.</p>
          <p className="text-sm text-muted-foreground">
            Use the breadcrumb bar to move elsewhere in `kfd-brands`.
          </p>
        </div>
      );
    }

    return (
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground md:grid-cols-[minmax(0,1fr)_180px_120px]">
          <span>Name</span>
          <span className="hidden md:block">Modified</span>
          <span className="text-right">Size</span>
        </div>
        <div className="divide-y">
          {directory.entries.map((entry) => {
            const isSelected = entry.relativePath === selectedEntryPath;
            return (
              <button
                key={entry.relativePath}
                type="button"
                onClick={() => setSelectedEntryPath(entry.relativePath)}
                onDoubleClick={() => {
                  if (entry.kind === "directory") {
                    navigateTo(entry.relativePath);
                  }
                }}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_180px_120px]",
                  isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <EntryIcon entry={entry} />
                    <span className="truncate text-sm font-medium">{entry.name}</span>
                  </div>
                  {isMobile ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {entry.kind === "directory"
                        ? "Folder"
                        : `${formatTimestamp(entry.updatedAtMs)} · ${formatBytes(entry.size)}`}
                    </p>
                  ) : null}
                </div>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {formatTimestamp(entry.updatedAtMs)}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {entry.kind === "directory" ? "Folder" : formatBytes(entry.size)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (!directory) {
      return (
        <PreviewFrame title="Files" subtitle="Waiting for the gateway">
          <p className="text-sm text-muted-foreground">
            Connect to the gateway to browse the `kfd-brands` directory.
          </p>
        </PreviewFrame>
      );
    }

    const previewAction = (
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadTarget(selectedEntry?.relativePath)}
        disabled={Boolean(downloadingPath)}
      >
        {downloadingPath ? (
          <LoaderCircle className="mr-2 size-4 animate-spin" />
        ) : (
          <Download className="mr-2 size-4" />
        )}
        {selectedEntry ? (selectedEntry.kind === "directory" ? "Download ZIP" : "Download") : "Download Folder"}
      </Button>
    );

    if (!selectedEntry) {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a file to preview it, or download the current folder as a ZIP archive.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folder</p>
                <p className="mt-2 text-sm font-medium">{directory.rootLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Items</p>
                <p className="mt-2 text-sm font-medium">{directory.entries.length}</p>
              </div>
            </div>
          </div>
        </PreviewFrame>
      );
    }

    if (selectedEntry.kind === "directory") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This folder can be opened with a double click or downloaded as a ZIP archive.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Path</p>
                <p className="mt-2 break-all text-sm font-medium">{selectedEntry.relativePath}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Modified</p>
                <p className="mt-2 text-sm font-medium">{formatTimestamp(selectedEntry.updatedAtMs)}</p>
              </div>
            </div>
            <Button onClick={() => navigateTo(selectedEntry.relativePath)}>
              Open Folder
            </Button>
          </div>
        </PreviewFrame>
      );
    }

    if (preview.status === "loading") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-64 w-full" />
          </div>
        </PreviewFrame>
      );
    }

    if (preview.status === "markdown") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(preview.file.size)}</span>
            <span>{formatTimestamp(preview.file.updatedAtMs)}</span>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown remarkPlugins={[remarkGfm]}>{preview.file.content}</Markdown>
          </div>
        </PreviewFrame>
      );
    }

    if (preview.status === "image") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(preview.file.size)}</span>
            <span>{formatTimestamp(preview.file.updatedAtMs)}</span>
          </div>
          <img
            src={preview.src}
            alt={preview.file.name}
            className="max-h-[70vh] w-full rounded-lg border bg-muted/20 object-contain"
          />
        </PreviewFrame>
      );
    }

    if (preview.status === "unsupported") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="space-y-4">
            <p className="text-sm font-medium">Preview unavailable for this file type.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Path</p>
                <p className="mt-2 break-all text-sm font-medium">{selectedEntry.relativePath}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Modified</p>
                <p className="mt-2 text-sm font-medium">{formatTimestamp(selectedEntry.updatedAtMs)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Type</p>
                <p className="mt-2 text-sm font-medium">{selectedEntry.mimeType || "Unknown"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Size</p>
                <p className="mt-2 text-sm font-medium">{formatBytes(selectedEntry.size)}</p>
              </div>
            </div>
          </div>
        </PreviewFrame>
      );
    }

    if (preview.status === "too-large" || preview.status === "error") {
      return (
        <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {preview.status === "too-large" ? "Preview too large" : "Preview failed"}
                </p>
                <p className="text-sm text-muted-foreground">{preview.message}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You can still download the file directly.
            </p>
          </div>
        </PreviewFrame>
      );
    }

    return (
      <PreviewFrame title={previewTitle} subtitle={previewSubtitle} action={previewAction}>
        <p className="text-sm text-muted-foreground">Select a file to preview it.</p>
      </PreviewFrame>
    );
  };

  return (
    <div className="flex h-full flex-col bg-background px-4 py-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo("")}
            className="rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
          >
            {directory?.rootLabel ?? "kfd-brands"}
          </button>
          {breadcrumbs.map((segment, index) => {
            const path = breadcrumbs.slice(0, index + 1).join("/");
            return (
              <div key={path} className="flex items-center gap-2">
                <ChevronRight className="size-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => navigateTo(path)}
                  className="rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshDirectory} disabled={loadingDirectory}>
            {loadingDirectory ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadTarget()}
            disabled={Boolean(downloadingPath)}
          >
            {downloadingPath === "__root__" || downloadingPath === currentPath ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Download Folder
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1",
          isMobile ? "flex flex-col gap-4" : "grid grid-cols-[minmax(0,1fr)_420px] gap-4",
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-xl border bg-card">{renderList()}</div>
        <div className="min-h-0">{renderPreview()}</div>
      </div>
    </div>
  );
}
