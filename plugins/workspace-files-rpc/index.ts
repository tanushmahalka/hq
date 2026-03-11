import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_AGENT_ID = "main";
const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_HARD_MAX_BYTES = 1024 * 1024;
const MIN_MAX_BYTES = 1024;
const VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

type OpenClawConfig = {
  agents?: {
    defaults?: {
      workspace?: string;
    };
    list?: Array<{
      id?: string;
      default?: boolean;
      workspace?: string;
    }>;
  };
};

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
  defaultMaxBytes: number;
  hardMaxBytes: number;
};

type WorkspaceReadErrorCode =
  | "not-found"
  | "outside-workspace"
  | "invalid-path"
  | "not-file"
  | "too-large";

class WorkspaceReadError extends Error {
  code: WorkspaceReadErrorCode;

  constructor(code: WorkspaceReadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WorkspaceReadError";
  }
}

function toErrorShape(message: string) {
  return { code: "INVALID_REQUEST", message };
}

function readRequiredString(params: Record<string, unknown>, key: string): string {
  const raw = params[key];
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`${key} required`);
  }
  return raw.trim();
}

function readOptionalPositiveInteger(
  params: Record<string, unknown>,
  key: string,
): number | undefined {
  const raw = params[key];
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return raw;
}

function resolveEncoding(params: Record<string, unknown>): "utf8" | "base64" {
  const raw = params.encoding;
  if (raw === undefined || raw === null || raw === "") {
    return "utf8";
  }
  if (raw === "utf8" || raw === "base64") {
    return raw;
  }
  throw new Error('encoding must be "utf8" or "base64"');
}

function resolveConfiguredPositiveInteger(
  value: unknown,
  fallback: number,
  options?: { minimum?: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(value, options?.minimum ?? 1);
}

function resolvePluginConfig(api: PluginApi): ResolvedPluginConfig {
  const configuredDefault = resolveConfiguredPositiveInteger(
    api.pluginConfig?.defaultMaxBytes,
    DEFAULT_MAX_BYTES,
    { minimum: MIN_MAX_BYTES },
  );
  const configuredHard = resolveConfiguredPositiveInteger(
    api.pluginConfig?.hardMaxBytes,
    DEFAULT_HARD_MAX_BYTES,
    { minimum: MIN_MAX_BYTES },
  );
  return {
    defaultMaxBytes: Math.min(configuredDefault, configuredHard),
    hardMaxBytes: configuredHard,
  };
}

function resolveMaxBytes(params: {
  request: number | undefined;
  config: ResolvedPluginConfig;
}): number {
  if (params.request === undefined) {
    return params.config.defaultMaxBytes;
  }
  if (params.request > params.config.hardMaxBytes) {
    throw new Error(
      `maxBytes exceeds configured limit of ${params.config.hardMaxBytes} bytes`,
    );
  }
  return params.request;
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

function normalizeAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_AGENT_ID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

function listAgentEntries(cfg: OpenClawConfig): Array<{ id?: string; default?: boolean; workspace?: string }> {
  return Array.isArray(cfg.agents?.list)
    ? cfg.agents!.list.filter(
        (entry): entry is { id?: string; default?: boolean; workspace?: string } =>
          Boolean(entry && typeof entry === "object"),
      )
    : [];
}

function listAgentIds(cfg: OpenClawConfig): string[] {
  const entries = listAgentEntries(cfg);
  if (entries.length === 0) {
    return [DEFAULT_AGENT_ID];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of entries) {
    const id = normalizeAgentId(entry.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [DEFAULT_AGENT_ID];
}

function resolveDefaultAgentId(cfg: OpenClawConfig): string {
  const entries = listAgentEntries(cfg);
  if (entries.length === 0) {
    return DEFAULT_AGENT_ID;
  }
  const preferred = entries.find((entry) => entry.default) ?? entries[0];
  return normalizeAgentId(preferred?.id);
}

function resolveDefaultWorkspaceDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const profile = process.env.OPENCLAW_PROFILE?.trim();
  if (profile && profile.toLowerCase() !== "default") {
    return path.join(home, ".openclaw", `workspace-${profile}`);
  }
  return path.join(home, ".openclaw", "workspace");
}

function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".openclaw");
}

function resolveAgentWorkspaceDir(cfg: OpenClawConfig, agentId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId);
  const entry = listAgentEntries(cfg).find((candidate) => normalizeAgentId(candidate.id) === normalizedAgentId);
  const configuredWorkspace = typeof entry?.workspace === "string" ? entry.workspace.trim() : "";
  if (configuredWorkspace) {
    return resolveUserPath(configuredWorkspace);
  }

  const defaultAgentId = resolveDefaultAgentId(cfg);
  if (normalizedAgentId === defaultAgentId) {
    const defaultWorkspace = cfg.agents?.defaults?.workspace?.trim();
    if (defaultWorkspace) {
      return resolveUserPath(defaultWorkspace);
    }
    return resolveDefaultWorkspaceDir();
  }

  return path.join(resolveStateDir(), `workspace-${normalizedAgentId}`);
}

function normalizeRelativePath(input: string): string {
  if (input.includes("\0")) {
    throw new Error("relativePath contains invalid null bytes");
  }
  const normalized = input.replace(/[\\/]+/g, path.sep).trim();
  if (!normalized || normalized === "." || normalized === path.sep) {
    throw new Error("relativePath required");
  }
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error("relativePath must be workspace-relative");
  }
  return normalized;
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

async function resolveWorkspaceRealPath(workspaceDir: string): Promise<string> {
  try {
    return await fs.realpath(workspaceDir);
  } catch {
    return path.resolve(workspaceDir);
  }
}

async function resolveReadableWorkspaceFile(params: {
  workspaceDir: string;
  relativePath: string;
}): Promise<{ absolutePath: string; ioPath: string }> {
  const workspaceReal = await resolveWorkspaceRealPath(params.workspaceDir);
  const absolutePath = path.resolve(workspaceReal, params.relativePath);

  if (!isPathInside(workspaceReal, absolutePath)) {
    throw new WorkspaceReadError("outside-workspace", "file is outside workspace root");
  }

  let candidateLstat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    candidateLstat = await fs.lstat(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new WorkspaceReadError("not-found", "file not found");
    }
    throw error;
  }

  if (candidateLstat.isSymbolicLink()) {
    let targetReal: string;
    try {
      targetReal = await fs.realpath(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new WorkspaceReadError("not-found", "file not found");
      }
      throw error;
    }
    if (!isPathInside(workspaceReal, targetReal)) {
      throw new WorkspaceReadError("outside-workspace", "file is outside workspace root");
    }
    const targetStat = await fs.stat(targetReal).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new WorkspaceReadError("not-found", "file not found");
      }
      throw error;
    });
    if (!targetStat.isFile()) {
      throw new WorkspaceReadError("not-file", "path is not a regular file");
    }
    if (targetStat.nlink > 1) {
      throw new WorkspaceReadError("invalid-path", "hardlinked file path not allowed");
    }
    return { absolutePath, ioPath: targetReal };
  }

  if (!candidateLstat.isFile()) {
    throw new WorkspaceReadError("not-file", "path is not a regular file");
  }
  if (candidateLstat.nlink > 1) {
    throw new WorkspaceReadError("invalid-path", "hardlinked file path not allowed");
  }

  const ioPath = await fs.realpath(absolutePath).catch(() => absolutePath);
  if (!isPathInside(workspaceReal, ioPath)) {
    throw new WorkspaceReadError("outside-workspace", "file is outside workspace root");
  }
  return { absolutePath, ioPath };
}

async function readWorkspaceFile(params: {
  workspaceDir: string;
  relativePath: string;
  maxBytes: number;
}): Promise<{
  absolutePath: string;
  size: number;
  updatedAtMs: number;
  buffer: Buffer;
}> {
  const resolved = await resolveReadableWorkspaceFile(params);
  const stat = await fs.stat(resolved.ioPath);
  if (!stat.isFile()) {
    throw new WorkspaceReadError("not-file", "path is not a regular file");
  }
  if (stat.size > params.maxBytes) {
    throw new WorkspaceReadError(
      "too-large",
      `file exceeds limit of ${params.maxBytes} bytes (got ${stat.size})`,
    );
  }
  const buffer = await fs.readFile(resolved.ioPath);
  return {
    absolutePath: resolved.absolutePath,
    size: stat.size,
    updatedAtMs: Math.floor(stat.mtimeMs),
    buffer,
  };
}

function encodeContent(buffer: Buffer, encoding: "utf8" | "base64"): string {
  return encoding === "base64" ? buffer.toString("base64") : buffer.toString("utf8");
}

function resolveAgentWorkspace(params: { api: PluginApi; rawAgentId: string }) {
  const cfg = params.api.runtime.config.loadConfig();
  const agentId = normalizeAgentId(params.rawAgentId);
  const knownAgents = new Set(listAgentIds(cfg));
  if (!knownAgents.has(agentId)) {
    throw new Error(`unknown agent id "${agentId}"`);
  }
  return {
    agentId,
    workspaceDir: resolveAgentWorkspaceDir(cfg, agentId),
  };
}

export default function register(api: PluginApi) {
  api.registerGatewayMethod("workspace-files.read", async ({ params, respond }) => {
    const pluginConfig = resolvePluginConfig(api);

    let agentId = "";
    let workspaceDir = "";
    let relativePath = "";
    let absolutePath = "";
    let encoding: "utf8" | "base64" = "utf8";

    try {
      const rawAgentId = readRequiredString(params, "agentId");
      relativePath = normalizeRelativePath(readRequiredString(params, "relativePath"));
      encoding = resolveEncoding(params);
      const maxBytes = resolveMaxBytes({
        request: readOptionalPositiveInteger(params, "maxBytes"),
        config: pluginConfig,
      });

      const resolvedAgent = resolveAgentWorkspace({ api, rawAgentId });
      agentId = resolvedAgent.agentId;
      workspaceDir = resolvedAgent.workspaceDir;

      const file = await readWorkspaceFile({
        workspaceDir,
        relativePath,
        maxBytes,
      });
      absolutePath = file.absolutePath;

      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          file: {
            path: absolutePath,
            relativePath,
            missing: false,
            size: file.size,
            updatedAtMs: file.updatedAtMs,
            encoding,
            content: encodeContent(file.buffer, encoding),
          },
        },
        undefined,
      );
      return;
    } catch (error) {
      if (error instanceof WorkspaceReadError && error.code === "not-found") {
        if (!absolutePath && workspaceDir && relativePath) {
          absolutePath = path.resolve(workspaceDir, relativePath);
        }
        respond(
          true,
          {
            ok: true,
            agentId,
            workspace: workspaceDir,
            file: {
              path: absolutePath,
              relativePath,
              missing: true,
            },
          },
          undefined,
        );
        return;
      }

      const message = error instanceof Error ? error.message : "failed to read workspace file";
      respond(false, undefined, toErrorShape(message));
    }
  });
}
