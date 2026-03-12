import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ZipFile } from "yazl";

const DEFAULT_LABEL = "kfd-brands";
const DEFAULT_PREVIEW_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_DOWNLOAD_MAX_BYTES = 64 * 1024 * 1024;
const MIN_MAX_BYTES = 1024;

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const IMAGE_MIME_TYPES = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
]);

type FileBrowserPreviewKind = "markdown" | "image" | null;

type OpenClawConfig = Record<string, unknown>;

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  runtime: {
    config: {
      loadConfig: () => OpenClawConfig;
    };
  };
  registerGatewayMethod: (
    method: string,
    handler: (opts: {
      params: Record<string, unknown>;
      respond: (ok: boolean, payload?: unknown, error?: unknown) => void;
    }) => Promise<void>,
  ) => void;
};

type ResolvedPluginConfig = {
  rootPath: string;
  label: string;
  previewMaxBytes: number;
  downloadMaxBytes: number;
  hideDotfiles: boolean;
};

type ResolvedNode = {
  requestPath: string;
  ioPath: string;
  relativePath: string;
  rootRealPath: string;
  stats: Awaited<ReturnType<typeof fs.stat>>;
  kind: "file" | "directory";
};

type FileBrowserEntry = {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  size: number | null;
  updatedAtMs: number | null;
  mimeType: string | null;
  previewKind: FileBrowserPreviewKind;
};

class FileBrowserError extends Error {
  code:
    | "invalid-config"
    | "invalid-path"
    | "not-found"
    | "outside-root"
    | "not-file"
    | "not-directory"
    | "too-large";

  constructor(
    code:
      | "invalid-config"
      | "invalid-path"
      | "not-found"
      | "outside-root"
      | "not-file"
      | "not-directory"
      | "too-large",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "FileBrowserError";
  }
}

function toErrorShape(message: string) {
  return { code: "INVALID_REQUEST", message };
}

function expandHomePrefix(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  if (input === "~") {
    return home;
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(home, input.slice(2));
  }
  return input;
}

function resolveUserPath(input: string): string {
  return path.resolve(expandHomePrefix(input.trim()));
}

function ensureTrailingSep(value: string): string {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

function isPathInside(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(ensureTrailingSep(resolvedRoot))
  );
}

function normalizeRelativePath(input: unknown, options?: { allowEmpty?: boolean }): string {
  if (input === undefined || input === null || input === "") {
    if (options?.allowEmpty) {
      return "";
    }
    throw new FileBrowserError("invalid-path", "relativePath required");
  }
  if (typeof input !== "string") {
    throw new FileBrowserError("invalid-path", "relativePath must be a string");
  }
  if (input.includes("\0")) {
    throw new FileBrowserError("invalid-path", "relativePath contains invalid null bytes");
  }

  const normalized = path.normalize(input.replace(/[\\/]+/g, path.sep).trim());
  if (!normalized || normalized === "." || normalized === path.sep) {
    return "";
  }
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new FileBrowserError("invalid-path", "relativePath must stay inside the configured root");
  }
  return normalized;
}

function toApiRelativePath(value: string): string {
  return value.replace(/[\\]+/g, "/");
}

function resolveConfiguredPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(value, MIN_MAX_BYTES);
}

function resolveConfiguredBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function resolvePluginConfig(api: PluginApi): ResolvedPluginConfig {
  const rootPathValue = api.pluginConfig?.rootPath;
  if (typeof rootPathValue !== "string" || !rootPathValue.trim()) {
    throw new FileBrowserError("invalid-config", "file-browser-rpc requires pluginConfig.rootPath");
  }

  const rootPath = resolveUserPath(rootPathValue);
  return {
    rootPath,
    label:
      typeof api.pluginConfig?.label === "string" && api.pluginConfig.label.trim()
        ? api.pluginConfig.label.trim()
        : DEFAULT_LABEL,
    previewMaxBytes: resolveConfiguredPositiveInteger(
      api.pluginConfig?.previewMaxBytes,
      DEFAULT_PREVIEW_MAX_BYTES,
    ),
    downloadMaxBytes: resolveConfiguredPositiveInteger(
      api.pluginConfig?.downloadMaxBytes,
      DEFAULT_DOWNLOAD_MAX_BYTES,
    ),
    hideDotfiles: resolveConfiguredBoolean(api.pluginConfig?.hideDotfiles, true),
  };
}

function readEncoding(params: Record<string, unknown>): "utf8" | "base64" {
  const raw = params.encoding;
  if (raw === undefined || raw === null || raw === "") {
    return "utf8";
  }
  if (raw === "utf8" || raw === "base64") {
    return raw;
  }
  throw new FileBrowserError("invalid-path", 'encoding must be "utf8" or "base64"');
}

function classifyFile(name: string): {
  mimeType: string | null;
  previewKind: FileBrowserPreviewKind;
} {
  const extension = path.extname(name).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return {
      mimeType: "text/markdown",
      previewKind: "markdown",
    };
  }
  const imageMimeType = IMAGE_MIME_TYPES.get(extension);
  if (imageMimeType) {
    return {
      mimeType: imageMimeType,
      previewKind: "image",
    };
  }
  return {
    mimeType: null,
    previewKind: null,
  };
}

async function resolveRootRealPath(rootPath: string): Promise<string> {
  try {
    return await fs.realpath(rootPath);
  } catch {
    return path.resolve(rootPath);
  }
}

async function resolveNodeInsideRoot(params: {
  rootPath: string;
  relativePath: string;
}): Promise<ResolvedNode> {
  const rootRealPath = await resolveRootRealPath(params.rootPath);
  const requestPath = params.relativePath
    ? path.resolve(rootRealPath, params.relativePath)
    : rootRealPath;

  if (!isPathInside(rootRealPath, requestPath)) {
    throw new FileBrowserError("outside-root", "path escapes the configured root");
  }

  let candidateLstat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    candidateLstat = await fs.lstat(requestPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new FileBrowserError("not-found", "path not found");
    }
    throw error;
  }

  let ioPath = requestPath;
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  if (candidateLstat.isSymbolicLink()) {
    try {
      ioPath = await fs.realpath(requestPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new FileBrowserError("not-found", "path not found");
      }
      throw error;
    }
    if (!isPathInside(rootRealPath, ioPath)) {
      throw new FileBrowserError("outside-root", "symlink target escapes the configured root");
    }
    stats = await fs.stat(ioPath);
  } else {
    stats = await fs.stat(requestPath);
    ioPath = await fs.realpath(requestPath).catch(() => requestPath);
  }

  if (!isPathInside(rootRealPath, ioPath)) {
    throw new FileBrowserError("outside-root", "path escapes the configured root");
  }

  if (stats.isFile() && stats.nlink > 1) {
    throw new FileBrowserError("invalid-path", "hardlinked file path not allowed");
  }

  if (stats.isFile()) {
    return {
      requestPath,
      ioPath,
      relativePath: params.relativePath,
      rootRealPath,
      stats,
      kind: "file",
    };
  }

  if (stats.isDirectory()) {
    return {
      requestPath,
      ioPath,
      relativePath: params.relativePath,
      rootRealPath,
      stats,
      kind: "directory",
    };
  }

  throw new FileBrowserError("invalid-path", "path must point to a regular file or directory");
}

function compareEntries(left: FileBrowserEntry, right: FileBrowserEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

async function listDirectory(params: {
  config: ResolvedPluginConfig;
  relativePath: string;
}): Promise<{
  rootLabel: string;
  relativePath: string;
  parentRelativePath: string | null;
  entries: FileBrowserEntry[];
}> {
  const directoryNode = await resolveNodeInsideRoot({
    rootPath: params.config.rootPath,
    relativePath: params.relativePath,
  });
  if (directoryNode.kind !== "directory") {
    throw new FileBrowserError("not-directory", "relativePath must point to a directory");
  }

  const names = await fs.readdir(directoryNode.ioPath);
  const entries: FileBrowserEntry[] = [];

  for (const name of names) {
    if (params.config.hideDotfiles && name.startsWith(".")) {
      continue;
    }

    const childRelativePath = params.relativePath ? path.join(params.relativePath, name) : name;
    let childNode: ResolvedNode;
    try {
      childNode = await resolveNodeInsideRoot({
        rootPath: params.config.rootPath,
        relativePath: childRelativePath,
      });
    } catch (error) {
      if (error instanceof FileBrowserError) {
        continue;
      }
      throw error;
    }

    const fileInfo =
      childNode.kind === "file"
        ? classifyFile(name)
        : {
            mimeType: null,
            previewKind: null,
          };

    entries.push({
      name,
      relativePath: toApiRelativePath(childRelativePath),
      kind: childNode.kind,
      size: childNode.kind === "file" ? childNode.stats.size : null,
      updatedAtMs: Math.floor(childNode.stats.mtimeMs),
      mimeType: fileInfo.mimeType,
      previewKind: fileInfo.previewKind,
    });
  }

  entries.sort(compareEntries);
  const parentRelativePath = params.relativePath
    ? path.dirname(params.relativePath) === "."
      ? ""
      : toApiRelativePath(path.dirname(params.relativePath))
    : null;

  return {
    rootLabel: params.config.label,
    relativePath: toApiRelativePath(params.relativePath),
    parentRelativePath,
    entries,
  };
}

function encodeContent(buffer: Buffer, encoding: "utf8" | "base64"): string {
  return encoding === "base64" ? buffer.toString("base64") : buffer.toString("utf8");
}

async function readFileForPreview(params: {
  config: ResolvedPluginConfig;
  relativePath: string;
  encoding: "utf8" | "base64";
}) {
  const fileNode = await resolveNodeInsideRoot({
    rootPath: params.config.rootPath,
    relativePath: params.relativePath,
  });
  if (fileNode.kind !== "file") {
    throw new FileBrowserError("not-file", "relativePath must point to a file");
  }
  if (fileNode.stats.size > params.config.previewMaxBytes) {
    throw new FileBrowserError(
      "too-large",
      `file exceeds preview limit of ${params.config.previewMaxBytes} bytes`,
    );
  }

  const { mimeType, previewKind } = classifyFile(path.basename(fileNode.requestPath));
  const buffer = await fs.readFile(fileNode.ioPath);
  return {
    file: {
      name: path.basename(fileNode.requestPath),
      relativePath: toApiRelativePath(params.relativePath),
      size: fileNode.stats.size,
      updatedAtMs: Math.floor(fileNode.stats.mtimeMs),
      mimeType,
      previewKind,
      encoding: params.encoding,
      content: encodeContent(buffer, params.encoding),
    },
  };
}

async function addDirectoryToZip(params: {
  zipFile: ZipFile;
  config: ResolvedPluginConfig;
  relativePath: string;
  archivePrefix: string;
  visitedDirectories: Set<string>;
}) {
  const node = await resolveNodeInsideRoot({
    rootPath: params.config.rootPath,
    relativePath: params.relativePath,
  });
  if (node.kind !== "directory") {
    throw new FileBrowserError("not-directory", "relativePath must point to a directory");
  }

  if (params.visitedDirectories.has(node.ioPath)) {
    return;
  }
  params.visitedDirectories.add(node.ioPath);

  const childNames = await fs.readdir(node.ioPath);
  const visibleChildNames = params.config.hideDotfiles
    ? childNames.filter((name) => !name.startsWith("."))
    : childNames;

  if (visibleChildNames.length === 0) {
    params.zipFile.addEmptyDirectory(params.archivePrefix);
    return;
  }

  for (const name of visibleChildNames) {
    const childRelativePath = params.relativePath ? path.join(params.relativePath, name) : name;
    const archivePath = path.posix.join(params.archivePrefix, name);

    let childNode: ResolvedNode;
    try {
      childNode = await resolveNodeInsideRoot({
        rootPath: params.config.rootPath,
        relativePath: childRelativePath,
      });
    } catch (error) {
      if (error instanceof FileBrowserError) {
        continue;
      }
      throw error;
    }

    if (childNode.kind === "directory") {
      await addDirectoryToZip({
        zipFile: params.zipFile,
        config: params.config,
        relativePath: childRelativePath,
        archivePrefix: archivePath,
        visitedDirectories: params.visitedDirectories,
      });
      continue;
    }

    params.zipFile.addFile(childNode.ioPath, archivePath);
  }
}

async function zipDirectoryToBuffer(params: {
  config: ResolvedPluginConfig;
  relativePath: string;
  archiveRootName: string;
}) {
  const zipFile = new ZipFile();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  const outputPromise = new Promise<Buffer>((resolve, reject) => {
    const fail = (error: Error) => {
      zipFile.outputStream.destroy(error);
      reject(error);
    };

    zipFile.outputStream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > params.config.downloadMaxBytes) {
        fail(
          new FileBrowserError(
            "too-large",
            `archive exceeds download limit of ${params.config.downloadMaxBytes} bytes`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
    zipFile.outputStream.once("error", (error) => reject(error));
    zipFile.outputStream.once("end", () => resolve(Buffer.concat(chunks)));
  });

  await addDirectoryToZip({
    zipFile,
    config: params.config,
    relativePath: params.relativePath,
    archivePrefix: params.archiveRootName,
    visitedDirectories: new Set<string>(),
  });

  zipFile.end();
  return await outputPromise;
}

async function buildDownloadPayload(params: {
  config: ResolvedPluginConfig;
  relativePath: string;
}) {
  const node = await resolveNodeInsideRoot({
    rootPath: params.config.rootPath,
    relativePath: params.relativePath,
  });

  if (node.kind === "file") {
    if (node.stats.size > params.config.downloadMaxBytes) {
      throw new FileBrowserError(
        "too-large",
        `file exceeds download limit of ${params.config.downloadMaxBytes} bytes`,
      );
    }
    const buffer = await fs.readFile(node.ioPath);
    const fileInfo = classifyFile(path.basename(node.requestPath));
    return {
      name: path.basename(node.requestPath),
      kind: "file" as const,
      mimeType: fileInfo.mimeType || "application/octet-stream",
      encoding: "base64" as const,
      content: buffer.toString("base64"),
    };
  }

  const archiveRootName = path.basename(node.requestPath);
  const buffer = await zipDirectoryToBuffer({
    config: params.config,
    relativePath: params.relativePath,
    archiveRootName,
  });

  return {
    name: `${archiveRootName}.zip`,
    kind: "directory" as const,
    mimeType: "application/zip",
    encoding: "base64" as const,
    content: buffer.toString("base64"),
  };
}

export default function register(api: PluginApi) {
  api.registerGatewayMethod("file-browser.list", async ({ params, respond }) => {
    try {
      const config = resolvePluginConfig(api);
      const relativePath = normalizeRelativePath(params.relativePath, { allowEmpty: true });
      const result = await listDirectory({ config, relativePath });
      respond(true, result, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to list directory";
      respond(false, undefined, toErrorShape(message));
    }
  });

  api.registerGatewayMethod("file-browser.read", async ({ params, respond }) => {
    try {
      const config = resolvePluginConfig(api);
      const relativePath = normalizeRelativePath(params.relativePath);
      const encoding = readEncoding(params);
      const result = await readFileForPreview({ config, relativePath, encoding });
      respond(true, result, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to read file";
      respond(false, undefined, toErrorShape(message));
    }
  });

  api.registerGatewayMethod("file-browser.download", async ({ params, respond }) => {
    try {
      const config = resolvePluginConfig(api);
      const relativePath = normalizeRelativePath(params.relativePath, { allowEmpty: true });
      const result = await buildDownloadPayload({ config, relativePath });
      respond(true, result, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to prepare download";
      respond(false, undefined, toErrorShape(message));
    }
  });
}
